// app/(storefront)/page.tsx
"use client";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Heart,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { db } from "../../lib/firebase/client";
import { useWishlist } from "./../context/wishlist-context";

// ---------------------------------------------------------------------------
// Types — aligned with scripts/seed.ts
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
  description: string;
  shortDescription: string;
  productType: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  categoryId: string;
  collectionIds: string[];
  brandId: string;
  brandName: string;
  gender: "men" | "women" | "unisex";
  colors: string[];
  sizes: string[];
  inventoryValue: number;
  attributes: Record<string, unknown>;
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
  sortOrder: number;
};

type Section = { id: string; type: string; isActive: boolean };

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

type Tab = { key: string; label: string; href: string; products: Product[] };

type Filters = {
  categories: string[];
  brands: string[];
  gender: string[];
  productTypes: string[];
  price: string | null;
  sizes: string[];
  colors: string[];
  onSale: boolean;
};

type SortKey = "featured" | "price-asc" | "price-desc" | "discount";

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";
const HIDE_SCROLLBAR =
  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
const SLIDE_MS = 6500;
const PAGE_SIZE = 20;

const EMPTY_FILTERS: Filters = {
  categories: [],
  brands: [],
  gender: [],
  productTypes: [],
  price: null,
  sizes: [],
  colors: [],
  onSale: false,
};

const PRICE_BUCKETS = [
  { key: "u1000", label: "Under ₹1,000", min: 0, max: 99999 },
  { key: "1-2k", label: "₹1,000 – ₹1,999", min: 100000, max: 199999 },
  { key: "2-3k", label: "₹2,000 – ₹2,999", min: 200000, max: 299999 },
  { key: "3k", label: "₹3,000 & above", min: 300000, max: Infinity },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "discount", label: "Biggest discount" },
];

const GENDER_ORDER = ["men", "women", "unisex"] as const;
const GENDER_LABEL: Record<string, string> = {
  men: "Men",
  women: "Women",
  unisex: "Unisex",
};

// Sizes from seed: numeric shoe sizes, apparel (S/M, L/XL), One Size
const SIZE_ORDER = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "One Size",
  "S/M",
  "L/XL",
];
function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = Number(s);
  return Number.isFinite(n) ? 100 + n : 500;
}

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
  if (words.length <= 1) return [title, ""];
  if (words.length <= 3)
    return [words.slice(0, -1).join(" "), words[words.length - 1]];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

const FEATURES = [
  { icon: ShieldCheck, title: "Premium quality", sub: "Built for performance" },
  {
    icon: Truck,
    title: "Free delivery over ₹999",
    sub: "Shipped across India",
  },
  { icon: RotateCcw, title: "Easy returns", sub: "Hassle-free exchanges" },
  {
    icon: Headphones,
    title: "Real support",
    sub: "COD available on all orders",
  },
];

// ---------------------------------------------------------------------------
// Color parsing — seed uses compound names ("Mist/Aqua", "Wht-Blk", "Blk/Sky")
// ---------------------------------------------------------------------------
const COLOR_TOKENS: { match: RegExp; hex: string }[] = [
  { match: /^black|^blk/, hex: "#111111" },
  { match: /^white|^wht/, hex: "#f5f5f5" },
  { match: /^grey|^gray|^gry/, hex: "#9aa0a6" },
  { match: /^silver|^slvr/, hex: "#c0c0c0" },
  { match: /^navy/, hex: "#1e2a44" },
  { match: /^blue|^blu/, hex: "#2563eb" },
  { match: /^sky|^powder/, hex: "#7dd3fc" },
  { match: /^teal|^aqua|^ember/, hex: "#0f766e" },
  { match: /^green|^grn|^pista|^sage/, hex: "#4ade80" },
  { match: /^yellow|^yllw|^lemon|^mustard|^mstd/, hex: "#facc15" },
  { match: /^orange|^ornge|^orn\b|^f\.ornge/, hex: "#ff5a1f" },
  { match: /^red/, hex: "#dc2626" },
  { match: /^pink/, hex: "#ec4899" },
  { match: /^purple/, hex: "#7c3aed" },
  { match: /^brown/, hex: "#78350f" },
  { match: /^beige|^mist/, hex: "#e7e5e4" },
  { match: /^mouse/, hex: "#737373" },
  { match: /^charcoal|^d\.grey|^d\.gry/, hex: "#3a3a3a" },
  { match: /^topaz/, hex: "#0d9488" },
];

function colorHex(name: string): string {
  const first = name
    .trim()
    .toLowerCase()
    .split(/[\/\-]/)[0]
    .trim();
  for (const { match, hex } of COLOR_TOKENS) {
    if (match.test(first)) return hex;
  }
  return "#d4d4d4";
}

