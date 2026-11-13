import { SignJWT } from "jose";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const response = (data, status=200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const cors = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Vary": "Origin" } : {};
};
function pemBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return Uint8Array.from(atob(body), c=>c.charCodeAt(0));
}
async function googleAccessToken(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(sa.private_key), { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now()/1000);
  const assertion = await new SignJWT({ scope:"https://www.googleapis.com/auth/datastore" })
    .setProtectedHeader({ alg:"RS256", typ:"JWT" }).setIssuer(sa.client_email)
    .setSubject(sa.client_email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now+3600).sign(key);
  const r = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const j=await r.json(); if(!r.ok) throw new Error("Google service authentication failed"); return j.access_token;
}
async function verifyFirebase(idToken, env) {
  const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idToken})});
  const j=await r.json(); if(!r.ok||!j.users?.[0]) throw new Error("Sign in again to continue");
  return j.users[0];
}
async function firestore(env, path, token, options={}) {
  const url="https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/"+path;
  const r=await fetch(url,{...options,headers:{Authorization:"Bearer "+token,...(options.headers||{})}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) { if(r.status===404)return null; throw new Error("Unable to read billing records"); }
  return j;
}
function val(fields,key){const x=fields?.[key]; if(!x)return null; return x.stringValue??x.integerValue??x.booleanValue??x.timestampValue??null}
function fsFields(obj){return {fields:Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,typeof v==="number"?{integerValue:String(v)}:typeof v==="boolean"?{booleanValue:v}:v===null?{nullValue:null}:{stringValue:String(v)}]))}}
async function ownerContext(request,env){
  const auth=request.headers.get("Authorization")||"", token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)throw new Error("Sign in to access billing");
  const user=await verifyFirebase(token,env), access=await googleAccessToken(env);
  const profile=await firestore(env,"users/"+user.localId,access);
  const f=profile?.fields||{};
  const role=val(f,"role"), institutionId=val(f,"institutionId");
  if(role!=="owner"||!institutionId)throw new Error("Only the institution owner can manage subscription payments");
  const institution=await firestore(env,"institutions/"+institutionId,access);
  if(!institution)throw new Error("Institution record not found");
  return {uid:user.localId,institutionId,access,institution};
}
async function activeStudents(ctx,env){
  let next="", count=0, docs=[];
  do {
    const url="https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/institutions/"+ctx.institutionId+"/students?pageSize=1000"+(next?"&pageToken="+encodeURIComponent(next):"");
    const r=await fetch(url,{headers:{Authorization:"Bearer "+ctx.access}});
    const j=await r.json(); if(!r.ok)throw new Error("Could not calculate registered student count");
    for(const d of (j.documents||[])){if(val(d.fields,"status")==="active"){count++;docs.push(d);}}
    next=j.nextPageToken||"";
  } while(next);
  return {count,docs};
}
function millis(timestamp){return timestamp?Date.parse(timestamp):0}
function summaryData(institution, count){
  const f=institution.fields||{}, sub=f.subscription?.mapValue?.fields||{};
  const trialStart=val(sub,"trialStartedAt"),trialEnd=val(sub,"trialEndsAt"),status=val(sub,"status")||"trial";
  const renewal=val(sub,"renewalAt"),paidThrough=val(sub,"paidThrough");
  const now=Date.now(), trialActive=trialEnd&&millis(trialEnd)>now;
  return {institutionName:val(f,"name")||"Institution",studentCount:count,rate:250,currency:"UGX",status:trialActive?"trial":status,trialStartedAt:trialStart,trialEndsAt:trialEnd,trialDaysRemaining:trialActive?Math.ceil((millis(trialEnd)-now)/86400000):0,renewalAt:renewal,paidThrough,amountDue:count*250};
}
async function saveInstitution(ctx,env,patch){
  const token=ctx.access, id=ctx.institutionId;
  const fields={...(ctx.institution.fields||{}),subscription:{mapValue:{fields:Object.fromEntries(Object.entries(patch).map(([k,v])=>[k,typeof v==="number"?{integerValue:String(v)}:v===null?{nullValue:null}:{stringValue:String(v)}]))}}};
  return firestore(env,"institutions/"+id+"?updateMask.fieldPaths=subscription",token,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({fields:{subscription:fields.subscription}})});
}
async function createCheckout(ctx,env){
  const {count}=await activeStudents(ctx,env);
  if(count<1)throw new Error("There are no active registered students to bill");
  const sub=ctx.institution.fields?.subscription?.mapValue?.fields||{};
  const status=val(sub,"status")||"trial", paidThrough=val(sub,"paidThrough"), renewalAt=val(sub,"renewalAt");
  const now=Date.now();
  if(paidThrough&&millis(paidThrough)>now)throw new Error("Your current subscription is already paid. New-student billing will be enabled in the next billing update.");
  const amount=count*250;
  const externalId="IC-"+ctx.institutionId+"-"+crypto.randomUUID();
  const origin=env.PUBLIC_APP_URL||"https://jowi-biz-os.web.app";
  const payload={amount,currency:"UGX",customer_name:val(ctx.institution.fields,"name")||"InterCampus institution",redirect_url:origin,return_url:origin,cancel_redirect_url:origin,metadata:{institutionId:ctx.institutionId,ownerUid:ctx.uid,studentCount:count,rate:250,product:"InterCampus monthly subscription"},external_order_id:externalId,idempotency_key:externalId};
  const r=await fetch("https://api.jjuma.com/api/v1/payments/create",{method:"POST",headers:{Authorization:"Bearer "+env.JJUMA_SECRET_KEY,"content-type":"application/json"},body:JSON.stringify(payload)});
  const j=await r.json(); if(!r.ok||!j.payment_url||!j.transaction_id)throw new Error("JJuma could not create the checkout. Try again later.");
  const token=ctx.access;
  await firestore(env,"institutions/"+ctx.institutionId+"/billingPayments/"+j.transaction_id,token,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(fsFields({transactionId:j.transaction_id,reference:j.reference||"",externalOrderId:externalId,amount,currency:"UGX",studentCount:count,status:"pending",createdAt:new Date().toISOString()}))});
  await firestore(env,"billingTransactions/"+j.transaction_id,token,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(fsFields({institutionId:ctx.institutionId,transactionId:j.transaction_id,status:"pending"}))});
  return {paymentUrl:j.payment_url,transactionId:j.transaction_id,amount,studentCount:count};
}
async function webhook(request,env){
  const raw=await request.text(), signature=request.headers.get("X-Jjuma-Signature")||"", stamp=request.headers.get("X-Jjuma-Timestamp")||"";
  if(!env.JJUMA_WEBHOOK_SECRET||!signature||!stamp) return response({error:"Invalid webhook"},401);
  if(Math.abs(Date.now()/1000-Number(stamp))>300)return response({error:"Expired webhook"},401);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.JJUMA_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(stamp+"."+raw)));
  const hex=[...signed].map(x=>x.toString(16).padStart(2,"0")).join("");
  if(hex!==signature.replace(/^sha256=/,""))return response({error:"Invalid signature"},401);
  const event=JSON.parse(raw), data=event.data||event, transactionId=data.transaction_id||data.id;
  if(!transactionId)return response({received:true});
  if(!["payment.completed","payment.success"].includes(request.headers.get("X-Jjuma-Event")||event.event))return response({received:true});
  const access=await googleAccessToken(env);
  const tx=await firestore(env,"institutions/"+data.metadata?.institutionId+"/billingPayments/"+transactionId,access);
  if(!tx)return response({received:true});
  if(val(tx.fields,"status")==="paid")return response({received:true,duplicate:true});
  const payment=await fetch("https://api.jjuma.com/api/v1/payments/verify/"+encodeURIComponent(transactionId),{headers:{Authorization:"Bearer "+env.JJUMA_SECRET_KEY}});
  const verified=await payment.json();
  if(!payment.ok||!["completed","success","paid"].includes(String(verified.status||verified.data?.status||"").toLowerCase()))return response({error:"Payment not verified"},400);
  const now=new Date(), renewal=new Date(now); const day=renewal.getDate(); renewal.setDate(1); renewal.setMonth(renewal.getMonth()+1); const lastDay=new Date(renewal.getFullYear(),renewal.getMonth()+1,0).getDate(); renewal.setDate(Math.min(day,lastDay));
  await firestore(env,"institutions/"+institutionId+"/billingPayments/"+transactionId,access,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(fsFields({transactionId,status:"paid",verifiedAt:now.toISOString(),amount:Number(val(tx.fields,"amount")||0),studentCount:Number(val(tx.fields,"studentCount")||0)}))});
  const inst=await firestore(env,"institutions/"+institutionId,access);
  const current=inst.fields||{};
  const fields={...current,subscription:{mapValue:{fields:{status:{stringValue:"active"},lastPaymentAt:{stringValue:now.toISOString()},renewalAt:{stringValue:renewal.toISOString()},paidThrough:{stringValue:renewal.toISOString()},lastPaidStudentCount:{integerValue:String(val(tx.fields,"studentCount")||0)},lastTransactionId:{stringValue:transactionId}}}}};
  await firestore(env,"institutions/"+institutionId+"?updateMask.fieldPaths=subscription",access,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({fields:{subscription:fields.subscription}})});
  return response({received:true});
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...cors(request,env)}});
  if(url.pathname==="/webhooks/jjuma"&&request.method==="POST")return webhook(request,env);
  if(url.pathname==="/health")return response({ok:true,service:"InterCampus billing"});
  const headers={...JSON_HEADERS,...cors(request,env)};
  try{
    if(!["GET","POST"].includes(request.method))return response({error:"Method not allowed"},405);
    const ctx=await ownerContext(request,env);
    if(url.pathname==="/billing/summary"&&request.method==="GET"){
      const {count}=await activeStudents(ctx,env);
      const data=summaryData(ctx.institution,count);
      
      return new Response(JSON.stringify(data),{headers});
    }
    if(url.pathname==="/billing/checkout"&&request.method==="POST"){
      const result=await createCheckout(ctx,env);
      return new Response(JSON.stringify(result),{headers});
    }
    return response({error:"Not found"},404);
  }catch(e){return new Response(JSON.stringify({error:e.message||"Billing request failed"}),{status:400,headers});}
}};
