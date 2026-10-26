import dotenv from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.local FIRST, and override anything from .env
dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
  override: true,
});

// ── Credential loading: JSON file first, env vars as fallback ────────────────
function loadCredential() {
  // 1. Try service-account.json (recommended)
  const jsonPath = path.resolve(process.cwd(), "service-account.json");
  try {
    const json = JSON.parse(readFileSync(jsonPath, "utf8"));
    if (json.project_id && json.client_email && json.private_key) {
      console.log("✓ Using service-account.json");
      return cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      });
    }
  } catch {
    /* file missing — fall through to env vars */
  }

  // 2. Fallback: env vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "No Firebase Admin credentials found.\n" +
        "Either place service-account.json in the project root, " +
        "or set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local",
    );
  }

  // Sanitise: trim, strip quotes, normalise every flavour of newline
  let key = rawKey.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key
    .replace(/\\\\n/g, "\n") // literal "\\n" (double-escaped) -> newline
    .replace(/\\n/g, "\n") // literal "\n" (single-escaped)  -> newline
    .replace(/\r\n/g, "\n") // Windows CRLF -> LF
    .trim();
  if (!key.endsWith("\n")) key += "\n";

  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    console.error("Debug — key preview:");
    console.error(JSON.stringify(key.slice(0, 80)));
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not a valid PEM. " +
        'It must contain "-----BEGIN PRIVATE KEY-----". See preview above.',
    );
  }

  console.log("✓ Using env-var credentials (no service-account.json found)");
  return cert({ projectId, clientEmail, privateKey: key });
}

const app = initializeApp({ credential: loadCredential() });
const db = getFirestore(app);

const now = Timestamp.now();
// ... the rest of your seed file unchanged from `// 1. CATEGORIES` onward

