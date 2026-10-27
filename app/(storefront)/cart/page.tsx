// app/(storefront)/cart/page.tsx
"use client";

import { useCart } from "./../../context/cart-context";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, totalDiscount } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-neutral-100 mb-6">
          <ShoppingBag className="h-10 w-10 text-neutral-400" />
        </div>
        <h1 className="font-display text-3xl font-black italic uppercase tracking-tight">Your Cart is Empty</h1>
        <p className="mt-3 text-neutral-500 max-w-sm">Looks like you haven't added anything yet. Find your next favorite piece.</p>
        <Link href="/products" className="mt-8 rounded-md bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-brand-hover transition-colors">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 min-h-screen py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-black italic uppercase tracking-tight mb-8">Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={`${item.id}-${item.size}-${item.color}`} className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                  {item.image && <img src={item.image} alt={item.name} className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base line-clamp-1">
                        <Link href={`/products/${item.slug}`} className="hover:underline">{item.name}</Link>
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">Size: <span className="font-semibold text-neutral-900">{item.size}</span></p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">Color:</span>
                        <span className="h-3 w-3 rounded-full border border-neutral-300" style={{ backgroundColor: item.color }} />
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id, item.size, item.color)} className="text-neutral-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-end justify-between mt-4">
                    <div className="flex items-center rounded-md border border-neutral-300 px-2 py-1">
                      <button onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity - 1)} className="text-neutral-500 hover:text-black p-1"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity + 1)} className="text-neutral-500 hover:text-black p-1"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm sm:text-base">{formatINR(item.price * item.quantity)}</p>
                      {item.mrp > item.price && (
                        <p className="text-xs text-neutral-400 line-through">{formatINR(item.mrp * item.quantity)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-6">Order Summary</h2>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-neutral-900">{formatINR(subtotal + totalDiscount)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-{formatINR(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Shipping</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
                <div className="border-t border-neutral-200 pt-4 flex justify-between font-black text-lg">
                  <span>Total</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
              </div>

              <button className="mt-6 w-full rounded-md bg-brand py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-brand-hover transition-colors flex items-center justify-center gap-2">
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}