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

// Deterministic RNG so re-seeds are stable
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xc0ffee);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
function weightedPick<T>(items: T[], weights: number[]): T {
  const r = rand();
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    cum += weights[i];
    if (r <= cum) return items[i];
  }
  return items[items.length - 1];
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
    {
      forcePassword: true,
    },
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
  { id: "shera", name: "Shera", slug: "shera", status: "active" },
];

const categories = [
  { id: "running", name: "Running", slug: "running", sortOrder: 1, status: "active" },
  { id: "training", name: "Training & Gym", slug: "training", sortOrder: 2, status: "active" },
  { id: "walking", name: "Walking", slug: "walking", sortOrder: 3, status: "active" },
  { id: "accessories", name: "Accessories", slug: "accessories", sortOrder: 4, status: "active" },
];

const collections = [
  { id: "new-arrivals", name: "New Arrivals", slug: "new-arrivals", sortOrder: 1, status: "active" },
  { id: "carbon-racing", name: "Carbon Racing", slug: "carbon-racing", sortOrder: 2, status: "active" },
  { id: "bestsellers", name: "Bestsellers", slug: "bestsellers", sortOrder: 3, status: "active" },
];

const IMG = (label: string, hexBg: string = "111111", hexFg: string = "FF6B00") =>
  `https://placehold.co/800x1000/${hexBg}/${hexFg}?text=${encodeURIComponent(label)}`;

// ---------------------------------------------------------------------------
// Product Data (Based on provided images)
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
  inventoryValue: number; // Total stock across variants
  attributes: Record<string, any>;
  sizes: string[];
  colors: string[];
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
    colors: ["Mist/Aqua", "Black/L.Yellow"],
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
    colors: ["White/L.Pista", "Ember Grn/Black", "White/Black"],
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
    colors: ["Mouse/L.Grey", "Black/D.Grey", "White/Black"],
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
    colors: ["Wht-Blk", "L.Sky-R.Slt", "Wht-L.Yellow", "Blk-Slvr"],
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
    colors: ["Blk/Sky", "L.Grey/D.Grey", "Wht/L.Pista"],
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
    colors: ["Mid.Gry/D.Grey", "Black/Silver", "White/Black"],
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
    colors: ["Slvr Gry/Slt Blu", "Wht/L.Gry", "Black/D.Gry"],
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
    colors: ["D.Grey/Blk/Sage.Grn", "Wht/Mist/Mstd", "Wht/Lt.Yllw"],
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
    colors: ["Mist/F.Ornge", "Blk/Silver", "Slvr Gry/Powder.Blu", "Pista Grn/Mustard"],
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
    colors: ["Wht/L.Yellow"],
  },
  {
    id: "columbus-vision",
    name: "Columbus Vision",
    slug: "columbus-vision",
    description: "Elevate your running experience with Vision. Next Gen 9.0 technology.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["new-arrivals"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "unisex",
    basePricePaise: 219900,
    mrpPaise: 219900,
    inventoryValue: 105,
    attributes: { generation: "Next Gen 9.0", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["Wht/Mist/Blk", "Wht/L.Pista", "Wht/Topaz Blue", "Wht/R.Slate/F.Orng"],
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
    colors: ["Blk/White", "L.Grey/Blk", "Mouse/Silver"],
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
    colors: ["Wht/Mist/Black", "White/Pista/Orange", "Wht/L.Pista/Lemon Yellow", "Aqua Grn/Blk"],
  },
  {
    id: "columbus-aeroflow",
    name: "Columbus Aeroflow",
    slug: "columbus-aeroflow",
    description: "Aerodynamic design for speed. Carbon racing technology.",
    productType: "Shoe",
    categoryId: "running",
    collectionIds: ["carbon-racing"],
    brandId: "columbus",
    brandName: "Columbus",
    gender: "unisex",
    basePricePaise: 189900,
    mrpPaise: 189900,
    inventoryValue: 70,
    attributes: { tech: "Carbon Tech", drop: "8mm", terrain: "Road" },
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["Wht/D.Gry/Mist"],
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
    colors: ["L.Grey/Power Blue", "White/D.Grey"],
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
    colors: ["Silver Grey/Pwdr Blu"],
  },
  // Supporting Products
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
  }
];

