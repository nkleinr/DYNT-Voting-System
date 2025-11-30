import { 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  doc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  const passwordError = document.getElementById('passwordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');

  function validatePassword(password) {
    const minLength = 8;
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (password.length < minLength) return 'Password must be at least 8 characters long';
    if (!hasCapital) return 'Password must include at least 1 capital letter';
    if (!hasNumber) return 'Password must include at least 1 number';
    return null;
  }

  signupForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const age = document.getElementById('age').value;
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    passwordError.textContent = '';
    confirmPasswordError.textContent = '';

    const passwordErrorMsg = validatePassword(password);
    if (passwordErrorMsg) {
      passwordError.textContent = passwordErrorMsg;
      return;
    }

    if (password !== confirmPassword) {
      confirmPasswordError.textContent = 'Passwords do not match';
      return;
    }

    if (age < 13) {
      alert('You must be at least 13 years old to sign up.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: fullName });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName,
        username,
        age: parseInt(age),
        email,
        createdAt: new Date().toISOString()
      });

      alert("Account created successfully!");
      window.location.href = "index.html";

    } catch (error) {
      alert("Error: " + error.message);
    }
  });
});
