// app/(storefront)/cart/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCart } from "./../../context/cart-context";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
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
  return "#d4d4d4";
}

// Max qty per line — matches product page
const MAX_QTY = 10;

// Live inventory lookup result per cart line
type StockInfo = {
  available: number; // 0 = out of stock, >0 = real stock
  loading: boolean;
};

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, subtotal, totalDiscount } =
    useCart();

  // Map: `${productId}__${size}__${color}` -> StockInfo
  const [stockMap, setStockMap] = useState<Record<string, StockInfo>>({});

  // Fetch real stock for every cart item (products without variants fall back
  // to product-level inventoryValue)
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    (async () => {
      const next: Record<string, StockInfo> = {};

      // Seed every line as loading
      for (const item of items) {
        next[lineKey(item)] = { available: 0, loading: true };
      }
      if (!cancelled) setStockMap({ ...next });

      // Group items by product so we only fetch each product's variants once
      const byProduct = new Map<string, typeof items>();
      for (const item of items) {
        const arr = byProduct.get(item.id) ?? [];
        arr.push(item);
        byProduct.set(item.id, arr);
      }

      await Promise.all(
        Array.from(byProduct.entries()).map(async ([productId, lines]) => {
          try {
            const [pSnap, vSnap] = await Promise.all([
              getDoc(doc(db, "products", productId)),
              getDocs(collection(db, "products", productId, "variants")),
            ]);

            const hasVariants = !!pSnap.data()?.hasVariants && !vSnap.empty;

            if (hasVariants) {
              // Build a lookup of size__color -> inventoryValue
              const invMap = new Map<string, number>();
              vSnap.docs.forEach((d) => {
                const v = d.data();
                if (v.status === "inactive" || v.status === "archived") return;
                const k = `${String(v.size ?? "")}__${String(v.color ?? "")}`;
                invMap.set(
                  k,
                  typeof v.inventoryValue === "number" ? v.inventoryValue : 0,
                );
              });

              for (const line of lines) {
                const k = `${line.size}__${line.color}`;
                const inv = invMap.get(k) ?? 0;
                next[lineKey(line)] = { available: inv, loading: false };
              }
            } else {
              // Simple product — use product-level inventoryValue
              const pd = pSnap.data();
              const inv =
                typeof pd?.inventoryValue === "number" ? pd.inventoryValue : 0;
              for (const line of lines) {
                next[lineKey(line)] = { available: inv, loading: false };
              }
            }
          } catch {
            // On error, be safe: mark unavailable
            for (const line of lines) {
              next[lineKey(line)] = { available: 0, loading: false };
            }
          }
        }),
      );

      if (!cancelled) setStockMap(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [items]);

  // Compute issues across the cart
  const issues = useMemo(() => {
    let anyOutOfStock = false;
    let anyClamped = false;
    let anyLoading = false;

    for (const item of items) {
      const s = stockMap[lineKey(item)];
      if (!s) continue;
      if (s.loading) anyLoading = true;
      if (!s.loading && s.available === 0) anyOutOfStock = true;
      if (!s.loading && s.available > 0 && item.quantity > s.available) {
        anyClamped = true;
      }
    }
    return { anyOutOfStock, anyClamped, anyLoading };
  }, [items, stockMap]);

  const handleCheckout = () => {
    if (issues.anyLoading) {
      toast.error("Please wait while we verify stock");
      return;
    }
    if (issues.anyOutOfStock) {
      toast.error("Remove out-of-stock items before checkout");
      return;
    }
    if (issues.anyClamped) {
      toast.error("Some quantities exceed available stock");
      return;
    }
    router.push("/checkout");
  };

  const handleQuantityChange = (item: (typeof items)[number], next: number) => {
    const s = stockMap[lineKey(item)];
    const cap =
      s && !s.loading ? Math.max(0, Math.min(s.available, MAX_QTY)) : MAX_QTY;
    if (next > cap) {
      toast.error(`Only ${cap} available for this size`);
      return;
    }
    updateQuantity(item.id, item.size, item.color, next);
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <ShoppingBag className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-black italic uppercase tracking-tight text-neutral-900">
          Your Cart is Empty
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Looks like you haven&apos;t added anything yet. Find your next
          favorite piece.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
        >
          Shop Now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const checkoutDisabled =
    issues.anyLoading || issues.anyOutOfStock || issues.anyClamped;

  return (
    <div className="min-h-screen bg-[#fafafa] py-6 md:py-8">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between border-b border-neutral-200 pb-3">
          <h1 className="font-display text-xl md:text-2xl font-black italic uppercase tracking-tight text-neutral-900">
            Shopping Cart{" "}
            <span className="text-xs md:text-sm font-bold tracking-normal text-neutral-500 not-italic ml-1">
              ({items.length} items)
            </span>
          </h1>
          <Link
            href="/products"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-neutral-900 hover:text-[#ff5a1f] transition-colors"
          >
            Continue Shopping <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Cart-wide warning banner */}
        {issues.anyOutOfStock && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Some items are out of stock</p>
              <p className="mt-0.5 text-xs text-red-700">
                Remove the highlighted items to proceed with checkout.
              </p>
            </div>
          </div>
        )}
        {issues.anyClamped && !issues.anyOutOfStock && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Some quantities exceed available stock
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Reduce the quantities below to match what&apos;s available.
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-8 flex flex-col rounded-xl bg-white divide-y divide-neutral-100 overflow-hidden">
            {items.map((item) => {
              const s = stockMap[lineKey(item)];
              const outOfStock = !!s && !s.loading && s.available === 0;
              const exceedsStock =
                !!s &&
                !s.loading &&
                s.available > 0 &&
                item.quantity > s.available;
              const loadingStock = !s || s.loading;

              const maxForLine =
                s && !s.loading
                  ? Math.max(1, Math.min(s.available, MAX_QTY))
                  : MAX_QTY;

              return (
                <div
                  key={lineKey(item)}
                  className={`group flex gap-3 p-3 sm:p-4 transition-colors ${
                    outOfStock
                      ? "bg-red-50/50 hover:bg-red-50"
                      : "hover:bg-neutral-50/50"
                  }`}
                >
                  {/* Image */}
                  <div className="h-[85px] w-[68px] sm:h-[100px] sm:w-[80px] shrink-0 overflow-hidden rounded bg-[#f5f5f5] relative">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                          outOfStock ? "opacity-60 grayscale" : ""
                        }`}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[10px] text-neutral-400">
                        No Image
                      </div>
                    )}
                    {outOfStock && (
                      <span className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-bold uppercase tracking-wider text-white">
                        Out of stock
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col justify-between py-0.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-neutral-900 leading-snug line-clamp-2 pr-2">
                          <Link
                            href={`/products/${item.slug}`}
                            className="hover:text-[#ff5a1f] transition-colors"
                          >
                            {item.name}
                          </Link>
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                          <p>
                            Size:{" "}
                            <span className="font-bold text-neutral-900 uppercase">
                              {item.size}
                            </span>
                          </p>
                          <div className="flex items-center gap-1.5">
                            Color:
                            <span
                              className="h-3 w-3 rounded-full border border-neutral-200"
                              style={{
                                backgroundColor: colorHex(item.color),
                              }}
                            />
                          </div>
                        </div>

                        {/* Stock status line */}
                        {!loadingStock && (
                          <p
                            className={`mt-1 text-[11px] font-semibold ${
                              outOfStock
                                ? "text-red-600"
                                : exceedsStock
                                  ? "text-amber-600"
                                  : s.available <= 5
                                    ? "text-amber-600"
                                    : "text-neutral-500"
                            }`}
                          >
                            {outOfStock
                              ? "Out of stock — remove to continue"
                              : exceedsStock
                                ? `Only ${s.available} available — reduce quantity`
                                : s.available <= 5
                                  ? `Only ${s.available} left in stock`
                                  : `${s.available} in stock`}
                          </p>
                        )}
                        {loadingStock && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Checking stock…
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        <p
                          className={`font-black text-sm sm:text-base ${
                            outOfStock
                              ? "text-neutral-400 line-through"
                              : "text-neutral-950"
                          }`}
                        >
                          {formatINR(item.price * item.quantity)}
                        </p>
                        {item.mrp > item.price && (
                          <p className="text-[11px] text-neutral-400 line-through mt-0.5">
                            {formatINR(item.mrp * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="mt-2 flex items-end justify-between">
                      {/* Quantity */}
                      <div
                        className={`flex items-center rounded bg-neutral-100 p-0.5 ${
                          outOfStock ? "opacity-50" : ""
                        }`}
                      >
                        <button
                          onClick={() =>
                            handleQuantityChange(item, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1 || outOfStock}
                          className="grid h-7 w-7 place-items-center text-neutral-600 hover:text-neutral-950 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-neutral-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            handleQuantityChange(item, item.quantity + 1)
                          }
                          disabled={
                            outOfStock ||
                            item.quantity >= maxForLine ||
                            loadingStock
                          }
                          className="grid h-7 w-7 place-items-center text-neutral-600 hover:text-neutral-950 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() =>
                          removeItem(item.id, item.size, item.color)
                        }
                        className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition-colors ml-2 px-1 ${
                          outOfStock
                            ? "text-red-600 hover:text-red-700"
                            : "text-neutral-400 hover:text-red-500"
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {outOfStock ? "Remove" : "Remove"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 rounded-xl bg-white p-4 sm:p-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-neutral-900 mb-3 border-b border-neutral-100 pb-3">
                Order Summary
              </h2>

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal (MRP)</span>
                  <span className="font-semibold text-neutral-900">
                    {formatINR(subtotal + totalDiscount)}
                  </span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-[#22c55e] font-medium">
                    <span>Discount</span>
                    <span>-{formatINR(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Shipping</span>
                  <span className="text-[#22c55e] font-bold uppercase text-[10px] tracking-wide mt-0.5">
                    Free
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Tax</span>
                  <span className="text-neutral-400 text-[11px]">
                    At checkout
                  </span>
                </div>
                <div className="border-t border-neutral-100 pt-3 mt-1 flex justify-between items-end">
                  <span className="text-sm font-bold text-neutral-900">
                    Total
                  </span>
                  <span className="text-lg sm:text-xl font-black text-neutral-950">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={checkoutDisabled}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded py-3.5 text-sm font-bold uppercase tracking-wider transition-colors ${
                  checkoutDisabled
                    ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                    : "bg-neutral-950 text-white hover:bg-[#ff5a1f]"
                }`}
              >
                {issues.anyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying stock…
                  </>
                ) : issues.anyOutOfStock || issues.anyClamped ? (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Fix cart to continue
                  </>
                ) : (
                  <>
                    Proceed to Checkout <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Trust Badges */}
              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-4">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-neutral-700" />{" "}
                  Secure
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  <Truck className="h-3.5 w-3.5 text-neutral-700" /> Fast
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  <RotateCcw className="h-3.5 w-3.5 text-neutral-700" /> Returns
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stable per-line key (product + size + color)
function lineKey(item: { id: string; size: string; color: string }): string {
  return `${item.id}__${item.size}__${item.color}`;
}
