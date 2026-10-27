// app/(storefront)/categories/[slug]/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";
import { ArrowLeft, Heart, Loader2, SlidersHorizontal, Tag } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWishlist } from "./../../../context/wishlist-context";
import { toast } from "sonner";

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
            <span className="absolute left-2.5 top-2.5 rounded bg-[#ff5a1f] px-2 py-1 text-[9px] font-bold uppercase leading-none text-white">
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
// Main Category Page Component
// ---------------------------------------------------------------------------

function CategoryDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high">("newest");

  useEffect(() => {
    if (!slug) return;
    async function fetchData() {
      try {
        // 1. Fetch the category by slug
        const catQuery = query(collection(db, "categories"), where("slug", "==", slug));
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

        // 2. Fetch products for this category
        const prodQuery = query(
          collection(db, "products"),
          where("categoryId", "==", categoryObj.id),
          where("status", "==", "active"),
          orderBy("createdAt", "desc")
        );
        const prodSnap = await getDocs(prodQuery);
        
        const list: Product[] = prodSnap.docs.map((d) => {
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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-4 text-center">
        <h1 className="text-2xl font-black italic uppercase">Category Not Found</h1>
        <p className="mt-2 text-neutral-500">The category you are looking for does not exist.</p>
        <Link href="/categories" className="mt-6 rounded-md bg-[#ff5a1f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e84912]">
          Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header Banner */}
      <div className="relative bg-neutral-950 text-white py-16 sm:py-24 overflow-hidden">
        {category.image && (
          <img
            src={category.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
          />
        )}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <Link href="/categories" className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> All Categories
          </Link>
          <h1 className="font-display text-4xl font-black italic uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-4 text-sm text-neutral-400 max-w-xl mx-auto">
              {category.description}
            </p>
          )}
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
            className="bg-transparent text-sm font-semibold outline-none cursor-pointer hover:text-[#ff5a1f]"
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
            <h3 className="text-lg font-bold">No products found in this category</h3>
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

export default function CategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
        </div>
      }
    >
      <CategoryDetail />
    </Suspense>
  );
}