// scripts/seed.ts
// Run: npm run seed
//
// Requires one of:
//   - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON, OR
//   - FIREBASE_SERVICE_ACCOUNT_JSON containing the raw JSON string.
//
// Creates/updates demo catalog + CMS content and a default admin user.

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Default admin credentials — CHANGE THE PASSWORD AFTER FIRST LOGIN.
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = "admin@sherasportswear.com";
const ADMIN_PASSWORD = "Shera@Admin2024!";
const ADMIN_DISPLAY_NAME = "Shera Admin";

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

const now = () => FieldValue.serverTimestamp();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function ensureAdminUser(): Promise<string> {
  const auth = getAuth();
  let userRecord;

  try {
    userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`   Admin user already exists (uid: ${userRecord.uid})`);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
        emailVerified: true,
      });
      console.log(`   Created admin user (uid: ${userRecord.uid})`);
    } else {
      throw err;
    }
  }

  // Always (re)assert the admin claim
  await auth.setCustomUserClaims(userRecord.uid, { admin: true });
  console.log(`   Admin claim set for ${ADMIN_EMAIL}`);

  // Mirror into users/{uid}
  await db.collection("users").doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
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

  return userRecord.uid;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const categories = [
  { id: "men", name: "Men", slug: "men", sortOrder: 1, status: "active" },
  { id: "women", name: "Women", slug: "women", sortOrder: 2, status: "active" },
  {
    id: "accessories",
    name: "Accessories",
    slug: "accessories",
    sortOrder: 3,
    status: "active",
  },
  {
    id: "footwear",
    name: "Footwear",
    slug: "footwear",
    sortOrder: 4,
    status: "active",
  },
];

const collections = [
  {
    id: "new-arrivals",
    name: "New Arrivals",
    slug: "new-arrivals",
    sortOrder: 1,
    status: "active",
  },
  {
    id: "training",
    name: "Training",
    slug: "training",
    sortOrder: 2,
    status: "active",
  },
  {
    id: "running",
    name: "Running",
    slug: "running",
    sortOrder: 3,
    status: "active",
  },
];

const IMG = (label: string) =>
  `https://placehold.co/800x1000/111111/FF6B00?text=${encodeURIComponent(label)}`;

type SeedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  productType: string;
  categoryId: string;
  collectionIds: string[];
  basePricePaise: number;
  mrpPaise: number;
  attributes: Record<string, any>;
  sizes: string[];
  colors: string[];
};

const products: SeedProduct[] = [
  {
    id: "shera-dry-tee",
    name: "Shera Dry-Fit Training Tee",
    slug: "shera-dry-fit-training-tee",
    description:
      "Lightweight, moisture-wicking tee built for high-intensity training.",
    productType: "T-Shirt",
    categoryId: "men",
    collectionIds: ["new-arrivals", "training"],
    basePricePaise: 129900,
    mrpPaise: 179900,
    attributes: { fabric: "Polyester", fit: "Regular", gender: "Men" },
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "White", "Orange"],
  },
  {
    id: "shera-run-shorts",
    name: "Shera Pro Run Shorts",
    slug: "shera-pro-run-shorts",
    description: "7-inch running shorts with liner and zip pocket.",
    productType: "Shorts",
    categoryId: "men",
    collectionIds: ["running"],
    basePricePaise: 99900,
    mrpPaise: 149900,
    attributes: {
      fabric: "Recycled Polyester",
      fit: "Athletic",
      gender: "Men",
    },
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Charcoal"],
  },
  {
    id: "shera-flex-leggings",
    name: "Shera Flex Training Leggings",
    slug: "shera-flex-training-leggings",
    description: "High-waist, squat-proof leggings with four-way stretch.",
    productType: "Leggings",
    categoryId: "women",
    collectionIds: ["new-arrivals", "training"],
    basePricePaise: 159900,
    mrpPaise: 219900,
    attributes: { fabric: "Nylon-Spandex", fit: "Slim", gender: "Women" },
    sizes: ["XS", "S", "M", "L"],
    colors: ["Black", "Orange"],
  },
  {
    id: "shera-court-shoe",
    name: "Shera Court Trainer",
    slug: "shera-court-trainer",
    description: "Cushioned court shoe for cross-training and HIIT.",
    productType: "Shoe",
    categoryId: "footwear",
    collectionIds: ["training"],
    basePricePaise: 349900,
    mrpPaise: 449900,
    attributes: { upper: "Mesh", sole: "Rubber", gender: "Unisex" },
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["Black", "White"],
  },
];

const banners = [
  {
    id: "hero-launch",
    title: "Own Your Grind",
    subtitle: "New season performance drop is live.",
    imageUrl: IMG("Shera Hero"),
    ctaLabel: "Shop now",
    ctaUrl: "/products",
    placement: "home_hero",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "strip-training",
    title: "Training Essentials",
    subtitle: "Built to move.",
    imageUrl: IMG("Training Strip"),
    ctaLabel: "Explore",
    ctaUrl: "/collections/training",
    placement: "home_strip",
    sortOrder: 2,
    isActive: true,
  },
];

const homepageSections = [
  {
    id: "hero",
    type: "hero",
    title: "Own Your Grind",
    sortOrder: 1,
    isActive: true,
    config: { bannerId: "hero-launch" },
  },
  {
    id: "featured",
    type: "featured_products",
    title: "Featured",
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding admin user…");
  const adminUid = await ensureAdminUser();
  console.log(`   Admin UID: ${adminUid}\n`);

  console.log("Seeding categories…");
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

  console.log("Seeding collections…");
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

  console.log("Seeding products & variants…");
  for (const p of products) {
    const { sizes, colors, ...rest } = p;
    await db
      .collection("products")
      .doc(p.id)
      .set(
        {
          ...rest,
          images: [IMG(p.name), IMG(p.name + " 2")],
          status: "active",
          brand: "Shera Sports Wear",
          shortDescription: p.description.slice(0, 80),
          seoTitle: p.name,
          seoDescription: p.description,
          createdAt: now(),
          updatedAt: now(),
        },
        { merge: true },
      );

    const variants = [];
    for (const size of sizes) {
      for (const color of colors) {
        const variantId = `${size}-${color}`.replace(/\s+/g, "-").toLowerCase();
        variants.push({
          id: variantId,
          data: {
            sku: `SHERA-${p.id}-${size}-${color}`
              .toUpperCase()
              .replace(/\s+/g, ""),
            size,
            color,
            pricePaise: p.basePricePaise,
            mrpPaise: p.mrpPaise,
            status: "active",
            attributes: {},
            images: [],
            createdAt: now(),
            updatedAt: now(),
          },
        });
      }
    }
    await upsertVariant(p.id, variants);
    console.log(`   ${p.name} (${variants.length} variants)`);
  }

  console.log("Seeding banners…");
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

  console.log("Seeding homepage sections…");
  await upsert(
    "homepageSections",
    homepageSections.map((s) => ({
      id: s.id,
      data: { ...s, createdAt: now(), updatedAt: now() },
    })),
  );

  console.log("\n✅ Seed complete.");
  console.log("\nAdmin login:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("  URL:      /login  →  /admin\n");
  console.log("⚠️  Change the default password after first login.\n");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
