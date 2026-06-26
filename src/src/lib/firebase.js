import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistent local cache (IndexedDB) with multi-tab support — this is the
// caching layer: repeated reads of the same documents are served locally
// instead of round-tripping to the network every time, and the app keeps
// working (read-only for cached data) if connectivity drops briefly.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// A secondary, separately-named Firebase app instance. Creating a new user
// with the client SDK automatically signs the browser in as that new user —
// which would kick the admin out of their own session. Performing user
// creation on this secondary instance keeps the admin's primary session
// untouched. (Same workaround used for the React Native build.)
export function getSecondaryAuth() {
  const secondaryApp = getApps().find((a) => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
  return getAuth(secondaryApp);
}
