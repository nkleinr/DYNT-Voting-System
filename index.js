import { 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const usernameOrEmail = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    loginError.textContent = '';

    try {
      const email = usernameOrEmail.includes("@") 
        ? usernameOrEmail 
        : usernameOrEmail + "@dynt.fake.com";

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        loginError.textContent = "User profile not found.";
        return;
      }

      window.localStorage.setItem("currentUser", JSON.stringify(userSnap.data()));
      window.location.href = "main.html";

    } catch (error) {
      loginError.textContent = "Invalid login. Try again.";
    }
  });
});
