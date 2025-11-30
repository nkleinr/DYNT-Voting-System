document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  const passwordError = document.getElementById('passwordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');

  // Password strength validation
  function validatePassword(password) {
    const minLength = 8;
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (password.length < minLength) {
      return 'Password must be at least 8 characters long';
    }
    if (!hasCapital) {
      return 'Password must include at least 1 capital letter';
    }
    if (!hasNumber) {
      return 'Password must include at least 1 number';
    }
    return null;
  }

  signupForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const age = document.getElementById('age').value;
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Clear previous errors
    passwordError.textContent = '';
    confirmPasswordError.textContent = '';

    // Validation - check password strength only on submit
    const passwordErrorMsg = validatePassword(password);
    if (passwordErrorMsg) {
      passwordError.textContent = passwordErrorMsg;
      return;
    }

    // Check if passwords match only on submit
    if (password !== confirmPassword) {
      confirmPasswordError.textContent = 'Passwords do not match';
      return;
    }

    if (age < 13) {
      alert('You must be at least 13 years old to sign up.');
      return;
    }

    // Check if username already exists
    const existingUsers = JSON.parse(localStorage.getItem('users') || '{}');
    if (existingUsers[username]) {
      alert('Username already exists. Please choose a different one.');
      return;
    }

    // ---------------------------------------------------------
    // FIREBASE
    // ---------------------------------------------------------
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        console.log("Firebase signup success:", userCredential.user);

        // Save additional profile info to Firestore
        db.collection("users").doc(userCredential.user.uid).set({
          fullName: fullName,
          age: parseInt(age),
          username: username,
          email: email
        });

        alert("Account created successfully! You can now login.");
        window.location.href = "index.html"; 
      })
      .catch((error) => {
        console.warn("Firebase signup failed — falling back to localStorage:", error);


        const newUser = {
          fullName,
          age: parseInt(age),
          username,
          email,
          password
        };

        existingUsers[username] = newUser;
        localStorage.setItem('users', JSON.stringify(existingUsers));

        alert('Account created successfully! (Local backup created)');
        window.location.href = 'main.html';
      });

  });
});
