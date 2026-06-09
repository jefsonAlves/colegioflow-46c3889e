import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCvPSBM7ridYfleodjTPt4fLdAdwY5tOk8",
  authDomain: "projetojefson.firebaseapp.com",
  databaseURL:
    "https://projetojefson-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "projetojefson",
  storageBucket: "projetojefson.firebasestorage.app",
  messagingSenderId: "537809046235",
  appId: "1:537809046235:web:b76f9be5d05ff2e0ef9afe",
};

// Avoid re-init during HMR / SSR
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export default app;
