import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("userInfo").innerHTML = `
        <p>Welcome, <strong>${data.fullName}</strong>!</p>
        <p>Username: ${data.username}</p>
        <p>Email: ${data.email}</p>
      `;
    }
  });
});

function logout() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
}
