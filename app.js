// Firebase web configuration is added after copying it from Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyB-dlQtjt9r_iKrM7GytukIjOPDN_zcBpY",
  authDomain: "jowi-biz-os.firebaseapp.com",
  projectId: "jowi-biz-os",
  storageBucket: "jowi-biz-os.firebasestorage.app",
  messagingSenderId: "821672776356",
  appId: "1:821672776356:web:1fd58e0a923807299ccc31"
};

const form = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const nameInput = document.querySelector("#full-name");
const nameWrap = document.querySelector("#name-wrap");
const submitButton = document.querySelector("#submit-btn");
const switchButton = document.querySelector("#switch-mode");
const switchLabel = document.querySelector("#switch-label");
const title = document.querySelector("#auth-title");
const subtitle = document.querySelector("#auth-subtitle");
const message = document.querySelector("#auth-message");
let mode = "signin";
let authApi = null;

function setMessage(text, success = false) {
  message.textContent = text;
  message.style.color = success ? "#27764f" : "#b33b31";
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
  setMessage("");
}

switchButton.addEventListener("click", () => {
  mode = mode === "signin" ? "signup" : "signin";
  updateMode();
});

try {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js");
  const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } =
    await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js");
  if (Object.values(firebaseConfig).some(value => String(value).startsWith("REPLACE_WITH"))) {
    setMessage("Firebase setup needed: add the Web app configuration from Firebase Console before signing in.");
  } else {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    authApi = { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile };
  }
} catch (error) {
  setMessage("Could not initialise Firebase. Check the web app configuration and internet connection.");
  console.error(error);
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authApi) {
    setMessage("Authentication is not ready yet. Add the Firebase Web app configuration first.");
    return;
  }
  submitButton.disabled = true;
  setMessage("");
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (mode === "signup") {
      const credential = await authApi.createUserWithEmailAndPassword(authApi.auth, email, password);
      await authApi.updateProfile(credential.user, { displayName: nameInput.value.trim() });
      setMessage("Account created. Business workspace setup is the next step.", true);
    } else {
      await authApi.signInWithEmailAndPassword(authApi.auth, email, password);
      setMessage("Signed in successfully. Business dashboard setup is the next step.", true);
    }
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "That email already has an account. Try signing in.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password": "Choose a stronger password with at least 6 characters.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Authentication."
    };
    setMessage(messages[error.code] || error.message || "Authentication failed. Please try again.");
  } finally {
    submitButton.disabled = false;
  }
});
