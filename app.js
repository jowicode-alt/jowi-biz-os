const firebaseConfig = {
  apiKey: "AIzaSyB-dlQtjt9r_iKrM7GytukIjOPDN_zcBpY",
  authDomain: "jowi-biz-os.firebaseapp.com",
  projectId: "jowi-biz-os",
  storageBucket: "jowi-biz-os.firebasestorage.app",
  messagingSenderId: "821672776356",
  appId: "1:821672776356:web:1fd58e0a923807299ccc31"
};

const $ = selector => document.querySelector(selector);
const form = $("#auth-form");
const emailInput = $("#email");
const passwordInput = $("#password");
const nameInput = $("#full-name");
const nameWrap = $("#name-wrap");
const submitButton = $("#submit-btn");
const switchButton = $("#switch-mode");
const forgotPasswordButton = $("#forgot-password");
const moduleView = $("#module-view");
const recordForm = $("#record-form");
let currentBusinessId = null;
let activeModule = null;
const switchLabel = $("#switch-label");
const title = $("#auth-title");
const subtitle = $("#auth-subtitle");
const message = $("#auth-message");
const authView = $("#auth-view");
const workspaceView = $("#workspace-view");
const setupPanel = $("#setup-panel");
const dashboardPanel = $("#dashboard-panel");
const workspaceForm = $("#workspace-form");
const workspaceMessage = $("#workspace-message");
const workspaceSubmit = $("#workspace-submit");
const signoutButton = $("#signout-btn");
let mode = "signin";
let authApi = null;
let firestoreApi = null;
let currentUser = null;
let workspaceLoading = false;

function setMessage(element, text, success = false) {
  element.textContent = text;
  element.style.color = success ? "#27764f" : "#b33b31";
}
function showAuth() {
  authView.classList.remove("hidden");
  workspaceView.classList.add("hidden");
  signoutButton.classList.add("hidden");
  $("#topbar-note").textContent = "One workspace. Your whole business.";
}
function showWorkspaceShell() {
  authView.classList.add("hidden");
  workspaceView.classList.remove("hidden");
  signoutButton.classList.remove("hidden");
  $("#topbar-note").textContent = "Your business, organised.";
}
function updateMode() {
  const creating = mode === "signup";
  title.textContent = creating ? "Create your account" : "Welcome back";
  subtitle.textContent = creating ? "Start with an account for your business workspace." : "Sign in to manage your business.";
  submitButton.textContent = creating ? "Create account" : "Sign in";
  switchLabel.textContent = creating ? "Already have an account?" : "New to Jowi Biz OS?";
  switchButton.textContent = creating ? "Sign in" : "Create account";
  forgotPasswordButton.classList.toggle("hidden", creating);
  forgotPasswordButton.disabled = creating;
  nameWrap.classList.toggle("hidden", !creating);
  nameInput.required = creating;
  passwordInput.autocomplete = creating ? "new-password" : "current-password";
  setMessage(message, "");
}
switchButton.addEventListener("click", () => {
  mode = mode === "signin" ? "signup" : "signin";
  updateMode();


});

function readableError(error) {
  const messages = {
    "auth/email-already-in-use": "That email already has an account. Try signing in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Authentication.",
    "permission-denied": "Firestore denied access. Check that the published rules match this app.",
    "unavailable": "Firebase is temporarily unavailable. Check your connection and try again."
  };
  return messages[error.code] || error.message || "Something went wrong. Please try again.";
}

