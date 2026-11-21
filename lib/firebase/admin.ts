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

  // 1) Full service-account JSON blob (preferred for Vercel etc.)
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    initializeApp({ credential: cert(JSON.parse(jsonEnv)) });
    return;
  }

  // 2) Separate FIREBASE_ADMIN_* env vars
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // Convert escaped "\n" sequences into real newlines
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
    return;
  }

  // 3) Service-account JSON file on disk
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && fs.existsSync(path)) {
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(path, "utf8"))),
    });
    return;
  }

  // 4) Fallback (Firebase Hosting / GCP runtimes)
  initializeApp({ credential: applicationDefault() });
}

initAdmin();

export const adminDb = getFirestore();
export const adminAuth = getAuth();