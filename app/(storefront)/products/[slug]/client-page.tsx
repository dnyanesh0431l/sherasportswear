// app/(storefront)/products/[slug]/client-page.tsx
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
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { db } from "../../../../lib/firebase/client";
import { useCart } from "../../../context/cart-context";
import { useWishlist } from "../../../context/wishlist-context";

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
type CartItem = { id: string; size: string; color: string; quantity: number };

// ---------------------------------------------------------------------------
// Layout system — identical to cart + checkout
//   page:      pt-6 md:pt-8, max-w 1200, gutters px-4 / sm:px-6 / lg:px-8
//   gap:       24px (gap-6) between every card / column
//   card:      rounded-xl bg-white p-4 sm:p-5
//   in-card:   20px (space-y-5) between blocks
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";
const CARD = "rounded-xl bg-white p-4 sm:p-5";
const HIDE_SCROLLBAR =
  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";
// Keyboard-only focus indicator (outline, not a ring/shadow)
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a1f]";

const MAX_QTY = 10;
const FREE_SHIPPING_PAISE = 99900;
const SHIPPING_FEE_PAISE = 4900;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];
function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = Number(s);
  return Number.isFinite(n) ? 100 + n : 500;
}

const COLOR_MAP: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
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

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
const discountPercent = (mrp: number, price: number) =>
  mrp <= price ? 0 : Math.round(((mrp - price) / mrp) * 100);
