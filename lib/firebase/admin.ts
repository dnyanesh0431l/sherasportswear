// lib/firebase/admin.ts
import "server-only";

import {
  App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

// 1. Create a lazy initialization function
function initAdmin(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Priority 1: JSON provided directly in environment variables (Best for Vercel)
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
      console.error(
        "Failed to initialize Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON:",
        error,
      );
      // Do NOT throw here. Let it fall through or return a dummy app.
    }
  }

  // Priority 2: Local service-account file
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    const resolvedPath = path.resolve(credentialsPath);
    // ONLY check for the file if we are NOT on Vercel (VERCEL env var is set by Vercel)
    if (!process.env.VERCEL && fs.existsSync(resolvedPath)) {
      try {
        const serviceAccount = JSON.parse(
          fs.readFileSync(resolvedPath, "utf8"),
        );
        return initializeApp({
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
          }),
        });
      } catch (error) {
        console.error(
          "Failed to initialize Firebase Admin from the credentials file:",
          error,
        );
      }
    }
  }

  // Priority 3: Google Cloud runtime fallback
  // This will try applicationDefault(), but we wrap it in a try/catch
  // because it might fail during the build.
  try {
    return initializeApp({ credential: applicationDefault() });
  } catch (error) {
    console.error(
      "Firebase Admin initialization failed. Returning a dummy app.",
      error,
    );
    // Return a dummy app to prevent the build from crashing.
    // The page will render with empty data instead.
    return initializeApp({ projectId: "dummy-project-id" });
  }
}

// 2. Use lazy getters so the app isn't initialized until it's actually needed
const adminApp = (): App => initAdmin();
const adminDb = () => getFirestore(adminApp());
const adminAuth = () => getAuth(adminApp());

export { adminApp, adminAuth, adminDb };
