// lib/firebase/admin.ts
import "server-only";
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as fs from "fs";

function initAdmin() {
  if (getApps().length) return;

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    initializeApp({ credential: cert(JSON.parse(jsonEnv)) });
    return;
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && fs.existsSync(path)) {
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(path, "utf8"))),
    });
    return;
  }

  // Fallback (Firebase Hosting / GCP runtimes)
  initializeApp({ credential: applicationDefault() });
}

initAdmin();

export const adminDb = getFirestore();
export const adminAuth = getAuth();