const banners = [
  {
    id: "hero-columbus",
    title: "Own Your Run",
    subtitle: "Columbus NXG Series is here.",
    imageUrl: IMG("Columbus Hero"),
    ctaLabel: "Shop Columbus",
    ctaUrl: "/brands/columbus",
    placement: "home_hero",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "strip-carbon",
    title: "Carbon Racing",
    subtitle: "Engineered for speed.",
    imageUrl: IMG("Carbon Racing"),
    ctaLabel: "Explore",
    ctaUrl: "/collections/carbon-racing",
    placement: "home_strip",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "strip-running",
    title: "Run Season",
    subtitle: "Gear that keeps up with your pace.",
    imageUrl: IMG("Running Strip"),
    ctaLabel: "Shop running",
    ctaUrl: "/collections/running",
    placement: "home_strip",
    sortOrder: 3,
    isActive: true,
  },
];

const homepageSections = [
  {
    id: "hero",
    type: "hero",
    title: "Own Your Run",
    sortOrder: 1,
    isActive: true,
    config: { bannerId: "hero-columbus" },
  },
  {
    id: "featured",
    type: "featured_products",
    title: "New Arrivals",
    sortOrder: 2,
    isActive: true,
    config: { limit: 4 },
  },
  {
    id: "bestsellers",
    type: "bestsellers",
    title: "Bestsellers",
    sortOrder: 3,
    isActive: true,
    config: { limit: 4 },
  },
  {
    id: "categories",
    type: "category_grid",
    title: "Shop by category",
    sortOrder: 4,
    isActive: true,
    config: {},
  },
];

// ---------------------------------------------------------------------------
// Customers (dummy)
// ---------------------------------------------------------------------------
type SeedAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};
type SeedCustomer = {
  email: string;
  name: string;
  phone: string;
  marketingOptIn: boolean;
  addresses: SeedAddress[];
};

const customers: SeedCustomer[] = [
  {
    email: "arjun.mehta@example.com",
    name: "Arjun Mehta",
    phone: "+919812345001",
    marketingOptIn: true,
    addresses: [
      {
        id: "home",
        label: "Home",
        fullName: "Arjun Mehta",
        phone: "+919812345001",
        line1: "12, Rose Villa",
        line2: "MG Road",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
        country: "India",
        isDefault: true,
      }
    ],
  },
  {
    email: "priya.sharma@example.com",
    name: "Priya Sharma",
    phone: "+919812345002",
    marketingOptIn: true,
    addresses: [
      {
        id: "home",
        label: "Home",
        fullName: "Priya Sharma",
        phone: "+919812345002",
        line1: "B-402, Green Heights",
        line2: "Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400053",
        country: "India",
        isDefault: true,
      },
    ],
  },
  {
    email: "rohan.verma@example.com",
    name: "Rohan Verma",
    phone: "+919812345003",
    marketingOptIn: false,
    addresses: [
      {
        id: "home",
        label: "Home",
        fullName: "Rohan Verma",
        phone: "+919812345003",
        line1: "H-14, Hauz Khas",
        line2: "Near Deer Park",
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110016",
        country: "India",
        isDefault: true,
      },
    ],
  }
];