// Filter matching. `skip` leaves one group out so option counts stay accurate.
function matches(p: Product, f: Filters, skip?: keyof Filters): boolean {
  if (
    skip !== "categories" &&
    f.categories.length &&
    !f.categories.includes(p.categoryId)
  )
    return false;
  if (skip !== "brands" && f.brands.length && !f.brands.includes(p.brandId))
    return false;
  if (skip !== "gender" && f.gender.length && !f.gender.includes(p.gender))
    return false;
  if (
    skip !== "productTypes" &&
    f.productTypes.length &&
    !f.productTypes.includes(p.productType)
  )
    return false;
  if (skip !== "price" && f.price) {
    const b = PRICE_BUCKETS.find((x) => x.key === f.price);
    if (b && !(p.basePricePaise >= b.min && p.basePricePaise <= b.max))
      return false;
  }
  if (
    skip !== "sizes" &&
    f.sizes.length &&
    !f.sizes.some((s) => p.sizes.includes(s))
  )
    return false;
  if (
    skip !== "colors" &&
    f.colors.length &&
    !f.colors.some((c) => p.colors.includes(c))
  )
    return false;
  if (
    skip !== "onSale" &&
    f.onSale &&
    discountPercent(p.mrpPaise, p.basePricePaise) <= 0
  )
    return false;
  return true;
}

function NoScrollbars() {
  return (
    <style>{`
      html, body, * { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { display: none; width: 0; height: 0; }
    `}</style>
  );
}

