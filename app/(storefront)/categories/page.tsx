// app/(storefront)/categories/page.tsx
"use client";

import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { ArrowRight, Loader2, Tag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase/client";

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const snap = await getDocs(
          query(collection(db, "categories"), orderBy("sortOrder", "asc"))
        );
        const list: Category[] = snap.docs
          .filter((d) => d.data().status === "active")
          .map((d) => {
            const c = d.data();
            return {
              id: d.id,
              name: c.name || "",
              slug: c.slug || d.id,
              image: c.image || null,
              description: c.description || null,
            };
          });
        setCategories(list);
      } catch (error) {
        console.error("Failed to load categories", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header Banner */}
      <div className="bg-neutral-950 text-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-4xl font-black italic uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
            Shop by Category
          </h1>
          <p className="mt-4 text-sm text-neutral-400 max-w-xl mx-auto">
            Find exactly what you need to elevate your performance.
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
        {categories.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-bold">No categories found</h3>
            <p className="text-neutral-500 mt-2">Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group relative overflow-hidden rounded-xl aspect-[4/5] bg-neutral-100"
              >
                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-neutral-200">
                    <Tag className="h-10 w-10 text-neutral-400" />
                  </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                
                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <h3 className="font-display text-xl sm:text-2xl font-black italic uppercase text-white leading-tight">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-xs text-white/70 mt-1 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5a1f]">
                    Shop Now <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}