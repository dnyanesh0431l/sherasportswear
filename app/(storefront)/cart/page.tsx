// app/(storefront)/cart/page.tsx
"use client";

import {
  ArrowRight,
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
import { toast } from "sonner";
import { useCart } from "./../../context/cart-context";

// ---------------------------------------------------------------------------
// Money + shipping (kept in sync with checkout)
// ---------------------------------------------------------------------------
const SHIPPING_FEE_PAISE = 8000; // ₹80 flat — matches checkout/page.tsx

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, subtotal, totalDiscount } =
    useCart();

  // Cart total that matches checkout: subtotal - discount + shipping
  const subtotalPaise = subtotal;
  const discountPaise = totalDiscount;
  const shippingPaise = SHIPPING_FEE_PAISE;
  const totalPaise = subtotalPaise - discountPaise + shippingPaise;

  const handleCheckout = () => {
    router.push("/checkout");
  };

  const handleQuantityChange = (item: (typeof items)[number], next: number) => {
    if (next > MAX_QTY) {
      toast.error(`Maximum ${MAX_QTY} per item`);
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

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-8 flex flex-col rounded-xl bg-white divide-y divide-neutral-100 overflow-hidden">
            {items.map((item) => {
              return (
                <div
                  key={lineKey(item)}
                  className="group flex gap-3 p-3 sm:p-4 transition-colors hover:bg-neutral-50/50"
                >
                  {/* Image */}
                  <div className="h-[85px] w-[68px] sm:h-[100px] sm:w-[80px] shrink-0 overflow-hidden rounded bg-[#f5f5f5] relative">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[10px] text-neutral-400">
                        No Image
                      </div>
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
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm sm:text-base text-neutral-950">
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
                      <div className="flex items-center rounded bg-neutral-100 p-0.5">
                        <button
                          onClick={() =>
                            handleQuantityChange(item, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
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
                          disabled={item.quantity >= MAX_QTY}
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
                        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition-colors ml-2 px-1 text-neutral-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary — same money layout as checkout */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 rounded-xl bg-white p-4 sm:p-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-neutral-900 mb-3 border-b border-neutral-100 pb-3">
                Order Summary
              </h2>

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {formatINR(subtotalPaise)}
                  </span>
                </div>

                {discountPaise > 0 && (
                  <div className="flex justify-between font-medium text-[#22c55e]">
                    <span>Discount</span>
                    <span className="tabular-nums">
                      −{formatINR(discountPaise)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-neutral-600">
                  <span>Shipping</span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {formatINR(shippingPaise)}
                  </span>
                </div>

                <div className="flex justify-between text-neutral-600">
                  <span>Tax</span>
                  <span className="text-[11px] text-neutral-400">Included</span>
                </div>

                <div className="mt-1 flex items-end justify-between border-t border-neutral-100 pt-3">
                  <span className="text-sm font-bold text-neutral-900">
                    Total
                  </span>
                  <span className="text-lg sm:text-xl font-black tabular-nums text-neutral-950">
                    {formatINR(totalPaise)}
                  </span>
                </div>
              </div>

              {/* Shipping note — mirrors the checkout trust line */}
              <p className="mt-2 text-[11px] text-neutral-500">
                A flat {formatINR(shippingPaise)} shipping fee is added at
                checkout.
              </p>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded py-3.5 text-sm font-bold uppercase tracking-wider transition-colors bg-neutral-950 text-white hover:bg-[#ff5a1f]"
              >
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
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
