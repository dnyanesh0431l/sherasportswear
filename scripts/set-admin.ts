// scripts/set-admin.ts
// Usage: npx tsx scripts/set-admin.ts <uid> [true|false]
// Or:    npx tsx scripts/set-admin.ts you@example.com true

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as fs from "fs";

function initAdmin() {
  if (getApps().length) return;
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) { initializeApp({ credential: cert(JSON.parse(jsonEnv)) }); return; }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && fs.existsSync(path)) { initializeApp({ credential: cert(JSON.parse(fs.readFileSync(path, "utf8"))) }); return; }
  initializeApp({ credential: applicationDefault() });
}
initAdmin();

async function main() {
  const identifier = process.argv[2];
  const value = (process.argv[3] ?? "true").toLowerCase() !== "false";
  if (!identifier) {
    console.error("Usage: tsx scripts/set-admin.ts <uid-or-email> [true|false]");
    process.exit(1);
  }

  const auth = getAuth();
  let uid = identifier;
  if (identifier.includes("@")) {
    uid = (await auth.getUserByEmail(identifier)).uid;
  }

  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims ?? {}), admin: value };
  await auth.setCustomUserClaims(uid, claims);

  console.log(`✅ ${value ? "Granted" : "Revoked"} admin for ${user.email ?? uid}`);
  console.log("   User must sign out and back in (or refresh token) to see change.");
}

main().catch((e) => { console.error(e); process.exit(1); });