async function openWorkspace(user) {
  if (!user || !firestoreApi || workspaceLoading) return;
  workspaceLoading = true;
  currentUser = user;
  showWorkspaceShell();
  setupPanel.classList.add("hidden");
  dashboardPanel.classList.add("hidden");
  setMessage($("#dashboard-message"), "");
  try {
    const { collection, query, where, getDocs } = firestoreApi;
    const q = query(collection(firestoreApi.db, "businesses"), where("ownerId", "==", user.uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      setupPanel.classList.remove("hidden");
      $("#business-name").focus();
    } else {
      const businessDoc = snapshot.docs[0];
      currentBusinessId = businessDoc.id;
      const business = businessDoc.data();
      moduleView.classList.add("hidden");
      $("#dashboard-business-name").textContent = business.name || "Your business";
      $("#dashboard-business-meta").textContent = [business.industry, business.country].filter(Boolean).join(" • ");
      dashboardPanel.classList.remove("hidden");
    }
  } catch (error) {
    setupPanel.classList.remove("hidden");
    setMessage(workspaceMessage, "Could not load your workspace. " + readableError(error));
    console.error("Workspace loading failed:", error);
  } finally {
    workspaceLoading = false;
  }
}

try {
  const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = authModule.getAuth(app);
  const db = firestoreModule.getFirestore(app);
  authApi = {
    auth,
    createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    sendPasswordResetEmail: authModule.sendPasswordResetEmail,
    updateProfile: authModule.updateProfile,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged
  };
  firestoreApi = {
    db,
    collection: firestoreModule.collection,
    doc: firestoreModule.doc,
    query: firestoreModule.query,
    where: firestoreModule.where,
    getDocs: firestoreModule.getDocs,
    addDoc: firestoreModule.addDoc,
    deleteDoc: firestoreModule.deleteDoc,
    serverTimestamp: firestoreModule.serverTimestamp
  };
  authApi.onAuthStateChanged(auth, user => {
    if (user) {
      openWorkspace(user);
    } else {
      currentUser = null;
      showAuth();
    }
  });
} catch (error) {
  setMessage(message, "Could not initialise Firebase. Check the web app configuration, enabled Firestore database and internet connection.");
  console.error(error);
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authApi) {
    setMessage(message, "Firebase is not ready yet. Refresh the page and try again.");
    return;
  }
  submitButton.disabled = true;
  setMessage(message, "");
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let credential;
    if (mode === "signup") {
      credential = await authApi.createUserWithEmailAndPassword(authApi.auth, email, password);
      await authApi.updateProfile(credential.user, { displayName: nameInput.value.trim() });
    } else {
      credential = await authApi.signInWithEmailAndPassword(authApi.auth, email, password);
    }
    currentUser = credential.user;
    await openWorkspace(credential.user);
  } catch (error) {
    setMessage(message, readableError(error));
    console.error("Authentication failed:", error);
  } finally {
    submitButton.disabled = false;
  }
});

workspaceForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser || !firestoreApi) {
    setMessage(workspaceMessage, "Your session is not ready. Please sign in again.");
    return;
  }
  workspaceSubmit.disabled = true;
  setMessage(workspaceMessage, "");
  try {
    const business = {
      name: $("#business-name").value.trim(),
      industry: $("#industry").value,
      country: $("#business-country").value.trim(),
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email || "",
      createdAt: firestoreApi.serverTimestamp(),
      updatedAt: firestoreApi.serverTimestamp(),
      plan: "free",
      status: "active"
    };
    if (!business.name || !business.industry || !business.country) {
      throw new Error("Please complete all workspace fields.");
    }
    await firestoreApi.addDoc(firestoreApi.collection(firestoreApi.db, "businesses"), business);
    currentBusinessId = (await firestoreApi.getDocs(firestoreApi.query(firestoreApi.collection(firestoreApi.db, "businesses"), firestoreApi.where("ownerId", "==", currentUser.uid)))).docs[0]?.id || null;
    $("#dashboard-business-name").textContent = business.name;
    $("#dashboard-business-meta").textContent = [business.industry, business.country].filter(Boolean).join(" • ");
    setupPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");
  } catch (error) {
    setMessage(workspaceMessage, "Could not create workspace. " + readableError(error));
    console.error("Workspace creation failed:", error);
  } finally {
    workspaceSubmit.disabled = false;
  }
});

signoutButton.addEventListener("click", async () => {
  if (!authApi) return;
  signoutButton.disabled = true;
  try {
    await authApi.signOut(authApi.auth);
  } catch (error) {
    setMessage($("#dashboard-message"), "Sign out failed. " + readableError(error));
  } finally {
    signoutButton.disabled = false;
  }
});

const countries = [
"Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan",
"Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
"Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (Republic of the)","Costa Rica","Côte d’Ivoire","Croatia","Cuba","Cyprus","Czechia",
"Democratic Republic of the Congo","Denmark","Djibouti","Dominica","Dominican Republic",
"Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
"Fiji","Finland","France",
"Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
"Haiti","Honduras","Hungary",
"Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
"Jamaica","Japan","Jordan",
"Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan",
"Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
"Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
"Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway",
"Oman",
"Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
"Qatar",
"Romania","Russia","Rwanda",
"Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
"Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Türkiye","Turkmenistan","Tuvalu",
"Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
"Vanuatu","Vatican City","Venezuela","Vietnam",
"Yemen",
"Zambia","Zimbabwe",
"Åland Islands","American Samoa","Anguilla","Aruba","Bermuda","Bonaire, Sint Eustatius and Saba","British Virgin Islands","Cayman Islands","Christmas Island","Cocos (Keeling) Islands","Cook Islands","Curaçao","Faroe Islands","French Guiana","French Polynesia","Gibraltar","Greenland","Guadeloupe","Guam","Guernsey","Hong Kong","Isle of Man","Jersey","Kosovo","Macao","Martinique","Mayotte","Montserrat","New Caledonia","Niue","Norfolk Island","Northern Mariana Islands","Puerto Rico","Réunion","Saint Barthélemy","Saint Helena, Ascension and Tristan da Cunha","Saint Martin (French part)","Saint Pierre and Miquelon","Sint Maarten (Dutch part)","Tokelau","Turks and Caicos Islands","U.S. Virgin Islands","Wallis and Futuna","Western Sahara"
].sort((a,b)=>a.localeCompare(b));
const countrySelect = $("#business-country");
countries.forEach(country => {
  const option = document.createElement("option");
  option.value = country;
  option.textContent = country;
  if (country === "Uganda") option.selected = true;
  countrySelect.append(option);
});

forgotPasswordButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setMessage(message, "Enter your email address above, then choose Forgot password again.");
    emailInput.focus();
    return;
  }
  if (!authApi) {
    setMessage(message, "Firebase is not ready yet. Refresh and try again.");
    return;
  }
  forgotPasswordButton.disabled = true;
  try {
    await authApi.sendPasswordResetEmail(authApi.auth, email);
    setMessage(message, "If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.", true);
  } catch (error) {
    const known = {
      "auth/invalid-email": "Enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Wait a while and try again.",
      "auth/network-request-failed": "Network error. Check your connection and try again."
    };
    setMessage(message, known[error.code] || "Could not send the reset email. Check the address and Firebase Authentication email settings.");
    console.error("Password reset failed:", error);
  } finally {
    forgotPasswordButton.disabled = false;
  }
});

const moduleDefinitions = {
  customers: {title:"Customers",description:"Create and manage your customer directory.",collection:"customers",fields:[["name","Customer name","text",true],["phone","Phone","tel",false],["email","Email","email",false],["notes","Notes","text",false]]},
  sales: {title:"Sales & payments",description:"Record sales and payments received.",collection:"sales",fields:[["title","Sale or item","text",true],["amount","Amount","number",true],["paymentMethod","Payment method","select",true,["Cash","Mobile money","Bank transfer","Card","Credit/Other"]],["date","Date","date",true]]},
  expenses: {title:"Expenses",description:"Record business costs and spending.",collection:"expenses",fields:[["title","Expense description","text",true],["amount","Amount","number",true],["category","Category","text",true],["date","Date","date",true]]},
  tasks: {title:"Tasks & staff",description:"Track work items and who is responsible.",collection:"tasks",fields:[["title","Task","text",true],["assignedTo","Assigned to","text",false],["dueDate","Due date","date",false],["status","Status","select",true,["Not started","In progress","Done"]]]},
  invoices: {title:"Invoices & receipts",description:"Track invoices and payment status. This MVP stores records; printable document generation will be added separately.",collection:"invoices",fields:[["customer","Customer / client","text",true],["amount","Amount due","number",true],["dueDate","Due date","date",false],["status","Status","select",true,["Draft","Sent","Paid","Overdue"]]]},
  reports: {title:"Reports",description:"A live summary of recorded sales and expenses.",collection:null,fields:[]},
  staff: {title:"Staff directory",description:"Maintain basic staff contact records.",collection:"staff",fields:[["name","Staff member","text",true],["role","Role / job title","text",true],["phone","Phone","tel",false],["email","Email","email",false]]}
};

function makeField(field) {
  const [name,label,type,required,options] = field;
  const wrap = document.createElement("div");
  wrap.className = "record-field";
  const lab = document.createElement("label");
  lab.htmlFor = "record-" + name;
  lab.textContent = label;
  const input = type === "select" ? document.createElement("select") : document.createElement("input");
  input.id = "record-" + name;
  input.name = name;
  input.required = required;
  if (type === "select") {
    options.forEach(value => { const option=document.createElement("option"); option.value=value; option.textContent=value; input.append(option); });
  } else {
    input.type = type;
    if (type === "number") { input.min="0"; input.step="0.01"; }
  }
  wrap.append(lab,input);
  return wrap;
}

async function openModule(key) {
  const definition = moduleDefinitions[key];
  if (!definition || !currentBusinessId || !firestoreApi) return;
  activeModule = key;
  dashboardPanel.classList.add("hidden");
  moduleView.classList.remove("hidden");
  $("#module-title").textContent = definition.title;
  $("#module-description").textContent = definition.description;
  $("#records-title").textContent = key === "reports" ? "Summary" : "Saved records";
  recordForm.replaceChildren();
  $("#record-message").textContent = "";
  if (key === "reports") {
    await loadReports();
    return;
  }
  definition.fields.forEach(field => recordForm.append(makeField(field)));
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Save " + (key === "customers" ? "customer" : key === "sales" ? "sale" : key === "expenses" ? "expense" : key === "invoices" ? "invoice record" : key === "staff" ? "staff member" : "task");
  recordForm.append(submit);
  await loadRecords();
}

