// scripts/seed.ts
// Run: npm run seed
//
// Requires one of:
//   - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON, OR
//   - FIREBASE_SERVICE_ACCOUNT_JSON containing the raw JSON string.
//
// WARNING: This wipes everything EXCEPT the `users` collection.
// It will read existing users from Firestore to generate dummy orders and carts.

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  CollectionReference,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import * as fs from "fs";

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
const ts = (d: Date) => Timestamp.fromDate(d);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
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

// Custom Image Loader
const IMAGES = [
  "https://i.pinimg.com/736x/ff/44/e3/ff44e37249879fb73472f51aa20f7853.jpg",
  "https://i.pinimg.com/1200x/4d/88/88/4d88885d3787e9760587bc8b75b53f41.jpg",
  "https://i.pinimg.com/736x/8c/6c/09/8c6c0946d133c357f372502bb4b23371.jpg",
];
let imgIdx = 0;
const getImg = () => {
  const img = IMAGES[imgIdx % IMAGES.length];
  imgIdx++;
  return img;
};

// ---------------------------------------------------------------------------
// Catalog data
// ---------------------------------------------------------------------------
// 6 Categories
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
  {
    id: "outerwear",
    name: "Outerwear",
    slug: "outerwear",
    sortOrder: 5,
    status: "active",
  },
  {
    id: "innerwear",
    name: "Innerwear",
    slug: "innerwear",
    sortOrder: 6,
    status: "active",
  },
];

