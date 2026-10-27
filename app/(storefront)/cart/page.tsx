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
import { useCart } from "./../../context/cart-context";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, totalDiscount } =
    useCart();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50 border border-neutral-100">
          <ShoppingBag className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-black italic uppercase tracking-tight text-neutral-900">
          Your Cart is Empty
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Looks like you haven't added anything yet. Find your next favorite
          piece.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#ff5a1f] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#e84912] shadow-sm"
        >
          Shop Now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] py-6 md:py-8">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between border-b border-neutral-200 pb-3">
          <h1 className="font-display text-xl md:text-2xl font-black italic uppercase tracking-tight text-neutral-900">
            Shopping Cart{" "}
            <span className="text-xs md:text-sm font-bold tracking-normal text-neutral-500 not-italic ml-1.5">
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
          {/* Cart Items List - Compact Rows */}
          <div className="lg:col-span-8 flex flex-col rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 shadow-sm overflow-hidden">
            {items.map((item) => (
              <div
                key={`${item.id}-${item.size}-${item.color}`}
                className="group flex gap-3 p-3 sm:gap-4 sm:p-4 transition-colors hover:bg-neutral-50/50"
              >
                {/* Image */}
                <div className="h-[90px] w-[72px] sm:h-[110px] sm:w-[88px] shrink-0 overflow-hidden rounded-md bg-[#f5f5f5] border border-neutral-100">
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

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                        <p>
                          Size:{" "}
                          <span className="font-bold text-neutral-900 uppercase">
                            {item.size}
                          </span>
                        </p>
                        <div className="flex items-center gap-1.5">
                          Color:
                          <span
                            className="h-3 w-3 rounded-full border border-neutral-300 shadow-sm"
                            style={{ backgroundColor: item.color }}
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
                    {/* Quantity Selector - High Contrast */}
                    <div className="flex items-center rounded-md border border-neutral-300 bg-white shadow-sm">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            item.size,
                            item.color,
                            item.quantity - 1,
                          )
                        }
                        disabled={item.quantity <= 1}
                        className="grid h-7 w-7 place-items-center text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors rounded-l-md"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-neutral-900 border-x border-neutral-200">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            item.size,
                            item.color,
                            item.quantity + 1,
                          )
                        }
                        className="grid h-7 w-7 place-items-center text-neutral-800 hover:bg-neutral-100 transition-colors rounded-r-md"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeItem(item.id, item.size, item.color)}
                      className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400 hover:text-red-500 transition-colors ml-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary - Compact & Sticky */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-neutral-900 mb-3 border-b border-neutral-100 pb-3">
                Order Summary
              </h2>

              <div className="space-y-2.5 text-xs sm:text-sm">
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

                <div className="border-t border-neutral-200 pt-3 mt-1 flex justify-between items-end">
                  <span className="text-sm font-bold text-neutral-900">
                    Total
                  </span>
                  <span className="text-lg sm:text-xl font-black text-neutral-950">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </div>

              {/* High Visibility Checkout Button */}
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5a1f] py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-[#e84912] hover:shadow-lg">
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
