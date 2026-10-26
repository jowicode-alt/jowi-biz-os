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
      renderIndustryModules(business.industry);
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
    renderIndustryModules(business.industry);
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
  staff: {title:"Staff directory",description:"Maintain basic staff contact records.",collection:"staff",fields:[["name","Staff member","text",true],["role","Role / job title","text",true],["phone","Phone","tel",false],["email","Email","email",false]]},
  inventory: {title:"Inventory & stock",description:"Track products, quantities and reorder levels.",collection:"inventory",fields:[["name","Product / item","text",true],["sku","SKU / item code","text",false],["quantity","Quantity in stock","number",true],["reorderLevel","Reorder level","number",false],["unitCost","Unit cost","number",false]]},
  suppliers: {title:"Suppliers",description:"Manage supplier contacts and supply details.",collection:"suppliers",fields:[["name","Supplier name","text",true],["contactName","Contact person","text",false],["phone","Phone","tel",false],["email","Email","email",false],["itemsSupplied","Items supplied","text",false]]},
  appointments: {title:"Appointments & bookings",description:"Schedule clients, services and appointment status.",collection:"appointments",fields:[["customer","Client / customer","text",true],["service","Service","text",true],["date","Date","date",true],["time","Time","text",false],["status","Status","select",true,["Requested","Confirmed","Completed","Cancelled"]]]},
  services: {title:"Service menu",description:"Maintain the services your business offers and their prices.",collection:"services",fields:[["name","Service name","text",true],["duration","Duration / notes","text",false],["price","Price","number",true],["staffMember","Assigned staff","text",false]]},
  students: {title:"Student register",description:"Maintain student enrolment and guardian contact details.",collection:"students",fields:[["name","Student name","text",true],["studentId","Student ID","text",false],["className","Class / course","text",true],["guardian","Parent / guardian","text",false],["guardianPhone","Guardian phone","tel",false],["status","Status","select",true,["Active","Completed","Withdrawn"]]]},
  classes: {title:"Classes & courses",description:"Organise classes, courses, teachers and schedules.",collection:"classes",fields:[["name","Class / course name","text",true],["teacher","Teacher / trainer","text",false],["schedule","Schedule","text",false],["location","Room / location","text",false]]},
  attendance: {title:"Attendance register",description:"Record attendance for a class or group.",collection:"attendance",fields:[["className","Class / group","text",true],["personName","Student / member name","text",true],["date","Date","date",true],["status","Attendance","select",true,["Present","Absent","Late","Excused"]]]},
  members: {title:"Members directory",description:"Keep member and community contact records.",collection:"members",fields:[["name","Member name","text",true],["phone","Phone","tel",false],["email","Email","email",false],["group","Group / ministry","text",false],["status","Status","select",true,["Active","Inactive"]]]},
  events: {title:"Events & activities",description:"Plan gatherings, activities and assigned coordinators.",collection:"events",fields:[["name","Event name","text",true],["date","Date","date",true],["location","Location","text",false],["coordinator","Coordinator","text",false],["status","Status","select",true,["Planning","Confirmed","Completed","Cancelled"]]]},
  donations: {title:"Donations & contributions",description:"Record contributions and their purpose.",collection:"donations",fields:[["contributor","Contributor (optional)","text",false],["amount","Amount","number",true],["purpose","Purpose / fund","text",true],["date","Date","date",true],["method","Method","select",true,["Cash","Mobile money","Bank transfer","Other"]]]},
  menu: {title:"Menu & products",description:"Manage menu items, prices and availability.",collection:"menu",fields:[["name","Item name","text",true],["category","Category","text",false],["price","Price","number",true],["available","Availability","select",true,["Available","Unavailable"]]]},
  orders: {title:"Orders & kitchen tickets",description:"Track customer orders from receipt to completion.",collection:"orders",fields:[["orderNumber","Order / ticket number","text",true],["customer","Customer / table","text",false],["items","Items ordered","text",true],["amount","Order total","number",true],["status","Status","select",true,["New","Preparing","Ready","Served","Cancelled"]]]},
  projects: {title:"Projects & jobs",description:"Track project owners, deadlines, budgets and delivery status.",collection:"projects",fields:[["name","Project name","text",true],["client","Client","text",false],["startDate","Start date","date",false],["dueDate","Target completion","date",false],["budget","Budget","number",false],["status","Status","select",true,["Planned","In progress","On hold","Completed"]]]},
  materials: {title:"Materials & equipment",description:"Track project materials, equipment and quantities.",collection:"materials",fields:[["name","Material / equipment","text",true],["project","Project / site","text",false],["quantity","Quantity","number",true],["unit","Unit","text",false],["status","Status","select",true,["In stock","Assigned to site","Low stock","Used"]]]},
  patients: {title:"Patient appointments",description:"Manage appointment logistics. Avoid storing unnecessary sensitive medical details here.",collection:"patientAppointments",fields:[["patientName","Patient name","text",true],["appointmentType","Appointment type","text",true],["date","Appointment date","date",true],["time","Time","text",false],["status","Status","select",true,["Booked","Arrived","Completed","Cancelled"]]]},
  medicines: {title:"Medicine stock",description:"Track medicine stock levels and expiry dates; use access controls appropriate for your clinic or pharmacy.",collection:"medicines",fields:[["name","Medicine / product","text",true],["batch","Batch number","text",false],["quantity","Quantity","number",true],["expiryDate","Expiry date","date",false],["reorderLevel","Reorder level","number",false]]},
  serviceJobs: {title:"Service jobs",description:"Track customer requests, assigned technicians and job progress.",collection:"serviceJobs",fields:[["jobTitle","Job / service requested","text",true],["customer","Customer","text",true],["assignedTo","Assigned technician / team","text",false],["scheduledDate","Scheduled date","date",false],["price","Quoted price","number",false],["status","Status","select",true,["New","Scheduled","In progress","Waiting for parts","Completed"]]]},
  cleaningSchedules: {title:"Cleaning schedules",description:"Plan recurring cleaning work and assign teams.",collection:"cleaningSchedules",fields:[["site","Client / site","text",true],["service","Cleaning service","text",true],["date","Scheduled date","date",true],["team","Assigned team","text",false],["frequency","Frequency","select",true,["Once","Daily","Weekly","Monthly"]],["status","Status","select",true,["Scheduled","In progress","Completed"]]]},
  properties: {title:"Property listings",description:"Manage properties, rental or sale status and asking prices.",collection:"properties",fields:[["name","Property / listing","text",true],["type","Property type","text",false],["location","Location","text",true],["price","Price / rent","number",false],["status","Status","select",true,["Available","Reserved","Rented","Sold"]]]},
  viewings: {title:"Viewings & inspections",description:"Schedule property viewings and inspections.",collection:"viewings",fields:[["property","Property","text",true],["contact","Prospect / tenant","text",true],["date","Date","date",true],["assignedTo","Agent","text",false],["status","Status","select",true,["Requested","Confirmed","Completed","Cancelled"]]]},
  printJobs: {title:"Print & production jobs",description:"Track artwork, production requirements and delivery deadlines.",collection:"printJobs",fields:[["jobName","Job / artwork name","text",true],["client","Client","text",true],["specifications","Specifications / quantity","text",false],["dueDate","Due date","date",false],["amount","Quoted amount","number",false],["status","Status","select",true,["Quoted","Approved","In production","Ready","Delivered"]]]},
  quotes: {title:"Quotes & estimates",description:"Prepare and track client quotations.",collection:"quotes",fields:[["quoteTitle","Quote / estimate","text",true],["client","Client","text",true],["amount","Quoted amount","number",true],["validUntil","Valid until","date",false],["status","Status","select",true,["Draft","Sent","Accepted","Declined","Expired"]]]},
  bookings: {title:"Bookings & reservations",description:"Track reservations, dates, guests and booking status.",collection:"bookings",fields:[["bookingName","Booking / reservation","text",true],["customer","Customer / guest","text",true],["startDate","Start date","date",true],["endDate","End date","date",false],["partySize","People / units","number",false],["status","Status","select",true,["Requested","Confirmed","Checked in / started","Completed","Cancelled"]]]},
  fleet: {title:"Vehicles, rooms & equipment",description:"Track key operational assets and availability.",collection:"fleet",fields:[["name","Vehicle / room / asset","text",true],["assetCode","Registration / asset code","text",false],["capacity","Capacity","number",false],["status","Status","select",true,["Available","In use","Maintenance","Unavailable"]]]},
  trips: {title:"Trips & itineraries",description:"Organise trips, routes, guides and trip status.",collection:"trips",fields:[["name","Trip / route","text",true],["date","Departure date","date",true],["destination","Destination","text",true],["guide","Driver / guide","text",false],["capacity","Capacity","number",false],["status","Status","select",true,["Planned","Booked","Departed","Completed","Cancelled"]]]},
  purchaseOrders: {title:"Purchase orders",description:"Track orders placed with suppliers.",collection:"purchaseOrders",fields:[["supplier","Supplier","text",true],["orderReference","Order reference","text",false],["items","Items ordered","text",true],["amount","Order amount","number",true],["expectedDate","Expected delivery","date",false],["status","Status","select",true,["Draft","Sent","Partially received","Received","Cancelled"]]]},
  deliveryOrders: {title:"Deliveries & fulfilment",description:"Track customer orders, delivery details and fulfilment status.",collection:"deliveryOrders",fields:[["customer","Customer","text",true],["orderReference","Order reference","text",false],["destination","Delivery address / area","text",true],["date","Delivery date","date",false],["assignedTo","Driver / team","text",false],["status","Status","select",true,["Pending","Packed","Out for delivery","Delivered","Returned"]]]}
};

