// app/(storefront)/products/page.tsx
"use client";

import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Loader2, SlidersHorizontal, Tag, Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase/client";
import { useWishlist } from "../../context/wishlist-context"; // Adjust path if needed
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

type Product = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  categoryId: string;
  colors: string[];
};

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

// ---------------------------------------------------------------------------
// Product Card Component
// ---------------------------------------------------------------------------

function ProductCard({ product }: { product: Product }) {
  const { addItem, removeItem, isInWishlist } = useWishlist();
  const isSaved = isInWishlist(product.id);
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
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
        image: product.images[0] || "",
      });
      toast.success("Added to wishlist");
    }
  };

  return (
    <div className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[5/6] overflow-hidden rounded-lg bg-neutral-100">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-300">
              <Tag className="h-10 w-10" />
            </div>
          )}
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded bg-brand px-2 py-1 text-[9px] font-bold uppercase leading-none text-white">
              {discount}% off
            </span>
          )}
        </div>
        <div className="mt-3">
          <h3 className="line-clamp-1 text-xs font-medium text-neutral-900 sm:text-sm">
            {product.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-neutral-950 sm:text-base">
              {formatINR(product.basePricePaise)}
            </span>
            {product.mrpPaise > product.basePricePaise && (
              <>
                <span className="text-[11px] text-neutral-400 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Save {formatINR(product.mrpPaise - product.basePricePaise)}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={toggleWishlist}
        aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full text-neutral-800 transition-colors hover:text-red-500 bg-white/70 backdrop-blur-sm"
      >
        <Heart
          className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high">("newest");

  useEffect(() => {
    async function fetchProducts() {
      try {
        const snap = await getDocs(
          query(collection(db, "products"), orderBy("createdAt", "desc"))
        );
        const list: Product[] = snap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const p = d.data();
            return {
              id: d.id,
              name: p.name || "",
              slug: p.slug || d.id,
              basePricePaise: typeof p.basePricePaise === "number" ? p.basePricePaise : 0,
              mrpPaise: typeof p.mrpPaise === "number" ? p.mrpPaise : 0,
              images: Array.isArray(p.images) ? p.images : [],
              categoryId: p.categoryId || "",
              colors: Array.isArray(p.colors) ? p.colors : [],
            };
          });
        setProducts(list);
      } catch (error) {
        console.error("Failed to load products", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "price-low") return a.basePricePaise - b.basePricePaise;
    if (sortBy === "price-high") return b.basePricePaise - a.basePricePaise;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header Banner */}
      <div className="bg-neutral-950 text-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-4xl font-black italic uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
            The Collection
          </h1>
          <p className="mt-4 text-sm text-neutral-400 max-w-xl mx-auto">
            Engineered for performance. Designed for everyday movement.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <SlidersHorizontal className="h-4 w-4" />
            <span>{products.length} Products</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-sm font-semibold outline-none cursor-pointer hover:text-brand"
          >
            <option value="newest">Newest Arrivals</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
        {sortedProducts.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-bold">No products found</h3>
            <p className="text-neutral-500 mt-2">Check back soon for new drops.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}