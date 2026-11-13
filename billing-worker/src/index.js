const JSON_HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...headers}});
const encoder = new TextEncoder();
const iso = value => value ? new Date(value).toISOString() : null;
const addCalendarMonth = value => { const d=new Date(value), day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+1); d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate())); return d; };
const money = n => Math.max(0,Math.ceil(Number(n)||0));
function cors(request,env){const origin=request.headers.get("Origin")||"",allowed=(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);return allowed.includes(origin)?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type","Vary":"Origin"}:{};}
function field(fields,key){const v=fields?.[key];return v?.stringValue??v?.integerValue??v?.booleanValue??v?.timestampValue??null;}

let googleTokenCache = null;
function base64url(value) {
 const bytes = typeof value === "string" ? encoder.encode(value) : value;
 let binary = "";
 for (let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
 return btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
async function googleAccessToken(env) {
 if (googleTokenCache && googleTokenCache.expiresAt>Date.now()+60000) return googleTokenCache.token;
 if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("Firebase billing entitlement credential is not configured.");
 let account;
 try { account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new Error("Firebase billing entitlement credential is invalid JSON."); }
 if (!account.client_email || !account.private_key || account.project_id!==env.FIREBASE_PROJECT_ID) throw new Error("Firebase billing entitlement credential does not match the configured Firebase project.");
 const pem=account.private_key.replaceAll("-----BEGIN PRIVATE KEY-----","").replaceAll("-----END PRIVATE KEY-----","").replaceAll("\n","").replaceAll("\r","");
 const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const now=Math.floor(Date.now()/1000);
 const unsigned=base64url(JSON.stringify({alg:"RS256",typ:"JWT"}))+"."+base64url(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/datastore",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
 const signature=new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,encoder.encode(unsigned)));
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+base64url(signature)})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token) throw new Error("Could not authenticate the billing service with Firebase.");
 googleTokenCache={token:data.access_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000};
 return data.access_token;
}
async function syncEntitlement(institutionId,sub,env) {
 const now=Date.now(),trialEnd=Number(sub?.trial_ends_at||0),paidThrough=Number(sub?.paid_through||0);
 const trialActive=sub?.status==="trial"&&trialEnd>now,paidActive=sub?.status==="active"&&paidThrough>now;
 const canOpen=trialActive||paidActive,until=trialActive?trialEnd:paidActive?paidThrough:0;
 const untilIso=until?new Date(until).toISOString():null;
 const token=await googleAccessToken(env);
 const base="https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/institutions/"+encodeURIComponent(institutionId)+"/members";
 let pageToken="";
 do {
  const listUrl=new URL(base);listUrl.searchParams.set("pageSize","1000");if(pageToken)listUrl.searchParams.set("pageToken",pageToken);
  const listed=await fetch(listUrl,{headers:{Authorization:"Bearer "+token}}),data=await listed.json().catch(()=>({}));
  if(!listed.ok)throw new Error("Could not read institution membership for billing access synchronization ("+listed.status+").");
  for(const member of data.documents||[]){
   const fields=member.fields||{},currentAllowed=fields.billingCanOpenSessions?.booleanValue,currentUntil=fields.billingAccessUntil?.timestampValue||null;
   if(currentAllowed===canOpen&&currentUntil===untilIso)continue;
   const uid=member.name.split("/").pop(),patchUrl=new URL(base+"/"+encodeURIComponent(uid));
   patchUrl.searchParams.append("updateMask.fieldPaths","billingCanOpenSessions");
   patchUrl.searchParams.append("updateMask.fieldPaths","billingAccessUntil");
   const patched=await fetch(patchUrl,{method:"PATCH",headers:{Authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({fields:{billingCanOpenSessions:{booleanValue:canOpen},billingAccessUntil:untilIso?{timestampValue:untilIso}:{nullValue:null}}})});
   if(!patched.ok)throw new Error("Could not synchronize billing access for an institution member ("+patched.status+").");
  }
  pageToken=data.nextPageToken||"";
 } while(pageToken);
 return {canOpenSessions:canOpen,status:trialActive?"trial":paidActive?"active":"payment_required",accessUntil:untilIso};
}
async function firebaseUser(token,env){const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idToken:token})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.users?.[0])throw new Error("Your sign-in has expired. Sign in again.");return j.users[0];}
async function firestoreRead(path,token,env){const url="https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/"+path;const r=await fetch(url,{headers:{Authorization:"Bearer "+token}});const j=await r.json().catch(()=>({}));if(r.status===404)return null;if(!r.ok)throw new Error("Your account is not permitted to read the institution billing data.");return j;}
async function ownerContext(request,env){const auth=request.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";if(!token)throw new Error("Sign in to access billing.");const user=await firebaseUser(token,env),uid=user.localId;const profile=await firestoreRead("users/"+uid,token,env),pf=profile?.fields||{};const institutionId=field(pf,"institutionId");if(field(pf,"role")!=="owner"||!institutionId||field(pf,"status")!=="active")throw new Error("Only the active institution owner can manage subscription payments.");const institution=await firestoreRead("institutions/"+institutionId,token,env);if(!institution||field(institution.fields,"ownerId")!==uid)throw new Error("Institution ownership could not be verified.");const member=await firestoreRead("institutions/"+institutionId+"/members/"+uid,token,env);if(!member||field(member.fields,"role")!=="owner"||field(member.fields,"status")!=="active")throw new Error("Your institution owner access is not active.");return {uid,institutionId,token,institution};}
async function activeStudentCount(ctx,env){let pageToken="",count=0;do{const url=new URL("https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/institutions/"+ctx.institutionId+"/students");url.searchParams.set("pageSize","1000");if(pageToken)url.searchParams.set("pageToken",pageToken);const r=await fetch(url,{headers:{Authorization:"Bearer "+ctx.token}}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error("Could not securely count active registered students. Check owner access to the student register.");for(const doc of j.documents||[])if(field(doc.fields,"status")==="active")count++;pageToken=j.nextPageToken||"";}while(pageToken);return count;}
async function subscription(ctx,env){let row=await env.DB.prepare("SELECT * FROM subscriptions WHERE institution_id=?").bind(ctx.institutionId).first();if(row)return row;const created=ctx.institution.fields?.createdAt?.timestampValue;const createdMs=created?Date.parse(created):0;const rollout=Date.parse(env.BILLING_ROLLOUT_AT||"2026-11-13T00:00:00.000Z");const trialStart=createdMs>=rollout?createdMs:0;const trialEnd=trialStart?trialStart+14*86400000:0;const status=trialEnd>Date.now()?"trial":"payment_required";await env.DB.prepare("INSERT OR IGNORE INTO subscriptions (institution_id,status,trial_started_at,trial_ends_at,paid_student_count,created_at,updated_at) VALUES (?,?,?,?,0,?,?)").bind(ctx.institutionId,status,trialStart||null,trialEnd||null,Date.now(),Date.now()).run();return await env.DB.prepare("SELECT * FROM subscriptions WHERE institution_id=?").bind(ctx.institutionId).first();}
async function outstandingSeatBatch(ctx,sub,count,now,env){
 const paid=Number(sub.paid_student_count||0);
 if(count<=paid)return null;
 const pending=await env.DB.prepare("SELECT COALESCE(SUM(seat_count),0) AS seats FROM seat_grace_batches WHERE institution_id=? AND status='grace'").bind(ctx.institutionId).first();
 const unbatched=Math.max(0,count-paid-Number(pending?.seats||0));
 if(unbatched>0){
  const created=now,ends=now+7*86400000,id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO seat_grace_batches (id,institution_id,seat_count,grace_started_at,grace_ends_at,status,created_at) VALUES (?,?,?,?,?,'grace',?)").bind(id,ctx.institutionId,unbatched,created,ends,created).run();
 }
 return await env.DB.prepare("SELECT * FROM seat_grace_batches WHERE institution_id=? AND status='grace' ORDER BY created_at DESC LIMIT 1").bind(ctx.institutionId).first();
}
let ugxUsdRateCache=null;
async function getUgxUsdRate(env){
 if(ugxUsdRateCache&&ugxUsdRateCache.expiresAt>Date.now())return ugxUsdRateCache;
 const r=await fetch("https://open.er-api.com/v6/latest/UGX",{headers:{"accept":"application/json"}}),j=await r.json().catch(()=>({}));
 const rate=Number(j.rates?.USD),updated=Number(j.time_last_update_unix||0)*1000;
 if(!r.ok||j.result!=="success"||!Number.isFinite(rate)||rate<=0||!updated||Date.now()-updated>48*60*60*1000)throw new Error("The live UGX-to-USD exchange rate is temporarily unavailable. Please try again later or choose UGX.");
 ugxUsdRateCache={rate,updatedAt:new Date(updated).toISOString(),expiresAt:Date.now()+6*60*60*1000};return ugxUsdRateCache;
}
function toUsd(ugx,rate){return Math.max(0,Math.round((Number(ugx||0)*Number(rate)*100)+1e-8)/100);}
async function summaryData(ctx,env){const now=Date.now();await env.DB.prepare("UPDATE billing_transactions SET status='failed',payment_url=NULL WHERE institution_id=? AND status IN ('initiating','pending') AND created_at<=?").bind(ctx.institutionId,now-3*60*1000).run();const count=await activeStudentCount(ctx,env),sub=await subscription(ctx,env),batch=await outstandingSeatBatch(ctx,sub,count,now,env);const paidThrough=Number(sub.paid_through||0),trialEnd=Number(sub.trial_ends_at||0),trialActive=sub.status==="trial"&&trialEnd>now,paidActive=sub.status==="active"&&paidThrough>now;let amountDue=0,billingType="initial";if(trialActive)amountDue=0;else if(paidActive&&count>Number(sub.paid_student_count||0)){billingType="additional_seats";const remaining=paidThrough-now,period=Math.max(1,paidThrough-Number(sub.period_started_at||now));amountDue=money((count-Number(sub.paid_student_count||0))*250*remaining/period);}else if(!paidActive){amountDue=count*250;}const history=await env.DB.prepare("SELECT transaction_id,reference,amount,currency,student_count,status,created_at,paid_at FROM billing_transactions WHERE institution_id=? ORDER BY created_at DESC LIMIT 20").bind(ctx.institutionId).all();let fx=null;try{fx=await getUgxUsdRate(env);}catch(error){console.error("USD exchange rate unavailable",error?.message||error);}return {institutionName:field(ctx.institution.fields,"name")||"Institution",studentCount:count,rate:250,currency:"UGX",status:trialActive?"trial":paidActive?"active":(sub.status==="active"||sub.status==="trial")?"expired":sub.status,trialStartedAt:iso(sub.trial_started_at),trialEndsAt:iso(trialEnd),trialDaysRemaining:trialActive?Math.ceil((trialEnd-now)/86400000):0,renewalAt:iso(paidThrough),paidThrough:iso(paidThrough),paidStudentCount:Number(sub.paid_student_count||0),additionalUnpaidStudents:Math.max(0,count-Number(sub.paid_student_count||0)),graceEndsAt:iso(batch?.grace_ends_at),amountDue,upcomingMonthlyAmount:count*250,usdAmountDue:fx?toUsd(amountDue,fx.rate):null,usdUpcomingMonthlyAmount:fx?toUsd(count*250,fx.rate):null,exchangeRateUgxToUsd:fx?.rate||null,exchangeRateUpdatedAt:fx?.updatedAt||null,billingType,paymentHistory:(history.results||[]).map(x=>({...x,createdAt:iso(x.created_at),paidAt:iso(x.paid_at)}))};}
async function summary(ctx,env){const result=await summaryData(ctx,env);const sub=await subscription(ctx,env);await syncEntitlement(ctx.institutionId,sub,env);return result;}
async function checkout(ctx,env,requestedCurrency="UGX"){
 const currency=String(requestedCurrency||"UGX").toUpperCase();if(!["UGX","USD"].includes(currency))throw new Error("Choose UGX or USD for this checkout.");
 const count=await activeStudentCount(ctx,env);if(count<1)throw new Error("There are no active registered students to bill.");
 const sub=await subscription(ctx,env),now=Date.now(),paidThrough=Number(sub.paid_through||0),paidActive=sub.status==="active"&&paidThrough>now;
 // Close abandoned checkouts after three minutes so a fresh payment can be started.
 await env.DB.prepare("UPDATE billing_transactions SET status='failed',payment_url=NULL WHERE institution_id=? AND status IN ('initiating','pending') AND created_at<=?").bind(ctx.institutionId,now-3*60*1000).run();
 const pending=await env.DB.prepare("SELECT id FROM billing_transactions WHERE institution_id=? AND status IN ('initiating','pending') LIMIT 1").bind(ctx.institutionId).first();
 if(pending)throw new Error("A payment is already pending for this institution. Complete that JJuma checkout before starting another.");
 let amount=count*250,type="initial",renewalAt=null,allocations=[];
 if(paidActive){
  const paidCount=Number(sub.paid_student_count||0),newSeats=count-paidCount;
  if(newSeats<=0)throw new Error("There are no additional unpaid students. Your current subscription is up to date.");
  await outstandingSeatBatch(ctx,sub,count,now,env);
  const batches=await env.DB.prepare("SELECT id,seat_count FROM seat_grace_batches WHERE institution_id=? AND status='grace' ORDER BY created_at ASC,id ASC").bind(ctx.institutionId).all();
  let remaining=newSeats;
  for(const batch of batches.results||[]){
   const allocated=Math.min(remaining,Number(batch.seat_count||0));
   if(allocated>0){allocations.push({id:batch.id,seatCount:allocated});remaining-=allocated;}
   if(remaining===0)break;
  }
  if(remaining>0)throw new Error("The additional student grace ledger could not be matched to the checkout. Refresh the billing page and try again.");
  const periodStart=Number(sub.period_started_at||now),remainingMs=paidThrough-now,period=Math.max(1,paidThrough-periodStart);
  amount=money(newSeats*250*remainingMs/period);type="additional_seats";renewalAt=paidThrough;
 }
 const baseAmountUgx=amount;let exchangeRate=null;if(currency==="USD"){const fx=await getUgxUsdRate(env);exchangeRate=fx.rate;amount=toUsd(baseAmountUgx,exchangeRate);if(amount<0.01)throw new Error("The converted USD amount is below the minimum supported checkout amount.");}
 if(amount<1&&currency==="UGX")throw new Error("The calculated amount is zero. Contact support before retrying.");
 if(!env.JJUMA_PUBLIC_KEY)throw new Error("JJuma public API key is not configured on the billing service.");
 const id=crypto.randomUUID(),external="IC-"+ctx.institutionId+"-"+id;
 await env.DB.prepare("INSERT INTO billing_transactions (id,institution_id,external_order_id,amount,currency,base_amount_ugx,exchange_rate,student_count,seat_count,billing_type,seat_batch_allocations,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'initiating',?)").bind(id,ctx.institutionId,external,amount,currency,baseAmountUgx,exchangeRate,count,paidActive?count-Number(sub.paid_student_count||0):count,type,JSON.stringify(allocations),now).run();
 const origin=env.PUBLIC_APP_URL||"https://jowi-biz-os.web.app";
 const payload={amount,currency,customer_name:field(ctx.institution.fields,"name")||"InterCampus institution",redirect_url:origin,return_url:origin,cancel_redirect_url:origin,metadata:{product:"InterCampus subscription",institutionId:ctx.institutionId,transactionKey:id,studentCount:count,billingType:type,baseAmountUgx,exchangeRate},external_order_id:external,idempotency_key:external};
 const r=await fetch("https://api.jjuma.com/api/v1/payments/create",{method:"POST",headers:{Authorization:"Bearer "+env.JJUMA_PUBLIC_KEY,"content-type":"application/json","accept":"application/json"},body:JSON.stringify(payload)}),j=await r.json().catch(()=>({})),payment=j.data||j;
 if(!r.ok||!payment.payment_url||!payment.transaction_id){await env.DB.prepare("UPDATE billing_transactions SET status='failed' WHERE id=?").bind(id).run();const reason=typeof j.message==="string"?j.message:typeof j.error==="string"?j.error:"Please check the JJuma public API key and merchant verification.";throw new Error("JJuma rejected checkout: "+reason);}
 await env.DB.prepare("UPDATE billing_transactions SET transaction_id=?,reference=?,payment_url=?,status='pending' WHERE id=?").bind(String(payment.transaction_id),String(payment.reference||""),String(payment.payment_url),id).run();
 return {paymentUrl:payment.payment_url,transactionId:payment.transaction_id,amount,currency,baseAmountUgx,exchangeRate,studentCount:count,billingType:type};
}
function constantTimeEqual(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function webhook(request,env){if(!env.JJUMA_WEBHOOK_SECRET||!env.JJUMA_SECRET_KEY)return json({error:"Webhook is not configured"},503);const raw=await request.text(),sig=request.headers.get("X-Jjuma-Signature")||"",stamp=request.headers.get("X-Jjuma-Timestamp")||"";const stampMs=/^\d+(?:\.\d+)?$/.test(stamp)?(Number(stamp)<1e12?Number(stamp)*1000:Number(stamp)):Date.parse(stamp);if(!sig||!stamp||!Number.isFinite(stampMs)||Math.abs(Date.now()-stampMs)>300000)return json({error:"Invalid or expired webhook"},401);const key=await crypto.subtle.importKey("raw",encoder.encode(env.JJUMA_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]),mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(stamp+"."+raw))),hex=[...mac].map(b=>b.toString(16).padStart(2,"0")).join("");if(!constantTimeEqual(hex,sig.trim().replace(/^sha256=/i,"")))return json({error:"Invalid webhook signature"},401);let event;try{event=JSON.parse(raw);}catch{return json({error:"Invalid JSON"},400);}const eventName=request.headers.get("X-Jjuma-Event")||event.event||"",data=event.data||event,txid=String(data.transaction_id||data.id||"");if(!txid)return json({received:true});const delivery=request.headers.get("X-Jjuma-Delivery-Id")||crypto.randomUUID();if(!["payment.completed","payment.success"].includes(eventName)){if(txid&&["payment.failed","payment.cancelled"].includes(eventName)){const state=eventName==="payment.failed"?"failed":"cancelled";await env.DB.prepare("UPDATE billing_transactions SET status=? WHERE transaction_id=? AND status IN ('pending','initiating')").bind(state,txid).run();}try{await env.DB.prepare("INSERT OR IGNORE INTO webhook_events (delivery_id,event_name,received_at) VALUES (?,?,?)").bind(delivery,eventName,Date.now()).run();}catch{}return json({received:true});}const seen=await env.DB.prepare("SELECT delivery_id FROM webhook_events WHERE delivery_id=?").bind(delivery).first();if(seen)return json({received:true,duplicate:true});const tx=await env.DB.prepare("SELECT * FROM billing_transactions WHERE transaction_id=?").bind(txid).first();if(!tx)return json({received:true,unmatched:true});if(tx.status==="paid")return json({received:true,duplicate:true});const verify=await fetch("https://api.jjuma.com/api/v1/payments/verify/"+encodeURIComponent(txid),{headers:{Authorization:"Bearer "+env.JJUMA_SECRET_KEY}}),verified=await verify.json().catch(()=>({})),vdata=verified.data||verified,status=String(vdata.status||verified.status||"").toLowerCase(),verifiedAmount=Number(vdata.amount??verified.amount??tx.amount),verifiedCurrency=String(vdata.currency??verified.currency??tx.currency??"UGX").toUpperCase();if(!verify.ok||!["completed","success","paid"].includes(status)||Math.abs(verifiedAmount-Number(tx.amount))>0.005||verifiedCurrency!==String(tx.currency||"UGX").toUpperCase())return json({error:"JJuma payment could not be verified against the expected amount."},400);const now=Date.now(),sub=await env.DB.prepare("SELECT * FROM subscriptions WHERE institution_id=?").bind(tx.institution_id).first();if(!sub)return json({error:"Subscription record not found"},409);if(tx.billing_type==="additional_seats"){let allocations=[];try{allocations=JSON.parse(tx.seat_batch_allocations||"[]");}catch{}if(!Array.isArray(allocations)||!allocations.length||allocations.reduce((n,x)=>n+Number(x.seatCount||0),0)!==Number(tx.seat_count))return json({error:"The checkout seat allocation could not be verified. Contact support before retrying."},409);const checks=await Promise.all(allocations.map(x=>env.DB.prepare("SELECT seat_count FROM seat_grace_batches WHERE id=? AND institution_id=? AND status='grace'").bind(x.id,tx.institution_id).first()));if(checks.some((row,i)=>!row||Number(row.seat_count)<Number(allocations[i].seatCount)))return json({error:"The checkout seat allocation has changed. Contact support for reconciliation."},409);const statements=allocations.map(x=>env.DB.prepare("UPDATE seat_grace_batches SET seat_count=seat_count-?,status=CASE WHEN seat_count=? THEN 'paid' ELSE 'grace' END WHERE id=? AND institution_id=? AND status='grace' AND seat_count>=?").bind(Number(x.seatCount),Number(x.seatCount),x.id,tx.institution_id,Number(x.seatCount)));statements.push(env.DB.prepare("UPDATE subscriptions SET paid_student_count=?,updated_at=? WHERE institution_id=?").bind(tx.student_count,now,tx.institution_id));await env.DB.batch(statements);}else{const start=now,end=addCalendarMonth(now).getTime();await env.DB.prepare("UPDATE subscriptions SET status='active',period_started_at=?,paid_through=?,paid_student_count=?,last_payment_at=?,updated_at=? WHERE institution_id=?").bind(start,end,tx.student_count,now,now,tx.institution_id).run();}await env.DB.prepare("UPDATE billing_transactions SET status='paid',paid_at=? WHERE id=?").bind(now,tx.id).run();await env.DB.prepare("INSERT OR IGNORE INTO webhook_events (delivery_id,event_name,received_at) VALUES (?,?,?)").bind(delivery,eventName,now).run();const refreshed=await env.DB.prepare("SELECT * FROM subscriptions WHERE institution_id=?").bind(tx.institution_id).first();await syncEntitlement(tx.institution_id,refreshed,env);return json({received:true});}
export default {async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await env.DB.prepare("UPDATE billing_transactions SET status='failed',payment_url=NULL WHERE status IN ('initiating','pending') AND created_at<=?").bind(Date.now()-3*60*1000).run();const rows=await env.DB.prepare("SELECT * FROM subscriptions").all();for(const sub of rows.results||[]){try{await syncEntitlement(sub.institution_id,sub,env);}catch(error){console.error("Billing entitlement reconciliation failed for institution",sub.institution_id,error?.message||error);}}})());},async fetch(request,env){const url=new URL(request.url),headers=cors(request,env);if(request.method==="OPTIONS")return new Response(null,{status:204,headers});if(url.pathname==="/health")return json({ok:true,service:"InterCampus billing",storage:"Cloudflare D1"});if(url.pathname==="/webhooks/jjuma"&&request.method==="POST")return webhook(request,env);try{if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405,headers);const ctx=await ownerContext(request,env);if(url.pathname==="/billing/summary"&&request.method==="GET")return json(await summary(ctx,env),200,headers);if(url.pathname==="/billing/checkout"&&request.method==="POST"){const body=await request.json().catch(()=>({}));return json(await checkout(ctx,env,body.currency),200,headers);}return json({error:"Not found"},404,headers);}catch(e){return json({error:e.message||"Billing request failed"},400,headers);}}};
