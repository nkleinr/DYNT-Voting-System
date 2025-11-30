document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Clear previous errors
    loginError.textContent = '';

    auth.signInWithEmailAndPassword(username, password)
      .then((userCredential) => {
        console.log("Firebase Login Success:", userCredential.user);

        // Redirect to main page
        window.location.href = 'main.html';
      })
      .catch((error) => {
        console.warn("Firebase login failed, falling back to localStorage:", error);


        // Get users from localStorage
        const existingUsers = JSON.parse(localStorage.getItem('users') || '{}');

        // Check if user exists
        if (!existingUsers[username]) {
          loginError.textContent = 'Account not found. Please sign up.';
          return;
        }

        // Check password
        if (existingUsers[username].password !== password) {
          loginError.textContent = 'Wrong password. Please try again.';
          return;
        }

        // Login successful - store current user and redirect
        localStorage.setItem('currentUser', JSON.stringify(existingUsers[username]));
        
        alert('Login successful! Redirecting to main page...');
        window.location.href = 'main.html';
      });
  });
});
