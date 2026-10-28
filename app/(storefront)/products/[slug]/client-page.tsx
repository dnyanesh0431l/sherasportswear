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

const WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";
const HIDE_SCROLLBAR =
  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2";
const MAX_QTY = 10;

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

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;
const discountPercent = (mrp: number, price: number) =>
  mrp <= price ? 0 : Math.round(((mrp - price) / mrp) * 100);
const prettyKey = (key: string) => {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

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
      <div className="grid aspect-[4/5] place-items-center rounded-xl bg-neutral-100 text-neutral-400 lg:aspect-[5/6]">
        <Tag className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="lg:sticky lg:top-20 lg:self-start">
      {/* Mobile: swipe strip */}
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
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === active ? "w-6 bg-neutral-950" : "w-3 bg-neutral-950/30"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: thumbnails + hover zoom */}
      <div className="hidden gap-3 lg:flex">
        {images.length > 1 && (
          <div
            className={`${HIDE_SCROLLBAR} flex max-h-[calc(100vh-6rem)] w-14 shrink-0 flex-col gap-2 overflow-y-auto`}
          >
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={active === i}
                className={`aspect-[5/6] overflow-hidden rounded bg-neutral-100 transition-opacity ${FOCUS} ${active === i ? "ring-1 ring-neutral-950" : "opacity-60 hover:opacity-100"}`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div
          className="relative aspect-[5/6] max-h-[calc(100vh-6rem)] flex-1 cursor-zoom-in overflow-hidden rounded-xl bg-neutral-100"
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
            className="h-full w-full object-cover transition-transform duration-300 ease-out"
            style={
              zoom
                ? {
                    transform: "scale(1.5)",
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
        className={`flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-semibold text-neutral-950 [&::-webkit-details-marker]:hidden ${FOCUS}`}
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
      className={`group block w-[48%] shrink-0 sm:w-[23%] lg:w-auto ${FOCUS} rounded-lg`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-neutral-100">
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
      <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-neutral-950 transition-colors">
        {p.name}
      </h3>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-neutral-950">
          {formatINR(p.basePricePaise)}
        </span>
        {d > 0 && (
          <span className="text-xs text-neutral-500 line-through">
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
      <div className={`${WRAP} py-3`}>
        <div className="h-3 w-56 rounded bg-neutral-200" />
      </div>
      <div
        className={`${WRAP} grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12`}
      >
        <div className="-mx-4 aspect-[4/5] rounded-xl bg-neutral-200 sm:mx-0 lg:aspect-[5/6]" />
        <div className="space-y-4">
          <div className="h-3 w-32 rounded bg-neutral-200" />
          <div className="h-8 w-4/5 rounded bg-neutral-200" />
          <div className="h-6 w-40 rounded bg-neutral-200" />
          <div className="h-12 w-full rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}

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

  const handleCartClick = () => {
    if (!product || soldOut) return;
    if (itemInCart) {
      router.push("/cart");
      return;
    }
    if (product.sizes.length && !selectedSize) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please select a size");
      return;
    }
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
    toast.success("Added to cart");
  };

  const handleBuyNow = () => {
    if (!product || soldOut) return;
    if (product.sizes.length && !selectedSize) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please select a size");
      return;
    }
    if (!itemInCart) {
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
    }
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-black uppercase text-neutral-950">
          Product not found
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-600">
          This item doesn&apos;t exist or is no longer available.
        </p>
        <Link
          href="/products"
          className={`mt-6 rounded-md bg-neutral-950 px-6 py-3 text-sm font-semibold text-white hover:bg-[#ff5a1f] transition-colors ${FOCUS}`}
        >
          Browse all products
        </Link>
      </div>
    );

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

  return (
    <div className="bg-white pb-32 text-neutral-950 lg:pb-16">
      <nav aria-label="Breadcrumb" className={`${WRAP} py-3`}>
        <ol className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <li>
            <Link href="/" className="hover:text-neutral-950 transition-colors">
              Home
            </Link>
          </li>
          {category && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-neutral-300" />
              <li>
                <Link
                  href={`/categories/${category.slug}`}
                  className="hover:text-neutral-950 transition-colors"
                >
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="h-3 w-3 shrink-0 text-neutral-300" />
          <li
            className="min-w-0 truncate font-medium text-neutral-950"
            aria-current="page"
          >
            {product.name}
          </li>
        </ol>
      </nav>

      <div
        className={`${WRAP} grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12`}
      >
        <Gallery images={product.images} name={product.name} />

        <div className="flex min-w-0 flex-col lg:pt-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-950">
              Shera
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
              Sports Wear
            </span>
          </div>

          <h1 className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-neutral-950 sm:text-3xl lg:text-[2rem]">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold tracking-tight text-neutral-950">
              {formatINR(product.basePricePaise)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-sm text-neutral-400 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
                <span className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  {discount}% OFF
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Inclusive of all taxes · Shipping calculated at checkout
          </p>

          <div className="mt-6 border-t border-neutral-100 pt-6">
            {product.colors.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-950">
                    Colour
                  </span>
                  {selectedColor && (
                    <span className="text-xs text-neutral-500">
                      {selectedColor}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
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
                        className={`relative h-8 w-8 rounded-full border border-neutral-200 transition-all ${FOCUS} ${on ? "scale-110 border-neutral-950" : "hover:scale-105"} ${ok ? "" : "opacity-30"}`}
                        style={{ background: colorHex(c) }}
                      >
                        {on && (
                          <Check
                            className={`absolute inset-0 m-auto h-3.5 w-3.5 ${c.toLowerCase() === "white" || c.toLowerCase() === "grey" || c.toLowerCase() === "gray" ? "text-neutral-950" : "text-white"}`}
                            strokeWidth={3}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="mb-5" ref={sizeRef}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-950">
                    Size{" "}
                    {selectedSize && (
                      <span className="ml-1 font-normal text-neutral-500">
                        · {selectedSize}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-neutral-500 underline hover:text-neutral-950"
                  >
                    Size guide
                  </button>
                </div>
                {sizeError && !selectedSize && (
                  <p
                    className="mb-2 text-[11px] font-medium text-red-600"
                    role="alert"
                  >
                    Please select a size
                  </p>
                )}
                <div
                  className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2"
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
                        className={`h-10 rounded text-xs font-semibold transition-colors ${FOCUS} ${on ? "bg-neutral-950 text-white" : ok ? "bg-neutral-100 text-neutral-950 hover:bg-neutral-200" : "cursor-not-allowed bg-neutral-50 text-neutral-300 line-through"}`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {lowStock && (
              <p className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Only {product.stock} left in stock
              </p>
            )}

            {/* DESKTOP BUTTONS */}
            <div className="hidden items-stretch gap-2 lg:flex">
              <div className="flex h-12 w-[110px] shrink-0 items-center justify-between rounded bg-neutral-100 px-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className={`grid h-8 w-8 place-items-center rounded text-neutral-950 hover:bg-white disabled:text-neutral-300 ${FOCUS}`}
                >
                  <Minus className="h-3.5 w-3.5" />
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
                  className={`grid h-8 w-8 place-items-center rounded text-neutral-950 hover:bg-white disabled:text-neutral-300 ${FOCUS}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCartClick}
                disabled={soldOut}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded px-6 text-sm font-bold uppercase tracking-wider transition-colors ${FOCUS} ${soldOut ? "cursor-not-allowed bg-neutral-200 text-neutral-500" : itemInCart ? "bg-[#ff5a1f] text-white hover:bg-[#e84912]" : "bg-neutral-950 text-white hover:bg-neutral-800"}`}
              >
                {soldOut ? (
                  "Sold out"
                ) : itemInCart ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={3} />
                    Go to cart{" "}
                    {cartQtyForVariant > 1 && (
                      <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                        ×{cartQtyForVariant}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Add to cart
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={toggleWishlist}
                aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={saved}
                className={`grid h-12 w-12 shrink-0 place-items-center rounded transition-colors ${FOCUS} ${saved ? "bg-red-50 text-red-500" : "bg-neutral-100 text-neutral-500 hover:text-red-500"}`}
              >
                <Heart
                  className={`h-5 w-5 ${saved ? "fill-red-500" : ""}`}
                  strokeWidth={1.8}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={soldOut}
              className={`mt-2 hidden w-full items-center justify-center gap-2 rounded bg-white h-11 text-sm font-bold uppercase tracking-wider text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 lg:flex ${FOCUS}`}
            >
              Buy now <ArrowRight className="h-4 w-4" />
            </button>

            {/* MOBILE QUANTITY */}
            <div className="flex items-center justify-between lg:hidden">
              <span className="text-xs font-semibold text-neutral-950">
                Qty
              </span>
              <div className="flex h-10 w-[110px] items-center justify-between rounded bg-neutral-100 px-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className={`grid h-8 w-8 place-items-center rounded text-neutral-950 hover:bg-white disabled:text-neutral-300 ${FOCUS}`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  aria-label="Increase quantity"
                  className={`grid h-8 w-8 place-items-center rounded text-neutral-950 hover:bg-white disabled:text-neutral-300 ${FOCUS}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ul className="mt-5 grid grid-cols-3 divide-x divide-neutral-100 border-y border-neutral-100 py-3">
              {[
                { icon: Truck, label: "Fast delivery" },
                { icon: RotateCcw, label: "7-day returns" },
                { icon: ShieldCheck, label: "Secure checkout" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex flex-col items-center gap-1 px-1 text-center text-[10px] font-medium text-neutral-500"
                >
                  <Icon
                    className="h-4 w-4 text-neutral-950"
                    strokeWidth={1.5}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2">
            <Disclosure title="Product details" defaultOpen>
              <p className="whitespace-pre-line">{product.description}</p>
            </Disclosure>
            {specs.length > 0 && (
              <Disclosure title="Specifications">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
                  {specs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-neutral-500">{prettyKey(k)}</dt>
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

      {related.length > 0 && (
        <section
          className={`${WRAP} mt-10 border-t border-neutral-100 pt-6`}
          aria-label="Related products"
        >
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-lg font-black uppercase leading-none tracking-tight text-neutral-950 sm:text-xl">
              {category ? `More from ${category.name}` : "You may also like"}
            </h2>
            {category && (
              <Link
                href={`/categories/${category.slug}`}
                className={`text-xs font-semibold text-neutral-950 hover:text-[#ff5a1f] transition-colors ${FOCUS}`}
              >
                View all
              </Link>
            )}
          </div>
          <div
            className={`${HIDE_SCROLLBAR} -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible`}
          >
            {related.map((r) => (
              <MiniCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}

      {/* MOBILE STICKY CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-100 bg-white px-4 py-2.5 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="truncate text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              {product.name}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-neutral-950 leading-none">
                {formatINR(product.basePricePaise)}
              </span>
              {discount > 0 && (
                <span className="text-[10px] text-neutral-400 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCartClick}
            disabled={soldOut}
            className={`flex-[1.5] rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all ${soldOut ? "bg-neutral-300 cursor-not-allowed" : itemInCart ? "bg-[#ff5a1f]" : "bg-neutral-950"}`}
          >
            {soldOut ? (
              "Sold out"
            ) : itemInCart ? (
              <span className="inline-flex items-center justify-center gap-1 w-full">
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Go to cart
              </span>
            ) : (
              "Add to cart"
            )}
          </button>
          <button
            type="button"
            onClick={toggleWishlist}
            aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all ${saved ? "bg-red-50 text-red-500" : "bg-neutral-100 text-neutral-500"}`}
          >
            <Heart
              className={`h-4 w-4 ${saved ? "fill-red-500" : ""}`}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
