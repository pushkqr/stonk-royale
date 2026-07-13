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
          const response = await fetch("http://localhost:8080/api/users/auth", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}` 
            },
            body: JSON.stringify({
              oauthId: fbUser.uid,
              username: fbUser.displayName,
              avatarUrl: fbUser.photoURL,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            setUser(data); // The backend returns the User object directly
          } else {
            console.error("Auth failed with status:", response.status);
            setUser(null);
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
