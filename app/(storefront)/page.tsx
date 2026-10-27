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
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  sizes: string[];
  soldCount: number;
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

type Section = {
  id: string;
  type: string;
  isActive: boolean;
};

type Slide = Pick<
  Banner,
  "id" | "title" | "subtitle" | "imageUrl" | "ctaLabel" | "ctaUrl"
>;

type HomepageData = {
  banners: Banner[];
  products: Product[];
  categories: Category[];
  collections: Collection[];
  sections: Section[];
};

type Tab = {
  key: string;
  label: string;
  href: string;
  products: Product[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";
const HIDE_SCROLLBAR =
  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
const SLIDE_MS = 6500;
const SHOWCASE_LIMIT = 10;

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

// Headline split: last word(s) go on a second line so long titles stack neatly.
function splitTitle(title: string): [string, string] {
  const lines = title.split(/\n|\|/).map((s) => s.trim());
  if (lines.length > 1) return [lines[0], lines.slice(1).join(" ")];
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return [title, ""];
  if (words.length <= 3) return [words.slice(0, -1).join(" "), words.slice(-1)[0]];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

const FEATURES = [
  { icon: ShieldCheck, title: "Premium quality", sub: "Built for performance" },
  { icon: Truck, title: "Free delivery over ₹999", sub: "Shipped across India" },
  { icon: RotateCcw, title: "Easy returns", sub: "Hassle-free exchanges" },
  { icon: Headphones, title: "Real support", sub: "COD available on all orders" },
];

const COLOR_MAP: Record<string, string> = {
  black: "#111111",
  white: "#f7f7f7",
  orange: "#ff5a1f",
  charcoal: "#3a3a3a",
  navy: "#1e2a44",
  grey: "#9aa0a6",
  gray: "#9aa0a6",
  teal: "#0f766e",
};
function colorHex(name: string): string {
  return COLOR_MAP[name.trim().toLowerCase()] ?? "#d4d4d4";
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------
function TopBar() {
  return (
    <div className="bg-neutral-950 text-white">
      <div
        className={`${WRAP} flex h-8 items-center justify-center gap-6 text-[11px] font-medium sm:justify-between`}
      >
        <span>Free delivery on orders over ₹999</span>
        <span className="hidden sm:inline">Cash on delivery available</span>
        <span className="hidden md:inline">Easy 7-day returns</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero slider (the one bold moment on the page)
// ---------------------------------------------------------------------------
function HeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, count, go]);

  if (!count) return null;

  return (
    <div
      className="relative isolate h-[400px] overflow-hidden rounded-xl bg-neutral-950 text-white sm:h-[440px] lg:h-full lg:min-h-[480px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      {slides.map((s, i) => {
        const active = i === index;
        const [top, accent] = splitTitle(s.title);
        return (
          <div
            key={s.id}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-700 ${
              active ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
            }`}
          >
            {s.imageUrl && (
              <img
                src={s.imageUrl}
                alt=""
                fetchPriority={i === 0 ? "high" : "auto"}
                loading={i === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover object-[65%_center]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10 sm:bg-gradient-to-r sm:from-black/90 sm:via-black/55 sm:to-transparent" />

            <div
              className={`relative flex h-full flex-col justify-end p-6 transition-all duration-700 sm:justify-center sm:p-10 lg:p-14 ${
                active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
            >
              <div className="max-w-xl">
                <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-white/85">
                  <span className="h-px w-8 bg-brand" />
                  Shera Sports Wear
                </p>
                <h1 className="font-display text-[2.6rem] font-black italic uppercase leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl">
                  {top}
                  {accent && (
                    <>
                      <br />
                      <span className="text-brand">{accent}</span>
                    </>
                  )}
                </h1>
                {s.subtitle && (
                  <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-white/90 sm:text-base">
                    {s.subtitle}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={s.ctaUrl || "/products"}
                    tabIndex={active ? 0 : -1}
                    className={`inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-hover ${FOCUS}`}
                  >
                    {s.ctaLabel || "Shop now"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/collections"
                    tabIndex={active ? 0 : -1}
                    className={`inline-flex items-center rounded-md border border-white/70 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-black ${FOCUS}`}
                  >
                    All collections
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <div className="absolute bottom-4 left-6 z-20 flex items-center gap-3 sm:left-10 lg:left-14">
            <div className="flex gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-7 bg-brand" : "w-1.5 bg-white/45 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-white/70">
              {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </span>
          </div>
          <div className="absolute bottom-3 right-4 z-20 hidden gap-2 sm:flex">
            <button
              onClick={() => go(-1)}
              aria-label="Previous slide"
              className={`grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white hover:text-black ${FOCUS}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next slide"
              className={`grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white hover:text-black ${FOCUS}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Side promo tile that sits beside the hero on desktop (and under it on mobile)
function PromoTile({ banner }: { banner: Banner }) {
  return (
    <Link
      href={banner.ctaUrl || "/products"}
      className={`group relative flex min-h-[150px] overflow-hidden rounded-xl bg-neutral-900 ${FOCUS}`}
    >
      {banner.imageUrl && (
        <img
          src={banner.imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      <div className="relative z-10 flex w-full flex-col justify-end p-4">
        <h3 className="font-display text-lg font-black italic uppercase leading-none text-white sm:text-xl">
          {banner.title}
        </h3>
        {banner.subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-white/80">{banner.subtitle}</p>
        )}
        <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-white">
          <span className="border-b border-brand pb-px">{banner.ctaLabel || "Explore"}</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Category strip: one-tap access, with live product counts
// ---------------------------------------------------------------------------
function CategoryStrip({
  categories,
  counts,
}: {
  categories: Category[];
  counts: Record<string, number>;
}) {
  if (!categories.length) return null;

  return (
    <section className={`${WRAP} pt-5`} aria-label="Shop by category">
      {/* Desktop tiles */}
      <div
        className="hidden gap-3 md:grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 6)}, minmax(0, 1fr))` }}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className={`group relative flex h-[84px] overflow-hidden rounded-lg bg-neutral-100 ${FOCUS}`}
          >
            {c.image && (
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="absolute right-0 top-0 h-full w-[55%] object-cover transition-transform duration-500 group-hover:scale-110"
                style={{
                  maskImage: "linear-gradient(to right, transparent, black 45%)",
                  WebkitMaskImage: "linear-gradient(to right, transparent, black 45%)",
                }}
              />
            )}
            <div className="relative z-10 flex flex-col justify-center pl-4">
              <h3 className="font-display text-[15px] font-black uppercase leading-tight text-neutral-900">
                {c.name}
              </h3>
              <span className="mt-0.5 text-[11px] font-medium text-neutral-600">
                {counts[c.id] ?? 0} styles
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Mobile scroller */}
      <div className={`${HIDE_SCROLLBAR} -mx-4 flex gap-4 overflow-x-auto px-4 md:hidden`}>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="grid h-[64px] w-[64px] place-items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
              {c.image ? (
                <img src={c.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <Tag className="h-5 w-5 text-neutral-400" />
              )}
            </span>
            <span className="text-center text-[11px] font-semibold text-neutral-800">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------
function ProductCard({
  product,
  categoryName,
}: {
  product: Product;
  categoryName?: string;
}) {
  const { addItem, removeItem, isInWishlist } = useWishlist();
  const isSaved = isInWishlist(product.id);
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const image = product.images?.[0];
  const hoverImage = product.images?.[1];
  const extraColors = Math.max(0, (product.colors?.length ?? 0) - 4);

  const toggleWishlist = () => {
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
      <Link href={`/products/${product.slug}`} className={`block rounded-lg ${FOCUS}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-neutral-100">
          {image ? (
            <>
              <img
                src={image}
                alt={product.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
              />
              {hoverImage && (
                <img
                  src={hoverImage}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-300">
              <Tag className="h-8 w-8" />
            </div>
          )}

          {discount > 0 && (
            <span className="absolute left-2 top-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
              {discount}% off
            </span>
          )}

          {product.sizes?.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 hidden translate-y-full bg-white/95 px-2.5 py-2 text-[11px] font-semibold text-neutral-800 transition-transform duration-300 group-hover:translate-y-0 md:block">
              <span className="text-neutral-500">Sizes </span>
              {product.sizes.join("  ")}
            </div>
          )}
        </div>

        <div className="mt-2.5 flex flex-col gap-0.5">
          {categoryName && (
            <p className="text-[11px] font-medium text-neutral-500">{categoryName}</p>
          )}
          <h3 className="line-clamp-1 text-[13px] font-bold text-neutral-900">
            {product.name}
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[14px] font-black text-neutral-950">
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
          {product.colors?.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              {product.colors.slice(0, 4).map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  title={c}
                  className="h-3 w-3 rounded-full border border-neutral-300"
                  style={{ background: colorHex(c) }}
                />
              ))}
              {extraColors > 0 && (
                <span className="text-[10px] font-medium text-neutral-500">+{extraColors}</span>
              )}
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={toggleWishlist}
        aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={isSaved}
        className={`absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-neutral-600 shadow-sm transition-colors hover:text-red-500 ${FOCUS}`}
      >
        <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabbed showcase: switch between lists in place, no page loads
// ---------------------------------------------------------------------------
function Showcase({
  tabs,
  categoryNames,
}: {
  tabs: Tab[];
  categoryNames: Record<string, string>;
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  if (!tab) return null;

  const items = tab.products.slice(0, SHOWCASE_LIMIT);

  return (
    <section className={`${WRAP} pt-8`} aria-label="Shop products">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
          Shop the drop
        </h2>
        <Link
          href={tab.href}
          className={`hidden items-center gap-1 text-sm font-bold text-neutral-900 transition-colors hover:text-brand sm:inline-flex ${FOCUS}`}
        >
          View all {tab.label.toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Product lists"
        className={`${HIDE_SCROLLBAR} -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0`}
      >
        {tabs.map((t) => {
          const on = t.key === tab.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActiveKey(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${FOCUS} ${
                on
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-[11px] ${on ? "text-white/60" : "text-neutral-400"}`}>
                {t.products.length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5"
      >
        {items.map((p, i) => (
          <div
            key={`${tab.key}-${p.id}`}
            className={
              i >= 9 ? "hidden lg:block" : i >= 6 ? "hidden sm:block" : undefined
            }
          >
            <ProductCard product={p} categoryName={categoryNames[p.categoryId]} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center sm:hidden">
        <Link
          href={tab.href}
          className={`inline-flex items-center gap-1.5 rounded-md border border-neutral-900 px-5 py-2.5 text-sm font-bold ${FOCUS}`}
        >
          View all {tab.label.toLowerCase()} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Collection cards
// ---------------------------------------------------------------------------
function CollectionCards({
  collections,
  counts,
}: {
  collections: Collection[];
  counts: Record<string, number>;
}) {
  if (!collections.length) return null;

  return (
    <section className={`${WRAP} pt-10`} aria-label="Collections">
      <h2 className="mb-4 font-display text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
        Shop by collection
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {collections.slice(0, 6).map((c) => (
          <Link
            key={c.id}
            href={`/collections/${c.slug}`}
            className={`group relative flex h-[150px] overflow-hidden rounded-xl bg-neutral-900 ${FOCUS}`}
          >
            {c.image && (
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
            <div className="relative z-10 flex w-full flex-col justify-end p-5">
              <h3 className="font-display text-2xl font-black italic uppercase leading-none text-white">
                {c.name}
              </h3>
              <p className="mt-1.5 text-xs text-white/80">
                {counts[c.id] ?? 0} styles
                {c.description ? ` · ${c.description}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features strip
// ---------------------------------------------------------------------------
function FeaturesStrip() {
  return (
    <section className={`${WRAP} mt-10 border-t border-neutral-200 py-7`}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-start gap-3">
            <Icon className="h-6 w-6 shrink-0 text-neutral-900" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-bold text-neutral-900">{title}</p>
              <p className="mt-0.5 text-[12px] text-neutral-500">{sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading + error states
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div className="animate-pulse bg-white" aria-busy="true" aria-label="Loading store">
      <div className="h-8 bg-neutral-900" />
      <div className={`${WRAP} grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_340px]`}>
        <div className="h-[400px] rounded-xl bg-neutral-200 sm:h-[440px] lg:h-[480px]" />
        <div className="hidden grid-rows-2 gap-3 lg:grid">
          <div className="rounded-xl bg-neutral-200" />
          <div className="rounded-xl bg-neutral-200" />
        </div>
      </div>
      <div className={`${WRAP} grid grid-cols-2 gap-3 pt-6 sm:grid-cols-3 lg:grid-cols-5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] rounded-lg bg-neutral-200" />
            <div className="mt-2 h-3 w-3/4 rounded bg-neutral-200" />
            <div className="mt-1.5 h-3 w-1/3 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-white px-4 text-center">
      <div>
        <p className="text-lg font-bold text-neutral-900">We couldn’t load the store</p>
        <p className="mt-1 text-sm text-neutral-500">
          Check your connection and try again.
        </p>
        <button
          onClick={onRetry}
          className={`mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover ${FOCUS}`}
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function StorefrontHomePage() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setFailed(false);
      try {
        const byOrder = (name: string) =>
          getDocs(query(collection(db, name), orderBy("sortOrder", "asc")));

        const [bannersSnap, productsSnap, categoriesSnap, collectionsSnap, sectionsRes] =
          await Promise.all([
            byOrder("banners"),
            getDocs(query(collection(db, "products"), limit(60))),
            byOrder("categories"),
            byOrder("collections"),
            // CMS sections are optional: never let them break the page
            byOrder("homepageSections").catch(() => null),
          ]);

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
              sizes: Array.isArray(p.sizes) ? p.sizes : [],
              soldCount: typeof p.soldCount === "number" ? p.soldCount : 0,
            };
          });

        const categories: Category[] = categoriesSnap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const c = d.data();
            return { id: d.id, name: c.name || "", slug: c.slug || d.id, image: c.image || null };
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

        const sections: Section[] = (sectionsRes?.docs ?? []).map((d) => {
          const s = d.data();
          return { id: d.id, type: s.type || d.id, isActive: s.isActive !== false };
        });

        if (!cancelled) setData({ banners, products, categories, collections, sections });
      } catch (error) {
        console.error("Failed to load storefront data:", error);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (loading) return <PageSkeleton />;
  if (failed || !data) return <ErrorState onRetry={() => setAttempt((n) => n + 1)} />;

  // A CMS section is shown unless an admin explicitly turned it off
  const sectionOn = (type: string) => {
    const s = data.sections.find((x) => x.type === type);
    return s ? s.isActive : true;
  };

  // ---- Hero + side promos
  const heroBanners = data.banners.filter((b) => b.placement === "home_hero");
  const heroSlides: Slide[] = heroBanners.length
    ? heroBanners.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        ctaLabel: b.ctaLabel,
        ctaUrl: b.ctaUrl,
      }))
    : [
        {
          id: "fallback-hero",
          title: "Gear For A Stronger You",
          subtitle:
            "Premium sports wear for training, running, gym and everyday performance.",
          imageUrl: "https://placehold.co/1920x800/111111/FF6B00?text=Shera+Sports",
          ctaLabel: "Shop now",
          ctaUrl: "/products",
        },
      ];
  const promos = data.banners.filter((b) => b.placement === "home_strip").slice(0, 2);

  // ---- Lookups
  const categoryNames: Record<string, string> = {};
  const categoryCounts: Record<string, number> = {};
  const collectionCounts: Record<string, number> = {};
  data.categories.forEach((c) => (categoryNames[c.id] = c.name));
  data.products.forEach((p) => {
    categoryCounts[p.categoryId] = (categoryCounts[p.categoryId] ?? 0) + 1;
    p.collectionIds.forEach((id) => (collectionCounts[id] = (collectionCounts[id] ?? 0) + 1));
  });

  // ---- Showcase tabs
  const disc = (p: Product) => discountPercent(p.mrpPaise, p.basePricePaise);
  const tabs: Tab[] = [];

  if (sectionOn("bestsellers") && data.products.length) {
    tabs.push({
      key: "bestsellers",
      label: "Bestsellers",
      href: "/products",
      // Uses soldCount when present, otherwise falls back to biggest savings
      products: [...data.products].sort(
        (a, b) => b.soldCount - a.soldCount || disc(b) - disc(a),
      ),
    });
  }
  data.collections.forEach((col) => {
    const list = data.products.filter((p) => p.collectionIds.includes(col.id));
    if (list.length) {
      tabs.push({ key: col.id, label: col.name, href: `/collections/${col.slug}`, products: list });
    }
  });
  const deals = data.products.filter((p) => disc(p) > 0).sort((a, b) => disc(b) - disc(a));
  if (deals.length) {
    tabs.push({ key: "deals", label: "Top deals", href: "/products", products: deals });
  }

  return (
    <div className="bg-white text-neutral-900">
      <TopBar />

      {/* Hero: slider + two promo tiles, all above the fold on desktop */}
      <section
        className={`${WRAP} grid gap-3 py-3 ${
          promos.length ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""
        }`}
      >
        <HeroSlider slides={heroSlides} />
        {promos.length > 0 && (
          <div
            className={`grid grid-cols-2 gap-3 lg:grid-cols-1 ${
              promos.length > 1 ? "lg:grid-rows-2" : ""
            }`}
          >
            {promos.map((b) => (
              <PromoTile key={b.id} banner={b} />
            ))}
          </div>
        )}
      </section>

      {sectionOn("category_grid") && (
        <CategoryStrip categories={data.categories.slice(0, 6)} counts={categoryCounts} />
      )}

      {tabs.length > 0 ? (
        <Showcase tabs={tabs} categoryNames={categoryNames} />
      ) : (
        <section className={`${WRAP} py-16 text-center`}>
          <p className="text-lg font-bold">New products are on the way</p>
          <Link href="/collections" className="mt-2 inline-block text-sm font-bold text-brand">
            Browse collections
          </Link>
        </section>
      )}

      <CollectionCards collections={data.collections} counts={collectionCounts} />
      <FeaturesStrip />
    </div>
  );
}