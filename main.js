document.addEventListener('DOMContentLoaded', function() {


  auth.onAuthStateChanged(function(user) {
    if (user) {
      // User is logged in with Firebase
      console.log("Firebase user detected:", user.email);

      // Load Firestore profile (if saved)
      db.collection("users").doc(user.uid).get()
        .then(doc => {
          if (doc.exists) {
            const data = doc.data();

            document.getElementById('userInfo').innerHTML = `
              <p>Welcome, <strong>${data.fullName}</strong>!</p>
              <p>Username: ${data.username}</p>
              <p>Email: ${data.email}</p>
            `;
          } else {
            // Firebase user exists but no Firestore profile
            document.getElementById('userInfo').innerHTML = `
              <p>Welcome!</p>
              <p>Email: ${user.email}</p>
              <p>(Profile not found in Firestore)</p>
            `;
          }
        });

    } else {

      const currentUser = JSON.parse(localStorage.getItem('currentUser'));

      if (!currentUser) {
        window.location.href = 'index.html';
        return;
      }

      document.getElementById('userInfo').innerHTML = `
        <p>Welcome, <strong>${currentUser.fullName}</strong>!</p>
        <p>Username: ${currentUser.username}</p>
        <p>Email: ${currentUser.email}</p>
      `;
    }
  });

});


// -------------------------------------------------------
// LOGOUT
// -------------------------------------------------------
function logout() {

  // Try Firebase logout first
  auth.signOut()
    .then(() => {
      console.log("Firebase logout successful");
    })
    .catch(err => {
      console.warn("Firebase logout failed (maybe not logged in):", err);
    });

  // Always clear localStorage for backward compatibility
  localStorage.removeItem('currentUser');

  // Redirect
  window.location.href = 'index.html';
}

