// app/(storefront)/products/[slug]/page.tsx
"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { db } from "../../../../lib/firebase/client";
import { useCart } from "./../../../context/cart-context";
import { useWishlist } from "./../../../context/wishlist-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  colors: string[];
  sizes: string[];
  categoryId: string;
  stock: number;
  attributes: Record<string, string>;
};

type Variant = { size: string; color: string; active: boolean };

type Related = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  mrpPaise: number;
  image: string;
};

type CategoryInfo = { name: string; slug: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";
const HIDE_SCROLLBAR =
  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
const MAX_QTY = 10;
// Palette: ink (neutral-950) for text + primary actions, neutral-600/700 for
// secondary text, neutral-200/300 hairlines, neutral-100 image surface.
// Brand orange is an accent only: CTA hover/confirmation, tiny rule, focus ring.

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];
function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = Number(s);
  return Number.isFinite(n) ? 100 + n : 500;
}

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
  const key = name.trim().toLowerCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  if (key.startsWith("#")) return name.trim();
  if (typeof CSS !== "undefined" && CSS.supports("color", key)) return key;
  return "#d4d4d4";
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

function prettyKey(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
// Gallery
// Mobile: edge-to-edge swipe strip with dots.
// Desktop: vertical thumbnails + hover-zoom main image, sticky while scrolling.
// ---------------------------------------------------------------------------
function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (!images.length) {
    return (
      <div className="grid aspect-[5/6] place-items-center bg-neutral-100 text-neutral-500">
        <Tag className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="lg:sticky lg:top-20 lg:self-start">
      {/* Mobile: edge-to-edge swipe strip */}
      <div className="relative -mx-4 sm:mx-0 lg:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className={`${HIDE_SCROLLBAR} flex snap-x snap-mandatory overflow-x-auto`}
        >
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={i === 0 ? name : ""}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-[4/5] w-full shrink-0 snap-center bg-neutral-100 object-cover"
            />
          ))}
        </div>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-[3px] rounded-full transition-all ${
                  i === active ? "w-6 bg-neutral-950" : "w-3 bg-neutral-950/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: thumbnails + hover-zoom */}
      <div className="hidden gap-3 lg:flex">
        {images.length > 1 && (
          <div
            className={`${HIDE_SCROLLBAR} flex max-h-[calc(100vh-7rem)] w-14 shrink-0 flex-col gap-2 overflow-y-auto`}
          >
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={active === i}
                className={`aspect-[6/7] overflow-hidden bg-neutral-100 outline-offset-2 transition-opacity ${FOCUS} ${
                  active === i
                    ? "outline outline-1 outline-neutral-950"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div
          className="relative aspect-[5/6] max-h-[calc(100vh-7rem)] flex-1 cursor-zoom-in overflow-hidden bg-neutral-100"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({
              x: ((e.clientX - r.left) / r.width) * 100,
              y: ((e.clientY - r.top) / r.height) * 100,
            });
          }}
          onMouseLeave={() => setZoom(null)}
        >
          <img
            src={images[Math.min(active, images.length - 1)]}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-200 ease-out"
            style={
              zoom
                ? {
                    transform: "scale(1.7)",
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
function Disclosure({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-neutral-200">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between py-3.5 text-[13px] font-semibold text-neutral-950 [&::-webkit-details-marker]:hidden ${FOCUS}`}
      >
        {title}
        <ChevronDown className="h-4 w-4 text-neutral-700 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 text-[13px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </details>
  );
}

function MiniCard({ p }: { p: Related }) {
  const d = discountPercent(p.mrpPaise, p.basePricePaise);
  return (
    <Link
      href={`/products/${p.slug}`}
      className={`group block w-[44%] shrink-0 sm:w-[23%] lg:w-auto ${FOCUS} rounded-md`}
    >
      <div className="relative aspect-[6/7] overflow-hidden rounded-md bg-neutral-100">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-neutral-400">
            <Tag className="h-6 w-6" />
          </div>
        )}
      </div>
      <h3 className="mt-1.5 line-clamp-1 text-[12.5px] font-semibold leading-tight text-neutral-950">
        {p.name}
      </h3>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[13px] font-semibold text-neutral-950">
          {formatINR(p.basePricePaise)}
        </span>
        {d > 0 && (
          <span className="text-[11px] text-neutral-500 line-through">
            {formatINR(p.mrpPaise)}
          </span>
        )}
      </p>
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div
      className="animate-pulse bg-white"
      aria-busy="true"
      aria-label="Loading product"
    >
      <NoScrollbars />
      <div className={`${WRAP} py-2.5`}>
        <div className="h-3 w-56 rounded bg-neutral-200" />
      </div>
      <div className={`${WRAP} grid gap-6 lg:grid-cols-2 lg:gap-12`}>
        <div className="-mx-4 aspect-[4/5] bg-neutral-200 sm:mx-0 lg:aspect-[5/6] lg:rounded-lg" />
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-neutral-200" />
          <div className="h-8 w-4/5 rounded bg-neutral-200" />
          <div className="h-6 w-40 rounded bg-neutral-200" />
          <div className="h-8 w-full rounded bg-neutral-200" />
          <div className="h-10 w-full rounded bg-neutral-200" />
          <div className="h-12 w-full rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------
function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const { addItem: addToCart } = useCart();
  const {
    addItem: addToWishlist,
    removeItem: removeFromWishlist,
    isInWishlist,
  } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [sizeError, setSizeError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const sizeRef = useRef<HTMLDivElement>(null);

  // ---- Load product, variants, category and related products
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "products"),
            where("slug", "==", slug),
            limit(1),
          ),
        );
        if (snap.empty) return;

        const d = snap.docs[0];
        const p = d.data();
        if (p.status && p.status !== "active") return;

        // Variants are optional: used to derive sizes/colours and availability
        let vs: Variant[] = [];
        try {
          const vSnap = await getDocs(
            collection(db, "products", d.id, "variants"),
          );
          vs = vSnap.docs.map((v) => {
            const x = v.data();
            return {
              size: String(x.size ?? ""),
              color: String(x.color ?? ""),
              active: x.status !== "inactive" && x.status !== "archived",
            };
          });
        } catch {
          /* variants unreadable: fall back to product fields */
        }

        const unique = (arr: string[]) =>
          Array.from(new Set(arr.filter(Boolean)));
        const colors: string[] =
          Array.isArray(p.colors) && p.colors.length
            ? p.colors
            : unique(vs.map((v) => v.color));
        const sizes: string[] = (
          Array.isArray(p.sizes) && p.sizes.length
            ? p.sizes
            : unique(vs.map((v) => v.size))
        )
          .slice()
          .sort((a: string, b: string) => sizeRank(a) - sizeRank(b));

        const attributes: Record<string, string> = {};
        if (p.attributes && typeof p.attributes === "object") {
          Object.entries(p.attributes as Record<string, unknown>).forEach(
            ([k, v]) => {
              if (typeof v === "string" || typeof v === "number")
                attributes[k] = String(v);
            },
          );
        }

        const prod: Product = {
          id: d.id,
          name: p.name || "",
          slug: p.slug || d.id,
          description:
            p.description ||
            "Premium performance wear engineered for the modern athlete.",
          basePricePaise:
            typeof p.basePricePaise === "number" ? p.basePricePaise : 0,
          mrpPaise: typeof p.mrpPaise === "number" ? p.mrpPaise : 0,
          images: Array.isArray(p.images) ? p.images : [],
          colors,
          sizes,
          categoryId: p.categoryId || "",
          stock: typeof p.stock === "number" ? p.stock : MAX_QTY,
          attributes,
        };

        if (cancelled) return;
        setProduct(prod);
        setVariants(vs);
        setSelectedColor(colors[0] ?? "");
        setSelectedSize("");
        setQuantity(1);

        // Category + related are nice-to-have; never block the page
        if (prod.categoryId) {
          try {
            const c = await getDoc(doc(db, "categories", prod.categoryId));
            if (c.exists() && !cancelled) {
              const cd = c.data();
              setCategory({ name: cd.name || "", slug: cd.slug || c.id });
            }
          } catch {
            /* ignore */
          }
          try {
            const rSnap = await getDocs(
              query(
                collection(db, "products"),
                where("categoryId", "==", prod.categoryId),
                limit(13),
              ),
            );
            const rel: Related[] = rSnap.docs
              .filter((x) => x.id !== d.id && x.data().status === "active")
              .slice(0, 6)
              .map((x) => {
                const r = x.data();
                return {
                  id: x.id,
                  name: r.name || "",
                  slug: r.slug || x.id,
                  basePricePaise: r.basePricePaise || 0,
                  mrpPaise: r.mrpPaise || 0,
                  image: Array.isArray(r.images) ? r.images[0] || "" : "",
                };
              });
            if (!cancelled) setRelated(rel);
          } catch {
            /* ignore */
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isAvailable = useCallback(
    (size: string, color: string) => {
      if (!variants.length) return true;
      return variants.some(
        (v) => v.size === size && (!color || v.color === color) && v.active,
      );
    },
    [variants],
  );

  const colorHasStock = useCallback(
    (color: string) => {
      if (!variants.length || !product?.sizes.length) return true;
      return product.sizes.some((s) => isAvailable(s, color));
    },
    [variants, product, isAvailable],
  );

  if (loading) return <PageSkeleton />;

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white px-4 text-center">
        <NoScrollbars />
        <h1 className="font-display text-2xl font-black italic uppercase text-neutral-950">
          Product not found
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-700">
          This item doesn’t exist or is no longer available.
        </p>
        <Link
          href="/products"
          className={`mt-5 rounded-md bg-brand px-6 py-3 text-sm font-extrabold text-neutral-950 hover:bg-brand-hover ${FOCUS}`}
        >
          Browse all products
        </Link>
      </div>
    );
  }

  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const saved = isInWishlist(product.id);
  const maxQty = Math.max(1, Math.min(product.stock, MAX_QTY));
  const lowStock = product.stock > 0 && product.stock <= 5;
  const soldOut = product.stock <= 0;

  const handleAddToCart = () => {
    if (soldOut) return;
    if (product.sizes.length && !selectedSize) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Select a size first");
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.basePricePaise,
      mrp: product.mrpPaise,
      image: product.images[0] || "",
      size: selectedSize || "One Size",
      color: selectedColor,
      quantity,
    });

    toast.success("Added to cart");
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  };

  const toggleWishlist = () => {
    if (saved) {
      removeFromWishlist(product.id);
      toast.info("Removed from wishlist");
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.basePricePaise,
        mrp: product.mrpPaise,
        image: product.images[0] || "",
      });
      toast.success("Added to wishlist");
    }
  };

  const pickColor = (c: string) => {
    setSelectedColor(c);
    // Drop the chosen size if it doesn't exist in the new colour
    if (selectedSize && !isAvailable(selectedSize, c)) setSelectedSize("");
  };

  const specs = Object.entries(product.attributes);

  return (
    <div className="overflow-x-clip bg-white pb-8 text-neutral-950">
      <NoScrollbars />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className={`${WRAP} py-2.5`}>
        <ol className="flex items-center gap-1 text-[12px] text-neutral-700">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          {category && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-neutral-500" />
              <li>
                <Link
                  href={`/categories/${category.slug}`}
                  className="hover:underline"
                >
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="h-3 w-3 shrink-0 text-neutral-500" />
          <li
            className="min-w-0 truncate font-semibold text-neutral-950"
            aria-current="page"
          >
            {product.name}
          </li>
        </ol>
      </nav>

      <div
        className={`${WRAP} grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 xl:gap-14`}
      >
        <Gallery images={product.images} name={product.name} />

        {/* Info */}
        <div className="flex min-w-0 flex-col lg:pt-1">
          <p className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-neutral-600">
            <span className="h-0.5 w-5 bg-brand" />
            Shera Sports Wear
          </p>
          <h1 className="font-display text-[1.65rem] font-black italic uppercase leading-[1] tracking-tight text-neutral-950 sm:text-3xl lg:text-[2rem]">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-[22px] font-semibold tracking-tight text-neutral-950">
              {formatINR(product.basePricePaise)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-[15px] text-neutral-500 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
                <span className="text-[13px] font-semibold text-neutral-950">
                  {discount}% off · Save{" "}
                  {formatINR(product.mrpPaise - product.basePricePaise)}
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-[12px] text-neutral-600">
            Tax included. Shipping calculated at checkout.
          </p>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            {/* Colour */}
            {product.colors.length > 0 && (
              <div className="mb-5">
                <p className="mb-2.5 text-[13px] font-semibold text-neutral-950">
                  Colour
                  {selectedColor && (
                    <span className="ml-2 font-normal text-neutral-600">
                      {selectedColor}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((c) => {
                    const on = selectedColor === c;
                    const ok = colorHasStock(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => pickColor(c)}
                        title={ok ? c : `${c} (unavailable)`}
                        aria-label={`Colour ${c}${ok ? "" : ", unavailable"}`}
                        aria-pressed={on}
                        className={`h-7 w-7 rounded-full border border-neutral-300 transition-shadow ${FOCUS} ${
                          on
                            ? "ring-1 ring-neutral-950 ring-offset-2"
                            : "hover:ring-1 hover:ring-neutral-400 hover:ring-offset-2"
                        } ${ok ? "" : "opacity-30"}`}
                        style={{ background: colorHex(c) }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size */}
            {product.sizes.length > 0 && (
              <div className="mb-5" ref={sizeRef}>
                <p className="mb-2.5 flex items-center justify-between text-[13px] font-semibold text-neutral-950">
                  <span>
                    Size
                    {selectedSize && (
                      <span className="ml-2 font-normal text-neutral-600">
                        {selectedSize}
                      </span>
                    )}
                  </span>
                  {sizeError && !selectedSize && (
                    <span
                      className="text-[12px] font-medium text-red-700"
                      role="alert"
                    >
                      Please select a size
                    </span>
                  )}
                </p>
                <div
                  className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5"
                  role="group"
                  aria-label="Size"
                >
                  {product.sizes.map((size) => {
                    const ok = isAvailable(size, selectedColor);
                    const on = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={!ok}
                        aria-pressed={on}
                        onClick={() => {
                          setSelectedSize(size);
                          setSizeError(false);
                        }}
                        className={`h-11 rounded border text-[13px] font-semibold transition-colors ${FOCUS} ${
                          on
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : ok
                              ? sizeError && !selectedSize
                                ? "border-red-300 text-neutral-950 hover:border-neutral-950"
                                : "border-neutral-300 text-neutral-950 hover:border-neutral-950"
                              : "cursor-not-allowed border-neutral-200 text-neutral-400 line-through"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {lowStock && (
              <p className="mb-3 flex items-center gap-2 text-[12.5px] font-medium text-neutral-900">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Only {product.stock} left in stock
              </p>
            )}

            {/* Quantity + CTA */}
            <div className="flex items-stretch gap-2">
              <div className="flex h-12 w-[104px] shrink-0 items-center justify-between rounded border border-neutral-300 px-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className={`grid h-8 w-8 place-items-center rounded text-neutral-950 hover:bg-neutral-100 disabled:text-neutral-300 ${FOCUS}`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="text-sm font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  aria-label="Increase quantity"
                  className={`grid h-8 w-8 place-items-center rounded text-neutral-950 hover:bg-neutral-100 disabled:text-neutral-300 ${FOCUS}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={soldOut}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded px-6 text-[14px] font-semibold tracking-wide transition-colors duration-200 ${FOCUS} ${
                  soldOut
                    ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                    : justAdded
                      ? "bg-brand text-neutral-950"
                      : "bg-neutral-950 text-white hover:bg-brand hover:text-neutral-950"
                }`}
              >
                {soldOut ? (
                  "Sold out"
                ) : justAdded ? (
                  <>
                    <Check className="h-4 w-4" /> Added to cart
                  </>
                ) : (
                  "Add to cart"
                )}
              </button>

              <button
                type="button"
                onClick={toggleWishlist}
                aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={saved}
                className={`grid h-12 w-12 shrink-0 place-items-center rounded border transition-colors ${FOCUS} ${
                  saved
                    ? "border-neutral-950 text-neutral-950"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
                }`}
              >
                <Heart
                  className={`h-5 w-5 ${saved ? "fill-neutral-950" : ""}`}
                  strokeWidth={1.6}
                />
              </button>
            </div>

            {/* Trust row: hairlines, no boxes */}
            <ul className="mt-5 grid grid-cols-3 divide-x divide-neutral-200 border-y border-neutral-200 py-3">
              {[
                { icon: Truck, label: "Fast delivery" },
                { icon: RotateCcw, label: "7-day returns" },
                { icon: ShieldCheck, label: "Secure checkout" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex flex-col items-center gap-1 px-1 text-center text-[11.5px] font-medium text-neutral-700"
                >
                  <Icon
                    className="h-[18px] w-[18px] text-neutral-950"
                    strokeWidth={1.5}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Details */}
          <div className="mt-1">
            <Disclosure title="Product details" defaultOpen>
              <p className="whitespace-pre-line">{product.description}</p>
            </Disclosure>
            {specs.length > 0 && (
              <Disclosure title="Specifications">
                <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5">
                  {specs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-neutral-600">{prettyKey(k)}</dt>
                      <dd className="font-medium text-neutral-950">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Disclosure>
            )}
            <Disclosure title="Shipping and returns">
              <p>
                Delivery charges and timelines are shown at checkout. Unused
                items can be returned within 7 days of delivery.
              </p>
            </Disclosure>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section
          className={`${WRAP} mt-10 border-t border-neutral-200 pt-6`}
          aria-label="Related products"
        >
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-black uppercase leading-none tracking-tight text-neutral-950 sm:text-2xl">
              {category ? `More from ${category.name}` : "You may also like"}
            </h2>
            {category && (
              <Link
                href={`/categories/${category.slug}`}
                className={`text-[13px] font-bold text-neutral-950 hover:underline ${FOCUS}`}
              >
                View all
              </Link>
            )}
          </div>
          <div
            className={`${HIDE_SCROLLBAR} -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible`}
          >
            {related.map((r) => (
              <MiniCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductDetail />
    </Suspense>
  );
}