// ---------------------------------------------------------------------------
// Hero slider
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

  if (!count) return null;

  return (
    <div
      className="relative isolate h-[70svh] w-full overflow-hidden bg-neutral-950 text-white lg:h-[clamp(460px,72vh,640px)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        setPaused(false);
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (count > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      <style>{`
        @keyframes heroProgress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .hero-progress { animation-name: heroProgress; animation-timing-function: linear; animation-fill-mode: forwards; }
        .hero-pad { padding-left: 1.25rem; padding-right: 1.25rem; }
        @media (min-width: 640px) { .hero-pad { padding-left: 2rem; padding-right: 2rem; } }
        @media (min-width: 1024px) { .hero-pad { padding-left: max(2rem, calc((100vw - 1440px) / 2 + 2rem)); padding-right: 2.5rem; } }
        @media (prefers-reduced-motion: reduce) { .hero-progress { animation: none; transform: none; } }
      `}</style>

      <div className="grid h-full grid-cols-1 grid-rows-1">
        {slides.map((s, i) => {
          const active = i === index;
          const [top, accent] = splitTitle(s.title);
          return (
            <div
              key={s.id}
              aria-hidden={!active}
              className={`col-start-1 row-start-1 flex min-h-0 flex-col transition-opacity duration-700 lg:grid lg:grid-cols-[40%_60%] ${
                active
                  ? "z-10 opacity-100"
                  : "pointer-events-none z-0 opacity-0"
              }`}
            >
              <div className="relative order-first shrink-0 basis-[46%] overflow-hidden lg:order-last lg:h-full lg:basis-auto">
                {s.imageUrl && (
                  <img
                    src={s.imageUrl}
                    alt=""
                    fetchPriority={i === 0 ? "high" : "auto"}
                    loading={i === 0 ? "eager" : "lazy"}
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out ${
                      active ? "scale-100" : "scale-[1.06]"
                    }`}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-neutral-950 lg:bg-gradient-to-r lg:from-neutral-950 lg:via-neutral-950/10 lg:to-transparent" />
              </div>

              <div className="hero-pad relative flex min-h-0 flex-1 flex-col justify-center pb-10 lg:pb-12">
                <div
                  className={`max-w-lg transition-all delay-150 duration-700 ${
                    active
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                >
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-white/90 lg:mb-3 lg:text-xs">
                    <span className="h-0.5 w-7 bg-brand" />
                    Shera Sports Wear
                  </p>
                  <h1 className="break-words text-[#ff5a1f] font-display text-[clamp(1.9rem,8.5vw,2.6rem)] font-black italic uppercase leading-[0.92] tracking-tight lg:text-[3.5rem] xl:text-[4.25rem]">
                    {top}
                    {accent && (
                      <>
                        <br />
                        <span className="text-brand">{accent}</span>
                      </>
                    )}
                  </h1>
                  {s.subtitle && (
                    <p className="mt-2.5 line-clamp-2 max-w-md text-[13px] font-medium leading-snug text-white/90 lg:mt-4 lg:text-base lg:leading-relaxed">
                      {s.subtitle}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 lg:mt-6 lg:gap-3">
                    <Link
                      href={s.ctaUrl || "/products"}
                      tabIndex={active ? 0 : -1}
                      className={`inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-extrabold text-neutral-950 transition-colors hover:bg-brand-hover lg:px-6 lg:py-3 ${FOCUS}`}
                    >
                      {s.ctaLabel || "Shop now"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/collections"
                      tabIndex={active ? 0 : -1}
                      className={`inline-flex items-center rounded-md border border-white/70 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white hover:text-neutral-950 lg:px-6 lg:py-3 ${FOCUS}`}
                    >
                      All collections
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <div className="hero-pad absolute inset-x-0 bottom-4 z-20 lg:right-[60%]">
            <div className="flex gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}: ${s.title}`}
                  aria-current={i === index}
                  className={`group min-w-0 flex-1 text-left ${FOCUS}`}
                >
                  <span className="relative block h-[3px] overflow-hidden rounded-full bg-white/30">
                    {i < index && (
                      <span className="absolute inset-0 bg-white/70" />
                    )}
                    {i === index && (
                      <span
                        key={index}
                        className="hero-progress absolute inset-0 origin-left bg-brand"
                        style={{
                          animationDuration: `${SLIDE_MS}ms`,
                          animationPlayState: paused ? "paused" : "running",
                        }}
                        onAnimationEnd={() => go(1)}
                      />
                    )}
                  </span>
                  <span
                    className={`mt-1.5 hidden truncate text-[11px] font-semibold transition-colors lg:block ${
                      i === index
                        ? "text-[white]"
                        : "text-white/65 group-hover:text-white"
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="absolute bottom-4 right-6 z-20 hidden gap-2 lg:flex">
            <button
              onClick={() => go(-1)}
              aria-label="Previous slide"
              className={`grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-white hover:text-neutral-950 ${FOCUS}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next slide"
              className={`grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-white hover:text-neutral-950 ${FOCUS}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category strip
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
    <section className={`${WRAP} pt-3`} aria-label="Shop by category">
      <div
        className="hidden gap-2.5 md:grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(categories.length, 6)}, minmax(0, 1fr))`,
        }}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className={`group relative flex h-[60px] overflow-hidden rounded-md bg-neutral-100 ${FOCUS}`}
          >
            {c.image && (
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="absolute right-0 top-0 h-full w-[50%] object-cover transition-transform duration-500 group-hover:scale-110"
                style={{
                  maskImage:
                    "linear-gradient(to right, transparent, black 45%)",
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent, black 45%)",
                }}
              />
            )}
            <div className="relative z-10 flex flex-col justify-center pl-3.5">
              <h3 className="font-display text-[13px] font-black uppercase leading-tight text-neutral-950">
                {c.name}
              </h3>
              <span className="text-[11px] font-medium text-neutral-600">
                {counts[c.id] ?? 0} styles
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div
        className={`${HIDE_SCROLLBAR} -mx-4 flex gap-3.5 overflow-x-auto px-4 md:hidden`}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="flex w-[58px] shrink-0 flex-col items-center gap-1"
          >
            <span className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border border-neutral-300 bg-neutral-100">
              {c.image ? (
                <img
                  src={c.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Tag className="h-5 w-5 text-neutral-500" />
              )}
            </span>
            <span className="text-center text-[11px] font-semibold text-neutral-900">
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
function ProductCard({ product }: { product: Product }) {
  const { addItem, removeItem, isInWishlist } = useWishlist();
  const isSaved = isInWishlist(product.id);
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const image = product.images?.[0];
  const hoverImage = product.images?.[1];
  const extraColors = Math.max(0, (product.colors?.length ?? 0) - 3);

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
    <div className="group relative">
      <Link
        href={`/products/${product.slug}`}
        className={`block rounded-md ${FOCUS}`}
      >
        <div className="relative aspect-[6/7] overflow-hidden rounded-md bg-neutral-100">
          {image ? (
            <>
              <img
                src={image}
                alt={product.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
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
            <div className="grid h-full w-full place-items-center text-neutral-400">
              <Tag className="h-7 w-7" />
            </div>
          )}

          {discount > 0 && (
            <span className="absolute left-1.5 top-1.5 rounded-sm bg-brand px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-neutral-950">
              {discount}% off
            </span>
          )}

          {product.sizes?.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 hidden translate-y-full bg-white/95 px-2 py-1.5 text-[10.5px] font-semibold text-neutral-900 transition-transform duration-300 group-hover:translate-y-0 md:block">
              {product.sizes.join("  ")}
            </div>
          )}
        </div>

        <div className="mt-1.5">
          <h3 className="line-clamp-1 text-[12.5px] font-semibold leading-tight text-neutral-950">
            {product.name}
          </h3>
          <div className="mt-0.5 flex items-center justify-between gap-1.5">
            <p className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-extrabold text-neutral-950">
                {formatINR(product.basePricePaise)}
              </span>
              {discount > 0 && (
                <span className="text-[11px] text-neutral-500 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
              )}
            </p>
            {product.colors?.length > 0 && (
              <span className="flex items-center gap-0.5">
                {product.colors.slice(0, 3).map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    title={c}
                    className="h-2.5 w-2.5 rounded-full border border-neutral-400"
                    style={{ background: colorHex(c) }}
                  />
                ))}
                {extraColors > 0 && (
                  <span className="text-[10px] font-semibold text-neutral-600">
                    +{extraColors}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={toggleWishlist}
        aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={isSaved}
        className={`absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-white text-neutral-700 shadow-sm transition-colors hover:text-red-600 ${FOCUS}`}
      >
        <Heart
          className={`h-3.5 w-3.5 ${isSaved ? "fill-red-600 text-red-600" : ""}`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-b border-neutral-200 py-3 first:pt-0 last:border-b-0">
      <legend className="mb-1.5 text-[12px] font-extrabold text-neutral-950">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
}) {
  const dim = count === 0 && !checked;
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 py-[3px] text-[12.5px] ${
        dim ? "text-neutral-400" : "text-neutral-900"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-neutral-400 accent-brand"
      />
      <span className="flex-1">{label}</span>
      <span className="text-[11px] tabular-nums text-neutral-500">{count}</span>
    </label>
  );
}

function FilterPanel({
  products,
  filters,
  onChange,
  categoryNames,
  brandNames,
}: {
  products: Product[];
  filters: Filters;
  onChange: (f: Filters) => void;
  categoryNames: Record<string, string>;
  brandNames: Record<string, string>;
}) {
  const catIds = Object.keys(categoryNames).filter((id) =>
    products.some((p) => p.categoryId === id),
  );
  const brandIds = Object.keys(brandNames).filter((id) =>
    products.some((p) => p.brandId === id),
  );
  const presentGenders = GENDER_ORDER.filter((g) =>
    products.some((p) => p.gender === g),
  );
  const productTypes = Array.from(
    new Set(products.map((p) => p.productType).filter(Boolean)),
  ).sort();

  const sizes = Array.from(new Set(products.flatMap((p) => p.sizes))).sort(
    (a, b) => sizeRank(a) - sizeRank(b),
  );
  const colors = Array.from(new Set(products.flatMap((p) => p.colors))).sort();

  const count = (skip: keyof Filters, test: (p: Product) => boolean) =>
    products.filter((p) => matches(p, filters, skip) && test(p)).length;

  const toggle = (
    key:
      | "categories"
      | "brands"
      | "gender"
      | "productTypes"
      | "sizes"
      | "colors",
    val: string,
  ) => {
    const list = filters[key] as string[];
    onChange({
      ...filters,
      [key]: list.includes(val)
        ? list.filter((x) => x !== val)
        : [...list, val],
    });
  };

  return (
    <div>
      {catIds.length > 1 && (
        <FilterGroup title="Category">
          {catIds.map((id) => (
            <CheckRow
              key={id}
              label={categoryNames[id]}
              checked={filters.categories.includes(id)}
              onChange={() => toggle("categories", id)}
              count={count("categories", (p) => p.categoryId === id)}
            />
          ))}
        </FilterGroup>
      )}

      {brandIds.length > 1 && (
        <FilterGroup title="Brand">
          {brandIds.map((id) => (
            <CheckRow
              key={id}
              label={brandNames[id]}
              checked={filters.brands.includes(id)}
              onChange={() => toggle("brands", id)}
              count={count("brands", (p) => p.brandId === id)}
            />
          ))}
        </FilterGroup>
      )}

      {presentGenders.length > 1 && (
        <FilterGroup title="Gender">
          {presentGenders.map((g) => (
            <CheckRow
              key={g}
              label={GENDER_LABEL[g]}
              checked={filters.gender.includes(g)}
              onChange={() => toggle("gender", g)}
              count={count("gender", (p) => p.gender === g)}
            />
          ))}
        </FilterGroup>
      )}

      {productTypes.length > 1 && (
        <FilterGroup title="Type">
          {productTypes.map((t) => (
            <CheckRow
              key={t}
              label={t}
              checked={filters.productTypes.includes(t)}
              onChange={() => toggle("productTypes", t)}
              count={count("productTypes", (p) => p.productType === t)}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Price">
        {PRICE_BUCKETS.map((b) => (
          <CheckRow
            key={b.key}
            label={b.label}
            checked={filters.price === b.key}
            onChange={() =>
              onChange({
                ...filters,
                price: filters.price === b.key ? null : b.key,
              })
            }
            count={count(
              "price",
              (p) => p.basePricePaise >= b.min && p.basePricePaise <= b.max,
            )}
          />
        ))}
      </FilterGroup>

      {sizes.length > 0 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((s) => {
              const on = filters.sizes.includes(s);
              const n = count("sizes", (p) => p.sizes.includes(s));
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("sizes", s)}
                  className={`min-w-[36px] rounded border px-2 py-1 text-[11px] font-bold transition-colors ${FOCUS} ${
                    on
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : n === 0
                        ? "border-neutral-200 text-neutral-400"
                        : "border-neutral-400 text-neutral-900 hover:border-neutral-950"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {colors.length > 0 && (
        <FilterGroup title="Colour">
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const on = filters.colors.includes(c);
              const n = count("colors", (p) => p.colors.includes(c));
              return (
                <button
                  key={c}
                  type="button"
                  title={`${c} (${n})`}
                  aria-label={`${c}, ${n} styles`}
                  aria-pressed={on}
                  onClick={() => toggle("colors", c)}
                  className={`h-6 w-6 rounded-full border transition-all ${FOCUS} ${
                    on
                      ? "border-neutral-950 ring-2 ring-neutral-950 ring-offset-1"
                      : "border-neutral-400 hover:scale-110"
                  } ${n === 0 && !on ? "opacity-30" : ""}`}
                  style={{ background: colorHex(c) }}
                />
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Offers">
        <CheckRow
          label="On sale"
          checked={filters.onSale}
          onChange={() => onChange({ ...filters, onSale: !filters.onSale })}
          count={count(
            "onSale",
            (p) => discountPercent(p.mrpPaise, p.basePricePaise) > 0,
          )}
        />
      </FilterGroup>
    </div>
  );
}

// Mobile bottom sheet
function FilterSheet({
  open,
  onClose,
  onClear,
  resultCount,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  resultCount: number;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
    >
      <style>{`
        @keyframes sheetUp { from { transform: translateY(100%) } to { transform: none } }
        @media (prefers-reduced-motion: no-preference) { .sheet-up { animation: sheetUp 260ms ease-out } }
      `}</style>
      <button
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        tabIndex={-1}
      />
      <div className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-black text-neutral-950">Filters</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className={`grid h-9 w-9 place-items-center rounded-full text-neutral-900 hover:bg-neutral-100 ${FOCUS}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        <div className="flex gap-3 border-t border-neutral-200 p-3">
          <button
            onClick={onClear}
            className={`rounded-md border border-neutral-400 px-5 py-3 text-sm font-bold text-neutral-950 ${FOCUS}`}
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className={`flex-1 rounded-md bg-neutral-950 px-5 py-3 text-sm font-bold text-white ${FOCUS}`}
          >
            Show {resultCount} {resultCount === 1 ? "style" : "styles"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Showcase: collection tabs + attribute filters + sort + load more
//
// Tab strategy: one tab per seeded collection ("new-arrivals", "carbon-racing",
// "bestsellers") — no hardcoded duplicates. A trailing "All products" tab is
// added if the collections don't already cover everything, so users can always
// reach the full catalogue from this section.
// ---------------------------------------------------------------------------
function Showcase({
  tabs,
  categoryNames,
  brandNames,
}: {
  tabs: Tab[];
  categoryNames: Record<string, string>;
  brandNames: Record<string, string>;
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("featured");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);

  const tab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const tabProducts = tab?.products ?? [];

  const results = useMemo(() => {
    const list = tabProducts.filter((p) => matches(p, filters));
    const d = (p: Product) => discountPercent(p.mrpPaise, p.basePricePaise);
    if (sort === "price-asc")
      list.sort((a, b) => a.basePricePaise - b.basePricePaise);
    if (sort === "price-desc")
      list.sort((a, b) => b.basePricePaise - a.basePricePaise);
    if (sort === "discount") list.sort((a, b) => d(b) - d(a));
    return list;
  }, [tabProducts, filters, sort]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  if (!tab) return null;

  const update = (f: Filters) => {
    setFilters(f);
    setVisible(PAGE_SIZE);
  };
  const clearAll = () => update(EMPTY_FILTERS);

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.categories.map((id) => ({
      key: `c-${id}`,
      label: categoryNames[id] ?? id,
      remove: () =>
        update({
          ...filters,
          categories: filters.categories.filter((x) => x !== id),
        }),
    })),
    ...filters.brands.map((id) => ({
      key: `b-${id}`,
      label: brandNames[id] ?? id,
      remove: () =>
        update({
          ...filters,
          brands: filters.brands.filter((x) => x !== id),
        }),
    })),
    ...filters.gender.map((g) => ({
      key: `g-${g}`,
      label: GENDER_LABEL[g] ?? g,
      remove: () =>
        update({
          ...filters,
          gender: filters.gender.filter((x) => x !== g),
        }),
    })),
    ...filters.productTypes.map((t) => ({
      key: `t-${t}`,
      label: t,
      remove: () =>
        update({
          ...filters,
          productTypes: filters.productTypes.filter((x) => x !== t),
        }),
    })),
    ...(filters.price
      ? [
          {
            key: "price",
            label:
              PRICE_BUCKETS.find((b) => b.key === filters.price)?.label ??
              "Price",
            remove: () => update({ ...filters, price: null }),
          },
        ]
      : []),
    ...filters.sizes.map((s) => ({
      key: `s-${s}`,
      label: `Size ${s}`,
      remove: () =>
        update({ ...filters, sizes: filters.sizes.filter((x) => x !== s) }),
    })),
    ...filters.colors.map((c) => ({
      key: `col-${c}`,
      label: c,
      remove: () =>
        update({ ...filters, colors: filters.colors.filter((x) => x !== c) }),
    })),
    ...(filters.onSale
      ? [
          {
            key: "sale",
            label: "On sale",
            remove: () => update({ ...filters, onSale: false }),
          },
        ]
      : []),
  ];

  const shown = results.slice(0, visible);
  const remaining = results.length - shown.length;

  return (
    <section className={`${WRAP} pt-5`} aria-label="Shop products">
      {/* Heading + tabs */}
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
        <h2 className="font-display text-xl font-black uppercase leading-none tracking-tight text-neutral-950 sm:text-2xl">
          Shop the drop
        </h2>
        <div
          role="tablist"
          aria-label="Product lists"
          className={`${HIDE_SCROLLBAR} -mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0`}
        >
          {tabs.map((t) => {
            const on = t.key === tab.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActiveKey(t.key);
                  setVisible(PAGE_SIZE);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${
                  on
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                }`}
              >
                {t.label}
                <span
                  className={`ml-1.5 text-[11px] ${on ? "text-white/70" : "text-neutral-500"}`}
                >
                  {t.products.length}
                </span>
              </button>
            );
          })}
        </div>
        <Link
          href={tab.href}
          className={`hidden shrink-0 items-center gap-1 text-[13px] font-bold text-neutral-950 hover:underline lg:inline-flex ${FOCUS}`}
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
        {/* Desktop sidebar */}
        <aside
          className="hidden self-start lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
          aria-label="Filters"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[13px] font-black text-neutral-950">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
            </h3>
            {chips.length > 0 && (
              <button
                onClick={clearAll}
                className={`text-[12px] font-bold text-neutral-950 underline underline-offset-2 ${FOCUS}`}
              >
                Clear all
              </button>
            )}
          </div>
          <FilterPanel
            products={tabProducts}
            filters={filters}
            onChange={update}
            categoryNames={categoryNames}
            brandNames={brandNames}
          />
        </aside>

        <div className="min-w-0">
          {/* Toolbar */}
          <div className="mb-2.5 flex items-center gap-2">
            <button
              onClick={() => setSheetOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-md border border-neutral-400 px-3 py-1.5 text-[12.5px] font-bold text-neutral-950 lg:hidden ${FOCUS}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {chips.length > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-neutral-950">
                  {chips.length}
                </span>
              )}
            </button>

            <p className="text-[12.5px] text-neutral-600" aria-live="polite">
              <span className="font-extrabold text-neutral-950">
                {results.length}
              </span>{" "}
              {results.length === 1 ? "style" : "styles"}
            </p>

            <div className="relative ml-auto">
              <label className="sr-only" htmlFor="home-sort">
                Sort by
              </label>
              <select
                id="home-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortKey);
                  setVisible(PAGE_SIZE);
                }}
                className={`appearance-none rounded-md border border-neutral-400 bg-white py-1.5 pl-3 pr-8 text-[12.5px] font-bold text-neutral-950 ${FOCUS}`}
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-700" />
            </div>
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div
              className={`${HIDE_SCROLLBAR} -mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0`}
            >
              {chips.map((c) => (
                <button
                  key={c.key}
                  onClick={c.remove}
                  aria-label={`Remove filter ${c.label}`}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-950 py-1 pl-2.5 pr-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-neutral-800 ${FOCUS}`}
                >
                  {c.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                onClick={clearAll}
                className={`shrink-0 px-1 text-[12px] font-bold text-neutral-950 underline underline-offset-2 ${FOCUS}`}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Grid */}
          {shown.length > 0 ? (
            <div
              role="tabpanel"
              className="grid grid-cols-2 gap-x-2.5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-3 lg:gap-y-5 xl:grid-cols-5"
            >
              {shown.map((p) => (
                <ProductCard key={`${tab.key}-${p.id}`} product={p} />
              ))}
            </div>
          ) : (
            <div className="grid place-items-center rounded-lg border border-dashed border-neutral-400 px-6 py-10 text-center">
              <p className="text-base font-bold text-neutral-950">
                No styles match these filters
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Remove a filter or switch to another list.
              </p>
              <button
                onClick={clearAll}
                className={`mt-3 rounded-md bg-neutral-950 px-5 py-2 text-sm font-bold text-white ${FOCUS}`}
              >
                Clear all filters
              </button>
            </div>
          )}

          {shown.length > 0 && (
            <div className="mt-5 flex justify-center">
              {remaining > 0 ? (
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className={`rounded-md border border-neutral-950 px-5 py-2 text-[13px] font-bold text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white ${FOCUS}`}
                >
                  Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} left)
                </button>
              ) : (
                <Link
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-950 hover:underline ${FOCUS}`}
                >
                  See the full {tab.label.toLowerCase()} range{" "}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={closeSheet}
        onClear={clearAll}
        resultCount={results.length}
      >
        <FilterPanel
          products={tabProducts}
          filters={filters}
          onChange={update}
          categoryNames={categoryNames}
          brandNames={brandNames}
        />
      </FilterSheet>
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
    <section className={`${WRAP} pt-8`} aria-label="Collections">
      <h2 className="mb-2.5 font-display text-xl font-black uppercase leading-none tracking-tight text-neutral-950 sm:text-2xl">
        Shop by collection
      </h2>
      <div
        className={`${HIDE_SCROLLBAR} -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3`}
      >
        {collections.slice(0, 6).map((c) => (
          <Link
            key={c.id}
            href={`/collections/${c.slug}`}
            className={`group relative flex h-[96px] w-[72%] shrink-0 snap-start overflow-hidden rounded-lg bg-neutral-900 sm:w-auto ${FOCUS}`}
          >
            {c.image && (
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
            <div className="relative z-10 flex w-full flex-col justify-end p-3.5">
              <h3 className="font-display text-lg font-black italic uppercase leading-none text-white">
                {c.name}
              </h3>
              <p className="mt-1 line-clamp-1 text-[11.5px] font-medium text-white/90">
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
    <section className={`${WRAP} mt-8 border-t border-neutral-300 py-4`}>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-center gap-2.5">
            <Icon
              className="h-5 w-5 shrink-0 text-neutral-950"
              strokeWidth={1.6}
            />
            <div>
              <p className="text-[12px] font-bold leading-tight text-neutral-950">
                {title}
              </p>
              <p className="text-[11px] leading-tight text-neutral-600">
                {sub}
              </p>
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
    <div
      className="animate-pulse bg-white"
      aria-busy="true"
      aria-label="Loading store"
    >
      <NoScrollbars />
      <div className="h-[70svh] bg-neutral-200 lg:h-[clamp(460px,72vh,640px)]" />
      <div
        className={`${WRAP} grid grid-cols-2 gap-2.5 pt-5 sm:grid-cols-3 lg:grid-cols-5`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[6/7] rounded-md bg-neutral-200" />
            <div className="mt-1.5 h-3 w-3/4 rounded bg-neutral-200" />
            <div className="mt-1 h-3 w-1/3 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-white px-4 text-center">
      <NoScrollbars />
      <div>
        <p className="text-lg font-bold text-neutral-950">
          We couldn’t load the store
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Check your connection and try again.
        </p>
        <button
          onClick={onRetry}
          className={`mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-extrabold text-neutral-950 hover:bg-brand-hover ${FOCUS}`}
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

        const [
          bannersSnap,
          productsSnap,
          categoriesSnap,
          collectionsSnap,
          sectionsSnap,
        ] = await Promise.all([
          byOrder("banners"),
          getDocs(query(collection(db, "products"), limit(60))),
          byOrder("categories"),
          byOrder("collections"),
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
              description: p.description || "",
              shortDescription: p.shortDescription || "",
              productType: p.productType || "",
              basePricePaise: p.basePricePaise || 0,
              mrpPaise: p.mrpPaise || 0,
              images: Array.isArray(p.images) ? p.images : [],
              categoryId: p.categoryId || "",
              collectionIds: Array.isArray(p.collectionIds)
                ? p.collectionIds
                : [],
              brandId: p.brandId || "",
              brandName: p.brandName || "",
              gender:
                p.gender === "men" ||
                p.gender === "women" ||
                p.gender === "unisex"
                  ? p.gender
                  : "unisex",
              colors: Array.isArray(p.colors) ? p.colors : [],
              sizes: Array.isArray(p.sizes) ? p.sizes : [],
              inventoryValue:
                typeof p.inventoryValue === "number" ? p.inventoryValue : 0,
              attributes:
                p.attributes && typeof p.attributes === "object"
                  ? p.attributes
                  : {},
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
              sortOrder: c.sortOrder || 0,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const sections: Section[] = (sectionsSnap?.docs ?? []).map((d) => {
          const s = d.data();
          return {
            id: d.id,
            type: s.type || d.id,
            isActive: s.isActive !== false,
          };
        });

        if (!cancelled)
          setData({ banners, products, categories, collections, sections });
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
  if (failed || !data)
    return <ErrorState onRetry={() => setAttempt((n) => n + 1)} />;

  const sectionOn = (type: string) => {
    const s = data.sections.find((x) => x.type === type);
    return s ? s.isActive : true;
  };

  // ---- Hero slides
  const heroFirst = data.banners.filter((b) => b.placement === "home_hero");
  const others = data.banners.filter((b) => b.placement !== "home_hero");
  const heroSlides: Slide[] = [...heroFirst, ...others].map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    ctaLabel: b.ctaLabel,
    ctaUrl: b.ctaUrl,
  }));
  if (!heroSlides.length) {
    heroSlides.push({
      id: "fallback-hero",
      title: "Gear For A Stronger You",
      subtitle:
        "Premium sports wear for training, running, gym and everyday performance.",
      imageUrl: "https://placehold.co/1200x900/111111/FF6B00?text=Shera+Sports",
      ctaLabel: "Shop now",
      ctaUrl: "/products",
    });
  }

  // ---- Lookups
  const categoryNames: Record<string, string> = {};
  const categoryCounts: Record<string, number> = {};
  const collectionCounts: Record<string, number> = {};
  const brandNames: Record<string, string> = {};

  data.categories.forEach((c) => (categoryNames[c.id] = c.name));
  data.products.forEach((p) => {
    categoryCounts[p.categoryId] = (categoryCounts[p.categoryId] ?? 0) + 1;
    p.collectionIds.forEach(
      (id) => (collectionCounts[id] = (collectionCounts[id] ?? 0) + 1),
    );
    if (p.brandId && p.brandName) brandNames[p.brandId] = p.brandName;
  });

  // ---- Showcase tabs — one per collection, no hardcoded duplicates.
  const disc = (p: Product) => discountPercent(p.mrpPaise, p.basePricePaise);
  const tabs: Tab[] = [];

  data.collections.forEach((col) => {
    const list = data.products.filter((p) => p.collectionIds.includes(col.id));
    if (list.length) {
      // Curated collections like "bestsellers" are naturally ranked by discount
      // since the seed no longer stores soldCount.
      const sorted =
        col.id === "bestsellers"
          ? [...list].sort((a, b) => disc(b) - disc(a))
          : list;
      tabs.push({
        key: col.id,
        label: col.name,
        href: `/collections/${col.slug}`,
        products: sorted,
      });
    }
  });

  // Add an "All products" tab at the end so users can always browse everything
  // from this section, even if collections don't cover all products.
  const coveredIds = new Set(tabs.flatMap((t) => t.products.map((p) => p.id)));
  const uncovered = data.products.filter((p) => !coveredIds.has(p.id));
  if (uncovered.length || tabs.length === 0) {
    tabs.push({
      key: "__all__",
      label: "All products",
      href: "/products",
      products: data.products,
    });
  }

  return (
    <div className="overflow-x-clip bg-white text-neutral-950">
      <NoScrollbars />

      <HeroSlider slides={heroSlides} />

      {sectionOn("category_grid") && (
        <CategoryStrip
          categories={data.categories.slice(0, 6)}
          counts={categoryCounts}
        />
      )}

      {tabs.length > 0 ? (
        <Showcase
          tabs={tabs}
          categoryNames={categoryNames}
          brandNames={brandNames}
        />
      ) : (
        <section className={`${WRAP} py-12 text-center`}>
          <p className="text-lg font-bold">New products are on the way</p>
          <Link
            href="/collections"
            className="mt-2 inline-block text-sm font-bold text-neutral-950 underline underline-offset-2"
          >
            Browse collections
          </Link>
        </section>
      )}

      <CollectionCards
        collections={data.collections}
        counts={collectionCounts}
      />
      <FeaturesStrip />
    </div>
  );
}
