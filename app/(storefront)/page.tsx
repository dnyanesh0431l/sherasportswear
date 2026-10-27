// app/(storefront)/page.tsx
"use client";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Heart,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase/client";

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
};

type Product = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  categoryId: string;
  colors: string[]; // optional CSS colors (e.g. "#111111") from Firestore
};

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  productIds: string[];
};

type HomepageSection = {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  config: Record<string, any>;
  categoryIds?: string[];
};

type HomepageData = {
  sections: HomepageSection[];
  banners: Record<string, Banner>;
  products: Product[];
  categories: Category[];
  collections: Collection[];
};

type Slide = Pick<
  Banner,
  "id" | "title" | "subtitle" | "imageUrl" | "ctaLabel" | "ctaUrl"
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** "Gear for a stronger you" -> ["Gear for a", "stronger you"] (accent in orange).
 *  Use "|" or a newline in the title to choose the split yourself. */
function splitTitle(title: string): [string, string] {
  const lines = title.split(/\n|\|/).map((s) => s.trim());
  if (lines.length > 1) return [lines[0], lines.slice(1).join(" ")];
  const words = title.trim().split(/\s+/);
  const k = words.length >= 4 ? 2 : 1;
  return [words.slice(0, -k).join(" "), words.slice(-k).join(" ")];
}

const FEATURES = [
  { icon: ShieldCheck, title: "Premium Quality", sub: "Built for Performance" },
  { icon: Truck, title: "Fast Delivery", sub: "Across India" },
  { icon: RotateCcw, title: "Easy Returns", sub: "Hassle Free" },
  { icon: Headphones, title: "Dedicated Support", sub: "We're Here to Help" },
];

// ---------------------------------------------------------------------------
// Hero slider
// ---------------------------------------------------------------------------

function HeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const slide = slides[index % count];
  const [top, accent] = splitTitle(slide.title);
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative isolate overflow-hidden bg-neutral-950 text-white"
    >
      {slide.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.imageUrl}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center] sm:object-center"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/10 lg:bg-gradient-to-r lg:from-black/85 lg:via-black/45 lg:to-transparent" />

      <div
        className={`${WRAP} flex min-h-[440px] items-end pb-14 pt-24 lg:min-h-[500px] lg:items-center lg:py-20`}
      >
        <div className="max-w-xl">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.3em] sm:text-xs">
            Shera Sports Wear
          </p>
          <h1 className="font-display text-4xl font-black italic uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            {top}
            {top && <br />}
            <span className="text-brand">{accent}</span>
          </h1>
          {slide.subtitle && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
              {slide.subtitle}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={slide.ctaUrl || "/products"}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {slide.ctaLabel || "Shop Now"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/collections"
              className="hidden items-center rounded-md border border-white px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-neutral-900 sm:inline-flex"
            >
              Explore Collection
            </Link>
          </div>
        </div>
      </div>

      {/* Brand tagline (desktop) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[7%] top-1/2 hidden -translate-y-1/2 -rotate-12 lg:block"
      >
        <p className="text-xl font-semibold italic uppercase leading-snug tracking-wide">
          Discipline
          <br />
          Performance
          <br />
          Progress
        </p>
        <span className="mt-2 block h-1 w-44 -rotate-6 rounded-full bg-brand" />
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 transition-colors hover:bg-black/70 md:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 transition-colors hover:bg-black/70 md:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-brand" : "w-1.5 bg-white/50"
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
// Categories
// ---------------------------------------------------------------------------

function CategoryRow({ categories }: { categories: Category[] }) {
  return (
    <section aria-label="Shop by category" className={`${WRAP} py-5`}>
      {/* Desktop / tablet tiles */}
      <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-5">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="group relative flex min-h-[96px] overflow-hidden rounded-lg bg-neutral-200 lg:min-h-[108px]"
          >
            {c.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="absolute right-0 top-0 h-full w-3/5 object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-200 via-neutral-200/60 to-transparent" />
            <div className="relative flex flex-col justify-center pl-5">
              <h3 className="font-display text-base font-extrabold uppercase leading-tight text-neutral-950 lg:text-lg">
                {c.name}
              </h3>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-900">
                Shop Now <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Mobile circles */}
      <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 md:hidden">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="flex w-16 shrink-0 flex-col items-center gap-2"
          >
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Tag className="h-5 w-5 text-neutral-400" />
              )}
            </span>
            <span className="text-center text-xs font-medium">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const image = product.images[0];

  return (
    <div className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[5/6] overflow-hidden rounded-lg bg-neutral-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-300">
              <Tag className="h-10 w-10" />
            </div>
          )}
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded bg-brand px-2 py-1 text-[9px] font-bold uppercase leading-none text-white">
              {discount}% off
            </span>
          )}
        </div>
        <div className="mt-3">
          <h3 className="line-clamp-1 text-xs font-medium text-neutral-900 sm:text-sm">
            {product.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-neutral-950 sm:text-base">
              {formatINR(product.basePricePaise)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-[11px] text-neutral-400 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Save {formatINR(product.mrpPaise - product.basePricePaise)}
                </span>
              </>
            )}
          </div>
          {product.colors.length > 0 && (
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {product.colors.slice(0, 4).map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>
      </Link>
      {/* TODO: wire to your wishlist logic */}
      <button
        type="button"
        aria-label={`Add ${product.name} to wishlist`}
        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-neutral-800 transition-colors hover:text-brand"
      >
        <Heart className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductSection({
  eyebrow,
  title,
  subtitle,
  products,
  href,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  products: Product[];
  href?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className={`${WRAP} py-6 sm:py-8`}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-2xl font-black italic uppercase leading-none tracking-tight sm:text-4xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-xs text-neutral-500 sm:text-sm">{subtitle}</p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition-colors hover:text-brand"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5">
        {products.map((p) => (
          <div key={p.id} className="w-[42%] shrink-0 snap-start md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Promo banners & features
// ---------------------------------------------------------------------------

function PromoBanners({ banners }: { banners: Banner[] }) {
  return (
    <section className={`${WRAP} py-4 sm:py-6`}>
      <div className="grid gap-4 md:grid-cols-3">
        {banners.map((b, i) => (
          <Link
            key={b.id}
            href={b.ctaUrl || "/products"}
            className={`group relative isolate min-h-[140px] overflow-hidden rounded-lg bg-neutral-900 md:min-h-[150px] ${
              i > 0 ? "hidden md:block" : ""
            }`}
          >
            {b.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.imageUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="p-5 text-white sm:p-6">
              <h3 className="max-w-[9rem] font-display text-2xl font-black italic uppercase leading-none sm:text-3xl">
                {b.title}
              </h3>
              {b.subtitle && (
                <p className="mt-1 text-sm text-white/80">{b.subtitle}</p>
              )}
              <span className="mt-3 inline-flex items-center gap-1.5 rounded bg-brand px-4 py-1.5 text-xs font-semibold transition-colors group-hover:bg-brand-hover">
                {b.ctaLabel || "Explore"} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturesStrip() {
  return (
    <section aria-label="Why shop with us" className={`${WRAP} py-8`}>
      <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-center gap-3">
            <Icon className="h-7 w-7 shrink-0 text-neutral-800" strokeWidth={1.5} />
            <div>
              <p className="text-xs font-semibold sm:text-sm">{title}</p>
              <p className="text-[11px] text-neutral-500 sm:text-xs">{sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StorefrontHomePage() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const byOrder = (name: string) =>
          getDocs(query(collection(db, name), orderBy("sortOrder", "asc")));

        const [
          sectionsSnap,
          bannersSnap,
          productsSnap,
          categoriesSnap,
          collectionsSnap,
        ] = await Promise.all([
          byOrder("homepageSections"),
          byOrder("banners"),
          getDocs(
            query(
              collection(db, "products"),
              orderBy("createdAt", "desc"),
              limit(48),
            ),
          ),
          byOrder("categories"),
          byOrder("collections"),
        ]);

        const banners: Record<string, Banner> = {};
        bannersSnap.docs.forEach((d) => {
          const b = d.data();
          if (b.isActive === false) return;
          banners[d.id] = {
            id: d.id,
            title: b.title || "",
            subtitle: b.subtitle || null,
            imageUrl: b.imageUrl || "",
            ctaLabel: b.ctaLabel || null,
            ctaUrl: b.ctaUrl || null,
            placement: b.placement || "",
          };
        });

        const products: Product[] = productsSnap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const p = d.data();
            return {
              id: d.id,
              name: p.name || "",
              slug: p.slug || d.id,
              basePricePaise:
                typeof p.basePricePaise === "number" ? p.basePricePaise : 0,
              mrpPaise: typeof p.mrpPaise === "number" ? p.mrpPaise : 0,
              images: Array.isArray(p.images) ? p.images : [],
              categoryId: p.categoryId || "",
              colors: Array.isArray(p.colors)
                ? p.colors.filter((c: unknown) => typeof c === "string")
                : [],
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
              description: c.description || null,
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
              productIds: Array.isArray(c.productIds) ? c.productIds : [],
            };
          });

        const sections: HomepageSection[] = sectionsSnap.docs
          .filter((d) => d.data().isActive === true)
          .map((d) => {
            const s = d.data();
            return {
              id: d.id,
              type: s.type || "",
              title: s.title || null,
              subtitle: s.subtitle || null,
              sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : 0,
              config: s.config || {},
              categoryIds: Array.isArray(s.categoryIds) ? s.categoryIds : [],
            };
          });

        setData({ sections, banners, products, categories, collections });
      } catch (error) {
        console.error("Failed to load storefront data:", error);
        setData({
          sections: [],
          banners: {},
          products: [],
          categories: [],
          collections: [],
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-label="Loading" />
      </div>
    );
  }

  if (!data || data.sections.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-black italic uppercase tracking-tight sm:text-5xl">
          Shera Sports Wear
        </h1>
        <p className="mt-4 text-neutral-600">
          The store is being set up. Check back soon.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Browse products <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  // All "hero" sections become one slider, rendered where the first one sits.
  const heroSections = data.sections.filter((s) => s.type === "hero");
  const heroSlides: Slide[] = heroSections.map((s) => {
    const banner = s.config?.bannerId ? data.banners[s.config.bannerId] : undefined;
    return {
      id: s.id,
      title: banner?.title || s.title || "Gear for a stronger you",
      subtitle: banner?.subtitle || s.subtitle,
      imageUrl: banner?.imageUrl || "",
      ctaLabel: banner?.ctaLabel || null,
      ctaUrl: banner?.ctaUrl || null,
    };
  });

  return (
    <>
      {data.sections.map((section) => {
        switch (section.type) {
          case "hero":
            return section.id === heroSections[0].id ? (
              <HeroSlider key={section.id} slides={heroSlides} />
            ) : null;

          case "category_grid": {
            const shown = section.categoryIds?.length
              ? data.categories.filter((c) => section.categoryIds!.includes(c.id))
              : data.categories;
            return shown.length ? (
              <CategoryRow key={section.id} categories={shown} />
            ) : null;
          }

          case "featured_products":
          case "bestsellers": {
            const limitCount = Number(section.config?.limit) || 5;
            return (
              <ProductSection
                key={section.id}
                eyebrow={section.type === "bestsellers" ? "Bestsellers" : "Featured"}
                title={section.title || "Popular products"}
                subtitle={section.subtitle}
                products={data.products.slice(0, limitCount)}
                href="/products"
              />
            );
          }

          case "collection": {
            const col = data.collections.find(
              (c) => c.id === section.config?.collectionId,
            );
            if (!col) return null;
            const limitCount = Number(section.config?.limit) || 5;
            const prods = col.productIds
              .map((id) => data.products.find((p) => p.id === id))
              .filter((p): p is Product => !!p)
              .slice(0, limitCount);
            return (
              <ProductSection
                key={section.id}
                eyebrow="Curated"
                title={section.title || col.name}
                subtitle={section.subtitle || col.description}
                products={prods}
                href={`/collections/${col.slug}`}
              />
            );
          }

          // Use config.bannerIds (array) to show several banners side by side.
          // A single config.bannerId also works.
          case "promo_strip": {
            const ids: string[] = Array.isArray(section.config?.bannerIds)
              ? section.config.bannerIds
              : section.config?.bannerId
                ? [section.config.bannerId]
                : [];
            let list = ids.map((id) => data.banners[id]).filter(Boolean);
            if (list.length === 0 && section.title) {
              list = [
                {
                  id: section.id,
                  title: section.title,
                  subtitle: section.subtitle,
                  imageUrl: "",
                  ctaLabel: null,
                  ctaUrl: null,
                  placement: "",
                },
              ];
            }
            return list.length ? (
              <PromoBanners key={section.id} banners={list} />
            ) : null;
          }

          case "brand_story": {
            const body =
              section.config?.bodyText ||
              "Born from the grit of everyday athletes. Shera Sports Wear builds performance gear that moves the way you do — engineered, tested, and refined for the modern athlete.";
            return (
              <section key={section.id} className="my-8 bg-neutral-50 py-16 sm:py-20">
                <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand">
                    Our Story
                  </p>
                  <h2 className="font-display text-3xl font-black italic uppercase tracking-tight sm:text-4xl">
                    {section.title || "Built to move"}
                  </h2>
                  {section.subtitle && (
                    <p className="mt-4 text-lg text-neutral-600">{section.subtitle}</p>
                  )}
                  <p className="mt-6 whitespace-pre-line leading-relaxed text-neutral-700">
                    {body}
                  </p>
                </div>
              </section>
            );
          }

          default:
            return null;
        }
      })}

      <FeaturesStrip />

      {/* Newsletter */}
      <section className="bg-neutral-950 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand">
            Stay in the loop
          </p>
          <h2 className="font-display text-3xl font-black italic uppercase tracking-tight text-white sm:text-4xl">
            Join the movement
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-400">
            New drops, training stories, and early access. No spam.
          </p>
          {/* TODO: connect to your newsletter endpoint */}
          <form action="#" className="mx-auto mt-6 flex max-w-md gap-2">
            <input
              type="email"
              required
              aria-label="Email address"
              placeholder="you@example.com"
              className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand"
            />
            <button
              type="submit"
              className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </>
  );
}