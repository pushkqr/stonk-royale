/**
 * Sign-in is optional and entirely absent unless Firebase is configured. Guests are the
 * default path, so nothing here may ever block someone from playing.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const authAvailable = Boolean(config.apiKey && config.authDomain && config.projectId);

let authPromise = null;

async function getAuth() {
  if (!authAvailable) return null;
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp } = await import("firebase/app");
      const auth = await import("firebase/auth");
      return { auth, instance: auth.getAuth(initializeApp(config)) };
    })();
  }
  return authPromise;
}

/** Returns an ID token, or null if the user backed out. */
export async function signIn() {
  const loaded = await getAuth();
  if (!loaded) return null;
  try {
    const result = await loaded.auth.signInWithPopup(
      loaded.instance,
      new loaded.auth.GoogleAuthProvider(),
    );
    return result.user.getIdToken();
  } catch {
    return null;
  }
}