// 8 Collections
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
  {
    id: "yoga",
    name: "Yoga & Pilates",
    slug: "yoga",
    sortOrder: 4,
    status: "active",
  },
  {
    id: "basketball",
    name: "Basketball",
    slug: "basketball",
    sortOrder: 5,
    status: "active",
  },
  {
    id: "winter-wear",
    name: "Winter Wear",
    slug: "winter-wear",
    sortOrder: 6,
    status: "active",
  },
  {
    id: "limited-edition",
    name: "Limited Edition",
    slug: "limited-edition",
    sortOrder: 7,
    status: "active",
  },
  {
    id: "gym-essentials",
    name: "Gym Essentials",
    slug: "gym-essentials",
    sortOrder: 8,
    status: "active",
  },
];

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
    collectionIds: ["new-arrivals", "training", "yoga"],
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
    collectionIds: ["training", "basketball"],
    basePricePaise: 349900,
    mrpPaise: 449900,
    attributes: { upper: "Mesh", sole: "Rubber", gender: "Unisex" },
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["Black", "White"],
  },
  {
    id: "shera-compression-tee",
    name: "Shera Compression Training Tee",
    slug: "shera-compression-training-tee",
    description: "Second-skin compression tee engineered for mobility.",
    productType: "T-Shirt",
    categoryId: "men",
    collectionIds: ["training"],
    basePricePaise: 149900,
    mrpPaise: 199900,
    attributes: { fabric: "Elastane Blend", fit: "Compression", gender: "Men" },
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Charcoal", "Navy"],
  },
  {
    id: "shera-track-pants",
    name: "Shera Tapered Track Pants",
    slug: "shera-tapered-track-pants",
    description: "Everyday tapered track pants with zip pockets.",
    productType: "Track Pants",
    categoryId: "men",
    collectionIds: ["running"],
    basePricePaise: 179900,
    mrpPaise: 249900,
    attributes: { fabric: "Cotton-Poly", fit: "Tapered", gender: "Men" },
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Grey"],
  },
  {
    id: "shera-sports-bra",
    name: "Shera Support Sports Bra",
    slug: "shera-support-sports-bra",
    description: "Medium-support sports bra with removable pads.",
    productType: "Sports Bra",
    categoryId: "women",
    collectionIds: ["training", "yoga"],
    basePricePaise: 119900,
    mrpPaise: 169900,
    attributes: { fabric: "Nylon-Spandex", support: "Medium", gender: "Women" },
    sizes: ["XS", "S", "M", "L"],
    colors: ["Black", "Orange", "White"],
  },
  {
    id: "shera-yoga-top",
    name: "Shera Flow Yoga Tank",
    slug: "shera-flow-yoga-tank",
    description: "Breathable yoga tank with relaxed drape.",
    productType: "Tank Top",
    categoryId: "women",
    collectionIds: ["new-arrivals", "yoga"],
    basePricePaise: 109900,
    mrpPaise: 149900,
    attributes: { fabric: "Modal Blend", fit: "Relaxed", gender: "Women" },
    sizes: ["XS", "S", "M", "L"],
    colors: ["Black", "Teal"],
  },
  {
    id: "shera-training-hoodie",
    name: "Shera Training Hoodie",
    slug: "shera-training-hoodie",
    description: "Midweight fleece hoodie for warm-ups and recovery days.",
    productType: "Hoodie",
    categoryId: "men",
    collectionIds: ["new-arrivals", "training"],
    basePricePaise: 249900,
    mrpPaise: 349900,
    attributes: { fabric: "Cotton Fleece", fit: "Regular", gender: "Unisex" },
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black", "Charcoal"],
  },
  {
    id: "shera-gym-cap",
    name: "Shera Performance Cap",
    slug: "shera-performance-cap",
    description: "Lightweight training cap with moisture-wicking sweatband.",
    productType: "Cap",
    categoryId: "accessories",
    collectionIds: ["new-arrivals", "gym-essentials"],
    basePricePaise: 49900,
    mrpPaise: 79900,
    attributes: { fabric: "Polyester", fit: "Adjustable", gender: "Unisex" },
    sizes: ["One Size"],
    colors: ["Black", "White"],
  },
  // New Products for new Categories/Collections
  {
    id: "shera-puffer-jacket",
    name: "Shera Thermal Puffer Jacket",
    slug: "shera-thermal-puffer-jacket",
    description: "Insulated puffer jacket for cold weather training.",
    productType: "Jacket",
    categoryId: "outerwear",
    collectionIds: ["winter-wear", "new-arrivals"],
    basePricePaise: 399900,
    mrpPaise: 499900,
    attributes: { fabric: "Nylon", fit: "Regular", gender: "Unisex" },
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Olive"],
  },
  {
    id: "shera-base-layer",
    name: "Shera Thermal Base Layer",
    slug: "shera-thermal-base-layer",
    description: "Moisture-wicking base layer for extreme conditions.",
    productType: "Base Layer",
    categoryId: "innerwear",
    collectionIds: ["winter-wear", "training"],
    basePricePaise: 89900,
    mrpPaise: 129900,
    attributes: { fabric: "Polyester", fit: "Compression", gender: "Unisex" },
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black"],
  },
  {
    id: "shera-yoga-mat",
    name: "Shera Premium Yoga Mat",
    slug: "shera-premium-yoga-mat",
    description: "Non-slip, eco-friendly yoga mat for daily practice.",
    productType: "Equipment",
    categoryId: "accessories",
    collectionIds: ["yoga", "gym-essentials"],
    basePricePaise: 199900,
    mrpPaise: 249900,
    attributes: { material: "TPE", thickness: "6mm", gender: "Unisex" },
    sizes: ["One Size"],
    colors: ["Purple", "Grey"],
  },
  {
    id: "shera-basketball-shorts",
    name: "Shera Pro Basketball Shorts",
    slug: "shera-pro-basketball-shorts",
    description: "Breathable mesh basketball shorts with side splits.",
    productType: "Shorts",
    categoryId: "men",
    collectionIds: ["basketball", "training"],
    basePricePaise: 129900,
    mrpPaise: 179900,
    attributes: { fabric: "Mesh", fit: "Loose", gender: "Men" },
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black", "Red"],
  },
  {
    id: "shera-limited-tee",
    name: "Shera Limited Edition Graphic Tee",
    slug: "shera-limited-edition-graphic-tee",
    description: "Exclusive limited run graphic tee.",
    productType: "T-Shirt",
    categoryId: "men",
    collectionIds: ["limited-edition", "new-arrivals"],
    basePricePaise: 149900,
    mrpPaise: 199900,
    attributes: { fabric: "Cotton", fit: "Oversized", gender: "Unisex" },
    sizes: ["S", "M", "L", "XL"],
    colors: ["White", "Black"],
  },
];

