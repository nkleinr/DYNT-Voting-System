import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxD7i3XyW108_8If_DwbEhnXtOndEcEI",
  authDomain: "dynt-voting.firebaseapp.com",
  projectId: "dynt-voting",
  storageBucket: "dynt-voting.firebasestorage.app",
  messagingSenderId: "1014512631800",
  appId: "1:1014512631800:web:aa14e9a7097c5fe7f2e00d",
  measurementId: "G-YZEX0Y7RNX"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