const prettyKey = (key: string) => {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// ---------------------------------------------------------------------------
// Gallery — square images, flat, no borders
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
      <div className="grid aspect-square place-items-center rounded bg-neutral-100 text-neutral-400">
        <Tag className="h-10 w-10" />
      </div>
    );
  }

  const current = Math.min(active, images.length - 1);

  return (
    <div className="lg:sticky lg:top-20 lg:self-start">
      {/* Mobile: swipe strip, kept inside the page gutters */}
      <div className="relative lg:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className={cx(
            HIDE_SCROLLBAR,
            "flex snap-x snap-mandatory overflow-x-auto rounded",
          )}
        >
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={i === 0 ? name : ""}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-square w-full shrink-0 snap-center bg-neutral-100 object-cover"
            />
          ))}
        </div>
        {images.length > 1 && (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-xs font-bold tabular-nums text-neutral-950">
            {current + 1} / {images.length}
          </span>
        )}
      </div>

      {/* Desktop: thumbnails + hover zoom */}
      <div className="hidden gap-3 lg:flex">
        {images.length > 1 && (
          <div className="relative w-16 shrink-0">
            <div
              className={cx(
                HIDE_SCROLLBAR,
                "absolute inset-0 flex flex-col gap-2 overflow-y-auto",
              )}
            >
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={current === i}
                  className={cx(
                    "aspect-square w-full shrink-0 overflow-hidden rounded bg-neutral-100 transition-opacity",
                    FOCUS,
                    current === i
                      ? "opacity-100"
                      : "opacity-50 hover:opacity-100",
                  )}
                >
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          className="relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded bg-neutral-100"
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
            src={images[current]}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 ease-out"
            style={
              zoom
                ? {
                    transform: "scale(1.6)",
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
// Building blocks
// ---------------------------------------------------------------------------
function FieldTitle({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {value && (
        <span className="text-sm font-semibold capitalize text-neutral-950">
          {value}
        </span>
      )}
    </div>
  );
}

/**
 * Quantity control
 *  - 44px touch targets
 *  - tap +/-, use ↑/↓ keys, or type a number (clamped to the allowed range)
 *  - select-all on focus so typing replaces the number
 */
function QuantityControl({
  quantity,
  maxQty,
  onChange,
  disabled,
}: {
  quantity: number;
  maxQty: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(maxQty, Math.max(1, n));
  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    onChange(Number.isFinite(n) ? clamp(n) : quantity);
    setDraft(null);
  };

  const btn = cx(
    "grid h-10 w-10 place-items-center rounded text-neutral-700 transition-colors hover:bg-white hover:text-neutral-950 active:bg-white disabled:opacity-30 disabled:hover:bg-transparent",
    FOCUS,
  );

  return (
    <div
      role="group"
      aria-label="Quantity"
      className={cx(
        "inline-flex h-11 items-center rounded bg-neutral-100 p-0.5",
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(quantity - 1))}
        disabled={disabled || quantity <= 1}
        aria-label="Decrease quantity"
        className={btn}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label="Quantity"
        aria-live="polite"
        disabled={disabled}
        value={draft ?? String(quantity)}
        onFocus={(e) => e.target.select()}
        onChange={(e) =>
          setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))
        }
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(quantity + 1));
            setDraft(null);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(quantity - 1));
            setDraft(null);
          }
        }}
        className="h-10 w-12 bg-transparent text-center text-sm font-bold tabular-nums text-neutral-950 outline-none focus:bg-white"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(quantity + 1))}
        disabled={disabled || quantity >= maxQty}
        aria-label="Increase quantity"
        className={btn}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

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
    <details
      open={defaultOpen}
      className="group border-b border-neutral-100 last:border-b-0"
    >
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center justify-between py-4 text-sm font-bold text-neutral-950 [&::-webkit-details-marker]:hidden",
          FOCUS,
        )}
      >
        {title}
        <ChevronDown className="h-4 w-4 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 text-sm leading-relaxed text-neutral-600">
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
      className={cx("group block w-[46%] shrink-0 sm:w-[23%] lg:w-auto", FOCUS)}
    >
      <div className="aspect-square overflow-hidden rounded bg-neutral-100">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="aspect-square h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-neutral-400">
            <Tag className="h-6 w-6" />
          </div>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-neutral-950 transition-colors group-hover:text-[#ff5a1f]">
        {p.name}
      </h3>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-bold tabular-nums text-neutral-950">
          {formatINR(p.basePricePaise)}
        </span>
        {d > 0 && (
          <>
            <span className="text-xs tabular-nums text-neutral-400 line-through">
              {formatINR(p.mrpPaise)}
            </span>
            <span className="text-xs font-bold text-[#22c55e]">{d}% off</span>
          </>
        )}
      </p>
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div
      className="min-h-screen animate-pulse bg-[#fafafa] pt-6 md:pt-8"
      aria-busy="true"
      aria-label="Loading product"
    >
      <div className={WRAP}>
        <div className="mb-5 h-3 w-56 rounded bg-neutral-200" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="aspect-square rounded bg-neutral-200" />
          <div className={cx(CARD, "space-y-5")}>
            <div className="h-8 w-4/5 rounded bg-neutral-200" />
            <div className="h-6 w-40 rounded bg-neutral-200" />
            <div className="h-10 w-full rounded bg-neutral-100" />
            <div className="h-12 w-full rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ClientProductPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { addItem: addToCart, items: cartItems } = useCart() as {
    addItem: (item: {
      id: string;
      name: string;
      slug: string;
      price: number;
      mrp: number;
      image: string;
      size: string;
      color: string;
      quantity: number;
    }) => void;
    items: CartItem[];
  };
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

  const sizeRef = useRef<HTMLDivElement>(null);

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
        } catch {}

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

        if (prod.categoryId) {
          try {
            const c = await getDoc(doc(db, "categories", prod.categoryId));
            if (c.exists() && !cancelled) {
              const cd = c.data();
              setCategory({ name: cd.name || "", slug: cd.slug || c.id });
            }
          } catch {}
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
          } catch {}
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

  const effectiveSize = selectedSize || "One Size";
  const itemInCart = product
    ? cartItems.some(
        (item) =>
          item.id === product.id &&
          item.size === effectiveSize &&
          item.color === selectedColor,
      )
    : false;
  const soldOut = (product?.stock ?? 0) <= 0;

  const requireSize = () => {
    if (product?.sizes.length && !selectedSize) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Select a size first");
      return false;
    }
    return true;
  };

  const addCurrentToCart = () => {
    if (!product) return;
    addToCart({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.basePricePaise,
      mrp: product.mrpPaise,
      image: product.images[0] || "",
      size: effectiveSize,
      color: selectedColor,
      quantity,
    });
  };

  const handleCartClick = () => {
    if (!product || soldOut) return;
    if (itemInCart) {
      router.push("/cart");
      return;
    }
    if (!requireSize()) return;
    addCurrentToCart();
    toast.success("Added to cart", {
      description: `${quantity} × ${product.name}${selectedSize ? `, size ${selectedSize}` : ""}`,
      action: { label: "View cart", onClick: () => router.push("/cart") },
      duration: 4500,
    });
  };

  const handleBuyNow = () => {
    if (!product || soldOut) return;
    if (!requireSize()) return;
    if (!itemInCart) addCurrentToCart();
    router.push("/checkout");
  };

  const toggleWishlist = () => {
    if (!product) return;
    if (isInWishlist(product.id)) {
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
    if (selectedSize && !isAvailable(selectedSize, c)) setSelectedSize("");
  };

  if (loading) return <PageSkeleton />;

  if (!product)
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <Tag className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-900 md:text-3xl">
          Product not found
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          This item doesn&apos;t exist or is no longer available.
        </p>
        <Link
          href="/products"
          className={cx(
            "mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
            FOCUS,
          )}
        >
          Browse products
        </Link>
      </div>
    );

  // ----- Derived values
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const saved = isInWishlist(product.id);
  const maxQty = Math.max(1, Math.min(product.stock, MAX_QTY));
  const lowStock = product.stock > 0 && product.stock <= 5;
  const cartQtyForVariant =
    cartItems.find(
      (item) =>
        item.id === product.id &&
        item.size === effectiveSize &&
        item.color === selectedColor,
    )?.quantity ?? 0;
  const specs = Object.entries(product.attributes);
  const sizeMissing = sizeError && !selectedSize;
  const lineTotal = product.basePricePaise * quantity;

  const qtyHint =
    quantity >= maxQty
      ? product.stock > 0 && product.stock < MAX_QTY
        ? `Only ${product.stock} available`
        : `Maximum ${MAX_QTY} per order`
      : null;

  const cartBtnCls = cx(
    "flex h-12 items-center justify-center gap-2 rounded px-6 text-sm font-bold uppercase tracking-wider transition-colors",
    FOCUS,
    soldOut
      ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
      : itemInCart
        ? "bg-neutral-200 text-neutral-950 hover:bg-neutral-300"
        : "bg-neutral-950 text-white hover:bg-neutral-800",
  );
  const buyBtnCls = cx(
    "flex h-12 items-center justify-center gap-2 rounded px-6 text-sm font-bold uppercase tracking-wider transition-colors",
    FOCUS,
    "bg-[#ff5a1f] text-white hover:bg-[#e84912]",
  );
  const wishBtnCls = cx(
    "grid h-12 w-12 shrink-0 place-items-center rounded transition-colors",
    FOCUS,
    saved
      ? "bg-red-50 text-red-500"
      : "bg-neutral-100 text-neutral-600 hover:text-red-500",
  );

  const cartLabel = soldOut ? (
    "Sold out"
  ) : itemInCart ? (
    <>
      <Check className="h-4 w-4" strokeWidth={3} />
      Go to cart
      {cartQtyForVariant > 1 && (
        <span className="text-xs font-bold">×{cartQtyForVariant}</span>
      )}
    </>
  ) : (
    <>
      <ShoppingBag className="h-4 w-4" />
      Add to cart
    </>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] pb-28 pt-6 text-neutral-950 md:pt-8 lg:pb-14">
      <div className={WRAP}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-neutral-500">
            <li className="shrink-0">
              <Link
                href="/"
                className="transition-colors hover:text-neutral-950"
              >
                Home
              </Link>
            </li>
            {category && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
                <li className="shrink-0">
                  <Link
                    href={`/categories/${category.slug}`}
                    className="transition-colors hover:text-neutral-950"
                  >
                    {category.name}
                  </Link>
                </li>
              </>
            )}
            <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
            <li
              className="min-w-0 truncate font-semibold text-neutral-950"
              aria-current="page"
            >
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Gallery images={product.images} name={product.name} />

          {/* ---- Buy box ---- */}
          <div className={cx(CARD, "min-w-0")}>
            <h1 className="font-display text-2xl font-black uppercase italic leading-tight tracking-tight text-neutral-950 sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black tabular-nums tracking-tight text-neutral-950">
                {formatINR(product.basePricePaise)}
              </span>
              {discount > 0 && (
                <>
                  <span className="text-base tabular-nums text-neutral-400 line-through">
                    {formatINR(product.mrpPaise)}
                  </span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {discount}% off
                  </span>
                </>
              )}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Free shipping on orders above {formatINR(FREE_SHIPPING_PAISE)}.
              Tax is added at checkout.
            </p>

            <div className="mt-5 space-y-5">
              {/* Colour */}
              {product.colors.length > 0 && (
                <div>
                  <FieldTitle label="Colour" value={selectedColor} />
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Colour"
                  >
                    {product.colors.map((c) => {
                      const on = selectedColor === c;
                      const ok = colorHasStock(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => pickColor(c)}
                          aria-pressed={on}
                          aria-label={`${c}${ok ? "" : ", unavailable"}`}
                          className={cx(
                            "inline-flex h-10 items-center gap-2 rounded px-3.5 text-sm font-medium capitalize transition-colors",
                            FOCUS,
                            on
                              ? "bg-neutral-950 text-white"
                              : ok
                                ? "bg-neutral-100 text-neutral-950 hover:bg-neutral-200"
                                : "bg-neutral-50 text-neutral-400 line-through",
                          )}
                        >
                          <span
                            className={cx(
                              "h-3.5 w-3.5 rounded-sm",
                              on &&
                                "outline outline-1 -outline-offset-1 outline-white/40",
                            )}
                            style={{ background: colorHex(c) }}
                          />
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size */}
              {product.sizes.length > 0 && (
                <div ref={sizeRef}>
                  <FieldTitle label="Size" value={selectedSize} />
                  {sizeMissing && (
                    <p
                      className="mb-2 text-xs font-medium text-red-600"
                      role="alert"
                    >
                      Select a size to continue.
                    </p>
                  )}
                  <div
                    className={cx(
                      "grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2 transition-colors",
                      sizeMissing && "rounded bg-red-50 p-2",
                    )}
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
                          aria-label={ok ? size : `${size}, unavailable`}
                          onClick={() => {
                            setSelectedSize(size);
                            setSizeError(false);
                          }}
                          className={cx(
                            "h-11 rounded text-sm font-semibold transition-colors",
                            FOCUS,
                            on
                              ? "bg-neutral-950 text-white"
                              : ok
                                ? "bg-neutral-100 text-neutral-950 hover:bg-neutral-200"
                                : "cursor-not-allowed bg-neutral-50 text-neutral-300 line-through",
                          )}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <FieldTitle label="Quantity" />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <QuantityControl
                    quantity={quantity}
                    maxQty={maxQty}
                    onChange={setQuantity}
                    disabled={soldOut}
                  />
                  {!soldOut && quantity > 1 && (
                    <p className="text-sm text-neutral-600">
                      {quantity} × {formatINR(product.basePricePaise)} ={" "}
                      <span className="font-bold tabular-nums text-neutral-950">
                        {formatINR(lineTotal)}
                      </span>
                    </p>
                  )}
                </div>
                {(qtyHint || lowStock || itemInCart) && (
                  <div className="mt-2 space-y-1 text-xs">
                    {qtyHint && <p className="text-neutral-500">{qtyHint}</p>}
                    {lowStock && (
                      <p className="font-medium text-red-600">
                        Only {product.stock} left in stock
                      </p>
                    )}
                    {itemInCart && (
                      <p className="text-neutral-600">
                        <Check
                          className="mr-1 inline h-3.5 w-3.5 text-[#22c55e]"
                          strokeWidth={3}
                        />
                        Already in your cart (×{cartQtyForVariant}).{" "}
                        <Link
                          href="/cart"
                          className="font-bold text-neutral-950 underline underline-offset-2 hover:text-[#ff5a1f]"
                        >
                          Edit in cart
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop actions — one row (mobile uses the sticky bar) */}
              <div className="hidden gap-2 lg:flex">
                <button
                  type="button"
                  onClick={handleCartClick}
                  disabled={soldOut}
                  className={cx(
                    cartBtnCls,
                    "min-w-0 flex-1 whitespace-nowrap px-3",
                  )}
                >
                  {cartLabel}
                </button>
                {!soldOut && (
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className={cx(
                      buyBtnCls,
                      "min-w-0 flex-1 whitespace-nowrap px-3",
                    )}
                  >
                    Buy now <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleWishlist}
                  aria-label={
                    saved ? "Remove from wishlist" : "Add to wishlist"
                  }
                  aria-pressed={saved}
                  className={wishBtnCls}
                >
                  <Heart
                    className={cx("h-5 w-5", saved && "fill-red-500")}
                    strokeWidth={1.8}
                  />
                </button>
              </div>

              {/* Assurances */}
              <ul className="grid grid-cols-3 gap-2">
                {[
                  { icon: Truck, label: "Fast delivery" },
                  { icon: RotateCcw, label: "7-day returns" },
                  { icon: ShieldCheck, label: "Secure checkout" },
                ].map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex flex-col items-center gap-1.5 rounded bg-neutral-50 px-2 py-3 text-center text-xs font-medium text-neutral-700"
                  >
                    <Icon
                      className="h-5 w-5 text-neutral-950"
                      strokeWidth={1.6}
                    />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Details */}
            <div className="mt-5">
              <Disclosure title="Product details" defaultOpen>
                <p className="whitespace-pre-line">{product.description}</p>
              </Disclosure>
              {specs.length > 0 && (
                <Disclosure title="Specifications">
                  <dl className="overflow-hidden rounded">
                    {specs.map(([k, v], i) => (
                      <div
                        key={k}
                        className={cx(
                          "flex justify-between gap-6 px-3 py-2.5",
                          i % 2 === 0 && "bg-neutral-50",
                        )}
                      >
                        <dt className="text-neutral-500">{prettyKey(k)}</dt>
                        <dd className="text-right font-semibold text-neutral-950">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Disclosure>
              )}
              <Disclosure title="Shipping and returns">
                <p>
                  Shipping is free on orders above{" "}
                  {formatINR(FREE_SHIPPING_PAISE)}; otherwise it costs{" "}
                  {formatINR(SHIPPING_FEE_PAISE)}. Tax is added at checkout.
                  Unused items can be returned within 7 days of delivery.
                </p>
              </Disclosure>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-6" aria-label="Related products">
            <div className={CARD}>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="font-display text-lg font-black uppercase italic leading-none tracking-tight text-neutral-950 sm:text-xl">
                  {category
                    ? `More from ${category.name}`
                    : "You may also like"}
                </h2>
                {category && (
                  <Link
                    href={`/categories/${category.slug}`}
                    className={cx(
                      "inline-flex items-center gap-1 text-xs font-bold text-neutral-950 transition-colors hover:text-[#ff5a1f]",
                      FOCUS,
                    )}
                  >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              {/* Scroll edge-to-edge inside the card, aligned to its padding */}
              <div
                className={cx(
                  HIDE_SCROLLBAR,
                  "-mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0",
                )}
              >
                {related.map((r) => (
                  <MiniCard key={r.id} p={r} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-[1200px] items-stretch gap-2 px-4 sm:px-6">
          <button
            type="button"
            onClick={toggleWishlist}
            aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={saved}
            className={wishBtnCls}
          >
            <Heart
              className={cx("h-5 w-5", saved && "fill-red-500")}
              strokeWidth={1.8}
            />
          </button>
          <button
            type="button"
            onClick={handleCartClick}
            disabled={soldOut}
            className={cx(cartBtnCls, "flex-1 px-3")}
          >
            {cartLabel}
          </button>
          {!soldOut && (
            <button
              type="button"
              onClick={handleBuyNow}
              className={cx(buyBtnCls, "flex-1 px-3")}
            >
              Buy now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