function recordsCollection(key) {
  return firestoreApi.collection(firestoreApi.db,"businesses",currentBusinessId,moduleDefinitions[key].collection);
}

function createRecordCard(doc, key) {
  const data = doc.data();
  const card = document.createElement("article");
  card.className = "record-card";
  const heading = document.createElement("div");
  heading.className = "record-card-heading";
  const name = document.createElement("strong");
  name.textContent = data.name || data.title || data.customer || "Record";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button delete-record";
  remove.textContent = "Delete";
  remove.addEventListener("click", async () => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    try {
      await firestoreApi.deleteDoc(firestoreApi.doc(firestoreApi.db,"businesses",currentBusinessId,moduleDefinitions[key].collection,doc.id));
      await loadRecords();
    } catch(error) { setMessage($("#record-message"),"Could not delete record. "+readableError(error)); }
  });
  heading.append(name,remove);
  card.append(heading);
  const details = document.createElement("p");
  details.textContent = Object.entries(data).filter(([field,value]) => !["createdAt","updatedAt","ownerId"].includes(field) && value !== "" && value != null).map(([field,value]) => {
    if (field === "amount") return "Amount: " + Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
    return field.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase()) + ": " + String(value);
  }).join(" • ");
  card.append(details);
  return card;
}

async function loadRecords() {
  if (!activeModule || !moduleDefinitions[activeModule].collection) return;
  const list = $("#records-list");
  list.replaceChildren();
  try {
    const snap = await firestoreApi.getDocs(recordsCollection(activeModule));
    $("#records-count").textContent = snap.size + (snap.size === 1 ? " record" : " records");
    if (snap.empty) {
      const empty = document.createElement("p"); empty.className="empty-records"; empty.textContent="No records yet. Use the form above to add the first one."; list.append(empty); return;
    }
    snap.docs.forEach(doc => list.append(createRecordCard(doc,activeModule)));
  } catch(error) { setMessage($("#record-message"),"Could not load records. "+readableError(error)); }
}

async function loadReports() {
  const list=$("#records-list"); list.replaceChildren();
  try {
    const [sales,expenses] = await Promise.all([
      firestoreApi.getDocs(firestoreApi.collection(firestoreApi.db,"businesses",currentBusinessId,"sales")),
      firestoreApi.getDocs(firestoreApi.collection(firestoreApi.db,"businesses",currentBusinessId,"expenses"))
    ]);
    const total = snap => snap.docs.reduce((sum,doc)=>sum+Number(doc.data().amount||0),0);
    const salesTotal=total(sales), expenseTotal=total(expenses);
    const metrics=[["Total sales",salesTotal],["Total expenses",expenseTotal],["Net recorded",salesTotal-expenseTotal],["Sales records",sales.size],["Expense records",expenses.size]];
    metrics.forEach(([label,value])=>{const card=document.createElement("article");card.className="report-metric";const h=document.createElement("span");h.textContent=label;const v=document.createElement("strong");v.textContent=label.endsWith("records")?String(value):Number(value).toLocaleString(undefined,{maximumFractionDigits:2});card.append(h,v);list.append(card);});
    $("#records-count").textContent="Live summary";
  } catch(error) { setMessage($("#record-message"),"Could not build reports. "+readableError(error)); }
}

recordForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!activeModule || activeModule === "reports") return;
  const button=recordForm.querySelector('button[type="submit"]');
  button.disabled=true;
  try {
    const data={};
    moduleDefinitions[activeModule].fields.forEach(([name])=>{const input=recordForm.elements.namedItem(name);data[name]=input.value.trim();});
    if ("amount" in data) data.amount=Number(data.amount);
    data.createdAt=firestoreApi.serverTimestamp();
    data.updatedAt=firestoreApi.serverTimestamp();
    await firestoreApi.addDoc(recordsCollection(activeModule),data);
    recordForm.reset();
    setMessage($("#record-message"),"Saved successfully.",true);
    await loadRecords();
  } catch(error) { setMessage($("#record-message"),"Could not save record. "+readableError(error)); }
  finally { button.disabled=false; }
});

$("#module-back").addEventListener("click",()=>{moduleView.classList.add("hidden");dashboardPanel.classList.remove("hidden");activeModule=null;});
document.querySelectorAll("[data-module]").forEach(card=>{
  card.addEventListener("click",()=>openModule(card.dataset.module));
  card.addEventListener("keydown",event=>{
    if(event.key==="Enter" || event.key===" "){event.preventDefault();openModule(card.dataset.module);}
  });
});

updateMode();
