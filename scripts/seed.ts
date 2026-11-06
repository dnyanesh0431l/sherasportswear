// scripts/seed.ts
// Run: npm run seed
//
// Requires one of:
//   - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON, OR
//   - FIREBASE_SERVICE_ACCOUNT_JSON containing the raw JSON string.
//
// Seeds catalog + CMS + customers + carts + orders + payments + shipments.
// WARNING: This wipes orders, carts, payments, idempotencyKeys and every
//          users/{uid}/addresses & users/{uid}/wishlist before recreating them.
//          It also wipes categories, collections, brands, and products.

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  CollectionReference,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = "dhakanearvind900@gmail.com";
const ADMIN_PASSWORD = "admin@123";
const ADMIN_DISPLAY_NAME = "Shera Admin";
const CUSTOMER_PASSWORD = "Customer@123";
const LEGACY_ADMIN_EMAIL = "admin@sherasportswear.com";

// ---------------------------------------------------------------------------
// Firebase Admin init
// ---------------------------------------------------------------------------
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
  initializeApp({ credential: applicationDefault() });
}
initAdmin();

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();

const now = () => FieldValue.serverTimestamp();
const ts = (d: Date) => Timestamp.fromDate(d);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
async function ensureAuthUser(
  email: string,
  password: string,
  displayName: string,
  opts: { forcePassword?: boolean } = {},
): Promise<string> {
  try {
    const u = await auth.getUserByEmail(email);
    if (opts.forcePassword) {
      await auth.updateUser(u.uid, { password, displayName });
    }
    return u.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      const created = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });
      return created.uid;
    }
    throw err;
  }
}

async function deleteCollectionRecursive(colRef: CollectionReference) {
  const snap = await colRef.get();
  for (const doc of snap.docs) {
    const subs = await doc.ref.listCollections();
    for (const sub of subs) await deleteCollectionRecursive(sub);
    await doc.ref.delete();
  }
}

async function wipeCollections(paths: string[]) {
  for (const p of paths) {
    await deleteCollectionRecursive(db.collection(p));
  }
}

async function upsert(
  collectionName: string,
  docs: { id: string; data: Record<string, any> }[],
) {
  let batch = db.batch();
  let count = 0;
  for (const { id, data } of docs) {
    batch.set(db.collection(collectionName).doc(id), data, { merge: true });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
}

async function upsertVariant(
  productId: string,
  variants: { id: string; data: Record<string, any> }[],
) {
  const batch = db.batch();
  for (const { id, data } of variants) {
    batch.set(
      db.collection("products").doc(productId).collection("variants").doc(id),
      data,
      { merge: true },
    );
  }
  await batch.commit();
}

// Helper to make Firestore-safe IDs
const safeId = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

// ---------------------------------------------------------------------------
// Admin user
// ---------------------------------------------------------------------------
async function ensureAdminUser(): Promise<string> {
  try {
    const legacy = await auth.getUserByEmail(LEGACY_ADMIN_EMAIL);
    const claims = { ...(legacy.customClaims ?? {}), admin: false };
    await auth.setCustomUserClaims(legacy.uid, claims);
    console.log(`   Revoked admin from legacy account ${LEGACY_ADMIN_EMAIL}`);
  } catch (err) {
    if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
  }

  const uid = await ensureAuthUser(
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    ADMIN_DISPLAY_NAME,
    { forcePassword: true },
  );
  await auth.setCustomUserClaims(uid, { admin: true });
  console.log(`   Admin claim set for ${ADMIN_EMAIL}`);

  await db.collection("users").doc(uid).set(
    {
      uid,
      displayName: ADMIN_DISPLAY_NAME,
      email: ADMIN_EMAIL,
      phone: null,
      photoURL: null,
      marketingOptIn: false,
      defaultAddressId: null,
      createdAt: now(),
      updatedAt: now(),
    },
    { merge: true },
  );

  return uid;
}

// ---------------------------------------------------------------------------
// Catalog Data: Brands, Categories, Collections
// ---------------------------------------------------------------------------
const brands = [
  { id: "columbus", name: "Columbus", slug: "columbus", status: "active" },
  { id: "columbus-nxg", name: "Columbus NXG", slug: "columbus-nxg", status: "active" },
  { id: "shera", name: "Shera", slug: "shera", status: "active" },
];

const categories = [
  { id: "running", name: "Running", slug: "running", sortOrder: 1, status: "active" },
  { id: "training", name: "Training & Gym", slug: "training", sortOrder: 2, status: "active" },
  { id: "walking", name: "Walking", slug: "walking", sortOrder: 3, status: "active" },
  { id: "slippers", name: "Slippers", slug: "slippers", sortOrder: 4, status: "active" },
  { id: "accessories", name: "Accessories", slug: "accessories", sortOrder: 5, status: "active" },
];

const collections = [
  { id: "new-arrivals", name: "New Arrivals", slug: "new-arrivals", sortOrder: 1, status: "active" },
  { id: "carbon-racing", name: "Carbon Racing", slug: "carbon-racing", sortOrder: 2, status: "active" },
  { id: "bestsellers", name: "Bestsellers", slug: "bestsellers", sortOrder: 3, status: "active" },
];

const IMG = (label: string, hexBg: string = "111111", hexFg: string = "FF6B00") =>
  `https://placehold.co/800x1000/${hexBg}/${hexFg}?text=${encodeURIComponent(label)}`;

// ---------------------------------------------------------------------------
// Product Data (Based on provided JSON)
// ---------------------------------------------------------------------------
type SeedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  productType: string;
  categoryId: string;
  collectionIds: string[];
  brandId: string;
  brandName: string;
  gender: "men" | "women" | "unisex";
  basePricePaise: number;
  mrpPaise: number;
  inventoryValue: number;
  attributes: Record<string, any>;
  sizes: string[];
  colors: string[];
  images: string[]; // Added to store actual image URLs
};

