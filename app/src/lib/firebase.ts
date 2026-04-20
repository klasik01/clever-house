import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!config.apiKey) {
  throw new Error(
    "Missing Firebase config. Create .env.local based on .env.example."
  );
}

let app: FirebaseApp;
if (getApps().length) {
  app = getApps()[0]!;
} else {
  app = initializeApp(config);
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Persistent login across reloads — no re-login on return visits.
// Top-level await avoided for tsc compatibility; fire-and-forget.
setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.error("auth persistence failed", e)
);
