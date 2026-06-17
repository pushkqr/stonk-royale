import { createContext, useContext, useState, useEffect } from "react";
import { auth, loginWithGoogle, logout as firebaseLogout } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Will hold the internal DB user object
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Exchange Firebase token for our internal DB user
        try {
          const idToken = await fbUser.getIdToken();
          const response = await fetch("http://localhost:8000/api/users/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken,
              username: fbUser.displayName,
              avatar_url: fbUser.photoURL,
            }),
          });
          const data = await response.json();
          if (data.success) {
            setUser(data.user); // Contains the internal DB UUID
          }
        } catch (error) {
          console.error("Failed to authenticate with backend:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    await loginWithGoogle();
  };

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