const products: SeedProduct[] = [
  {
    id: "columbus-victory",
    name: "Columbus Victory",
    slug: "columbus-victory",
    description: "Experience ultimate comfort and speed with the Columbus Victory. Features a breathable mesh upper and a responsive sole.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["new-arrivals", "bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "men",
    basePricePaise: 239900,
    mrpPaise: 239900,
    inventoryValue: 150,
    attributes: { cushioning: "High", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["MIST / AQUA", "BLACK / L.YELLOW"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781576609_WhatsApp%20Image%202026-10-26%20at%201.11.53%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=iohnVf%2FNDwpmsU9OXNkfix1%2BcY5CUyEyhtp5LvhYIBt61qWDnLoay7poLCWVBWQzvUuSCqOafqM2fc40Hqr9LOoEuwlDwn8KykBKQElxRx0pnbBZhvTe24dRr84W938tYJW6VvftWArr%2BUhBtBzVObqPyV6mfZEg6zpeFqSaag%2FvebCN11akic6PUzZHbaX0TmGdKcL5lPAiMNnEajjZllUAuFWodqjaBmQW%2F50roCR0PTg%2FRxqb7%2FaUEjDxVyR%2Fp7qzuP1qN7plp9qDPRoKvTaghXFIHBawtji7Ebrvd%2BpUh3mT8izCpcRBeV98mdzvLIuySZ0Vk5NLXSHjFcGXiw%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781590766_WhatsApp%20Image%202026-10-26%20at%201.11.53%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=vtKxkToBpmYLTX7Helj%2B1A1o9GmRa5Cwfv7cHe%2BDDZqGe3HXzWamRKw0CeR1KxTgY1k6l4nziGjjNQqZZHRFZCKYj8zYEDyiRhgsEvO8QsFT9%2FFJTNZrHUVLaVNnn8MRPWIRggwcSgP24BdDWO%2BHR52vAmg37j%2FiyJcQP2GOKCZ6SOATVzo3LA4MlDG6NqSq6A9%2Fp8EQbzrsgtgAJcxjTkjN6paAZ%2FLUEqO%2FHF5n9GnEyvKpkLTlFXbK3GD8qbM5VPEoMpbuDPvDJHi7b7m4g9wRKbQhtzM3KG2BapS%2FSTggDU%2F%2BKcv4h%2BjDb3TXJlTDL0vtREPL7QmNtwLO5CB55A%3D%3D"],
  },
  {
    id: "columbus-freemove",
    name: "Columbus Freemove",
    slug: "columbus-freemove",
    description: "Built with Carbon Tech for explosive speed. Ideal for race day and tempo runs.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["carbon-racing", "bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "unisex",
    basePricePaise: 219900,
    mrpPaise: 219900,
    inventoryValue: 120,
    attributes: { tech: "Carbon Plate", drop: "6mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["WHITE / L.PISTA", "EMBER GRN / BLACK", "WHITE / BLACK"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781584444_WhatsApp%20Image%202026-10-26%20at%201.11.53%20PM%20%282%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=q8qp2PVhoVgOaZGJjEK401OrPu1WIQEtSENEY9AJkurPw58mLRXQeRE6mohpYmHSTQz4e6D6P3%2BSLmr%2FhzyhIfZuY7DHE%2BCRvIgf7OjSzQvH7Dx6UkfvrtJUK7%2FKtiIzxfveGa6kDxklxSl9fWO822saCuRxaJpm6PTbdtr5wUcm3TWfqwiYpDIIECSF1GSOYgNcmNXPcK5o2iHMVbAWg71PkeD0VNX3hOO8xb4GzpK%2FkTdbVixAkuKEPCyPAqT5e55j6qIyRZmM6fzPGU1IB%2Bzw7OXOJJcyWCk6H2hzj4e5Lda0CKpRpG91r499Pohdss1l5QsD1ye8x2At1O2dOg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781596531_WhatsApp%20Image%202026-10-26%20at%201.11.54%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=kobhmiE5Xmoqf1Z4fuwzkDjvmI9WwJ0eTa78tJnZu8spfxUx2zNfHZhFZahngUQ4A%2BkgcNjfep5hXbYQHkayT%2BNLvJ7dGnBWkZk9NXbtW0JVeJBU0gxZMw%2BUgtoGDvYyWwEbuA7D7G8vh%2FYLSdI1DA6N%2F9kikDjEp4W5%2FftkXXGB8P%2FlLTsv7%2BEp%2F%2BGJwWiHmJ1WD3IpWYMZN%2FdovyRoqCQPpCaXxFnQQ5ku3TCaXeQCiRFO1lj3Q%2B5JrSljuwi%2F6TfqUmhwh8ZpDb649HCenn%2BYW%2BG5gJj9%2F%2BEXLjYg%2FI5MvtAcq7WPwCotqO5jaJTuqBkjTXuLmpmYIwKrf62uAg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781602830_WhatsApp%20Image%202026-10-26%20at%201.11.54%20PM%20%282%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=TzHIpVItg5NKW7Pd%2FepmL6XBOb95UrNu%2BLntyBmijBLZVQsL6c6u%2FSN0CCrBiO3ADuEfzYzI3EoWGp83cx89Dbxvx85hYvMXo0g%2BfOPDf9TK%2FPi%2BKxjPXeUTXY6CV2JcWMI2mQRplixUKmgsJtg83xHbHd7REA7mTIPpbc2z%2FAWZtmxuK6c2r0qpue2RRQDH6wQIuZYd8YzGm%2BcXH3z23c5Q%2Bg86XpzlA0zr%2BGEfCQ%2BpAT8aMHDIHJ%2BlYW5Gg1y4OdV8c2l9RIb3yTZ%2B%2BCLrbrcLQeM80f2nN7RhKBk3PD59%2FT6%2F8WXTwYIsPOLsXtds%2FwjOiiE8G39EL5VGyjF9kg%3D%3D"],
  },
  {
    id: "columbus-destiny",
    name: "Columbus Destiny",
    slug: "columbus-destiny",
    description: "Reliable daily trainer with Carbon Racing technology for consistent performance.",
    productType: "Shoe",
    categoryId: "training",
    collectionIds: ["new-arrivals"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "men",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 80,
    attributes: { tech: "Carbon Tech", drop: "8mm", terrain: "Road/Gym" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["MOUSE / L.GREY", "BLACK / D.GREY", "WHITE / BLACK"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781608816_WhatsApp%20Image%202026-10-26%20at%201.11.54%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=I%2FKljS2xBuiUapP7oRrq7C25%2B0LIYh%2BNjFOx27X3vCJE78UlBYv%2F1Y2%2FcirRt8kTXFhlXHv9igaIzvA9SfrXD32jdwRWXgFL1TiX1nyXeAXVJDPcUt%2Fjz2qU11dqtczB0jdbaDZ2gpe3JR3KFjyui0Lw4juLjuAAi362XHOQml%2Fm2GrXTEtUn5mWv6xE6YMLjkq5HvJVY9%2FNVn%2BPHoH30VLOM3ZJ9AF9wv8FVPaeY6eQI%2FpANt7zh81SUAdlIJLlcW7XnTfIJwM5QeW8Y1YbnyydFSlDUc2Mx7d7jWM%2F7LInakBcWkdCPBNJhmXgev4Hz0O2CLejdj%2FqRBdnI1NgjA%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781614747_WhatsApp%20Image%202026-10-26%20at%201.11.55%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=yR%2BNGkvpiZjCyL%2FwdWr2Id%2FM3J2VhGjfgxTDHg4RbQrWWhtPfVyEiW0pSsi2kvGuZ194FQ%2BFbfqVZ%2By6%2BhZdfQ2N5BrRSuVEOo0RYX8FOpFvoZXD%2BDYwdi4gUncERDczqXxElqwLfNlsPiX149MGy8iuftdxm9sPhbr1NWe%2BqJcAh9S0133Wc8yk%2BDL3s9DPibTJNnZaICqJ0qhioeNvcZfcCbsoxDrc8faXPxvi1%2B74b9uxdmNskT8OsZ0XeTX1C%2FR5Wr%2FjrnXu5iuVdcu6PFdglPKWQ7Zx31b0S3VIMeHvmdBElAV00%2FwOhfH6OWAAaf7HV6xLAxEVbRjNJCal%2Fw%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781625364_WhatsApp%20Image%202026-10-26%20at%201.11.55%20PM%20%282%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=Y%2BpjETBhHvzGH3cicldFw3WLPRgYH%2BOfisrGOFAQIZGvvlkDSd4z%2BOfa%2FW41Q4venlFegdDEQABYxIAa9I3r8h7uwa5XAE4tCRKHClxBFCpJuk%2FypePYKe5MvaKQ%2Fe2dUkAjjkPxiaSzIUl3nYYNRYvlDkP4LTA9RsOaU8H268uzDRaxWwMoCPX50pzbZoUc%2FTtq0nZbuqfZrAgAK7N70sWe7T%2Fqm%2FYC5t7%2Fr6OW5AbiOZztlfyUROt7sDju04AC8wq9k7wUGdDtwvusmBIjIo9pgLU5ObrHKb8C8zIacxo0pV0mIZfRvRf%2FBYX0CK0iKK72WZo1uY%2FjcLhPpWiZZA%3D%3D"],
  },
  {
    id: "columbus-streak",
    name: "Columbus Streak",
    slug: "columbus-streak",
    description: "Lightweight and breathable. Features Boom Fiber midsole for maximum energy return.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["new-arrivals"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "women",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 95,
    attributes: { tech: "Boom Fiber", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["WHT-BLK", "L.SKY-R.SLT", "WHT-L.YELLOW", "BLK-SLVR"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781632269_WhatsApp%20Image%202026-10-26%20at%201.11.55%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=rgv9qiKQmKYykkNl5nSVNk8Whm%2Baoy6nfdTrcy9hS7M0xhcOlae15H4IlsW%2F9CT%2FOtKdJqvMapiDAnDCoBNKGVz9i0O33QO9YnOHY%2Fb8vndtnPH09KqFmjnx8pNRK%2FxuuT%2BLC%2Fzwd%2F7%2Ftq%2B2ul5FwhQQ%2BSdylgI9Eqh7Stzi8aGYzSlxM5m3UL%2F%2FDIe3q2Ctzp4dIahxMsIO1wGuYYQpsYENeBfIpNFmLJyc8DFtfa%2B4adjJ92GXpvCRiXz%2BGRH3b0lRvaUvYb4GE3huehgl5QEypQi0ujOuxwEbOtVMDoNgLd%2F2mVzyCzQiOw7WAi6qbIAzG403%2BfDr8UtxMzJVpg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781641001_WhatsApp%20Image%202026-10-26%20at%201.11.56%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=0IEhl%2F%2BK%2BtP1L%2BwKK8rJZhBWrMaS0ysG%2F7uCcBjono2VOINBVk3A2vb9xHiegYBgrqrGS7ipB3bdZ8Y2%2FAhN9mdc%2B8fSzjQQpEiZokkypsK9SgVvN1Jj7UnT74u4lIYfGkkAqxSxpCPD1zjxGwOStvUZlpSKDOBW69Ew6ZVDoL0F3%2BO79ZMSNPtEx2xVSei57DSTbxZeOTPapPM%2F%2FF4MFhZ9S3%2BYrkej3qDeRMgpRI6sCM3aQWcMgOuQM2eukbNdOT1boML5WAA4dkE2TkGfuCWnfiqGn1b7JxqW4Keq5TAj2y%2BVOu1pdUdYa%2BYS9s%2B6CBol0irOhHrtdqvrAyRCew%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781647064_WhatsApp%20Image%202026-10-26%20at%201.11.56%20PM%20%282%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=c3z1dH2z70LmPyoIMrGOP6is%2FnzgEQbZ9fWsLnqhqjuazzeuCGfDy6ZXRgqtv07uyVgt4SbjEeY47%2FBqSy84RmeHhgpMosTi9DwtUagynPdACTtI0Fyugr0nfJSok1S8LVlaA4kvVGdC5By%2BBeuJbZS8rtKmPwtQeyubJ7so01tIl0sxd1B1jvkriBicnNDKyXNP7L%2FwFBmeXvBOrsrIrC8yi8vtS3m5XoOHvPG1xZ0ijTW3EYWjX4pvxkSfyGhg%2BZK7NZaGJbDD8OTDbGDJ7WcO%2B38j2x38nzB19Z%2FOIIJZNwR9CyS9Yo9K9JdQ0vgWUgf8Z2z5vCGg0T5NjStWWQ%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781653295_WhatsApp%20Image%202026-10-26%20at%201.11.56%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=qI0edJR8kSrxm9H6l3ioufmEXSCJCdzBfOZoPlL9v449GPJl9Rstjqlmi0Ahalk10oFCJJnXHQX7Wt8p8%2FPpPWAT78uFE9W%2BuygL9c0JXJnMczD714NuitwCMGJIsyoMhKMoz32SnZx2rIztEWCiG0s0Oi4fFtWTEULMGZxbqxT3ZT45ova3SaUWlS1wg5ngIjf54AFDIk6h0d12evAg5WFPkbRLcIggOxzfSONbVCjZj%2B5tfq8xKYpBUQ3eGf1GMyKnOV3zLFC63%2FX7RmosTDuYPygwQIXDHvQJGg%2FML7OjbuJktgCbmpYlL7ppKai7BktNHO58dffsapXtkmqpvw%3D%3D"],
  },
  {
    id: "columbus-facelift",
    name: "Columbus Facelift",
    slug: "columbus-facelift",
    description: "Next Gen design meets everyday comfort. Perfect for casual runs and workouts.",
    productType: "Shoe",
    categoryId: "walking",
    collectionIds: ["bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "unisex",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 110,
    attributes: { generation: "Next Gen", drop: "10mm", terrain: "Road/Walking" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["BLK / SKY", "L.GREY / D.GREY", "WHT / L. PISTA"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781662514_WhatsApp%20Image%202026-10-26%20at%201.11.57%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=TC0DMnyuWbP54y9DcCyu5G4u3vI0lqH6kGmCe7lxGihR2Q2KbtzH2C3s1EqQCMH5u0HFEzOVQvN1eiWyvs6qkf2SL3EemS69TOVu7J7vFaAkY7yjGEdt3pJsLm85RzCCZSrl5b%2FIwIOkCjfOO4FVGWyCBUk2KtI1GOtWOPH2SoAN6oPyQge2nZc1BSPYUgHEomP8sVS6rGbmq39d7eNMDGLDu5ME2T08JxMlk3tgIvWdlPyXsAymYBalP9yPKyt94VTOi9wS1qfEIM8vDWu3%2FBDH9yn9FzXjWlb2yIJEMVWXwQblNsL5haoIthtmBGjzLDmAti4GXgtAEffunBfZtg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781670341_WhatsApp%20Image%202026-10-26%20at%201.11.57%20PM%20%282%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=zRASznFKYBHwQss7IV08IFmlJ3rcqMzE9PIJ9CPvQly158cft0ea55U3x4K6GmfZodZOLsTQzSha6zmt6cbg7%2Fn5RKI2tjTjRZVe7UUr4jad4rdS83FtRtMKPPuSf%2BY2USNdfHEuzFfHije4i9oHAm8vGO1EssMkY3beiPcPOJzdTIVDd6104xGHpi9NP8MiFRH6GbJNlg5omFX1EoupEXoYxoqE54vFrY9kOTSDRiqYAlCsbUQIseIzGTSnGspDG0Exe2GNky75FXq5ZB71EaqFOQKI7mw5y6d41PdItg41YUk0XWU4kZGrrEDeIc0%2Bt4mS4cNHgoNBOcK93aU7HA%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781676911_WhatsApp%20Image%202026-10-26%20at%201.11.57%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=3ojCjH2EHp9H2gC2pFY%2F5wipTL43%2FsddlK6cU1DEVpE%2FtoviziWpXrxggp63zDZAWPo8c4YMQG33huwKZYYxUfwTq7SNaPdSdUZ7fc1xXwf8gakSHrA1xSjsexGCg%2FyWITH5zWipqVrD9EN0lid%2FFpqEeS6jMFz5869uXM8sSCO6k%2BhBTj%2B2MtgLiZTQpcJTR%2FB7%2Bmkxiflvu9eqT5Y9LSuzeYVJkYHZSF%2B3QiLEl%2FnNWlUIJ4CDbLqgyBOpNXk8udi%2FXknodabh29IpOhOOGMFXIOYj4TIFUnBqphxDfL9OI83WySieppw%2BDczeEdmd3tgDey8P5iLSoGil4gCieA%3D%3D"],
  },
  {
    id: "columbus-rift",
    name: "Columbus Rift",
    slug: "columbus-rift",
    description: "Durable and stylish. Built to withstand the rigors of daily training.",
    productType: "Shoe",
    categoryId: "training",
    collectionIds: ["new-arrivals"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "men",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 60,
    attributes: { durability: "High", drop: "8mm", terrain: "Gym/Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["MID. GRY/ D.GREY", "BLACK/ SILVER", "White/Black"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781682646_WhatsApp%20Image%202026-10-26%20at%201.11.58%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=OhmBmqOTr7UvI%2FvjKJg3BnoRP5%2BibPKhE0pnXMiRJQ6EmsVS6p3%2Be0vzDdigTmMAQTcYdXNiKO2HFAb68lzXCFNTSwTh%2FJDcHWFlUVOD%2BTBo7STYhFtoWTyOytm8%2B%2FhUZ7Zs1EL2%2Fr%2FOfybV81Qw77AIMpT%2F3JHHz6bI1WGCg08W1F5N6%2Fu8xx8ToG7ykRXwE%2BbGOiKdMDLcEU4CtMm0zuwy3ep3154h34kHKddACgyqjTbeG7HIgou51LJBdGMTPZ0PWx8U%2FpIIbTuwmJPii%2Bb4hADLBfuBi3ED6CWpPGHLvJi0%2F%2F6nuz%2Fm6sRP2gIvLDNRTcNKQHBu2eERVRBiNQ%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781688873_WhatsApp%20Image%202026-10-26%20at%201.11.58%20PM%20%282%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=fnkHGP0cPD34O6vv7dIY%2FRqTcALHh881JTFdKVfonx%2B18NHM63h41bm3tdUGcHOx%2Bf6KHh%2BgG%2F5395GNdPFdRWiFFJsJe2A3F16bmoUS2AJTD23%2BpLWrFCCiIA48K1Tj2kOdtKgYRAhv1ZcYwQ3GEa8Gz1ESg7g0hwyfNCbsZcgtf9rnQKa6JmiKNlIM6UMWKQIlF7Sf8gxAxn8Zu5TjpxvQDjjibOFZx2YAIOAnw%2FRgm20BYWmsseEPC0p8jciLBxpf%2FJDAPmdh%2Ba6em2oNH0nPDQFuj6mbMUnW%2FsccGoUszHZDofL5da3IBNE%2F3ImawPs1LD7mMBbFbfWRyWgH1A%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781695989_WhatsApp%20Image%202026-10-26%20at%201.11.58%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=cOkqpuLnIeHznJwDNCWeCm40Q8KzXYA9BBxRhmNK%2BhlQgsloGy73CgBCP0nNfWp0CbvRlITgJHFz5G9Te1J3UdficZ92m3F%2BoI%2F6dXlQoHjCJDcZQ2Vgk3FaUpoVYO4iTwNVnXXAIFFJDskTZ%2FjKopa4a7WuPP63Nib%2BlDVJSxRtT%2FR5I0pmrIrgQ%2BkQT9pbM%2BESlIlImaKo0Vs4sYlF5lDm%2F%2B3xjGx5nlpa8YZ2d7YkMiDBDJbeZ3W4SLduUqAvYGD1UOdBKtXkjNdbDCOTM8vRwVW%2FcpDKMc67cqbB00T%2BYPbrBHGE1jtuo%2BrlvxOuFYSSdWriPv4oxCBY%2FhFAHw%3D%3D"],
  },
  {
    id: "columbus-solar",
    name: "Columbus Solar",
    slug: "columbus-solar",
    description: "Glide through your runs with the Solar's smooth transition and carbon tech.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["carbon-racing"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "women",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 75,
    attributes: { tech: "Carbon Tech", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["SLVR GRY / SLT BLU", "WHT / L.GRY", "BLACK / D.GRY"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781702123_WhatsApp%20Image%202026-10-26%20at%201.11.59%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=qALtDIWDWdT5kN4vw7Ki79SEHMFup0%2B2FkmK4LwRu7aZ9L2Lsewf71CpM4%2BNf3zD8istpr3mbeq1c47IiEzsKGZWB3VNyboOhMFzVPiwkKiUG3sUBfeIJ7aniqbDtI0F%2Fdfrr8aaIoWPktLuEtPTWHitaXrE9wl1DovsK%2BZiqAPYFGaF7fhT%2BbURXZFkJ9wf4c6JxhMyPrvXgjALCswxousAEdyv4Wr6Ck9qePyLCpqX1gm7q%2Bh9QNjpZqaXIKDtwYVYe5XbPGqTU69q8ll7q8gONdT5JWBVcRHDTXqIigC7ie2Xj6Dy66U4usWFLtsrAXYWmWiZrgBjS4tLaKEKhw%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781707599_WhatsApp%20Image%202026-10-26%20at%201.11.59%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=PD87TG1l6gQiFan8exHlZ5z3Wa5W0ZQk1MRGiIqGAZo0ZBvRVHO3d%2FkV4BRv168szJGLeQ%2FG%2F%2BhEa1P6QuwmSJ%2BcV%2FOZp6KTkTmXQTUrGalVfLmU7QYHb2qxkNbSz4YIfKDlDf7Vte7TA%2B1fvC2prYNPJbVtGcamuRiLjZO04tcGXarni4nX6pnK%2BIaxLoc2HI19XFceXRlBFaztA2tRZwumvagNXyvK%2FTELii4QuuWYqRuN6fllS5DTL%2FlVGu7KEtO7T6YRam1Gsam0Sojwu0F0ww%2BiUbDw8GEwM01ouVsrMxSdyspS3THU3%2BSuHsMItGmLbTtnvM%2FelnAFTr%2FA5g%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781719394_WhatsApp%20Image%202026-10-26%20at%201.12.00%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=6s1akl9l%2FDl4vDol6%2Fk%2Fr8%2BSDCNdWM4hrbvKgZyVdNLPV9Uzm9nUXbmxYWDqG52cegCLvfCblUpaYFTcVrkESEeuqmUMDahevEMWwUaQWB29Bh5hCDrBA1Lud4JZWXT%2By6biqkZV9RDHSahyLDNTDBTREwO3VZQ8T3e39ITkoZuiuAPE4gUi4XILELvf%2B6uaxEWdVyyPN6KujiNGZlVk9DqXHXsrCX5YcKCPXo7JcIktNlKOgrJu2rCeQDw%2Fh9uyrlNuu1AXoQhF2zJSR8IXzob862vcche3aj4mU87WoAoJ%2BPfORxMlXHHOvp9lqX1BaX4e5sloMdNtmMR5a8p%2Fg%3D%3D"],
  },
  {
    id: "columbus-cubic",
    name: "Columbus Cubic",
    slug: "columbus-cubic",
    description: "Perfect entry-level running shoe with Next Gen 9.0 technology.",
    productType: "Shoe",
    categoryId: "walking",
    collectionIds: ["bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "unisex",
    basePricePaise: 179900,
    mrpPaise: 179900,
    inventoryValue: 200,
    attributes: { generation: "Next Gen 9.0", drop: "10mm", terrain: "Road/Walking" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["D.Grey/Blk/Sage.Grn", "WHT / MIST / MSTD", "WHT/LT.YLLW"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781713836_WhatsApp%20Image%202026-10-26%20at%201.12.00%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=XdVaTHasnW4d0jn%2BdmVw8gIB7oEateZjaNMfmLlvKPEYXj%2FDvvU9HhKUDetDaUZyNQ2ZFIW8gu0AweZeknhn1eC2n%2FrhZNNymHK%2Bc9le8f8WSDYSeiTylynsW4rjsJVBOpwwqLdnZNW%2FXkMu7w3PulNGOzkv2E8SyRi0GDrodbBmIef%2B4ilzbCeuXZItP0dUhJL034rgJBSihhlct1Xua5Flt3M4OEHxzSvTrbPAVAxu6%2FNM%2BSd0h2UVT3YodjaKcNPrhBM4Hb%2Fs%2FbZSJIbCt8Y0tx7dCGxKIkofjVGX%2BSNJdr%2FrKAClXtyrndurD6Y%2B49eW71vQTRdfzwSv8dY5Zg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781747854_WhatsApp%20Image%202026-10-26%20at%201.12.12%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=bcT3roUv%2BSUTObh4ffpPuNxpOw1HnMyMPIXCj9qit6x3d5VFGltiWfjuAFKQCi6ocGxV7z5iNKYTZ3Z88H0EcNaSpNXoX4URzembsRreJ9%2FU1X4AyAOMFWlrKdX61q9Tjj0zoAhk2tqUwz2Wlyt%2B5gkLvzNuJFlE9rKcUUR2QBDKBA10Iq701c5eBlErZYDTJ2ATneMgwLovDOWG7fcInhTg%2Fe2Ynm1Y1N%2BY0a4haipdZSnX4jBktSqL4Y3twdJgp%2BrS9QbikXakKF7K2mfw7qCLr3qW94RtJ92rBn7CAtw91StycBfFaZ%2B7UWNv3qtKWEaLFe9jsGHnolLhrDfW4g%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781844383_WhatsApp%20Image%202026-10-26%20at%201.12.23%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=3CXJZ3ahyT7B46JEWNqdwO3ZlRIhIGdW1hKCSZwef6QSkMgL7MITzmqATKnu%2FOFZ1usOI9cT3MlB70v4m0BJaJ0fTFwntgzumV8W2zaoRsKPuXp%2BEObAMkYoLVppoay5HvqHEECFNE2%2BtCyBqPyQlr5yc00rTdkF4pX93h3cX0STqImVBF9O%2FTGvigWmVmoaMvAoMKStGrC6wEzunUnujhOqmx5x8UEjUR4cqcLYBL2NGcBjHhlQ0YFIYP9iMBTy0%2FKOmweELk7snQnRwItdgLRd1u3cMzWqJvLjq%2F0lsex8%2B6kGIjr3TPTpNizY9hVxNW15aQW%2B96zrKLkB2U9A8A%3D%3D"],
  },
  {
    id: "columbus-arcade",
    name: "Columbus Arcade",
    slug: "columbus-arcade",
    description: "Stylish runner with great cushioning. Perfect for long distances.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["new-arrivals"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "women",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 90,
    attributes: { cushioning: "Max", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["MIST / F.ORNGE", "BLK/ SILVER", "SLVR GRY / POWDER.BLU", "Pista Grn / Mustard"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781724784_WhatsApp%20Image%202026-10-26%20at%201.12.10%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=l9wb1S9wmoBj%2Buky3Gbm6MpZh1pfgZpyKwP8fY15TWKXTwAX7k%2FCTorGfONfINqPu3id%2FHhoBORAyNAGIW%2B0uaGuTNQAeNHnynGill79Cm1lJoFZ6QSc1F%2BQYOAjQS8Yi0xrVSWuBYGPI2J2Hs3GUuWEGCdQp2l3k0MApyKWbzOeKTerAdLZopIBYQwCrSljWzjBEdm98zfIJ2VrpsXPc0pLW6g5midHPLOHbTMp1jzHMMvfWyyWjxtP2mn7BzOlY7hniXv6jtd0X8DUwo%2FJmcen1II%2F0NuUWaheEPUnBEdUS4m8hnaupE9A4IeN5t8C3N7dCJSkqSTqmogOuwYKGQ%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781730211_WhatsApp%20Image%202026-10-26%20at%201.12.11%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=C2Q5Nq9qDt1Y5T%2BNk63sht6xWQXoSFE1jRPP7MzbbXe1QJ8zjExgpAekWgLUWI7MJBHmdo1f6u12LWjs3XUEWxOQUVZrXUr7sqRNfslNjr1DJSNLt5sTg6GiwlXjq%2F%2B4aXYfqtKcBvg255ziHENTMi4bY0j3Z9g7WMeRM3JihSTlMwCugkAvMc5enHRNM6jI44a75bXqsXHxnlCJiLTeJs4D8oUFU0wZjRUnRs11ruQnvu81eo5M48zhKWuXzhq4bewYpic9%2BgWb9J30XcHE0Zr9DqDY0hNPjKnMGesgjRnRJCKM5kiSle99tNIa5ze7Ak6leLfp2wbKCRLjRkJH0Q%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781735981_WhatsApp%20Image%202026-10-26%20at%201.12.11%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=c1pDCTxe8L8SusNhZcgnx9XJ1XwrFLvUMJ7S2BNWcFNRzDRsE2XvYVSoFVJCfOfvgBEtpG8o7O9T%2BTZhJ8zv6sL8e%2FoCpu0c3dVEfmnIs9eIoOBRowA6Sw4XEBvEcTxA2VF6hXsxEE54OojrAIsig9hHYrPDe10zfabxG3FPsf5bnFahl5wBbuWb%2BAo2h3DwNfIG9gQT5MM%2Fze3hQDP47VAAb4AErmkYgAYyL9C1QeuUUW5ZJMBMQ0aqhhp%2BbDu1hwKcKEA%2BkPLoMJa8CcElP7Arw81ewC66vdN7AwVgU%2F5ij5jM0qoNmtXzbyd2qZ6H7lIupgQ1wh4eBrtjlY%2FlQg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781759703_WhatsApp%20Image%202026-10-26%20at%201.12.14%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=EsqXY2W%2Bwc%2Ba7dpYkUrSoZBNSnZtFNv5s2Av3lI6udTp421gqiJTFvfXD23xIUyWFktkyQh6MRD0BcjI57yHAOXGWtnwUDlSPrNa6xbtYv9jUgfaw1dypDYUMX1RH5kP8rL2%2BXWt47qijS%2BhoC9KgYnDb2lulWGOESGbVCVkP%2BEKfVjdrNuWkjNmsjfKq5aJZVGE52phh1JBRTcY%2BuXYikuLYOvvfDSXXeQCol1oLtKAKsq7pWTN18dosWVeepnwAXSwIfEcOAYBax2NR%2B1u%2BHqZ58fbbhbRe74hTTYTTN8YD87owUX9ehZYLIUIvpjK%2F5DeYrD4osKfdAySiVpzLA%3D%3D"],
  },
  {
    id: "columbus-stanfield",
    name: "Columbus Stanfield",
    slug: "columbus-stanfield",
    description: "Comfort meets performance. Next Gen 9.0 midsole for a plush ride.",
    productType: "Shoe",
    categoryId: "walking",
    collectionIds: ["bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "men",
    basePricePaise: 179900,
    mrpPaise: 179900,
    inventoryValue: 130,
    attributes: { generation: "Next Gen 9.0", drop: "10mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["WHT / L.YELLOW"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781741971_WhatsApp%20Image%202026-10-26%20at%201.12.12%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=gxlVROr4QJS1qu6MfykgxngX%2B%2F7jkd4RXULAJVoad13a3XFEF7YBw480medoL05%2FCqTuQ9L%2BBLSbCLdlcZc3meAGn6iwR01x7t5aiAdPULT3qwanBqGeCZuigH3qXN2MCPPxQiQAoJLNMw2%2F%2FY8yuLRdonOG6H%2FwR39iVcvBB7Z%2FZPJThDPLhEvC%2BJd3O23pJeuA4UI2%2FnrGRZkoUVTnNQeLcUJCFIKH54tGi9ALIZE0zE1IjgWD0gM%2Fe4E3oRYFMtl2o5Mx12%2BjisDGTycRb9swQc5SyF0C2zYcIhyRsCh0f%2F4e3sDvGYprkGi%2FuML409wRz2GSJz4okhSE0OmJsA%3D%3D"],
  },
  {
    id: "columbus-vision",
    name: "Columbus Vision",
    slug: "columbus-vision",
    description: "Elevate your running experience with Vision. Next Gen 9.0 technology.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["new-arrivals"],
    brandId: "columbus-nxg",
    brandName: "Columbus NXG",
    gender: "unisex",
    basePricePaise: 219900,
    mrpPaise: 219900,
    inventoryValue: 105,
    attributes: { generation: "Next Gen 9.0", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["WHT / MIST / BLK", "WHT / L.PISTA", "WHT / TOPAZ BLUE", "WHT/R.SLATE/F.ORNG"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781753866_WhatsApp%20Image%202026-10-26%20at%201.12.13%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=M6ZcrC%2FtC8A8F%2BDRizwKa6DI4keMahbN3L9bToJo8mBse2XYHpThfjc5J4I8%2BWk49IBB0tvxPpurC6O8Lp331vT43hwtmTIwxPE5G3JPzOR9XgcuArzfiG%2Bv4ddiDe%2BcaH8NJDtftU%2BEH0TiFgsiid%2BjdwlAQH%2F%2Bx%2BgxfRNSaN7akXJh%2BL7xRS9vmnQsmhQTFNsYtA%2FBrHKLioClqYiNQoDBe3tzNymR%2FzlpwjoXHsg1%2F2Y5QxbN3hM6wmx4bQSlpR1O39n53FPW673W48t5YlQYSvk3smio3Alwa5c%2BvBtAsg%2BlRXCAv3fya%2BMPhZ3LFU0hitOo1nev0IY6yyhJ8A%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781766526_WhatsApp%20Image%202026-10-26%20at%201.12.15%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=fb0QTxIpNYpZMTd9LmgwLuEWI0RTtmXj7fyFTr6uD9WnWLGN9DBG39ztzER5GeTXWOv7a1Y%2Bn76gdmzqVQYyIHjsBKcdbwrlGRvZpTkK1x4QlnTZfED6aMQ0xB6RVnyiLioUqQv2s6AG9%2Ba%2B8FNcP7k%2FHOhB0mJw6jdi7Nu8xLVL%2FG63qLya6zT1U8yeMon7nE8FfKbkysv5XmxclFYRr0SHDruglxHY6cDh5r9JeQrIk%2B3dAIP8bP7wBnTfqKn7zodlQIdqZiQkUabM1C1Dq%2BxNyM9A7AhsSwB146RPGkVFJ6zDPQ2mO2b%2FwCLhNR%2B0u25WoQU6jKNsrYlZ7MxqKg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781773021_WhatsApp%20Image%202026-10-26%20at%201.12.15%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=ufCQDxjDa1ndJYAFLaIn0b1OVh37l2FVBzpjGa9D5y284auJMxanwqYBOr1a%2BKi3c33yaP6V5yRX3wnZdbE8dJS8%2BILfi4iWcLJC66shNpaJTfAydtnbbmFOMGnZOJKWBlImaBP2djx2SY9PqP%2FZo2rkOLqTLFQv9iqWlChWcTb0gbH9333BnhyKYoqnO%2F4lP7aEu%2B%2BY84ZaAvzAF7lkzfnyHw5VVx59OMm%2B%2FmBNZGjJkRAFxPDtjIKVtx16%2BW696gObZaOkuJnMyiWi%2FtSnrdDLizFzQuo6%2FQepTRzYo0JVp2fOuMcLMbmq%2FIHSLkVdFKPRAdA3sLP9yvXrHiVxbA%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781779417_WhatsApp%20Image%202026-10-26%20at%201.12.16%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=mNZsZbRsAgChJmnRjYsE9lpZuthM4FVWsg%2Fh4MYNx9YqNJlLrlqcUg94Eqt5%2B0yFJQOiTwv0uFPIWJijoXNO%2F3EjbDzg00Y7RvVUG2g1iZgnKL8npQ58VJlzb%2BVsYlS5BK3w8d7CJ%2B96Ij3cYugRoKeMlTiolvIXZHUiHeKx0qIwaXu7dWnSEY%2FvO%2BCD7vn7f3xTJctkII8TGMbX%2FUPJIY43f%2FzyXOxz7cmrwbkT9IkjNJcvymn98Pr4cet5pZgrZRrdwvZwwYYD59KcahKJitHtYNOcIXpKcB7BCdR9PcPibadDZnnF32nP7RA%2BjiAwotl5uh%2FB9EcbD268oZ0aJg%3D%3D"],
  },
  {
    id: "columbus-ember",
    name: "Columbus Ember",
    slug: "columbus-ember",
    description: "Carbon racing shoe for serious athletes. Lightweight and responsive.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["carbon-racing"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "men",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 45,
    attributes: { tech: "Carbon Tech", drop: "6mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["BLK / WHITE", "L.GREY / BLK", "MOUSE / SILVER"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781785061_WhatsApp%20Image%202026-10-26%20at%201.12.17%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=2LnDG1OH851VsqTGmyQWERmPt4U56WVyEmPq%2Fv43t1t3Z56q1o3CwPdGz0Lfv0C8zxNS9FKiDRugh6qRlIjbAer3ifRGFS1jLdgN%2FOrZLZWCzoIp%2BVpl%2BH3k%2FwioozGY3B%2BVN7UZJWxt1SQdyaPn0m%2Fhu7qj%2FBQL3TipjUsNZfnAFns7LX%2FJi3PQIKKrxaEcrxjeq0dnJh0r5Gol%2B8VpBDwsvp8giugQ%2BeVsyctVhNt4ZTLgRF9pzsJWyIw%2Btz0wx5jAJJ1YkFHD081N8xchSo4ue6O6%2FNKNDSYqQDoMbTrSGZANP48AMQxZ8AY4XuXMDikFYzNrOG0y5CjxHQ%2F6Pg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781790977_WhatsApp%20Image%202026-10-26%20at%201.12.17%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=BABgnmUN4VnI4SSJi8e0hBp5A1M0wM1UUNUf5TnEJ4QRUBZhTzJ5yhSIuuNvRjygJOOTiyxXQxT0LwFpRjzORfHz7gbqQt%2FlVBKEBpVaUyIWdDuMgCIuMgKjD9jnw2QtNMHYY0CAhWZnNfT1lmilsoYdOjmLb797WMid5fkiQZc2gkFL5Y8Nm7%2BFFsJ2lrLg4qYEJwouAJxF48vcx5PBB2%2BoPDOsKSJ92avX%2FNvRCR0nSwZGy3veDbcOXxd0TPsN4XDuWI7h4szK1lv4afoAK5C7nvYKNnWJPrgmehsi2Kr0%2BQl7qzf3pfa%2FmUG3xsDBLdGnTiM7CEF0vhOSpBEU8g%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781803561_WhatsApp%20Image%202026-10-26%20at%201.12.18%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=WQoJu9qDPs%2Fz0bIjEhpacxzFIMe7TytApChheZXQaBP4YV6FS%2FfiWmUdxhCqvAkLFfJPTO5XT9V8COl2NeCtYryA5EGDMJJgv74rT7hVtLGkLAELfPwuXhIAjfSR9dOzPJ44afVkdE5iv1Pb3n%2FWHGuFm%2B%2FhjbA9k9pC57sLSqcc77lo3H8nM2zYMkgJgoAw5%2BHh41aIU0DJ6zgTddT0h0cqgygsAWJtziErxzTJgAm8bgTS6FM%2BS4U8H4DnizfWzY5U6B80Ogvh2fVEJfadPpDRyKkZB52fr%2BVuq2nm5MZ4BR2rIIZIEwzGTrKWUVq2GTwov5w6mie80nlggNOgNA%3D%3D"],
  },
  {
    id: "columbus-longrun",
    name: "Columbus Longrun",
    slug: "columbus-longrun",
    description: "Designed for long distances. Maximum comfort and carbon tech propulsion.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["carbon-racing", "bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "women",
    basePricePaise: 219900,
    mrpPaise: 219900,
    inventoryValue: 85,
    attributes: { tech: "Carbon Tech", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["WHT / MIST / BLACK", "WHITE / PISTA / ORANGE", "WHT/L.PISTA/LEMON YELLOW", "AQUA GRN / BLK"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781796705_WhatsApp%20Image%202026-10-26%20at%201.12.18%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=7GFbsFs6I5ye4x14msSOjMiptqxtx1F%2Fdb1H84UZNxjkHDSPBHyDMhey05liM%2B11Td%2FH7dENKk159FadkfeYXrK5xeCt79a%2B9eI4X6i0dEbUL727Ix3M4Z2uepmptEQPrRiZsq6WEA%2FauL9Jlcgv0HHov1ANaIcPbNVJg4xGcQUeAA0oro3yvJGnNbACX4B4HYbmnUuIWX2R5RbKYmuUc5feJtXFNO9FEAuRN4TScEnXnZpaAOY7uHuOB3hY4GCceiUoUV0oQeqVs4oocXwKFsa3LQR%2FFgsI6u%2BO57CDzQ9sJwhn9Yg005a7%2BZ8H6didU6P84%2FJGkLuS2fBZHbq1og%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781814738_WhatsApp%20Image%202026-10-26%20at%201.12.19%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=3GYIH2d3wgdaC7R8Jn31dYy5sGl4rAZZ8z52Rd1%2FCMYbJhPs1clID4rU3jYBh3XJtZYbz0i%2BD6I8H0CSRXtiBWAEkzl5sNQ1lFUWjzpCNE1qCJ47JH8j8OGT%2Bq5IpxNRB%2FvOXrWdI%2BmtYc8JbbEvXQJmzK%2BfDGYkYPlrpPZBAD8q87MacbIrj6k84u2CM5Nl1tE%2BJzKbGcnOjr0ubtoWAeUq868eOsivvwOMRoLEZcTVmes2EDM%2BVAHpwhxgU2yXg6W7QtPoAW8FRo5eE85GcfNptgoWwhLmAWye2BjR7%2BXO6onPM6FQlcr%2BD6HMiBqRZxPF4mTqunLYndYD3Et2cg%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781820335_WhatsApp%20Image%202026-10-26%20at%201.12.20%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=MZs%2F8YTt1p4TuKqT3llK002n3JT4vPX9mH2%2FOFTPaNxfL4NMbCDJkULpTkJ4hRoibCJ2cUaY%2B%2BWuMTGKAE2ydJS9pKaL2vfkqtCMFrqnbhuchnhh%2Fd7ADhLB6zQrjdM7GWC0hFuA0bA2%2BV0tBZSGibLAflUlP8492xuYFrtJJlEPFW4TIMhzMn74Iovjkpb%2Fe1VL9krbH9cutl6hK8BVP%2Fq0KjHyIoYUlQIpWd7iFDx1gpADFSmLjZlfLt%2FsiLsF4LpHT9e6wuYq1AHqd6Ks%2BKGt0G5AXMJ0A%2Fjo%2FJvradJutOAnHSUuke9cOegwAjtnHxeJUg3v0YzPKAkJkPtXWw%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781824599_WhatsApp%20Image%202026-10-26%20at%201.12.20%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=rxX7DmtfvK0flOGo1OExZPfMXwhAh%2FaO6AmFUlExorwdvX91GCuXPEbk9FaXFds8OFu6CncRHUT9ZCkTsyYCqHLezJIOwGAqrA7AoA%2FlfRZ51mYiu8unSE%2B30NubOC573o2RNMFSTkHDS6bweB1plLYbJr%2FgfvSy%2Bb9WOprfUM%2BSSLjNZHsn%2BL9Id7r2PXS7NuVZHV0i5IvCUF8GPtB93jR2Pz7FgmT0Fw5wtYKqOtMbPgyqjzxfC1b1ThCjldj%2Fr3mSEzzv44lWKkZKeP3%2FzPNhR79uaRyqGA%2Bntv34yL6nvMsEH1PXI%2F9ivUTAK3PZYbkZavy5%2BwePL72zikXjaA%3D%3D"],
  },
  {
    id: "columbus-aeroflow",
    name: "Columbus Aeroflow",
    slug: "columbus-aeroflow",
    description: "Aerodynamic design for speed. Carbon racing technology.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["carbon-racing"],
    brandId: "columbus-nxg",
    brandName: "Columbus NXG",
    gender: "unisex",
    basePricePaise: 189900,
    mrpPaise: 189900,
    inventoryValue: 70,
    attributes: { tech: "Carbon Tech", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["WHT / D.GRY / MIST"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781809072_WhatsApp%20Image%202026-10-26%20at%201.12.19%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=GpKOgrZTZ5zlrNXMwKJjh94Qt5xtYF4zJJ2PH6ub8M63yBOFgHiPXHYosOr1WTNxkWTBCrvoCPhsJTSronIfriqCmvXLtTEWbFaox26Iq3JtRw7RwEkNQ%2B9nRuIaHNYjQchHEj4knJtEwUBEJSGhC%2FcZZOwNklHP7hoIXRj4qpfIOOMjpb45v%2FczDdwY7ZDTff9ov1h7V8t9FXywYRGvbEbDb0cAW0Cu3R1nIAX%2BkVxHn4ecOmauqr4%2BQDrhre%2Fa%2FfzuoWF3oVpY2%2BRwjb6j2dgyf2PjHlSL47tTpIFA2jwSxklFDd13pAhd7ZyYsUvCQOC%2FJR8RJQsJhkNxIs1WQg%3D%3D"],
  },
  {
    id: "columbus-cliq",
    name: "Columbus Cliq",
    slug: "columbus-cliq",
    description: "Sleek and modern lifestyle shoe with running DNA.",
    productType: "Shoe",
    categoryId: "walking",
    collectionIds: ["new-arrivals"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "unisex",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 140,
    attributes: { style: "Lifestyle", drop: "10mm", terrain: "Casual" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["L.Grey / Power Blue", "White / D. Grey"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781829887_WhatsApp%20Image%202026-10-26%20at%201.12.21%20PM%20%281%29.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=ky6VOA8C%2FKzFMdUl65FigUnr3eYmBx5oRnvnQ5IVt7tsiV2FfpkLub2lp4NLRAKpAOUlJbdk9A282rECMwHDiYHrBzsPc%2BvajHFrK94xHjzHkfCf5WSq8p%2BEOHyADgUUVFts%2FEP7Vor1NO9oBDi%2BWqAKyh3XVLdIHR%2BB5qjp1ZUG4PhCWJK2pn8qyjwa9tZIoqPeC7jOK3IGAebobqmeEQ41aN%2F%2BQsvmvbeZ2zvudp14zsEEJWlxaNfqUf%2FmAlV8pguLJ5UyUlYWP%2FAe2Ekwd6zOf7cTBluxgwiZ3eBw6O%2Brtoz0mSBQ5A%2BHrcD8lTUP1xbNmoTucWFjhITWQrp3RA%3D%3D", "https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781839868_WhatsApp%20Image%202026-10-26%20at%201.12.22%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=RjRLCLkQO9oKHyXV1FjaP2Uaz77TSZ1iFsdVm07HVVEWAHrM8b%2BGl83Jik%2Br%2B%2FvQBsN0UW897Er1w%2BlvC9I3WhsTjjIxrFP6XzJvBQu3vFir2vzFkJ3AuN5lKRxOQNEl6qxGJvRDM60FeO2hPVWQNm5njMyWWXsNZzLdmBStR13cq7o0jLqyTbbddENMnINnNWzWZwoLhzdXfoMnJ7hePsFjFWaYq2Mic2mmMH0NJz5P%2BLUq0DAUkkMnJPVOkX4KdXSRUrsveuf99S9RS06uRa%2BAY21CwJD4PXA3Y7WpQNdalNOXWdumQ8ceAAB50eJ5V1JfdkxemIMrGzRi1m6WHA%3D%3D"],
  },
  {
    id: "columbus-freestyle",
    name: "Columbus Freestyle",
    slug: "columbus-freestyle",
    description: "Express your style with Freestyle. Comfortable and trendy.",
    productType: "Shoe",
    categoryId: "walking",
    collectionIds: ["bestsellers"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "women",
    basePricePaise: 229900,
    mrpPaise: 229900,
    inventoryValue: 65,
    attributes: { style: "Lifestyle", drop: "10mm", terrain: "Casual" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["SILVER GREY/PWDR BLU"],
    images: ["https://storage.googleapis.com/shera-sports-wear.firebasestorage.app/products/1793781833647_WhatsApp%20Image%202026-10-26%20at%201.12.21%20PM.jpeg?GoogleAccessId=firebase-adminsdk-fbsvc%40shera-sports-wear.iam.gserviceaccount.com&Expires=16730303400&Signature=yJr1Hic10KiCQpm%2F4uh%2Fl%2FD3eDqgvzJJ59DrGTl50hnQy85nx16h00F2Fo15C1vBm1kbISwjAPh77tFl2NgwoIgExXTNxDKeHi3Wc9g5lbTWCJ26goBmZ%2BuQuyw2dqusESLjThjWJnZbfDyiDK6WzJFwbsUu%2FB6IbSnZN0HYv6%2BrO16p7ZqApdaqH7W5er6WaJWUN%2F3MWdGbGNz0F65pDMd7z%2F8e41scHeSESbXmeVdHg6naPmHwaoQGan3L%2BMFj5asWLc05WwG1sP60MjApcFVShQDluPaG2eDPVJS5F1hLd9G8xpAhW5Ha2tnCCEXTMphJx2PkgWZGW0oNbX6lwA%3D%3D"],
  },
  // Supporting Products (Shera)
  {
    id: "shera-performance-socks",
    name: "Shera Performance Socks",
    slug: "shera-performance-socks",
    description: "Cushioned running socks to keep your feet dry and blister-free.",
    productType: "Accessories",
    categoryId: "accessories",
    collectionIds: ["bestsellers"],
    brandId: "shera",
    brandName: "Shera",
    gender: "unisex",
    basePricePaise: 49900,
    mrpPaise: 79900,
    inventoryValue: 500,
    attributes: { material: "Cotton Blend" },
    sizes: ["S/M", "L/XL"],
    colors: ["Black", "White"],
    images: ["https://placehold.co/800x1000/111111/FF6B00?text=Shera+Socks"],
  },
  {
    id: "shera-gym-bag",
    name: "Shera Gym Duffle Bag",
    slug: "shera-gym-duffle-bag",
    description: "Spacious duffle bag with shoe compartment for your gym essentials.",
    productType: "Accessories",
    categoryId: "accessories",
    collectionIds: ["new-arrivals"],
    brandId: "shera",
    brandName: "Shera",
    gender: "unisex",
    basePricePaise: 149900,
    mrpPaise: 199900,
    inventoryValue: 80,
    attributes: { capacity: "35L", material: "Polyester" },
    sizes: ["One Size"],
    colors: ["Black"],
    images: ["https://placehold.co/800x1000/111111/FF6B00?text=Shera+Gym+Bag"],
  },
  {
    id: "shera-steel-bottle",
    name: "Shera Insulated Steel Bottle",
    slug: "shera-insulated-steel-bottle",
    description: "1L insulated bottle keeps water cold for 24 hours.",
    productType: "Accessories",
    categoryId: "accessories",
    collectionIds: ["new-arrivals"],
    brandId: "shera",
    brandName: "Shera",
    gender: "unisex",
    basePricePaise: 89900,
    mrpPaise: 129900,
    inventoryValue: 250,
    attributes: { capacity: "1L", material: "Stainless Steel" },
    sizes: ["One Size"],
    colors: ["Matte Black", "Neon Orange"],
    images: ["https://placehold.co/800x1000/111111/FF6B00?text=Shera+Bottle"],
  }
];

const banners = [ /* Wahi purana code */ ];
const homepageSections = [ /* Wahi purana code */ ];
const customers = [ /* Wahi purana code */ ];

// ---------------------------------------------------------------------------
// Main (Only Product portion changed)
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 Shera Sports Wear — full reseed\n");

  console.log("👤 Ensuring admin user…");
  const adminUid = await ensureAdminUser();
  console.log(`   Admin UID: ${adminUid}\n`);

  console.log(
    "🧹 Wiping previous seed data (orders, carts, payments, catalog, addresses, wishlists)…",
  );
  
  await wipeCollections([
    "orders", "carts", "payments", "idempotencyKeys",
    "categories", "collections", "brands", "products"
  ]);
  
  const allUsers = await db.collection("users").get();
  for (const u of allUsers.docs) {
    await deleteCollectionRecursive(u.ref.collection("addresses"));
    await deleteCollectionRecursive(u.ref.collection("wishlist"));
  }
  console.log("   Done.\n");

  console.log("📂 Seeding brands…");
  await upsert(
    "brands",
    brands.map((b) => ({
      id: b.id,
      data: {
        ...b,
        logoUrl: IMG(b.name, "FFFFFF", "000000"),
        description: `${b.name} premium sports gear.`,
        createdAt: now(),
        updatedAt: now(),
      },
    })),
  );

  console.log("📂 Seeding categories…");
  await upsert(
    "categories",
    categories.map((c) => ({
      id: c.id,
      data: {
        ...c,
        image: IMG(c.name),
        description: `${c.name} collection.`,
        createdAt: now(),
        updatedAt: now(),
      },
    })),
  );

  console.log("📂 Seeding collections…");
  await upsert(
    "collections",
    collections.map((c) => ({
      id: c.id,
      data: {
        ...c,
        image: IMG(c.name),
        description: `${c.name} curated picks.`,
        createdAt: now(),
        updatedAt: now(),
      },
    })),
  );

  console.log("\n👕 Seeding products & variants…");
  const variantPool: VariantInfo[] = [];
  for (const p of products) {
    const { sizes, colors, images, ...rest } = p;
    await db
      .collection("products")
      .doc(p.id)
      .set(
        {
          ...rest,
          images: images, // Images from JSON
          status: "active",
          shortDescription: p.description.slice(0, 80),
          seoTitle: p.name,
          seoDescription: p.description,
          createdAt: now(),
          updatedAt: now(),
        },
        { merge: true },
      );

    const variants = [];
    const stockPerVariant = Math.floor(p.inventoryValue / (sizes.length * colors.length));
    
    for (const size of sizes) {
      for (const color of colors) {
        const variantId = safeId(`${size}-${color}`);
        const sku = `CLB-${safeId(p.id)}-${safeId(size)}-${safeId(color)}`.toUpperCase();
          
        variants.push({
          id: variantId,
          data: {
            sku,
            size,
            color,
            pricePaise: p.basePricePaise,
            mrpPaise: p.mrpPaise,
            inventoryValue: stockPerVariant,
            status: "active",
            attributes: {},
            images: [],
            createdAt: now(),
            updatedAt: now(),
          },
        });
        variantPool.push({
          productId: p.id,
          variantId,
          sku,
          name: p.name,
          size,
          color,
          pricePaise: p.basePricePaise,
          mrpPaise: p.mrpPaise,
          imageUrl: images[0], // Using first image as variant image
          inventoryValue: stockPerVariant,
        });
      }
    }
    await upsertVariant(p.id, variants);
    console.log(`   ${p.name} (${variants.length} variants)`);
  }

  // ... Baaki ka code (banners, customers, carts) same rahega ...

}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});