// ─────────────────────────────────────────────────────────────────────────────
// 1. CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
const categories = [
  {
    id: "cat_footwear",
    slug: "footwear",
    name: "Footwear",
    parentId: null,
    ancestorIds: [],
    depth: 0,
    order: 1,
  },
  {
    id: "cat_mens",
    slug: "men",
    name: "Men",
    parentId: "cat_footwear",
    ancestorIds: ["cat_footwear"],
    depth: 1,
    order: 1,
  },
  {
    id: "cat_running",
    slug: "running",
    name: "Running Shoes",
    parentId: "cat_mens",
    ancestorIds: ["cat_footwear", "cat_mens"],
    depth: 2,
    order: 1,
  },
  {
    id: "cat_apparel",
    slug: "apparel",
    name: "Apparel",
    parentId: null,
    ancestorIds: [],
    depth: 0,
    order: 2,
  },
  {
    id: "cat_tshirts",
    slug: "t-shirts",
    name: "T-Shirts",
    parentId: "cat_apparel",
    ancestorIds: ["cat_apparel"],
    depth: 1,
    order: 1,
  },
  {
    id: "cat_accessories",
    slug: "accessories",
    name: "Accessories",
    parentId: null,
    ancestorIds: [],
    depth: 0,
    order: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────
const collections = [
  {
    id: "col_new_arrivals",
    slug: "new-arrivals",
    name: "New Arrivals",
    description: "The latest drops from Shera Sports Wear.",
    kind: "manual" as const,
    productIds: ["prd_columbus_nxg_260x", "prd_shera_dryfit_tee"],
    order: 1,
    showOnHomepage: true,
  },
  {
    id: "col_best_sellers",
    slug: "best-sellers",
    name: "Best Sellers",
    description: "Our most-loved gear.",
    kind: "manual" as const,
    productIds: ["prd_columbus_nxg_260x"],
    order: 2,
    showOnHomepage: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
const PLACEHOLDER_IMG = (name: string) => ({
  storagePath: `products/placeholder/${name}.jpg`,
  url: `https://placehold.co/800x800/111111/ffffff?text=${encodeURIComponent(name)}`,
  alt: name,
  width: 800,
  height: 800,
});

const products = [
  {
    id: "prd_columbus_nxg_260x",
    slug: "columbus-nxg-260x-running-shoes",
    name: "Columbus NXG 260X Running Shoes",
    shortDescription:
      "Lightweight running shoes built for daily mileage and long runs.",
    description:
      "The Columbus NXG 260X pairs a breathable engineered mesh upper with a responsive 260X foam midsole. " +
      "Designed for road runners and daily training alike, with a durable rubber outsole and a secure heel counter.",
    brand: "Columbus",
    categoryId: "cat_running",
    categoryPath: ["cat_footwear", "cat_mens", "cat_running"],
    collectionIds: ["col_new_arrivals", "col_best_sellers"],
    productType: "shoes" as const,
    status: "active" as const,
    sku: "CNXG260X",
    hsnCode: "6404",
    mrp: 239900, // ₹2,399
    price: 199900, // ₹1,999
    discountPercent: 17,
    discountLabel: "17% OFF",
    images: [
      { ...PLACEHOLDER_IMG("Columbus NXG Black-Yellow"), order: 0 },
      { ...PLACEHOLDER_IMG("Columbus NXG Mist-Aqua"), order: 1 },
    ],
    attributes: {
      gender: "men",
      sport: "running",
      colorFamily: ["black", "yellow", "aqua"],
    },
    filterTags: ["shoes", "running", "men", "footwear"],
    tags: ["running", "daily-trainer", "new"],
    optionColors: [
      { slug: "black-yellow", name: "Black/Yellow", hex: "#111111", order: 0 },
      { slug: "mist-aqua", name: "Mist/Aqua", hex: "#7AC8C8", order: 1 },
    ],
    optionSizes: [
      { value: "uk-6", label: "UK 6", system: "uk" as const, order: 0 },
      { value: "uk-7", label: "UK 7", system: "uk" as const, order: 1 },
      { value: "uk-8", label: "UK 8", system: "uk" as const, order: 2 },
      { value: "uk-9", label: "UK 9", system: "uk" as const, order: 3 },
      { value: "uk-10", label: "UK 10", system: "uk" as const, order: 4 },
    ],
    isFeatured: true,
    isBestseller: true,
    seo: {
      title: "Columbus NXG 260X Running Shoes | Shera Sports Wear",
      description:
        "Lightweight running shoes with responsive 260X foam midsole. Shop now.",
    },
  },
  {
    id: "prd_shera_dryfit_tee",
    slug: "shera-dryfit-training-tee",
    name: "Shera DryFit Training T-Shirt",
    shortDescription:
      "Moisture-wicking training tee for high-intensity sessions.",
    description:
      "The Shera DryFit Training Tee uses a light, breathable knit that pulls sweat away from the skin. " +
      "Athletic cut, flatlock seams, and a drop-tail hem for coverage during lifts and runs.",
    brand: "Shera",
    categoryId: "cat_tshirts",
    categoryPath: ["cat_apparel", "cat_tshirts"],
    collectionIds: ["col_new_arrivals"],
    productType: "apparel" as const,
    status: "active" as const,
    sku: "SDFTEE",
    hsnCode: "6109",
    mrp: 129900, // ₹1,299
    price: 89900, // ₹899
    discountPercent: 31,
    discountLabel: "31% OFF",
    images: [
      { ...PLACEHOLDER_IMG("Shera DryFit Tee Black"), order: 0 },
      { ...PLACEHOLDER_IMG("Shera DryFit Tee Orange"), order: 1 },
    ],
    attributes: {
      gender: "unisex",
      sport: "training",
      colorFamily: ["black", "orange"],
    },
    filterTags: ["apparel", "t-shirt", "training", "unisex"],
    tags: ["apparel", "training", "new"],
    optionColors: [
      { slug: "black", name: "Black", hex: "#111111", order: 0 },
      { slug: "orange", name: "Orange", hex: "#F97316", order: 1 },
    ],
    optionSizes: [
      { value: "s", label: "S", system: "universal" as const, order: 0 },
      { value: "m", label: "M", system: "universal" as const, order: 1 },
      { value: "l", label: "L", system: "universal" as const, order: 2 },
      { value: "xl", label: "XL", system: "universal" as const, order: 3 },
    ],
    isFeatured: false,
    isBestseller: false,
    seo: {
      title: "Shera DryFit Training T-Shirt | Shera Sports Wear",
      description:
        "Moisture-wicking training tee built for high-intensity sessions.",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
type ColorPair = { slug: string; name: string; short: string };
type SizePair = { value: string; label: string; short: string };

function buildVariants(
  productId: string,
  baseSku: string,
  colors: ColorPair[],
  sizes: SizePair[],
  priceOverride: number | null,
  mrpOverride: number | null,
) {
  const out: Array<Record<string, unknown>> = [];
  for (const c of colors) {
    for (const s of sizes) {
      const id = `${c.slug}__${s.value}`;
      out.push({
        id,
        productId,
        sku: `${baseSku}-${c.short}-${s.short}`,
        barcode: null,
        colorSlug: c.slug,
        colorName: c.name,
        sizeValue: s.value,
        sizeLabel: s.label,
        priceOverride,
        mrpOverride,
        images: [],
        isActive: true,
      });
    }
  }
  return out;
}

const variants = [
  ...buildVariants(
    "prd_columbus_nxg_260x",
    "CNXG260X",
    [
      { slug: "black-yellow", name: "Black/Yellow", short: "BKYL" },
      { slug: "mist-aqua", name: "Mist/Aqua", short: "MSAQ" },
    ],
    [
      { value: "uk-6", label: "UK 6", short: "UK6" },
      { value: "uk-7", label: "UK 7", short: "UK7" },
      { value: "uk-8", label: "UK 8", short: "UK8" },
      { value: "uk-9", label: "UK 9", short: "UK9" },
      { value: "uk-10", label: "UK 10", short: "UK10" },
    ],
    null,
    null,
  ),
  ...buildVariants(
    "prd_shera_dryfit_tee",
    "SDFTEE",
    [
      { slug: "black", name: "Black", short: "BLK" },
      { slug: "orange", name: "Orange", short: "ORG" },
    ],
    [
      { value: "s", label: "S", short: "S" },
      { value: "m", label: "M", short: "M" },
      { value: "l", label: "L", short: "L" },
      { value: "xl", label: "XL", short: "XL" },
    ],
    null,
    null,
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. BANNER
// ─────────────────────────────────────────────────────────────────────────────
const banners = [
  {
    id: "ban_hero_running",
    placement: "home_hero",
    headline: "Run Further.",
    subtitle: "New Columbus NXG 260X — engineered for daily mileage.",
    ctaLabel: "Shop Running",
    ctaHref: "/products?category=cat_running",
    image: {
      storagePath: "banners/hero-running-desktop.jpg",
      url: "https://placehold.co/1920x800/111111/ffffff?text=Run+Further",
      alt: "Runner on a road at sunrise",
      width: 1920,
      height: 800,
    },
    mobileImage: {
      storagePath: "banners/hero-running-mobile.jpg",
      url: "https://placehold.co/800x1000/111111/ffffff?text=Run+Further",
      alt: "Runner on a road at sunrise",
      width: 800,
      height: 1000,
    },
    theme: { textColor: "#FFFFFF", overlayOpacity: 0.35, alignment: "left" },
    order: 1,
    isActive: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. HOMEPAGE SECTIONS
// ─────────────────────────────────────────────────────────────────────────────
const homepageSections = [
  {
    id: "sec_hero",
    type: "hero_carousel",
    title: null,
    subtitle: null,
    layout: "carousel",
    order: 1,
    isActive: true,
    collectionIds: [],
    categoryIds: [],
    bannerIds: ["ban_hero_running"],
    productIds: [],
    body: null,
  },
  {
    id: "sec_new_arrivals",
    type: "product_carousel",
    title: "New Arrivals",
    subtitle: "Fresh from the Shera catalogue",
    layout: "carousel",
    order: 2,
    isActive: true,
    collectionIds: ["col_new_arrivals"],
    categoryIds: [],
    bannerIds: [],
    productIds: ["prd_columbus_nxg_260x", "prd_shera_dryfit_tee"],
    body: null,
  },
  {
    id: "sec_best_sellers",
    type: "product_carousel",
    title: "Best Sellers",
    subtitle: "What everyone is wearing",
    layout: "carousel",
    order: 3,
    isActive: true,
    collectionIds: ["col_best_sellers"],
    categoryIds: [],
    bannerIds: [],
    productIds: ["prd_columbus_nxg_260x"],
    body: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("Seeding Shera Sports Wear…");

  const batch = db.batch();

  // categories
  for (const c of categories) {
    batch.set(db.collection("categories").doc(c.id), {
      slug: c.slug,
      name: c.name,
      description: null,
      parentId: c.parentId,
      ancestorIds: c.ancestorIds,
      depth: c.depth,
      image: null,
      iconName: null,
      order: c.order,
      isActive: true,
      showInNavigation: true,
      productCount: 0,
      seo: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  // collections
  for (const c of collections) {
    batch.set(db.collection("collections").doc(c.id), {
      slug: c.slug,
      name: c.name,
      description: c.description,
      kind: c.kind,
      productIds: c.productIds,
      rules: [],
      image: null,
      order: c.order,
      isActive: true,
      showOnHomepage: c.showOnHomepage,
      seo: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  // products
  for (const p of products) {
    const productVariants = variants.filter((v) => v.productId === p.id);
    batch.set(db.collection("products").doc(p.id), {
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      brand: p.brand,
      categoryId: p.categoryId,
      categoryPath: p.categoryPath,
      collectionIds: p.collectionIds,
      productType: p.productType,
      status: p.status,
      sku: p.sku,
      hsnCode: p.hsnCode,
      mrp: p.mrp,
      price: p.price,
      discountPercent: p.discountPercent,
      discountLabel: p.discountLabel,
      saleEndsAt: null,
      images: p.images,
      hoverImage: null,
      attributes: p.attributes,
      filterTags: p.filterTags,
      tags: p.tags,
      optionColors: p.optionColors,
      optionSizes: p.optionSizes,
      variantCount: productVariants.length,
      minPrice: p.price,
      maxPrice: p.price,
      isFeatured: p.isFeatured,
      isBestseller: p.isBestseller,
      seo: p.seo,
      publishedAt: now,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const v of productVariants) {
      const { id, ...data } = v as { id: string } & Record<string, unknown>;
      batch.set(
        db.collection("products").doc(p.id).collection("variants").doc(id),
        { ...data, createdAt: now, updatedAt: now },
      );
    }
  }

  // banners
  for (const b of banners) {
    const { id, ...data } = b as { id: string } & Record<string, unknown>;
    batch.set(db.collection("banners").doc(id), {
      ...data,
      startsAt: null,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // homepage sections
  for (const s of homepageSections) {
    const { id, ...data } = s as { id: string } & Record<string, unknown>;
    batch.set(db.collection("homepageSections").doc(id), {
      ...data,
      startsAt: null,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();

  console.log(`✓ categories: ${categories.length}`);
  console.log(`✓ collections: ${collections.length}`);
  console.log(`✓ products: ${products.length} (variants: ${variants.length})`);
  console.log(`✓ banners: ${banners.length}`);
  console.log(`✓ homepageSections: ${homepageSections.length}`);
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
