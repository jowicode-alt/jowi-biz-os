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
      const business = businessDoc.data();
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
    updateProfile: authModule.updateProfile,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged
  };
  firestoreApi = {
    db,
    collection: firestoreModule.collection,
    query: firestoreModule.query,
    where: firestoreModule.where,
    getDocs: firestoreModule.getDocs,
    addDoc: firestoreModule.addDoc,
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

updateMode();
