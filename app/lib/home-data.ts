import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase-admin";

export type SectionType =
  | "hero_carousel"
  | "banner_strip"
  | "product_carousel"
  | "collection_grid"
  | "category_grid"
  | "rich_text";

export interface HomepageSection {
  id: string;
  type: SectionType;
  title: string | null;
  subtitle: string | null;
  layout: "grid" | "carousel" | "list";
  order: number;
  isActive: boolean;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  collectionIds: string[];
  categoryIds: string[];
  bannerIds: string[];
  productIds: string[];
  body: string | null;
}

export interface BannerDoc {
  id: string;
  placement: string;
  headline: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  image: { url: string; alt: string; width?: number; height?: number };
  mobileImage: { url: string; alt: string } | null;
  theme: { textColor?: string; overlayOpacity?: number; alignment?: "left" | "center" | "right" } | null;
  order: number;
}

export interface CategoryDoc {
  id: string;
  slug: string;
  name: string;
  image: { url: string; alt: string } | null;
}

export interface ProductDoc {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  mrp: number;
  discountPercent: number;
  images: Array<{ url: string; alt: string; order: number }>;
  hoverImage: { url: string; alt: string } | null;
}

export interface CollectionDoc {
  id: string;
  slug: string;
  name: string;
  productIds: string[];
}

export interface HomepageData {
  sections: HomepageSection[];
  banners: Record<string, BannerDoc>;
  categories: Record<string, CategoryDoc>;
  products: Record<string, ProductDoc>;
  collections: Record<string, CollectionDoc>;
}

function withinWindow(startsAt: Timestamp | null, endsAt: Timestamp | null): boolean {
  const now = Date.now();
  if (startsAt && startsAt.toMillis() > now) return false;
  if (endsAt && endsAt.toMillis() < now) return false;
  return true;
}

async function fetchByIds<T extends { id: string }>(coll: string, ids: string[]): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();
  const snaps = await Promise.all(ids.map((id) => db.collection(coll).doc(id).get()));
  return new Map(
    snaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...s.data() } as T]),
  );
}

export async function getHomepageData(): Promise<HomepageData> {
  const sectionsSnap = await db
    .collection("homepageSections")
    .where("isActive", "==", true)
    .orderBy("order", "asc")
    .get();

  const sections = sectionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as HomepageSection))
    .filter((s) => withinWindow(s.startsAt, s.endsAt));

  // Collect all referenced IDs
  const bannerIds = new Set<string>();
  const categoryIds = new Set<string>();
  const productIds = new Set<string>();
  const collectionIds = new Set<string>();
  for (const s of sections) {
    s.bannerIds.forEach((id) => bannerIds.add(id));
    s.categoryIds.forEach((id) => categoryIds.add(id));
    s.productIds.forEach((id) => productIds.add(id));
    s.collectionIds.forEach((id) => collectionIds.add(id));
  }

  // Parallel fetch
  const [bannersMap, categoriesMap, productsMap, collectionsMap] = await Promise.all([
    fetchByIds<BannerDoc>("banners", [...bannerIds]),
    fetchByIds<CategoryDoc>("categories", [...categoryIds]),
    fetchByIds<ProductDoc>("products", [...productIds]),
    fetchByIds<CollectionDoc>("collections", [...collectionIds]),
  ]);

  // Second pass: products referenced only via collections
  const neededFromCollections = new Set<string>();
  for (const c of collectionsMap.values()) {
    for (const pid of c.productIds) {
      if (!productsMap.has(pid)) neededFromCollections.add(pid);
    }
  }
  if (neededFromCollections.size > 0) {
    const extra = await fetchByIds<ProductDoc>("products", [...neededFromCollections]);
    for (const [id, p] of extra) productsMap.set(id, p);
  }

  return {
    sections,
    banners: Object.fromEntries(bannersMap),
    categories: Object.fromEntries(categoriesMap),
    products: Object.fromEntries(productsMap),
    collections: Object.fromEntries(collectionsMap),
  };
}