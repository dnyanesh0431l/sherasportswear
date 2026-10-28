// app/(storefront)/categories/[slug]/page.tsx
"use client";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import {
  ArrowLeft,
  Heart,
  Loader2,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "../../../../lib/firebase/client";
import { useWishlist } from "./../../../context/wishlist-context";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
};

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
// Product Card Component (Compact Version)
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
        {/* Reduced aspect ratio to 3/4 for a shorter card */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-[#f5f5f5]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-300">
              <Tag className="h-6 w-6" />
            </div>
          )}

          {/* Smaller Discount Badge */}
          {discount > 0 && (
            <span className="absolute left-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              {discount}% Off
            </span>
          )}

          {/* Smaller Wishlist Button */}
          <button
            type="button"
            onClick={toggleWishlist}
            aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-white/80 transition-colors hover:bg-white"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${
                isSaved ? "fill-red-500 text-red-500" : "text-neutral-500"
              }`}
            />
          </button>
        </div>

        {/* Tighter Text Area */}
        <div className="mt-1.5">
          <h3 className="line-clamp-1 text-[11px] font-bold text-neutral-900 sm:text-xs group-hover:text-[#ff5a1f] transition-colors">
            {product.name}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs font-black text-neutral-950 sm:text-sm">
              {formatINR(product.basePricePaise)}
            </span>
            {product.mrpPaise > product.basePricePaise && (
              <span className="text-[10px] font-medium text-neutral-400 line-through">
                {formatINR(product.mrpPaise)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Category Page Component
// ---------------------------------------------------------------------------

function CategoryDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high">(
    "newest",
  );

  useEffect(() => {
    if (!slug) return;
    async function fetchData() {
      try {
        const catQuery = query(
          collection(db, "categories"),
          where("slug", "==", slug),
        );
        const catSnap = await getDocs(catQuery);

        if (catSnap.empty) {
          setLoading(false);
          return;
        }

        const catData = catSnap.docs[0];
        const categoryObj: Category = {
          id: catData.id,
          name: catData.data().name || "",
          slug: catData.data().slug || catData.id,
          image: catData.data().image || null,
          description: catData.data().description || null,
        };
        setCategory(categoryObj);

        const prodQuery = query(
          collection(db, "products"),
          where("categoryId", "==", categoryObj.id),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
        );
        const prodSnap = await getDocs(prodQuery);

        const list: Product[] = prodSnap.docs.map((d) => {
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
        setProducts(list);
      } catch (error) {
        console.error("Error fetching category data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "price-low") return a.basePricePaise - b.basePricePaise;
    if (sortBy === "price-high") return b.basePricePaise - a.basePricePaise;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white px-4 text-center">
        <h1 className="text-2xl font-black italic uppercase text-neutral-900">
          Category Not Found
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          The category you are looking for does not exist.
        </p>
        <Link
          href="/categories"
          className="mt-6 rounded bg-neutral-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#ff5a1f] transition-colors"
        >
          Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-16">
      {/* Compact Header Banner */}
      <div className="relative bg-neutral-950 text-white py-10 sm:py-14 overflow-hidden">
        {category.image && (
          <img
            src={category.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
          />
        )}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-400 hover:text-white mb-3 uppercase tracking-wider transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> All Categories
          </Link>
          <h1 className="font-display text-3xl font-black italic uppercase leading-none tracking-tight sm:text-4xl lg:text-5xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-2 text-xs sm:text-sm font-medium text-neutral-400 max-w-md mx-auto">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {/* Filter Bar - Sticky & Compact */}
      <div className="sticky top-0 z-30 border-b border-neutral-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{products.length} Products</span>
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
      </div>

      {/* Product Grid - Denser with more columns on desktop */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        {sortedProducts.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-black uppercase text-neutral-900">
              No products found
            </h3>
            <p className="text-sm text-neutral-500 mt-2">
              Check back soon for new drops.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
        </div>
      }
    >
      <CategoryDetail />
    </Suspense>
  );
}
