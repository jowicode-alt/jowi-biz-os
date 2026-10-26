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
  deliveryOrders: {title:"Deliveries & fulfilment",description:"Track customer orders, delivery details and fulfilment status.",collection:"deliveryOrders",fields:[["customer","Customer","text",true],["orderReference","Order reference","text",false],["destination","Delivery address / area","text",true],["date","Delivery date","date",false],["assignedTo","Driver / team","text",false],["status","Status","select",true,["Pending","Packed","Out for delivery","Delivered","Returned"]]]},
  studentAdmissions: {title:"Admissions & enrolment",description:"Track applications, guardians, entry requirements and enrolment decisions.",collection:"studentAdmissions",fields:[["applicant","Applicant name","text",true],["guardian","Parent / guardian","text",false],["classApplied","Class / programme applied for","text",true],["applicationDate","Application date","date",true],["status","Decision","select",true,["Received","Under review","Offered","Admitted","Declined"]]]},
  academicResults: {title:"Assessments & results",description:"Record assessment results by learner, subject and term.",collection:"academicResults",fields:[["student","Student name / ID","text",true],["subject","Subject","text",true],["term","Term / semester","text",true],["score","Score","number",true],["outOf","Maximum score","number",true],["teacherRemark","Teacher remark","text",false]]},
  timetables: {title:"Timetable & lesson schedule",description:"Schedule teaching sessions, rooms and instructors.",collection:"timetables",fields:[["className","Class / group","text",true],["subject","Subject / course","text",true],["instructor","Teacher / trainer","text",true],["day","Day","select",true,["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]],["startTime","Start time","text",true],["endTime","End time","text",true],["room","Room","text",false]]},
  feeLedger: {title:"Tuition & fee ledger",description:"Track learner billing, part-payments, balances and payment references.",collection:"feeLedger",fields:[["learner","Learner name / ID","text",true],["feeType","Fee type","text",true],["amountDue","Amount billed","number",true],["amountPaid","Amount paid","number",true],["term","Term / semester","text",true],["paymentRef","Payment reference","text",false]]},
  staffAttendance: {title:"Staff attendance & leave",description:"Record staff check-ins, absences and leave requests.",collection:"staffAttendance",fields:[["staffName","Staff name","text",true],["date","Date","date",true],["checkIn","Check-in time","text",false],["status","Attendance","select",true,["Present","Late","Absent","On leave"]],["notes","Notes","text",false]]},
  libraryLoans: {title:"Library lending",description:"Track books, borrowers, due dates and returns.",collection:"libraryLoans",fields:[["bookTitle","Book title","text",true],["borrower","Student / borrower","text",true],["issueDate","Issue date","date",true],["dueDate","Due date","date",true],["returnStatus","Return status","select",true,["On loan","Returned","Overdue"]]]},
  churchMembers: {title:"Congregation register",description:"Manage member profiles, groups and pastoral follow-up.",collection:"churchMembers",fields:[["name","Member name","text",true],["phone","Phone","tel",false],["group","Cell / ministry / group","text",false],["joinDate","Join date","date",false],["status","Membership","select",true,["Active","Visitor","Inactive"]]]},
  givingLedger: {title:"Giving & offerings",description:"Record offerings, pledges and restricted-purpose contributions.",collection:"givingLedger",fields:[["fund","Fund / offering type","text",true],["date","Date","date",true],["amount","Amount","number",true],["method","Method","select",true,["Cash","Mobile money","Bank","Other"]],["reference","Reference / anonymous note","text",false]]},
  outreach: {title:"Outreach & case activities",description:"Track community programmes, beneficiaries and follow-up actions.",collection:"outreach",fields:[["programme","Programme","text",true],["beneficiaryCode","Beneficiary ID (avoid sensitive details)","text",false],["activityDate","Activity date","date",true],["location","Location","text",false],["outcome","Outcome","text",false],["followUpDate","Follow-up date","date",false]]},
  tableMap: {title:"Tables & floor plan",description:"Track table occupancy and service status during a shift.",collection:"tableMap",fields:[["tableNumber","Table / section","text",true],["capacity","Seats","number",true],["status","Table status","select",true,["Available","Seated","Ordering","Awaiting food","Bill requested","Cleaning"]],["server","Assigned server","text",false]]},
  recipeCosting: {title:"Recipes & ingredient costing",description:"Record recipe quantities and estimate ingredient costs per menu item.",collection:"recipeCosting",fields:[["dish","Menu item","text",true],["ingredientList","Ingredients and quantities","text",true],["ingredientCost","Total ingredient cost","number",true],["sellingPrice","Selling price","number",true],["allergens","Allergen notes","text",false]]},
  foodSafety: {title:"Food safety & temperature logs",description:"Keep routine kitchen checks and corrective actions.",collection:"foodSafety",fields:[["checkType","Check type","select",true,["Fridge temperature","Freezer temperature","Cleaning","Delivery check","Other"]],["date","Date","date",true],["reading","Reading / observation","text",true],["checkedBy","Checked by","text",true],["action","Corrective action","text",false]]},
  roomBoard: {title:"Room availability & housekeeping",description:"Track room readiness, occupancy status and housekeeping tasks.",collection:"roomBoard",fields:[["room","Room number / name","text",true],["roomType","Room type","text",false],["status","Status","select",true,["Vacant clean","Vacant dirty","Occupied","Inspected","Out of service"]],["lastCleaned","Last cleaned","date",false],["notes","Maintenance / guest notes","text",false]]},
  guestRegister: {title:"Guest check-in register",description:"Record reservation reference, arrival/departure and guest status.",collection:"guestRegister",fields:[["guest","Guest name","text",true],["bookingReference","Booking reference","text",false],["arrival","Arrival date","date",true],["departure","Departure date","date",true],["room","Room","text",false],["status","Stay status","select",true,["Expected","Checked in","Checked out","No show"]]]},
  tourItineraries: {title:"Tour itineraries & departures",description:"Build trip schedules, destinations, guides and departure status.",collection:"tourItineraries",fields:[["tourName","Tour name","text",true],["destination","Destination / route","text",true],["departure","Departure date","date",true],["meetingPoint","Meeting point","text",false],["guide","Guide / driver","text",false],["capacity","Passenger capacity","number",false],["status","Status","select",true,["Draft","Open for booking","Confirmed","Departed","Completed","Cancelled"]]]},
  fleetMaintenance: {title:"Fleet & maintenance log",description:"Track vehicles, mileage, servicing and defects.",collection:"fleetMaintenance",fields:[["vehicle","Vehicle / asset","text",true],["registration","Registration / asset ID","text",true],["serviceDate","Service / inspection date","date",true],["odometer","Odometer / meter","number",false],["nextDue","Next service due","date",false],["defect","Defect / work needed","text",false],["status","Status","select",true,["Scheduled","In progress","Completed","Grounded"]]]},
  siteDailyLogs: {title:"Construction site daily logs",description:"Record labour, weather, work completed, equipment and safety observations.",collection:"siteDailyLogs",fields:[["project","Project / site","text",true],["date","Log date","date",true],["weather","Weather","text",false],["crewCount","Crew count","number",false],["workDone","Work completed","text",true],["materialsUsed","Materials used","text",false],["safetyIssues","Safety issues / actions","text",false]]},
  estimates: {title:"Estimates & job costing",description:"Estimate labour, materials and overhead for a job before approval.",collection:"estimates",fields:[["job","Job / project","text",true],["client","Client","text",true],["labourCost","Labour estimate","number",true],["materialsCost","Materials estimate","number",true],["otherCost","Other costs","number",false],["quotedTotal","Quoted total","number",true],["status","Status","select",true,["Draft","Sent","Approved","Declined"]]]},
  safetyChecks: {title:"Safety & inspection checks",description:"Record site inspections, hazards, corrective actions and sign-off.",collection:"safetyChecks",fields:[["site","Site / project","text",true],["date","Inspection date","date",true],["hazard","Hazard / observation","text",true],["riskLevel","Risk level","select",true,["Low","Medium","High","Critical"]],["action","Corrective action","text",true],["owner","Action owner","text",false],["status","Status","select",true,["Open","In progress","Resolved"]]]},
  cleaningChecklist: {title:"Cleaning checklists & inspections",description:"Assign site-specific cleaning checklists and record quality checks.",collection:"cleaningChecklist",fields:[["site","Client / site","text",true],["date","Service date","date",true],["team","Team / cleaner","text",true],["checklist","Tasks completed","text",true],["inspectionScore","Inspection result / score","text",false],["clientSignoff","Client sign-off","text",false]]},
  chemicalRegister: {title:"Cleaning chemicals & equipment",description:"Track cleaning products, safety notes and equipment inspections.",collection:"chemicalRegister",fields:[["item","Chemical / equipment","text",true],["quantity","Quantity","number",true],["safetyNotes","Handling / safety notes","text",false],["expiryDate","Expiry date","date",false],["inspectionDate","Next inspection","date",false]]},
  clinicalVisits: {title:"Consultation register",description:"Appointment and visit logistics only; this starter module is not an electronic medical record.",collection:"clinicalVisits",fields:[["patientCode","Patient ID / code","text",true],["visitDate","Visit date","date",true],["clinician","Clinician","text",true],["visitType","Visit type","text",true],["status","Visit status","select",true,["Booked","Arrived","In consultation","Completed","Referred","Cancelled"]]]},
  clinicalVitals: {title:"Vitals & observations",description:"Restricted clinical observations. Do not use for emergency triage or as a substitute for a validated clinical record system.",collection:"clinicalVitals",fields:[["patientCode","Patient ID / code","text",true],["date","Recorded date","date",true],["bloodPressure","Blood pressure","text",false],["temperature","Temperature (°C)","number",false],["pulse","Pulse / min","number",false],["weight","Weight (kg)","number",false],["recordedBy","Recorded by","text",true]]},
  prescriptions: {title:"Prescription log",description:"Restricted prescription tracking; prescribing and dispensing must be performed by authorised professionals.",collection:"prescriptions",fields:[["patientCode","Patient ID / code","text",true],["date","Date","date",true],["prescriber","Prescriber","text",true],["medicine","Medicine","text",true],["instructions","Instructions (authorised clinician only)","text",false],["status","Status","select",true,["Issued","Partially dispensed","Dispensed","Cancelled"]]]},
  dispensing: {title:"Dispensing & batch register",description:"Track product batches, quantities dispensed and expiry. Validate all medicine workflows with licensed pharmacy professionals.",collection:"dispensing",fields:[["medicine","Medicine / product","text",true],["batch","Batch / lot number","text",true],["expiryDate","Expiry date","date",true],["quantityReceived","Quantity received","number",true],["quantityDispensed","Quantity dispensed","number",true],["supplier","Supplier","text",false]]},
  workOrders: {title:"Work orders & dispatch",description:"Receive repair requests, assign technicians, schedule visits and track completion.",collection:"workOrders",fields:[["job","Work requested","text",true],["customer","Customer","text",true],["location","Service location","text",false],["assignedTechnician","Technician","text",false],["scheduledAt","Scheduled date","date",false],["priority","Priority","select",true,["Low","Normal","High","Urgent"]],["status","Status","select",true,["New","Quoted","Scheduled","In progress","Awaiting parts","Completed","Invoiced"]]]},
  vehicleJobs: {title:"Vehicle service cards",description:"Track vehicle details, diagnosis, repairs, parts and handover.",collection:"vehicleJobs",fields:[["registration","Vehicle registration","text",true],["customer","Owner / customer","text",true],["complaint","Reported fault","text",true],["diagnosis","Technician diagnosis","text",false],["partsUsed","Parts used","text",false],["labour","Labour charge","number",false],["status","Status","select",true,["Received","Diagnosing","Awaiting approval","Repairing","Ready for collection","Collected"]]]},
  printProduction: {title:"Print production job tickets",description:"Track artwork approval, print specifications, finishing stages and delivery.",collection:"printProduction",fields:[["job","Job ticket / title","text",true],["client","Client","text",true],["product","Product type","text",true],["quantity","Quantity","number",true],["specifications","Paper / size / colour / finishing","text",true],["proofStatus","Artwork proof","select",true,["Not received","In design","Sent for approval","Approved","Changes requested"]],["productionStatus","Production stage","select",true,["Quoted","Pre-press","Printing","Finishing","Quality check","Ready","Delivered"]],["dueDate","Due date","date",false]]},
  creativePipeline: {title:"Creative project pipeline",description:"Track client briefs, deliverables, approvals, revisions and campaign launch.",collection:"creativePipeline",fields:[["project","Project / campaign","text",true],["client","Client","text",true],["brief","Brief / deliverables","text",true],["owner","Project lead","text",false],["deadline","Deadline","date",false],["approval","Client approval","select",true,["Briefing","In progress","Review","Changes requested","Approved","Launched"]]]},
  eventRunsheet: {title:"Event runsheet & suppliers",description:"Coordinate event timeline, venue, vendors, setup and teardown.",collection:"eventRunsheet",fields:[["event","Event name","text",true],["date","Event date","date",true],["venue","Venue","text",true],["setupTime","Setup time","text",false],["vendorList","Vendors / contacts","text",false],["runsheet","Schedule / run of show","text",true],["status","Status","select",true,["Planning","Confirmed","Setup","Live","Teardown","Completed"]]]},
  rentalLedger: {title:"Tenancy & rent ledger",description:"Track leases, rent due, deposits and arrears; confirm local legal requirements before relying on templates.",collection:"rentalLedger",fields:[["property","Property / unit","text",true],["tenant","Tenant name / reference","text",true],["leaseStart","Lease start","date",true],["leaseEnd","Lease end","date",false],["rentDue","Rent due","number",true],["rentPaid","Rent paid","number",true],["nextDue","Next due date","date",false]]},
  propertyMaintenance: {title:"Property maintenance requests",description:"Track tenant requests, contractor visits, approvals and completion.",collection:"propertyMaintenance",fields:[["property","Property / unit","text",true],["requester","Tenant / owner","text",false],["issue","Issue reported","text",true],["priority","Priority","select",true,["Low","Normal","High","Urgent"]],["assignedTo","Contractor","text",false],["status","Status","select",true,["Reported","Approved","Scheduled","In progress","Completed"]]]},
  reservations: {title:"Reservation book & waitlist",description:"Manage guest requests, capacity, deposits and booking outcomes.",collection:"reservations",fields:[["guest","Guest / party name","text",true],["date","Reservation date","date",true],["time","Time","text",true],["partySize","Party size","number",true],["contact","Contact","text",false],["deposit","Deposit","number",false],["status","Status","select",true,["Requested","Confirmed","Seated","Completed","No show","Cancelled"]]]},
  patientQueue: {title:"Patient queue & referrals",description:"Track arrival order and referral status without exposing unnecessary clinical details.",collection:"patientQueue",fields:[["patientCode","Patient code","text",true],["arrivalTime","Arrival time","text",true],["servicePoint","Clinic / department","text",true],["priority","Triage category assigned by trained staff","select",true,["Routine","Priority","Urgent"]],["status","Status","select",true,["Waiting","Called","In service","Referred","Completed"]]]},
  orderFulfilment: {title:"Wholesale orders & fulfilment",description:"Track customer purchase orders, picking, dispatch and delivery confirmation.",collection:"orderFulfilment",fields:[["orderNumber","Order number","text",true],["buyer","Buyer / account","text",true],["items","Items and quantities","text",true],["orderValue","Order value","number",true],["deliveryDate","Required delivery date","date",false],["status","Status","select",true,["Received","Credit check","Picking","Packed","Dispatched","Delivered","Invoiced"]]]},
  stockLots: {title:"Batch & expiry stock control",description:"Track batch-level stock, expiry dates and stock adjustments.",collection:"stockLots",fields:[["product","Product","text",true],["batch","Batch / lot","text",true],["receivedDate","Received date","date",true],["expiryDate","Expiry date","date",false],["quantity","Quantity","number",true],["storageLocation","Storage location","text",false]]}
};

const industryModuleKeys = {
  "General retail shop": ["inventory","orders","stockLots","suppliers"],
  "Supermarket / Mini-mart": ["inventory","orders","stockLots","suppliers","purchaseOrders"],
  "Clothing / Fashion shop": ["inventory","orders","stockLots","suppliers"],
  "Furniture / Home goods shop": ["inventory","orders","suppliers","deliveryOrders"],
  "Electronics / Phone shop": ["inventory","orders","stockLots","suppliers"],
  "Hardware / Building supplies shop": ["inventory","orders","stockLots","suppliers","purchaseOrders"],
  "Salon": ["appointments","services","staff","inventory"],
  "Barbershop": ["appointments","services","staff"],
  "Spa / Wellness centre": ["appointments","services","staff","inventory"],
  "Nursery / Primary school": ["studentAdmissions","students","classes","attendance","academicResults","timetables","feeLedger","staffAttendance","libraryLoans"],
  "Secondary school": ["studentAdmissions","students","classes","attendance","academicResults","timetables","feeLedger","staffAttendance","libraryLoans"],
  "College / Training institute": ["studentAdmissions","students","classes","attendance","academicResults","timetables","feeLedger","staffAttendance"],
  "Church / Faith organisation": ["churchMembers","events","givingLedger","attendance","outreach"],
  "NGO / Community organisation": ["members","outreach","events","donations","projects"],
  "Restaurant": ["menu","orders","tableMap","recipeCosting","foodSafety","reservations","inventory"],
  "Catering business": ["menu","orders","recipeCosting","foodSafety","bookings","inventory"],
  "Hotel / Guesthouse": ["bookings","guestRegister","roomBoard","menu","orders","inventory","fleetMaintenance"],
  "Tour operator / Travel agency": ["tourItineraries","bookings","reservations","fleetMaintenance","customers"],
  "Transport / Taxi / Shuttle": ["bookings","fleetMaintenance","trips","deliveryOrders"],
  "Construction contractor": ["projects","estimates","siteDailyLogs","materials","safetyChecks","purchaseOrders"],
  "Cleaning company": ["cleaningSchedules","cleaningChecklist","chemicalRegister","staffAttendance","estimates"],
  "Clinic / Medical practice": ["clinicalVisits","patientQueue","clinicalVitals","prescriptions","staffAttendance"],
  "Pharmacy": ["medicines","dispensing","prescriptions","stockLots","suppliers","purchaseOrders"],
  "Real estate agency": ["properties","viewings","quotes","customers","events"],
  "Property / Rental management": ["properties","rentalLedger","viewings","propertyMaintenance","estimates"],
  "Printing shop": ["printProduction","quotes","inventory","purchaseOrders","deliveryOrders"],
  "Branding / Advertising agency": ["creativePipeline","quotes","projects","events"],
  "Web / Creative agency": ["creativePipeline","quotes","projects","events"],
  "Event planner / Decorator": ["eventRunsheet","bookings","inventory","quotes","suppliers"],
  "Mechanic / Garage": ["vehicleJobs","workOrders","inventory","stockLots","suppliers","estimates"],
  "Plumbing / Electrical services": ["workOrders","estimates","materials","fleetMaintenance","safetyChecks"],
  "Repair / Field technician": ["workOrders","estimates","inventory","stockLots","fleetMaintenance"],
  "Wholesale supplier / Distributor": ["inventory","stockLots","suppliers","purchaseOrders","orderFulfilment","deliveryOrders"],
  "Other specialist business": ["workOrders","estimates","bookings"],
  "Retail / Shop": ["inventory","orders","stockLots","suppliers"],
  "Salon / Barber / Spa": ["appointments","services","staff","inventory"],
  "School / Training": ["studentAdmissions","students","classes","attendance","academicResults","timetables","feeLedger"],
  "Church / Community organisation": ["churchMembers","events","givingLedger","attendance","outreach"],
  "Restaurant / Catering": ["menu","orders","tableMap","recipeCosting","foodSafety","reservations","inventory"],
  "Construction / Contractor": ["projects","estimates","siteDailyLogs","materials","safetyChecks","purchaseOrders"],
  "Clinic / Pharmacy": ["clinicalVisits","patientQueue","clinicalVitals","prescriptions"],
  "Cleaning services": ["cleaningSchedules","cleaningChecklist","chemicalRegister","staffAttendance","estimates"],
  "Real estate": ["properties","viewings","rentalLedger","propertyMaintenance"],
  "Agency / Printing / Branding": ["printProduction","creativePipeline","quotes","projects"],
  "Transport / Tours / Guesthouse": ["bookings","guestRegister","roomBoard","tourItineraries","fleetMaintenance"],
  "Repairs / Technical services": ["workOrders","estimates","inventory","stockLots","fleetMaintenance"],
  "Supplier / Distributor": ["inventory","stockLots","suppliers","purchaseOrders","orderFulfilment","deliveryOrders"],
  "Other": ["workOrders","estimates","bookings"]
};
const moduleIcons = {inventory:"▦",suppliers:"⇄",appointments:"◷",services:"✦",students:"♧",classes:"▤",attendance:"✓",members:"♙",events:"✧",donations:"♡",menu:"☷",orders:"▤",projects:"▧",materials:"▦",medicines:"✚",serviceJobs:"⚒",cleaningSchedules:"◷",properties:"⌂",viewings:"⌖",printJobs:"▧",quotes:"▤",bookings:"◷",fleet:"▰",trips:"➜",purchaseOrders:"⇄",deliveryOrders:"➜",studentAdmissions:"🎓",academicResults:"📊",timetables:"🗓",feeLedger:"💳",staffAttendance:"🕘",libraryLoans:"📚",churchMembers:"⛪",givingLedger:"♡",outreach:"🤝",tableMap:"🍽",recipeCosting:"🥘",foodSafety:"🧼",roomBoard:"🛏",guestRegister:"🛎",tourItineraries:"🗺",fleetMaintenance:"🚐",siteDailyLogs:"🏗",estimates:"🧾",safetyChecks:"⚠",cleaningChecklist:"🧹",chemicalRegister:"🧴",clinicalVisits:"🩺",clinicalVitals:"🩺",prescriptions:"💊",dispensing:"💊",workOrders:"🧰",vehicleJobs:"🔧",printProduction:"🖨",creativePipeline:"🎨",eventRunsheet:"🎪",rentalLedger:"🏠",propertyMaintenance:"🔨",reservations:"📅",patientQueue:"🏥",orderFulfilment:"📦",stockLots:"🏷"};
function renderIndustryModules(industry) {
  const nav = $("#sidebar-modules");
  if (!nav) return;
  nav.replaceChildren();
  const keys = industryModuleKeys[industry] || industryModuleKeys["Other specialist business"];
  $("#industry-modules-intro").textContent = "A live snapshot of " + (industry || "your business") + " operations. Use the sidebar to open each specialist module.";
  if (window.matchMedia("(max-width: 680px)").matches) $("#workspace-sidebar").classList.add("hidden");
  else $("#workspace-sidebar").classList.remove("hidden");
  $("#metric-modules").textContent = String(keys.filter(key => moduleDefinitions[key]).length);
  keys.forEach(key => {
    const def = moduleDefinitions[key];
    if (!def) return;
    const link = document.createElement("button");
    link.type = "button";
    link.className = "sidebar-module-link";
    link.dataset.module = key;
    const icon = document.createElement("span");
    icon.className = "sidebar-module-icon";
    icon.textContent = moduleIcons[key] || "•";
    const label = document.createElement("span");
    label.textContent = def.title;
    link.append(icon, label);
    link.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 680px)").matches) $("#workspace-sidebar").classList.add("hidden");
      openModule(key);
    });
    nav.append(link);
  });
  loadOverviewMetrics(keys);
}
async function loadOverviewMetrics(keys) {
  const output = $("#metric-records");
  if (!output || !currentBusinessId || !firestoreApi) return;
  output.textContent = "…";
  try {
    const collections = [...new Set(keys.map(key => moduleDefinitions[key]?.collection).filter(Boolean))];
    const snapshots = await Promise.all(collections.map(name =>
      firestoreApi.getDocs(firestoreApi.collection(firestoreApi.db, "businesses", currentBusinessId, name))
    ));
    output.textContent = String(snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0));
  } catch (error) {
    output.textContent = "—";
    console.warn("Overview metrics could not be refreshed:", error);
  }
}
const moduleWorkflowGuides = {
  inventory: {who:"Store owner, stock controller, cashier",when:"Whenever goods are received, sold, moved, counted, damaged or returned.",steps:["Create each item with a unique code, unit, cost and reorder threshold.","Record receipts and stock adjustments against a reason or source document.","Check low-stock items before raising a purchase order.","Count physical stock regularly and investigate differences."],controls:"Use consistent units, record adjustments with reasons, and restrict write-offs."},
  stockLots: {who:"Stock controller, pharmacist or store manager",when:"When a supplier delivers a batch and whenever stock is issued, counted or expires.",steps:["Record batch or lot number, received quantity and expiry date where applicable.","Keep batches traceable to the supplier and purchase receipt.","Issue the earliest-expiring suitable lot first where policy requires it.","Quarantine expired, recalled or damaged stock and document the disposition."],controls:"Never silently overwrite batch history; expiry and recall handling must be auditable."},
  suppliers: {who:"Purchasing officer, store manager, accounts",when:"Before ordering and when supplier details, prices or delivery performance change.",steps:["Register verified supplier contacts and the products they provide.","Compare quotes, delivery times and payment terms before ordering.","Link receipts and shortages to the supplier and purchase order.","Review quality, delivery reliability and outstanding balances."],controls:"Verify supplier identity and keep purchase approvals separate from receipt confirmation where possible."},
  purchaseOrders: {who:"Buyer, approving manager, receiving storekeeper",when:"After a reorder need is confirmed and before goods are expected.",steps:["Select supplier and item quantities with agreed prices.","Obtain approval before sending the order when required.","Record partial deliveries and shortages against the original order.","Close the order only after the received quantities are checked."],controls:"Avoid duplicate orders; retain references and receiving evidence."},
  deliveryOrders: {who:"Order desk, packer, driver, recipient",when:"After an order is confirmed and before dispatch, delivery or return.",steps:["Confirm the order and delivery address or service area.","Pick and check the items, then record who packed and dispatched them.","Update delivery status and capture recipient confirmation.","Record failed delivery, damage or return and decide the next action."],controls:"Do not mark delivered without confirmation; protect recipient contact details."},
  orders: {who:"Waiter, cashier, kitchen or fulfilment team",when:"For each customer order, then at every preparation and handover stage.",steps:["Create a unique ticket and capture items, modifiers and table or customer.","Route the ticket to the correct preparation station.","Move it through new, preparing, ready and served/collected states.","Reconcile payment, cancellations and any returned items."],controls:"Use a unique ticket number and require a reason or permission for voids."},
  menu: {who:"Restaurant manager, chef, cashier",when:"When dishes, prices, availability, allergens or portion sizes change.",steps:["Create each menu item with category and selling price.","Mark temporarily unavailable items before taking orders.","Maintain ingredient and allergen information alongside recipes where supported.","Review price and availability before each service period."],controls:"Do not imply allergen safety unless ingredients and preparation controls are verified."},
  tableMap: {who:"Host, waiter, shift supervisor",when:"At opening, seating, transfers, bill splitting and table turnover.",steps:["Set up table identifiers and capacity.","Assign a party to a free table and link their order.","Track occupied, awaiting bill and cleaning states.","Release a table only after payment and turnover are confirmed."],controls:"Avoid double-seating; preserve order-to-table links during transfers."},
  recipeCosting: {who:"Chef, kitchen manager, purchaser",when:"When a recipe or portion changes, ingredient costs move, or menu prices are reviewed.",steps:["Define ingredients and quantities for a standard portion or batch.","Use current ingredient unit costs to calculate cost per serving.","Compare cost with selling price and target margin.","Update stock consumption and recipe version when approved."],controls:"Cost estimates depend on accurate units, yield and waste assumptions."},
  foodSafety: {who:"Food safety lead, kitchen staff, shift manager",when:"At opening, receiving, storage checks, preparation and closing.",steps:["Record required temperature, cleaning and hygiene checks with time and responsible person.","Log deviations, corrective action and re-check result.","Track supplier, storage and date labels where relevant.","Escalate unresolved critical checks before affected food is served."],controls:"This log supports—not replaces—local food-safety procedures and inspections."},
  bookings: {who:"Reservations agent, receptionist, service coordinator",when:"On enquiry, confirmation, arrival, change, cancellation and completion.",steps:["Capture customer, date range, party or unit count and requested service.","Check capacity and conflicts before confirming.","Record deposits, balance due and any change or cancellation reason.","Close the booking after the service and reconcile outstanding payment."],controls:"Avoid double booking; clearly distinguish requested from confirmed reservations."},
  reservations: {who:"Reservation desk, host or front office",when:"For advance bookings, walk-ins, changes and cancellations.",steps:["Check availability for the requested time, room, table or service.","Capture guest details, party size, special requests and confirmation status.","Track arrival, seating/check-in and no-show or cancellation outcome.","Release the capacity only when the reservation is cancelled or completed."],controls:"Confirm availability before promising a reservation; limit access to guest details."},
  guestRegister: {who:"Reception, front desk, authorised property manager",when:"At guest arrival, during a stay and at departure.",steps:["Match the guest to a confirmed booking or create an authorised walk-in record.","Record check-in time, allocated room and required registration details.","Coordinate special requests and authorised room changes.","Complete checkout and hand over room status to housekeeping."],controls:"Collect only necessary guest information and restrict access to registration data."},
  roomBoard: {who:"Reception, housekeeping, maintenance",when:"At each check-in/out, cleaning completion, inspection and room fault.",steps:["Maintain a room list and current status: clean, occupied, dirty, inspected or out of order.","Create cleaning work when guests depart or rooms need service.","Record inspection and faults before returning rooms to sale.","Coordinate front desk availability with housekeeping status."],controls:"Never assign an out-of-order room; status changes need a responsible user."},
  students: {who:"Admissions office, class teacher, school administrator",when:"At enrolment, class promotion, transfer, guardian update and exit.",steps:["Create a unique learner ID and verify biodata and guardian contacts.","Assign the learner to the correct academic year, class and stream.","Update status only with an authorised reason and preserve history.","Use the same learner identifier in attendance, fees and assessment records."],controls:"Limit access to minors' information and verify guardian contact changes."},
  studentAdmissions: {who:"Admissions officer, head teacher or registrar",when:"From application receipt through review, offer and enrolment.",steps:["Record applicant, programme/class applied for, date and required documents.","Review completeness and mark missing items for follow-up.","Record an authorised decision and communicate the next step.","Create the active student record after admission is confirmed."],controls:"Avoid duplicate learner records; record decision dates and responsible staff."},
  attendance: {who:"Class teacher, trainer or authorised register taker",when:"At the start of each class, session or scheduled activity.",steps:["Choose the class or group and date before taking the register.","Mark each person present, absent, late or excused using the institution's policy.","Review missing entries and correct errors with an explanation.","Use attendance summaries for follow-up, not as a substitute for safeguarding procedures."],controls:"Prevent duplicate registers for the same group and session; restrict edits after approval."},
  academicResults: {who:"Subject teacher, examiner, head of department, registrar",when:"After an assessment and before results are approved or published.",steps:["Choose learner, subject, assessment period and maximum score.","Enter marks and validate that scores are within the permitted range.","Review missing marks and moderation or approval requirements.","Publish or export results only after authorised review."],controls:"Lock or audit approved results and restrict access by class/subject role."},
  timetables: {who:"Academic coordinator, administrator, teachers",when:"At term setup and whenever a class, room or teacher changes.",steps:["Define classes, subjects, instructors, rooms and periods.","Check for teacher, class and room clashes before publishing.","Approve the timetable and communicate changes to affected people.","Keep a dated version so staff know which schedule is current."],controls:"The current starter form captures timetable entries; automated clash detection is a next-stage enhancement."},
  feeLedger: {who:"Bursar, cashier, school administrator",when:"At fee assessment, each payment, credit/waiver and statement request.",steps:["Define fee type and amount due for the learner and term.","Record each payment with date, method and reference; do not replace prior payments.","Calculate balance from charges less valid payments and approved adjustments.","Issue a receipt and reconcile collections with cash/mobile-money/bank records."],controls:"A ledger form alone is not a full accounting system; require reconciliation and immutable receipt references."},
  libraryLoans: {who:"Librarian, student or staff borrower",when:"At cataloguing, issue, renewal, return and overdue follow-up.",steps:["Register each book or resource with a unique catalogue identifier.","Issue it to a borrower with checkout date and due date.","Record returns, renewals, loss or damage and any policy-based fine.","Review overdue items and stock availability."],controls:"Track copies separately from titles and preserve a history of loans."},
  clinicalVisits: {who:"Authorised clinician and reception staff within their roles",when:"For a scheduled or walk-in encounter and follow-up visit.",steps:["Verify patient identity and appointment or triage context.","Record only necessary visit information under the clinician's workflow.","Document assessment, plan and follow-up in the approved clinical record.","Close the encounter only after required review and documentation."],controls:"Prototype only: do not use for real patient records until access control, audit, backups and applicable Ugandan health-data requirements are implemented and reviewed."},
  clinicalVitals: {who:"Trained clinical staff",when:"During triage and at clinically indicated reassessment.",steps:["Verify patient identity and encounter before recording measurements.","Record value, unit, measurement time and responsible staff member.","Flag out-of-range readings for clinician review according to local protocol.","Keep repeat measurements distinct rather than overwriting earlier readings."],controls:"Prototype only; no automated diagnosis or clinical decision support is implied."},
  patientQueue: {who:"Reception, triage nurse, clinician",when:"When a patient arrives, is triaged, called, seen or referred.",steps:["Register arrival and appointment/walk-in type.","Use the clinic's triage protocol to prioritise urgent cases.","Update waiting, called, in consultation and completed states.","Review waiting time and unresolved patients throughout the shift."],controls:"Queue visibility should reveal minimal patient data in public areas."},
  prescriptions: {who:"Authorised prescriber and dispensing professional",when:"After a clinical decision and before dispensing or renewal.",steps:["Verify patient and encounter and enter the legally required prescription details.","Check medicine, dose, route, frequency, duration and allergy/interaction information using approved systems.","Require the appropriate prescriber authorisation and document changes.","Link dispensing and counselling to the prescription where permitted."],controls:"Prototype only—not safe for live prescribing until clinical validation, permissions, audit and regulatory review are complete."},
  dispensing: {who:"Licensed/authorised pharmacy professional",when:"When filling a valid prescription or making an authorised sale.",steps:["Validate prescription and patient/product details under pharmacy policy.","Select the correct product and batch, checking expiry and quantity.","Record quantity supplied, dispenser, date and counselling/collection status.","Deduct stock from the exact batch and document returns or corrections."],controls:"Prototype only; requires pharmacy-grade validation, access controls and auditability before live use."},
  siteDailyLogs: {who:"Site supervisor, foreperson, project manager",when:"At the end of each site day and after significant incidents or delays.",steps:["Record date, site, crew, work completed and quantities achieved.","Capture weather, equipment, deliveries, delays and instructions affecting progress.","Log incidents, inspections and corrective actions separately.","Review and approve the daily report for the project record."],controls:"Keep time-stamped records and attach supporting evidence in a future enhancement."},
  safetyChecks: {who:"Site safety lead, supervisor, authorised workers",when:"Before work starts, after a change, and during scheduled inspections.",steps:["Select the activity/equipment and use the relevant approved checklist.","Record pass/fail/NA, finding, risk and responsible person.","Assign corrective action and due time for failed checks.","Verify closure before the affected work resumes where required."],controls:"Use site-specific approved safety procedures; the starter module is not a certified safety system."},
  estimates: {who:"Estimator, service manager, approving customer",when:"Before work is authorised and whenever scope or cost changes.",steps:["Capture scope, quantities, labour, materials, exclusions and validity period.","Calculate the estimate from documented rates and assumptions.","Review internally, then issue the approved version to the customer.","Track acceptance or rejection and convert approved scope into a job or project."],controls:"Keep revisions and customer approval evidence; this starter module records estimates but does not generate a formal quote PDF."},
  workOrders: {who:"Dispatcher, technician, customer contact",when:"From service request through diagnosis, work, testing and sign-off.",steps:["Capture fault/request, location, priority and customer contact.","Assign a technician, schedule the visit and record parts required.","Record diagnosis, work performed, parts used and test outcome.","Get customer sign-off and close or schedule a follow-up."],controls:"Keep status history and separate quoted work from approved work."},
  vehicleJobs: {who:"Service advisor, mechanic, parts store, vehicle owner",when:"At vehicle intake, diagnosis, repair approval, testing and handover.",steps:["Record vehicle identity, odometer, reported fault and intake condition.","Document diagnosis and estimate before carrying out chargeable work.","Track parts, labour, technician, repair progress and quality checks.","Record road/test result, customer approval and collection."],controls:"Maintain vehicle/job history and require approval for additional work."},
  appointments: {who:"Receptionist, service provider, customer",when:"At booking, confirmation, arrival, reschedule, completion and cancellation.",steps:["Choose a service, provider, date and available slot.","Confirm with the customer and record special requirements.","Mark arrival and completion or capture cancellation/no-show.","Review daily schedule and follow up on unconfirmed appointments."],controls:"The current form stores appointment entries; live calendar conflict checking and reminders are future integrations."},
  services: {who:"Owner, service manager, assigned staff",when:"When a service is introduced, repriced or changes duration/requirements.",steps:["Define service name, standard duration, price and required skill/equipment.","Assign eligible staff and make the service bookable only when available.","Review service profitability and customer feedback periodically.","Update the catalogue without altering completed historical jobs."],controls:"Store prices and duration consistently; future bookings should snapshot the price at booking time."},
  cleaningSchedules: {who:"Operations manager, supervisor, cleaning team",when:"When recurring work is planned and at each scheduled visit.",steps:["Register client/site, scope, frequency, scheduled date and assigned team.","Issue the task list for the site and confirm access/materials.","Record completion, exceptions and supervisor inspection.","Reschedule missed work and capture customer sign-off where required."],controls:"Track chemicals and safety requirements separately; never treat a schedule alone as proof of quality."},
  cleaningChecklist: {who:"Cleaning supervisor and assigned cleaner",when:"Before, during and after a cleaning job according to the site checklist.",steps:["Load the checklist appropriate to room/site and service type.","Mark tasks complete and note any inaccessible or failed item.","Record supervisor inspection and corrective rework.","Close the job only after required checks are complete."],controls:"Use site-specific checklists and avoid marking tasks complete in advance."},
  chemicalRegister: {who:"Cleaning manager, chemical storekeeper, safety lead",when:"When a chemical is received, issued, diluted, used or disposed of.",steps:["Record product identity, supplier and safety documentation location.","Track quantity, storage location, issue and expiry where applicable.","Record required PPE, dilution and handling instructions from the product label/SDS.","Log spills, incidents and safe disposal according to policy."],controls:"Never substitute this register for current safety data sheets or local hazardous-substance requirements."},
  properties: {who:"Real estate agent, property manager, owner",when:"When listing, updating availability, reserving, renting or selling a property.",steps:["Create a unique property reference with location, type and key features.","Record asking price/rent, availability and authorised listing status.","Link viewings, offers, tenancy or sale paperwork to the property reference.","Update status promptly when reserved, rented, sold or withdrawn."],controls:"Restrict access to owner/tenant documents and preserve listing change history."},
  viewings: {who:"Agent, prospective buyer/tenant, property contact",when:"When a prospect requests a viewing or an inspection is due.",steps:["Link the viewing to a property and prospect.","Agree a date/time and assign the responsible agent.","Record attendance, feedback and next action after the visit.","Reschedule or close cancelled viewings and follow up on active prospects."],controls:"Confirm property access and avoid exposing tenant details unnecessarily."},
  rentalLedger: {who:"Property manager, landlord, accounts officer, tenant (limited view)",when:"At rent due dates, payment, deposit adjustment, arrears review and move-out.",steps:["Record tenancy, rent amount, billing period and due date.","Record each receipt with method, reference and period paid.","Calculate arrears and credits from dated ledger entries.","Reconcile deposits, adjustments and final statement at move-out."],controls:"Keep receipts and adjustments traceable; seek local review for legal tenancy and deposit rules."},
  propertyMaintenance: {who:"Tenant/contact, property manager, contractor",when:"When a fault is reported, work is assigned, inspected and closed.",steps:["Record property, reported issue, priority and access arrangements.","Assign contractor and capture estimate/approval where needed.","Track work, costs, evidence and tenant/owner updates.","Verify repair and close the ticket or schedule further work."],controls:"Escalate urgent safety/security faults and preserve approvals."},
  printProduction: {who:"Sales/prepress, designer, production operator, quality checker",when:"From customer brief and artwork approval through production and delivery.",steps:["Capture job specification, dimensions, stock/material, quantity, finishing and deadline.","Confirm artwork proof and customer approval before production.","Track prepress, printing, finishing, quality inspection and waste/rework.","Record packed quantity, delivery and final balance."],controls:"Use versioned job tickets and verify final artwork, quantity and finishing before release."},
  creativePipeline: {who:"Account manager, strategist, designer, reviewer, client",when:"At enquiry, briefing, proposal, production review and client approval.",steps:["Capture client, objective, deliverables, budget, deadline and decision-maker.","Move work through brief, proposal, production, internal review and client review.","Track feedback rounds, approvals, scope changes and assets.","Record final delivery and lessons/renewal opportunities."],controls:"Version deliverables and distinguish client-approved work from drafts."},
  eventRunsheet: {who:"Event planner, venue lead, suppliers, stage manager",when:"During planning and on event day as each milestone is prepared or completed.",steps:["Record event timings, venue, owners, suppliers and dependencies.","Create a timed run sheet for setup, arrivals, programme, catering and breakdown.","Assign a named owner and contingency for critical milestones.","Update live status and record incidents or post-event follow-ups."],controls:"Share role-appropriate versions and keep one current master schedule."},
  tourItineraries: {who:"Tour operator, guide/driver, suppliers, traveller",when:"At trip design, booking confirmation and before/during departure.",steps:["Define route, stops, timings, inclusions, exclusions and traveller requirements.","Check transport capacity, supplier availability and realistic transfer times.","Attach booking references and emergency contacts to the authorised itinerary.","Record changes, attendance and trip completion feedback."],controls:"Confirm suppliers and travel requirements; an itinerary is not proof that a booking is confirmed."},
  fleetMaintenance: {who:"Fleet manager, driver/operator, mechanic",when:"At pre-trip checks, scheduled service, fault report and return to service.",steps:["Register vehicle/asset identity, odometer and service intervals.","Log inspections, defects, parts, maintenance work and cost.","Schedule next service based on time or usage thresholds.","Mark unavailable assets off duty until safety checks and repairs are complete."],controls:"Use verified maintenance intervals and preserve inspection history."},
  givingLedger: {who:"Treasurer, authorised finance officer, donor (limited access)",when:"Whenever a contribution is received, allocated, refunded or reconciled.",steps:["Record amount, date, fund/purpose and payment method/reference.","Issue a receipt and reconcile against cash, bank or mobile-money statements.","Allocate restricted contributions only to their stated purpose.","Produce period summaries for authorised governance review."],controls:"Restrict donor details, preserve receipts and require dual approval for refunds/adjustments."},
  churchMembers: {who:"Membership secretary, ministry leader, authorised administrator",when:"At registration, group assignment, contact change and membership status change.",steps:["Record member details and consented contact preferences.","Assign ministry/group and appropriate membership status.","Update changes while keeping an authorised history of important status decisions.","Use group lists only for the purposes the organisation has approved."],controls:"Limit personal data and avoid sharing sensitive pastoral notes broadly."},
  orderFulfilment: {who:"Order desk, warehouse picker, packer, dispatch lead",when:"After an order is accepted through packing, dispatch and delivery confirmation.",steps:["Validate order lines, quantities, payment/credit status and delivery promise.","Reserve stock and generate picking/packing work.","Check packed goods against the order and record dispatch handover.","Reconcile short picks, substitutions, returns and proof of delivery."],controls:"Do not dispatch unapproved credit orders; maintain traceability from order to delivery."}
};
function renderWorkflowGuide(key) {
  const target = $("#module-workflow-guide");
  if (!target) return;
  const guide = moduleWorkflowGuides[key] || {
    who:"The staff member responsible for this process and the approving manager",
    when:"Whenever a new record is created, a status changes, or a review is due.",
    steps:["Capture complete and accurate information before saving.","Assign a responsible person and a clear next action.","Update the record when work progresses and keep supporting references.","Review open items regularly and close them only when the outcome is confirmed."],
    controls:"Use unique references, least-privilege access and a traceable correction process."
  };
  target.replaceChildren();
  const title = document.createElement("h2"); title.textContent = "How this module works";
  const meta = document.createElement("div"); meta.className = "workflow-meta";
  [["Who uses it",guide.who],["When to use it",guide.when],["Key controls",guide.controls]].forEach(([label,value])=>{
    const item=document.createElement("div"); item.className="workflow-meta-item";
    const strong=document.createElement("strong"); strong.textContent=label;
    const p=document.createElement("p"); p.textContent=value;
    item.append(strong,p); meta.append(item);
  });
  const stepsTitle=document.createElement("h3"); stepsTitle.textContent="Recommended workflow";
  const list=document.createElement("ol"); list.className="workflow-steps";
  guide.steps.forEach(step=>{const li=document.createElement("li");li.textContent=step;list.append(li);});
  target.append(title,meta,stepsTitle,list);
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
  renderWorkflowGuide(key);
  document.querySelectorAll(".sidebar-module-link").forEach(link => link.classList.toggle("active", link.dataset.module === key));
  $("#sidebar-overview").classList.remove("active");
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
    moduleDefinitions[activeModule].fields.forEach(([name,,type])=>{const input=recordForm.elements.namedItem(name);data[name]=type==="number" ? (input.value==="" ? null : Number(input.value)) : input.value.trim();});
    data.createdAt=firestoreApi.serverTimestamp();
    data.updatedAt=firestoreApi.serverTimestamp();
    await firestoreApi.addDoc(recordsCollection(activeModule),data);
    recordForm.reset();
    setMessage($("#record-message"),"Saved successfully.",true);
    await loadRecords();
  } catch(error) { setMessage($("#record-message"),"Could not save record. "+readableError(error)); }
  finally { button.disabled=false; }
});

function showClientOverview() {
  moduleView.classList.add("hidden");
  dashboardPanel.classList.remove("hidden");
  activeModule = null;
  $("#sidebar-overview").classList.add("active");
  document.querySelectorAll(".sidebar-module-link").forEach(link => link.classList.remove("active"));
}
$("#module-back").addEventListener("click", showClientOverview);
$("#sidebar-overview").addEventListener("click", () => {
  showClientOverview();
  if (window.matchMedia("(max-width: 680px)").matches) $("#workspace-sidebar").classList.add("hidden");
});
$("#sidebar-open").addEventListener("click", () => $("#workspace-sidebar").classList.remove("hidden"));
$("#sidebar-close").addEventListener("click", () => $("#workspace-sidebar").classList.add("hidden"));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && window.matchMedia("(max-width: 680px)").matches) {
    $("#workspace-sidebar").classList.add("hidden");
  }
});
updateMode();
