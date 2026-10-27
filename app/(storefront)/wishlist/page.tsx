// app/(storefront)/wishlist/page.tsx
"use client";

import { useWishlist } from "./../../context/wishlist-context";
import { useCart } from "./../../context/cart-context";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
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
      size: "M", // Default size or prompt user
      color: "#000000", // Default color
      quantity: 1,
    });
    removeItem(item.id);
    toast.success("Moved to cart!");
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-neutral-100 mb-6">
          <Heart className="h-10 w-10 text-neutral-400" />
        </div>
        <h1 className="font-display text-3xl font-black italic uppercase tracking-tight">Your Wishlist is Empty</h1>
        <p className="mt-3 text-neutral-500 max-w-sm">Save your favorite items here to buy them later.</p>
        <Link href="/products" className="mt-8 rounded-md bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-brand-hover transition-colors">
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-black italic uppercase tracking-tight mb-8">My Wishlist ({items.length})</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.id} className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <button onClick={() => removeItem(item.id)} className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-neutral-500 hover:text-red-500 backdrop-blur-sm transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
              
              <Link href={`/products/${item.slug}`} className="block aspect-[4/5] overflow-hidden rounded-lg bg-neutral-100 mb-4">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="grid h-full place-items-center text-neutral-300">No Image</div>
                )}
              </Link>
              
              <div className="flex-1">
                <h3 className="font-bold text-sm line-clamp-1"><Link href={`/products/${item.slug}`}>{item.name}</Link></h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-bold text-neutral-900">{formatINR(item.price)}</span>
                  {item.mrp > item.price && (
                    <span className="text-xs text-neutral-400 line-through">{formatINR(item.mrp)}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleMoveToCart(item)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand transition-colors"
              >
                <ShoppingBag className="h-4 w-4" /> Move to Cart
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}