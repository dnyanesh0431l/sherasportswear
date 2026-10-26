import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadCredential() {
  const jsonPath = path.resolve(process.cwd(), "service-account.json");
  try {
    const json = JSON.parse(readFileSync(jsonPath, "utf8"));
    if (json.project_id && json.client_email && json.private_key) {
      return cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      });
    }
  } catch { /* fall through */ }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error("Missing Firebase Admin credentials.");
  }
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!key.endsWith("\n")) key += "\n";
  return cert({ projectId, clientEmail, privateKey: key });
}

const app: App = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: loadCredential() });
export const db: Firestore = getFirestore(app);