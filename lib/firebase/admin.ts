// lib/firebase/admin.ts
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import "server-only";

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
