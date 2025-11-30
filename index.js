import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    loginError.textContent = '';

    try {
      // Find user by username
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const snap = await getDocs(q);

      if (snap.empty) {
        loginError.textContent = "Username not found.";
        return;
      }

      const userData = snap.docs[0].data();
      const realEmail = userData.email;

      // Login with the REAL email
      const loginResult = await signInWithEmailAndPassword(auth, realEmail, password);

      // Save user info for other pages
      localStorage.setItem("currentUser", JSON.stringify(userData));

      alert("Login successful! Redirecting...");
      window.location.href = "main.html";

    } catch (error) {
      loginError.textContent = "Invalid username or password.";
    }
  });
});
