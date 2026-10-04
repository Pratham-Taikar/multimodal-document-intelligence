const signInTab = document.getElementById("signInTab");
const signUpTab = document.getElementById("signUpTab");
const confirmPasswordField = document.getElementById("confirmPasswordField");
const form = document.getElementById("authForm");
const submitBtn = form.querySelector("button[type='submit']");

let isSignup = false;

/* ---------------- Modern Tab Toggle Logic ---------------- */

function switchToSignIn() {
    isSignup = false;
    confirmPasswordField.classList.add("hidden");
    submitBtn.innerText = "Sign In";

    // Active Sign In style (Modern Indigo Accent)
    signInTab.className = "flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition-all shadow-sm";
    
    // Inactive Sign Up style
    signUpTab.className = "flex-1 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all bg-transparent";
}

function switchToSignUp() {
    isSignup = true;
    confirmPasswordField.classList.remove("hidden");
    submitBtn.innerText = "Sign Up";

    // Active Sign Up style (Modern Indigo Accent)
    signUpTab.className = "flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition-all shadow-sm";
    
    // Inactive Sign In style
    signInTab.className = "flex-1 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all bg-transparent";
}

signInTab.addEventListener("click", switchToSignIn);
signUpTab.addEventListener("click", switchToSignUp);

// Auto-switch to Sign Up if accessed via /register
if (window.location.pathname.includes("register")) {
    switchToSignUp();
} else {
    switchToSignIn();
}

/* ---------------- Submit Logic ---------------- */

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = form.username.value.trim();
    const password = form.password.value.trim();
    const confirmPassword = form.confirmPassword?.value.trim();

    if (!username || !password) {
        showToast("All fields are required", "error");
        return;
    }

    if (isSignup && password !== confirmPassword) {
        showToast("Passwords do not match", "error");
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";

        const url = isSignup ? "/register" : "/login";

        const response = await axios.post(url, {
            username,
            password
        });

        showToast(response.data.message || "Success", "success");

        // Redirect after success
        setTimeout(() => {
            window.location.href = "/dashboard";
        }, 800);

    } catch (error) {
        if (error.response && error.response.data.message) {
            showToast(error.response.data.message, "error");
        } else {
            showToast("Authentication failed", "error");
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isSignup ? "Sign Up" : "Sign In";
    }
});
