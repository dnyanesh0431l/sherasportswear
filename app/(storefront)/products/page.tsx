// app/(storefront)/products/page.tsx
"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Heart, Loader2, SlidersHorizontal, Tag, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "../../../lib/firebase/client";
import { useWishlist } from "../../context/wishlist-context";

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

type Category = {
  id: string;
  name: string;
  slug: string;
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
    <div className="group relative flex flex-col">
      <Link href={`/products/${product.slug}`} className="block flex-1">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#f5f5f5]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-300">
              <Tag className="h-8 w-8" />
            </div>
          )}

          {/* Discount Badge */}
          {discount > 0 && (
            <span className="absolute left-2 top-2 rounded bg-red-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {discount}% Off
            </span>
          )}

          {/* Wishlist Button - Clean, no borders */}
          <button
            type="button"
            onClick={toggleWishlist}
            aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/80 transition-colors hover:bg-white"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isSaved ? "fill-red-500 text-red-500" : "text-neutral-500"
              }`}
            />
          </button>
        </div>

        <div className="mt-2.5">
          <h3 className="line-clamp-1 text-xs font-bold text-neutral-900 sm:text-sm group-hover:text-[#ff5a1f] transition-colors">
            {product.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-black text-neutral-950">
              {formatINR(product.basePricePaise)}
            </span>
            {product.mrpPaise > product.basePricePaise && (
              <>
                <span className="text-[11px] font-medium text-neutral-400 line-through">
                  {formatINR(product.mrpPaise)}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Content
// ---------------------------------------------------------------------------

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "all";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high">(
    "newest",
  );

  // Update state if URL changes (e.g., user searches again from header)
  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
    setActiveCategory(searchParams.get("category") || "all");
  }, [searchParams]);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [prodSnap, catSnap] = await Promise.all([
          getDocs(
            query(collection(db, "products"), orderBy("createdAt", "desc")),
          ),
          getDocs(
            query(collection(db, "categories"), orderBy("sortOrder", "asc")),
          ),
        ]);

        const pList: Product[] = prodSnap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const p = d.data();
            return {
              id: d.id,
              name: p.name || "",
              slug: p.slug || d.id,
              basePricePaise:
                typeof p.basePricePaise === "number" ? p.basePricePaise : 0,
              mrpPaise: typeof p.mrpPaise === "number" ? p.mrpPaise : 0,
              images: Array.isArray(p.images) ? p.images : [],
              categoryId: p.categoryId || "",
              colors: Array.isArray(p.colors) ? p.colors : [],
            };
          });

        const cList: Category[] = catSnap.docs
          .filter((d) => {
            const s = d.data().status;
            return s === "active" || s === undefined;
          })
          .map((d) => {
            const c = d.data();
            return {
              id: d.id,
              name: c.name || d.id,
              slug: c.slug || d.id,
            };
          });

        setProducts(pList);
        setCategories(cList);
      } catch (error) {
        console.error("Failed to load products", error);
        toast.error("Failed to load catalog");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Category
    if (activeCategory !== "all") {
      result = result.filter((p) => p.categoryId === activeCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === "price-low") return a.basePricePaise - b.basePricePaise;
      if (sortBy === "price-high") return b.basePricePaise - a.basePricePaise;
      return 0; // 'newest' is already default from Firestore
    });
  }, [products, activeCategory, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Compact Hero Banner */}
      <div className="bg-neutral-950 text-white py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-3xl font-black italic uppercase leading-none tracking-tight sm:text-4xl lg:text-5xl">
            {activeCategory !== "all"
              ? categories.find((c) => c.id === activeCategory)?.name ||
                "The Collection"
              : "The Collection"}
          </h1>
          <p className="mt-3 text-xs sm:text-sm font-medium text-neutral-400 max-w-xl mx-auto">
            Engineered for performance. Designed for everyday movement.
          </p>
        </div>
      </div>

      {/* Filter Bar - Sticky & Compact */}
      <div className="sticky top-0 z-30 border-b border-neutral-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Row: Count & Sort */}
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{filteredProducts.length} Products</span>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold uppercase tracking-wider text-neutral-900 outline-none cursor-pointer hover:text-[#ff5a1f] transition-colors"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>

          {/* Bottom Row: Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              onClick={() => setActiveCategory("all")}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeCategory === "all"
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              All Products
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeCategory === c.id
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Search Indicator */}
      {searchQuery && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            Showing results for{" "}
            <span className="font-bold text-neutral-900">"{searchQuery}"</span>
            <Link
              href="/products"
              className="ml-2 inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-200 transition-colors"
            >
              Clear Search <X className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-black uppercase text-neutral-900">
              No products found
            </h3>
            <p className="text-sm text-neutral-500 mt-2">
              Try adjusting your search or filter to find what you're looking
              for.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
              className="mt-6 rounded bg-neutral-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#ff5a1f] transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Wrapper (Required for useSearchParams)
// ---------------------------------------------------------------------------
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