// ---------------------------------------------------------------------------
// Variant helper type
// ---------------------------------------------------------------------------
type VariantInfo = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  pricePaise: number;
  mrpPaise: number;
  imageUrl: string;
  inventoryValue: number;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 Shera Sports Wear — full reseed\n");

  console.log("👤 Ensuring admin user…");
  const adminUid = await ensureAdminUser();
  console.log(`   Admin UID: ${adminUid}\n`);

  console.log(
    "🧹 Wiping previous seed data (orders, carts, payments, catalog, addresses, wishlists)…",
  );
  
  // Wipe transactional data and catalog data
  await wipeCollections([
    "orders", 
    "carts", 
    "payments", 
    "idempotencyKeys",
    "categories",
    "collections",
    "brands",
    "products"
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
    const { sizes, colors, ...rest } = p;
    const imageUrl = IMG(p.name);
    await db
      .collection("products")
      .doc(p.id)
      .set(
        {
          ...rest,
          images: [imageUrl, IMG(p.name + " 2")],
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
    // Distribute inventory across variants
    const stockPerVariant = Math.floor(p.inventoryValue / (sizes.length * colors.length));
    
    for (const size of sizes) {
      for (const color of colors) {
        // Sanitize variantId to remove slashes and other problematic characters
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
            inventoryValue: stockPerVariant, // Add stock per variant
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
          imageUrl,
          inventoryValue: stockPerVariant,
        });
      }
    }
    await upsertVariant(p.id, variants);
    console.log(`   ${p.name} (${variants.length} variants)`);
  }

  console.log("\n🖼  Seeding banners…");
  await upsert(
    "banners",
    banners.map((b) => ({
      id: b.id,
      data: {
        ...b,
        startsAt: null,
        endsAt: null,
        createdAt: now(),
        updatedAt: now(),
      },
    })),
  );

  console.log("🖼  Seeding homepage sections…");
  await upsert(
    "homepageSections",
    homepageSections.map((s) => ({
      id: s.id,
      data: { ...s, createdAt: now(), updatedAt: now() },
    })),
  );

  // ------------------ Customers ------------------
  console.log("\n👥 Seeding customers…");
  type CustomerRecord = SeedCustomer & { uid: string };
  const customerRecords: CustomerRecord[] = [];

  for (const c of customers) {
    const uid = await ensureAuthUser(c.email, CUSTOMER_PASSWORD, c.name);
    const defaultAddressId =
      c.addresses.find((a) => a.isDefault)?.id ?? c.addresses[0]?.id ?? null;

    await db.collection("users").doc(uid).set(
      {
        uid,
        displayName: c.name,
        email: c.email,
        phone: c.phone,
        photoURL: null,
        marketingOptIn: c.marketingOptIn,
        defaultAddressId,
        createdAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );

    for (const a of c.addresses) {
      await db
        .collection("users")
        .doc(uid)
        .collection("addresses")
        .doc(a.id)
        .set({ ...a, createdAt: now(), updatedAt: now() });
    }

    // Wishlist container
    await db
      .collection("users")
      .doc(uid)
      .collection("wishlist")
      .doc(uid)
      .set({ uid, createdAt: now(), updatedAt: now() }, { merge: true });

    const wishCount = randInt(0, 3);
    const wishProductIds = new Set<string>();
    while (wishProductIds.size < wishCount) {
      wishProductIds.add(pick(variantPool).productId);
    }
    for (const pid of wishProductIds) {
      await db
        .collection("users")
        .doc(uid)
        .collection("wishlist")
        .doc(uid)
        .collection("items")
        .doc(pid)
        .set({
          productId: pid,
          variantId: null,
          addedAt: ts(daysAgo(randInt(1, 45))),
        });
    }

    customerRecords.push({ ...c, uid });
    console.log(
      `   ${c.name} → ${uid} (${c.addresses.length} address${
        c.addresses.length !== 1 ? "es" : ""
      }, ${wishProductIds.size} wishlist)`,
    );
  }

  // ------------------ Carts ------------------
  console.log("\n🛒 Seeding carts…");
  type CartSpec = {
    cartId: string;
    ownerUid: string | null;
    guestId: string | null;
    status: string;
    items: VariantInfo[];
  };
  const cartSpecs: CartSpec[] = [];
  const buildCartItems = (count: number): VariantInfo[] => {
    const out: VariantInfo[] = [];
    const used = new Set<string>();
    while (out.length < count) {
      const v = pick(variantPool);
      if (used.has(v.variantId)) continue;
      used.add(v.variantId);
      out.push(v);
    }
    return out;
  };

  for (let i = 0; i < Math.min(2, customerRecords.length); i++) {
    cartSpecs.push({
      cartId: `cart_active_${i + 1}`,
      ownerUid: customerRecords[i].uid,
      guestId: null,
      status: "active",
      items: buildCartItems(randInt(1, 2)),
    });
  }
  for (let i = 0; i < 2; i++) {
    cartSpecs.push({
      cartId: `cart_guest_${i + 1}`,
      ownerUid: null,
      guestId: `guest_${randInt(100000, 999999)}`,
      status: "active",
      items: buildCartItems(randInt(1, 2)),
    });
  }

  for (const c of cartSpecs) {
    const createdAt = daysAgo(randInt(0, 5));
    await db
      .collection("carts")
      .doc(c.cartId)
      .set({
        cartId: c.cartId,
        ownerUid: c.ownerUid,
        guestId: c.guestId,
        status: c.status,
        currency: "INR",
        createdAt: ts(createdAt),
        updatedAt: ts(createdAt),
        expiresAt: c.guestId ? ts(addDays(createdAt, 14)) : null,
      });
    for (const v of c.items) {
      const itemId = v.variantId;
      await db
        .collection("carts")
        .doc(c.cartId)
        .collection("items")
        .doc(itemId)
        .set({
          itemId,
          productId: v.productId,
          variantId: v.variantId,
          quantity: randInt(1, 2),
          addedAt: ts(createdAt),
          updatedAt: ts(createdAt),
        });
    }
    console.log(`   ${c.cartId} (${c.status}, ${c.items.length} items)`);
  }

  // ------------------ Orders / Payments / Shipments ------------------
  console.log("\n🧾 Seeding orders + payments + shipments…");
  const ORDER_COUNT = 25;
  const statuses = [
    "delivered",
    "shipped",
    "processing",
    "confirmed",
    "pending",
    "cancelled",
  ];
  const statusWeights = [0.4, 0.2, 0.1, 0.1, 0.1, 0.1];

  for (let i = 0; i < ORDER_COUNT; i++) {
    const orderId = `CLB-${10001 + i}`;
    const orderNumber = orderId;
    const customer = customerRecords[i % customerRecords.length];
    const status = weightedPick(statuses, statusWeights);

    let daysBack: number;
    switch (status) {
      case "delivered":
        daysBack = randInt(15, 60);
        break;
      case "shipped":
        daysBack = randInt(4, 10);
        break;
      case "processing":
        daysBack = randInt(1, 3);
        break;
      case "confirmed":
        daysBack = randInt(0, 2);
        break;
      case "pending":
        daysBack = randInt(0, 1);
        break;
      case "cancelled":
        daysBack = randInt(4, 45);
        break;
      default:
        daysBack = randInt(1, 30);
    }
    const orderDate = daysAgo(daysBack);

    // Address snapshot
    const addr =
      customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
    const addressSnapshot = {
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      label: addr.label,
    };

    // Line-item snapshots
    const items: any[] = [];
    const used = new Set<string>();
    const itemCount = randInt(1, 2);
    while (items.length < itemCount) {
      const v = pick(variantPool);
      if (used.has(v.variantId)) continue;
      used.add(v.variantId);
      const qty = randInt(1, 2);
      items.push({
        productId: v.productId,
        variantId: v.variantId,
        sku: v.sku,
        name: v.name,
        variantLabel: `${v.size} / ${v.color}`,
        size: v.size,
        color: v.color,
        quantity: qty,
        unitPricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        lineTotalPaise: v.pricePaise * qty,
        imageUrl: v.imageUrl,
      });
    }

    const subtotalPaise = items.reduce((s, it) => s + it.lineTotalPaise, 0);
    const discountPaise = rand() < 0.3 ? Math.round(subtotalPaise * 0.1) : 0;
    const shippingPaise = subtotalPaise - discountPaise >= 99900 ? 0 : 4900;
    const taxPaise = Math.round((subtotalPaise - discountPaise) * 0.05);
    const totalPaise = subtotalPaise - discountPaise + shippingPaise + taxPaise;

    const provider = rand() < 0.65 ? "razorpay" : "cod";

    let paymentStatus: string;
    if (status === "cancelled") paymentStatus = "refunded";
    else if (status === "pending") paymentStatus = "pending";
    else if (provider === "cod")
      paymentStatus = status === "delivered" ? "captured" : "pending";
    else paymentStatus = "captured";

    const fulfillmentStatus =
      status === "delivered" || status === "shipped"
        ? "fulfilled"
        : status === "cancelled"
          ? "cancelled"
          : "unfulfilled";

    const paymentId = `pay_${orderId}`;
    const idempotencyKey = `idem_${orderId}`;
    const lastUpdated =
      status === "delivered" ? addDays(orderDate, randInt(3, 6)) : orderDate;

    // Order
    await db
      .collection("orders")
      .doc(orderId)
      .set({
        orderId,
        orderNumber,
        userId: customer.uid,
        email: customer.email,
        phone: customer.phone,
        status,
        paymentStatus,
        fulfillmentStatus,
        currency: "INR",
        items,
        shippingAddress: addressSnapshot,
        billingAddress: addressSnapshot,
        subtotalPaise,
        discountPaise,
        shippingPaise,
        taxPaise,
        totalPaise,
        paymentId,
        idempotencyKey,
        createdAt: ts(orderDate),
        updatedAt: ts(lastUpdated),
      });

    // Payment
    const rzpId =
      provider === "razorpay"
        ? `pay_RZP${randInt(100000000, 999999999)}`
        : null;
    const capturedAt = paymentStatus === "captured" ? ts(orderDate) : null;
    const method =
      provider === "cod"
        ? "cod"
        : pick(["card", "upi", "netbanking", "wallet"]);

    await db
      .collection("payments")
      .doc(paymentId)
      .set({
        paymentId,
        orderId,
        userId: customer.uid,
        provider,
        providerPaymentId: rzpId,
        amountPaise: totalPaise,
        currency: "INR",
        status: paymentStatus,
        method,
        capturedAt,
        failureReason: null,
        createdAt: ts(orderDate),
        updatedAt: ts(lastUpdated),
      });

    // Shipment (only for shipped / delivered)
    if (status === "shipped" || status === "delivered") {
      const carrier = pick(["Delhivery", "Blue Dart", "Ekart"]);
      const trackingNumber = `${carrier.slice(0, 2).toUpperCase()}${randInt(
        100000000,
        999999999,
      )}`;
      const shippedAt = addDays(orderDate, randInt(1, 2));
      const deliveredAt =
        status === "delivered" ? addDays(shippedAt, randInt(2, 4)) : null;
      const shipmentId = `shp_${orderId}`;

      await db
        .collection("orders")
        .doc(orderId)
        .collection("shipments")
        .doc(shipmentId)
        .set({
          shipmentId,
          orderId,
          carrier,
          trackingNumber,
          trackingUrl: `https://track.example.com/${trackingNumber}`,
          status: status === "delivered" ? "delivered" : "in_transit",
          shippedAt: ts(shippedAt),
          deliveredAt: deliveredAt ? ts(deliveredAt) : null,
          createdAt: ts(shippedAt),
          updatedAt: ts(deliveredAt ?? shippedAt),
        });
    }

    // Idempotency key
    await db
      .collection("idempotencyKeys")
      .doc(idempotencyKey)
      .set({
        key: idempotencyKey,
        userId: customer.uid,
        operation: "createOrder",
        requestHash: randInt(10000000, 99999999).toString(16),
        orderId,
        paymentId,
        status: "completed",
        createdAt: ts(orderDate),
        expiresAt: null,
      });

    console.log(
      `   ${orderId} · ${customer.name} · ${status} · ₹${(
        totalPaise / 100
      ).toFixed(2)} · ${provider}`,
    );
  }

  console.log("\n✅ Seed complete.\n");
  console.log("Logins:");
  console.log(`  Admin    → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Customer → ${customers[0].email} / ${CUSTOMER_PASSWORD}`);
  console.log(`  Customer → ${customers[1].email} / ${CUSTOMER_PASSWORD}`);
  console.log(`  (all seeded customers use password: ${CUSTOMER_PASSWORD})`);
  console.log("\n⚠️  Change the default admin password after first login.\n");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});