const banners = [
  {
    id: "hero-launch",
    title: "Own Your Grind",
    subtitle: "New season performance drop is live.",
    imageUrl: getImg(),
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
    imageUrl: getImg(),
    ctaLabel: "Explore",
    ctaUrl: "/collections/training",
    placement: "home_strip",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "strip-running",
    title: "Run Season",
    subtitle: "Gear that keeps up with your pace.",
    imageUrl: getImg(),
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
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 Shera Sports Wear — full reseed (preserving users)\n");

  console.log("👥 Fetching existing users…");
  const usersSnap = await db.collection("users").get();
  type CustomerRecord = {
    uid: string;
    email: string;
    name: string;
    phone: string;
    addresses: any[];
  };
  const customerRecords: CustomerRecord[] = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const addrSnap = await db
      .collection("users")
      .doc(doc.id)
      .collection("addresses")
      .get();
    let addresses = addrSnap.docs.map((a) => ({ ...a.data(), id: a.id }));

    // Fallback if user has no addresses
    if (addresses.length === 0) {
      addresses = [
        {
          id: "fallback",
          label: "Home",
          fullName: data.displayName || "Customer",
          phone: data.phone || "+910000000000",
          line1: "123 Default Street",
          line2: "",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "India",
          isDefault: true,
        },
      ];
    }

    customerRecords.push({
      uid: doc.id,
      email: data.email || "unknown@example.com",
      name: data.displayName || "Customer",
      phone: data.phone || "+910000000000",
      addresses,
    });
  }

  if (customerRecords.length === 0) {
    console.log(
      "⚠️ No users found in 'users' collection. Create a user first or run the original seed script once.",
    );
    process.exit(1);
  }
  console.log(`   Found ${customerRecords.length} users.\n`);

  console.log("🧹 Wiping previous seed data (except users)…");
  await wipeCollections([
    "orders",
    "carts",
    "payments",
    "idempotencyKeys",
    "products",
    "categories",
    "collections",
    "banners",
    "homepageSections",
  ]);
  console.log("   Done.\n");

  console.log("📂 Seeding categories…");
  await upsert(
    "categories",
    categories.map((c) => ({
      id: c.id,
      data: {
        ...c,
        image: getImg(),
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
        image: getImg(),
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
    const imageUrl = getImg();

    await db
      .collection("products")
      .doc(p.id)
      .set(
        {
          ...rest,
          images: [imageUrl, getImg()],
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
        const sku = `SHERA-${p.id}-${size}-${color}`
          .toUpperCase()
          .replace(/\s+/g, "");
        variants.push({
          id: variantId,
          data: {
            sku,
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

  for (let i = 0; i < 4; i++) {
    cartSpecs.push({
      cartId: `cart_active_${i + 1}`,
      ownerUid: customerRecords[i % customerRecords.length].uid,
      guestId: null,
      status: "active",
      items: buildCartItems(randInt(1, 3)),
    });
  }
  for (let i = 0; i < 2; i++) {
    cartSpecs.push({
      cartId: `cart_abandoned_${i + 1}`,
      ownerUid: customerRecords[(4 + i) % customerRecords.length].uid,
      guestId: null,
      status: "abandoned",
      items: buildCartItems(randInt(1, 2)),
    });
  }
  for (let i = 0; i < 3; i++) {
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
    const orderId = `SHE-${10001 + i}`;
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
      customer.addresses.find((a: any) => a.isDefault) ?? customer.addresses[0];
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
    const itemCount = randInt(1, 3);
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

  console.log("\n✅ Seed complete.");
  console.log("⚠️  Users collection and Auth were strictly untouched.\n");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
