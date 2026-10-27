// lib/firebase/admin.ts

import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

function initAdmin() {
  // Reuse an existing Firebase Admin app
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 1. Vercel / production environment variable
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (jsonEnv) {
    try {
      const serviceAccount = JSON.parse(jsonEnv);

      if (
        !serviceAccount.project_id ||
        !serviceAccount.client_email ||
        !serviceAccount.private_key
      ) {
        throw new Error("Service account JSON is missing required fields.");
      }

      return initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
        }),
      });
    } catch (error) {
      console.error(
        "Failed to initialize Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON.",
      );

      throw new Error(
        "Invalid FIREBASE_SERVICE_ACCOUNT_JSON. Check the JSON format and service account fields.",
        { cause: error },
      );
    }
  }

  // 2. Local service-account file
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath) {
    // GOOGLE_APPLICATION_CREDENTIALS must contain a file path,
    // NOT the JSON contents.
    const resolvedPath = path.resolve(credentialsPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist.",
      );
    }

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
      console.error(
        "Failed to initialize Firebase Admin from the credentials file.",
      );

      throw new Error(
        "Invalid Firebase service-account file. Check its JSON format and fields.",
        { cause: error },
      );
    }
  }

  // 3. Google Cloud runtime fallback
  return initializeApp({
    credential: applicationDefault(),
  });
}

const adminApp = initAdmin();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { adminApp };
