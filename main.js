import { auth, db } from "./firebase-config.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const userInfoDiv = document.getElementById("userInfo");
  const logoutButton = document.getElementById("logoutButton");

  // ------------------------------
  // HANDLE AUTH STATE
  // ------------------------------
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("Firebase user logged in:", user.email);

      // Load Firestore data
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();

        userInfoDiv.innerHTML = `
          <p>Welcome, <strong>${data.fullName}</strong>!</p>
          <p>Username: ${data.username}</p>
          <p>Email: ${data.email}</p>
        `;
      } else {
        // Firestore profile not found
        userInfoDiv.innerHTML = `
          <p>Welcome!</p>
          <p>Email: ${user.email}</p>
          <p>(No Firestore profile found)</p>
        `;
      }

    } else {
      // Not logged in — try localStorage fallback
      const localUser = JSON.parse(localStorage.getItem("currentUser"));

      if (!localUser) {
        window.location.href = "index.html";
        return;
      }

      userInfoDiv.innerHTML = `
        <p>Welcome, <strong>${localUser.fullName}</strong>!</p>
        <p>Username: ${localUser.username}</p>
        <p>Email: ${localUser.email}</p>
      `;
    }
  });

  // ------------------------------
  // LOGOUT BUTTON
  // ------------------------------
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase signOut failed:", err);
    }

    // Always clear local backup
    localStorage.removeItem("currentUser");

    // Redirect
    window.location.href = "index.html";
  });
});

