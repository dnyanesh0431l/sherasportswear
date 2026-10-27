// app/(storefront)/page.tsx
"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Heart,
  Loader2,
  RotateCcw,
  Tag,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "../../lib/firebase/client";
import { useWishlist } from "./../context/wishlist-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  placement: string;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  categoryId: string;
  collectionIds: string[];
  colors: string[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
};

type Slide = Pick<
  Banner,
  "id" | "title" | "subtitle" | "imageUrl" | "ctaLabel" | "ctaUrl"
>;

// ✅ banners is ALWAYS an array now
type HomepageData = {
  banners: Banner[];
  products: Product[];
  categories: Category[];
  collections: Collection[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

function splitTitle(title: string): [string, string] {
  const lines = title.split(/\n|\|/).map((s) => s.trim());
  if (lines.length > 1) return [lines[0], lines.slice(1).join(" ")];
  const words = title.trim().split(/\s+/);
  if (words.length <= 3) return [title, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

const FEATURES = [
  { icon: ShieldCheck, title: "Premium Quality", sub: "Built for Performance" },
  { icon: Truck, title: "Fast Delivery", sub: "Across India" },
  { icon: RotateCcw, title: "Easy Returns", sub: "Hassle Free" },
  { icon: Headphones, title: "Dedicated Support", sub: "We're Here to Help" },
];

const COLOR_MAP: Record<string, string> = {
  black: "#111111", white: "#f7f7f7", orange: "#ff5a1f",
  charcoal: "#3a3a3a", navy: "#1e2a44", grey: "#9aa0a6",
  gray: "#9aa0a6", teal: "#0f766e",
};
function colorHex(name: string): string {
  return COLOR_MAP[name.trim().toLowerCase()] ?? "#d4d4d4";
}

// ---------------------------------------------------------------------------
// Hero Slider
// ---------------------------------------------------------------------------
function HeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const slide = slides[index % Math.max(count, 1)];
  const [top, accent] = splitTitle(slide?.title || "Gear for a stronger you");

  const go = (dir: number) =>
    setIndex((i) => (i + dir + count) % Math.max(count, 1));

  if (!slide) return null;

  return (
    <section className="relative isolate overflow-hidden bg-neutral-950 text-white min-h-[500px] lg:min-h-[600px] flex items-center">
      {slide.imageUrl && (
        <img
          src={slide.imageUrl}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center] lg:object-center"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/50 to-black/10 lg:bg-gradient-to-r lg:from-black/90 lg:via-black/60 lg:to-transparent" />

      <div className={`${WRAP} relative z-10 w-full py-16`}>
        <div className="max-w-2xl">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/80">
            Shera Sports Wear
          </p>
          <h1 className="font-display text-5xl font-black italic uppercase leading-[0.9] tracking-tight sm:text-6xl lg:text-[5.5rem]">
            {top}
            {top && <br />}
            <span className="text-brand">{accent}</span>
          </h1>
          {slide.subtitle && (
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/90 sm:text-base font-medium">
              {slide.subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={slide.ctaUrl || "/products"}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover"
            >
              {slide.ctaLabel || "Shop Now"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/collections"
              className="inline-flex items-center rounded-md border-2 border-white/80 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-black"
            >
              Explore Collection
            </Link>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-[10%] top-[40%] hidden -translate-y-1/2 -rotate-12 lg:block z-10">
        <p className="text-2xl font-bold italic uppercase leading-tight tracking-widest text-white/90 drop-shadow-lg">
          Discipline<br />Performance<br />Progress
        </p>
        <span className="mt-3 block h-1.5 w-48 -rotate-3 rounded-full bg-brand" />
      </div>

      {count > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/70 md:grid"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/70 md:grid"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-8 bg-brand" : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Category Row
// ---------------------------------------------------------------------------
function CategoryRow({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;

  return (
    <section className={`${WRAP} py-6 lg:py-8`}>
      <div className="hidden md:grid md:grid-cols-5 gap-4">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="group relative flex h-[110px] overflow-hidden rounded-lg bg-[#f4f4f4]"
          >
            <div className="relative z-10 flex flex-col justify-center pl-5 pr-2">
              <h3 className="font-display text-[15px] font-black uppercase leading-tight text-neutral-900 lg:text-base">
                {c.name}
              </h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-neutral-900 transition-transform group-hover:translate-x-1">
                Shop Now <ArrowRight className="h-3 w-3" />
              </span>
            </div>
            {c.image && (
              <img
                src={c.image}
                alt=""
                className="absolute right-0 top-0 h-full w-[60%] object-cover object-top transition-transform duration-500 group-hover:scale-110"
                style={{ maskImage: 'linear-gradient(to right, transparent, black 40%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 40%)' }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#f4f4f4] via-[#f4f4f4]/80 to-transparent pointer-events-none" />
          </Link>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 md:hidden">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="flex w-20 shrink-0 flex-col items-center gap-2"
          >
            <span className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
              {c.image ? (
                <img src={c.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <Tag className="h-6 w-6 text-neutral-400" />
              )}
            </span>
            <span className="text-center text-[11px] font-bold text-neutral-800">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------
function ProductCard({ product }: { product: Product }) {
  const { addItem, removeItem, isInWishlist } = useWishlist();
  const isSaved = isInWishlist(product.id);
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const image = product.images?.[0];

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaved) {
      removeItem(product.id);
      toast.info("Removed from wishlist");
    } else {
      addItem({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.basePricePaise,
        mrp: product.mrpPaise,
        image: image || "",
      });
      toast.success("Added to wishlist");
    }
  };

  return (
    <div className="group relative flex flex-col">
      <Link href={`/products/${product.slug}`} className="block relative">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#f5f5f5]">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 mix-blend-multiply"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-300">
              <Tag className="h-10 w-10" />
            </div>
          )}
          
          {discount > 0 && (
            <span className="absolute left-2 top-2 rounded-sm bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {discount}% OFF
            </span>
          )}

          <button
            type="button"
            onClick={toggleWishlist}
            aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-transparent text-neutral-500 transition-colors hover:text-red-500"
          >
            <Heart className={`h-5 w-5 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <h3 className="line-clamp-1 text-[13px] font-bold text-neutral-900 sm:text-sm">
            {product.name}
          </h3>
          
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[14px] font-black text-neutral-950 sm:text-[15px]">
              {formatINR(product.basePricePaise)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-[12px] text-neutral-400 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
                <span className="text-[11px] font-bold text-[#e84912]">
                  Save {formatINR(product.mrpPaise - product.basePricePaise)}
                </span>
              </>
            )}
          </div>

          {product.colors?.length > 0 && (
            <div className="mt-1 flex gap-1.5">
              {product.colors.slice(0, 4).map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="h-3 w-3 rounded-full border border-neutral-300"
                  style={{ background: colorHex(c) }}
                />
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection Section
// ---------------------------------------------------------------------------
function CollectionSection({
  collection,
  products,
}: {
  collection: Collection;
  products: Product[];
}) {
  if (!products.length) return null;

  return (
    <section className={`${WRAP} py-8 lg:py-10`}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-brand">
            Curated Edit
          </p>
          <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
            {collection.name}
          </h2>
          {collection.description && (
            <p className="mt-2 text-sm text-neutral-500 font-medium">
              {collection.description}
            </p>
          )}
        </div>
        <Link
          href={`/collections/${collection.slug}`}
          className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-neutral-900 transition-colors hover:text-brand mb-1"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
        {products.map((p) => (
          <div key={p.id} className="w-[60%] shrink-0 snap-start sm:w-[40%] md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Promo Banners
// ---------------------------------------------------------------------------
function PromoBanners({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;

  return (
    <section className={`${WRAP} py-6`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {banners.map((b) => (
          <Link
            key={b.id}
            href={b.ctaUrl || "/products"}
            className="group relative flex h-[200px] md:h-[240px] overflow-hidden rounded-xl bg-neutral-900"
          >
            {b.imageUrl && (
              <img
                src={b.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
            
            <div className="relative z-10 flex flex-col justify-end p-6 md:p-8 w-full">
              <h3 className="font-display text-2xl md:text-3xl font-black italic uppercase leading-[0.95] text-white">
                {b.title}
              </h3>
              {b.subtitle && (
                <p className="mt-2 text-sm text-white/80">{b.subtitle}</p>
              )}
              <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-md bg-brand px-5 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors group-hover:bg-brand-hover">
                {b.ctaLabel || "Explore"} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features Strip
// ---------------------------------------------------------------------------
function FeaturesStrip() {
  return (
    <section className={`${WRAP} py-10 border-t border-neutral-100 mt-6`}>
      <ul className="grid grid-cols-2 gap-y-8 gap-x-4 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3">
            <Icon className="h-7 w-7 shrink-0 text-neutral-800" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-bold text-neutral-900">{title}</p>
              <p className="text-[12px] text-neutral-500 mt-0.5">{sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function StorefrontHomePage() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const byOrder = (name: string) =>
          getDocs(query(collection(db, name), orderBy("sortOrder", "asc")));

        const [bannersSnap, productsSnap, categoriesSnap, collectionsSnap] =
          await Promise.all([
            byOrder("banners"),
            getDocs(query(collection(db, "products"), limit(60))),
            byOrder("categories"),
            byOrder("collections"),
          ]);

        // ✅ Force banners to be an ARRAY
        const banners: Banner[] = bannersSnap.docs
          .map((d) => {
            const b = d.data();
            return {
              id: d.id,
              title: b.title || "",
              subtitle: b.subtitle || null,
              imageUrl: b.imageUrl || "",
              ctaLabel: b.ctaLabel || null,
              ctaUrl: b.ctaUrl || null,
              placement: b.placement || "",
              sortOrder: b.sortOrder || 0,
              isActive: b.isActive !== false,
            };
          })
          .filter((b) => b.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const products: Product[] = productsSnap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const p = d.data();
            return {
              id: d.id,
              name: p.name || "",
              slug: p.slug || d.id,
              basePricePaise: p.basePricePaise || 0,
              mrpPaise: p.mrpPaise || 0,
              images: Array.isArray(p.images) ? p.images : [],
              categoryId: p.categoryId || "",
              collectionIds: Array.isArray(p.collectionIds) ? p.collectionIds : [],
              colors: Array.isArray(p.colors) ? p.colors : [],
            };
          });

        const categories: Category[] = categoriesSnap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const c = d.data();
            return {
              id: d.id,
              name: c.name || "",
              slug: c.slug || d.id,
              image: c.image || null,
            };
          });

        const collections: Collection[] = collectionsSnap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const c = d.data();
            return {
              id: d.id,
              name: c.name || "",
              slug: c.slug || d.id,
              image: c.image || null,
              description: c.description || null,
            };
          });

        setData({ banners, products, categories, collections });
      } catch (error) {
        console.error("Failed to load storefront data:", error);
        // ✅ fallback is also an array
        setData({ banners: [], products: [], categories: [], collections: [] });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!data) return null;

  // 1. Hero Slides (all banners with placement "home_hero")
  const heroBanners = data.banners.filter((b) => b.placement === "home_hero");
  const heroSlides: Slide[] = heroBanners.length > 0
    ? heroBanners.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        ctaLabel: b.ctaLabel,
        ctaUrl: b.ctaUrl,
      }))
    : [{
        id: "fallback-hero",
        title: "Gear For A Stronger You",
        subtitle: "Premium sports wear for training, running, gym and everyday performance.",
        imageUrl: "https://placehold.co/1920x800/111111/FF6B00?text=Shera+Sports",
        ctaLabel: "Shop Now",
        ctaUrl: "/products",
      }];

  // 2. Promo Banners (placement "home_strip")
  const promoBanners = data.banners
    .filter((b) => b.placement === "home_strip")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 3. Collections with their products mapped
  const collectionSections = data.collections
    .map((col) => {
      const colProducts = data.products
        .filter((p) => p.collectionIds.includes(col.id))
        .slice(0, 5);
      return { collection: col, products: colProducts };
    })
    .filter((c) => c.products.length > 0);

  return (
    <div className="bg-white">
      {/* 1. Hero Carousel (Using DB Banners) */}
      <HeroSlider slides={heroSlides} />

      {/* 2. Categories (5 columns) */}
      <CategoryRow categories={data.categories.slice(0, 5)} />

      {/* 3. Promo Banners */}
      {promoBanners.length > 0 && <PromoBanners banners={promoBanners} />}

      {/* 4. Collections mapped to product grids */}
      {collectionSections.map((section) => (
        <CollectionSection
          key={section.collection.id}
          collection={section.collection}
          products={section.products}
        />
      ))}

      {/* 5. Features Strip */}
      <FeaturesStrip />
    </div>
  );
}