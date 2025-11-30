import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const usernameInput = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    loginError.textContent = '';

    let emailToUse = usernameInput;
    if (!usernameInput.includes('@')) {
      emailToUse = usernameInput + "@dynt.fake";
    }

    try {
      const loginResult = await signInWithEmailAndPassword(auth, emailToUse, password);
      const user = loginResult.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        loginError.textContent = 'Account data not found.';
        return;
      }

      const userData = userSnap.data();
      localStorage.setItem('currentUser', JSON.stringify(userData));
      
      alert('Login successful! Redirecting to main page...');
      window.location.href = 'main.html';

    } catch (error) {
      loginError.textContent = 'Invalid login. Please try again.';
    }
  });
});