const coreModuleKeys = ["customers","sales","expenses","tasks","invoices","reports","staff"];
const industryModuleKeys = {
  "Retail / Shop": ["inventory","suppliers","purchaseOrders"],
  "Salon / Barber / Spa": ["appointments","services"],
  "School / Training": ["students","classes","attendance"],
  "Church / Community organisation": ["members","events","donations"],
  "Restaurant / Catering": ["menu","orders","bookings"],
  "Construction / Contractor": ["projects","materials","serviceJobs"],
  "Clinic / Pharmacy": ["patients","appointments","medicines"],
  "Cleaning services": ["serviceJobs","cleaningSchedules","staff"],
  "Real estate": ["properties","viewings","customers"],
  "Agency / Printing / Branding": ["projects","printJobs","quotes"],
  "Transport / Tours / Guesthouse": ["bookings","fleet","trips"],
  "Repairs / Technical services": ["serviceJobs","inventory","suppliers"],
  "Supplier / Distributor": ["inventory","suppliers","purchaseOrders","deliveryOrders"],
  "Other": ["appointments","serviceJobs"]
};
const moduleIcons = {customers:"♙",sales:"↗",expenses:"↘",tasks:"✓",invoices:"▤",reports:"▥",staff:"♟",inventory:"▦",suppliers:"⇄",appointments:"◷",services:"✦",students:"♧",classes:"▤",attendance:"✓",members:"♙",events:"✧",donations:"♡",menu:"☷",orders:"▤",projects:"▧",materials:"▦",patients:"◷",medicines:"✚",serviceJobs:"⚒",cleaningSchedules:"◷",properties:"⌂",viewings:"⌖",printJobs:"▧",quotes:"▤",bookings:"◷",fleet:"▰",trips:"➜",purchaseOrders:"⇄",deliveryOrders:"➜"};
function renderIndustryModules(industry) {
  const grid = $("#module-grid");
  if (!grid) return;
  grid.replaceChildren();
  const keys = [...new Set([...coreModuleKeys, ...(industryModuleKeys[industry] || industryModuleKeys.Other)])];
  $("#industry-modules-intro").textContent = "Core business tools plus services tailored for " + (industry || "your business") + ".";
  keys.forEach(key => {
    const def = moduleDefinitions[key];
    if (!def) return;
    const card = document.createElement("article");
    card.className = "module-card";
    card.dataset.module = key;
    card.tabIndex = 0;
    card.setAttribute("role","button");
    const icon = document.createElement("span"); icon.className="module-icon"; icon.textContent=moduleIcons[key] || "•";
    const heading = document.createElement("h3"); heading.textContent=def.title;
    const description = document.createElement("p"); description.textContent=def.description;
    const action = document.createElement("span"); action.className="module-status"; action.textContent="Open module →";
    card.append(icon,heading,description,action);
    card.addEventListener("click",()=>openModule(key));
    card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openModule(key);}});
    grid.append(card);
  });
}
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
  submit.textContent = "Save " + (definition.singular || definition.title.replace(/\s*&.*/, "").replace(/s$/, "").toLowerCase());
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
updateMode();
