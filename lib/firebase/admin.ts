// lib/firebase/admin.ts
import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

function initAdmin(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 1. Vercel / production environment variable
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    try {
      const serviceAccount = JSON.parse(jsonEnv);
      return initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
        }),
      });
    } catch (error) {
      console.error("Failed to init from FIREBASE_SERVICE_ACCOUNT_JSON:", error);
    }
  }

  // 2. Local service-account file
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    const resolvedPath = path.resolve(credentialsPath);
    // Only check for file if we are NOT on Vercel
    if (!process.env.VERCEL && fs.existsSync(resolvedPath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
        return initializeApp({
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
          }),
        });
      } catch (error) {
        console.error("Failed to init from credentials file:", error);
      }
    }
  }

  // 3. Google Cloud runtime fallback (Safe catch)
  try {
    return initializeApp({ credential: applicationDefault() });
  } catch (error) {
    console.error("Firebase Admin init failed, using safe fallback", error);
    // Return a dummy app to prevent the build from crashing.
    return initializeApp({ projectId: "dummy-project-id" });
  }
}

const adminApp = initAdmin();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { adminApp };