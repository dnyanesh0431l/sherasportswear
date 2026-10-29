// lib/firebase/client.ts
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Throw a clear error during build if the key is missing
if (!firebaseConfig.apiKey) {
  throw new Error(
    "Firebase API Key is missing. Make sure NEXT_PUBLIC_FIREBASE_API_KEY is set in your Vercel environment variables and that you have redeployed.",
  );
}

// Initialize (or reuse) the Firebase app — safe across HMR / multiple imports
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth
export const auth = getAuth(app);

// Firestore
// - experimentalForceLongPolling: true → bypasses the WebChannel/Listen CORS
//   issue ("Access-Control-Allow-Origin: * with credentials: include")
// - useFetchStreams: false → disables the newer fetch-stream transport that
//   has its own CORS edge cases on some hosts (Vercel, service workers, etc.)
//
// NOTE: initializeFirestore throws if Firestore was already initialized for
// this app (e.g. during Fast Refresh). Guard with try/catch and fall back to
// getFirestore so repeated imports don't crash the dev server.
import { Firestore, getFirestore } from "firebase/firestore";

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} catch {
  // Already initialized (HMR, multiple imports, or another module won the race)
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

// Storage
export const storage = getStorage(app);

export { app };
