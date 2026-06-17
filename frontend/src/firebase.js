import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAMEH2NlRuqGTs0DF4sF4vJpYlShFqmB1w",
  authDomain: "stonk-royale.firebaseapp.com",
  projectId: "stonk-royale",
  storageBucket: "stonk-royale.firebasestorage.app",
  messagingSenderId: "300471814737",
  appId: "1:300471814737:web:4987cbacafb3f384e74670",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google login error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);
