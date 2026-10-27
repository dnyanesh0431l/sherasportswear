// app/(storefront)/wishlist/page.tsx
"use client";

import { ArrowRight, Heart, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCart } from "./../../context/cart-context";
import { useWishlist } from "./../../context/wishlist-context";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export default function WishlistPage() {
  const { items, removeItem } = useWishlist();
  const { addItem } = useCart();

  const handleMoveToCart = (item: any) => {
    addItem({
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: item.price,
      mrp: item.mrp,
      image: item.image,
      size: "M",
      color: "#000000",
      quantity: 1,
    });
    removeItem(item.id);
    toast.success("Moved to cart!");
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-neutral-50 border border-neutral-100">
          <Heart className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-black italic uppercase tracking-tight text-neutral-900">
          Your Wishlist is Empty
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Save your favorite items here to buy them later.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-brand-hover"
        >
          Explore Products <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-10 md:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between border-b border-neutral-200 pb-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black italic uppercase tracking-tight text-neutral-900">
              My Wishlist
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {items.length} {items.length === 1 ? "item" : "items"} saved
            </p>
          </div>
          <Link
            href="/products"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-neutral-900 hover:text-brand"
          >
            Continue Shopping <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Rows Container */}
        <div className="flex flex-col border-t border-neutral-100">
          {items.map((item) => {
            const discount = discountPercent(item.mrp, item.price);

            return (
              <div
                key={item.id}
                className="group flex flex-row items-center gap-4 py-4 sm:gap-6 sm:py-6 border-b border-neutral-100 transition-colors hover:bg-neutral-50/50 px-2 -mx-2 rounded-lg"
              >
                {/* Image */}
                <Link
                  href={`/products/${item.slug}`}
                  className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-md bg-[#f5f5f5] sm:h-32 sm:w-28"
                >
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
                  {discount > 0 && (
                    <span className="absolute left-0 top-2 rounded-r bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                      {discount}% OFF
                    </span>
                  )}
                </Link>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-center min-w-0">
                  <Link href={`/products/${item.slug}`}>
                    <h3 className="truncate text-sm font-bold text-neutral-900 sm:text-base">
                      {item.name}
                    </h3>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-black text-neutral-950 sm:text-base">
                      {formatINR(item.price)}
                    </span>
                    {item.mrp > item.price && (
                      <>
                        <span className="text-xs text-neutral-400 line-through">
                          {formatINR(item.mrp)}
                        </span>
                        <span className="text-[10px] font-bold text-[#22c55e] sm:text-xs">
                          Save {formatINR(item.mrp - item.price)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove item"
                    className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>

                  <button
                    onClick={() => handleMoveToCart(item)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand sm:px-6 sm:py-2.5 sm:text-xs"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Move to Cart</span>
                    <span className="sm:hidden">Move</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Continue Shopping */}
        <div className="mt-8 sm:hidden">
          <Link
            href="/products"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 py-3 text-sm font-bold uppercase tracking-wider text-neutral-900 transition-colors hover:border-brand hover:text-brand"
          >
            Continue Shopping <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
