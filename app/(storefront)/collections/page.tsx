// app/(storefront)/collections/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ArrowRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CollectionCard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: number;
  count: number;
};

// ---------------------------------------------------------------------------
// Layout tokens (same system as cart / checkout / product page)
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a1f]";
const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CollectionsPage() {
  const [items, setItems] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Two plain queries, no composite indexes needed.
      const [colSnap, prodSnap] = await Promise.all([
        getDocs(
          query(collection(db, "collections"), where("status", "==", "active")),
        ),
        getDocs(
          query(collection(db, "products"), where("status", "==", "active")),
        ),
      ]);

      // Count active products + remember a fallback cover image per collection
      const counts = new Map<string, number>();
      const covers = new Map<string, string>();
      prodSnap.docs.forEach((d) => {
        const p = d.data();
        const ids: string[] = Array.isArray(p.collectionIds)
          ? p.collectionIds
          : [];
        const img = Array.isArray(p.images) ? p.images[0] || "" : "";
        ids.forEach((id) => {
          counts.set(id, (counts.get(id) ?? 0) + 1);
          if (img && !covers.has(id)) covers.set(id, img);
        });
      });

      const list: CollectionCard[] = colSnap.docs
        .map((d) => {
          const c = d.data();
          return {
            id: d.id,
            name: c.name || "",
            slug: c.slug || d.id,
            description: c.description || "",
            image: c.image || covers.get(d.id) || "",
            sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : 999,
            count: counts.get(d.id) ?? 0,
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

      setItems(list);
    } catch (e) {
      console.error("Error loading collections:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ----- Loading
  if (loading) {
    return (
      <div
        className="min-h-screen animate-pulse bg-[#fafafa] pb-14 pt-6 md:pt-8"
        aria-busy="true"
        aria-label="Loading collections"
      >
        <div className={WRAP}>
          <div className="mb-5 h-8 w-48 rounded bg-neutral-200" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-white p-3">
                <div className="aspect-square rounded bg-neutral-200" />
                <div className="mt-3 h-5 w-2/3 rounded bg-neutral-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----- Error / empty
  if (error || items.length === 0) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <LayoutGrid className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-900 md:text-3xl">
          {error ? "Couldn't load collections" : "No collections yet"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          {error
            ? "Something went wrong. Check your connection and try again."
            : "New collections are on the way. Meanwhile, browse everything we have."}
        </p>
        {error ? (
          <button
            type="button"
            onClick={load}
            className={cx(
              "mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
              FOCUS,
            )}
          >
            Try again
          </button>
        ) : (
          <Link
            href="/products"
            className={cx(
              "mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
              FOCUS,
            )}
          >
            Shop all <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-14 pt-6 md:pt-8">
      <div className={WRAP}>
        {/* Header (same as cart) */}
        <div className="mb-5 flex items-end justify-between border-b border-neutral-200 pb-3">
          <h1 className="font-display text-xl font-black uppercase italic tracking-tight text-neutral-900 md:text-2xl">
            Collections{" "}
            <span className="ml-1 text-sm font-medium normal-case not-italic tracking-normal text-neutral-500">
              ({items.length})
            </span>
          </h1>
          <Link
            href="/products"
            className={cx(
              "hidden items-center gap-1 text-xs font-bold text-neutral-900 transition-colors hover:text-[#ff5a1f] sm:inline-flex",
              FOCUS,
            )}
          >
            Shop all products <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.slug}`}
                className={cx(
                  "group block rounded-xl bg-white p-3 transition-colors hover:bg-neutral-50",
                  FOCUS,
                )}
              >
                <div className="aspect-square overflow-hidden rounded bg-neutral-100">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      className="aspect-square h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-neutral-400">
                      <LayoutGrid className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between gap-3 px-0.5 pb-0.5">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-black uppercase italic leading-tight tracking-tight text-neutral-950">
                      {c.name}
                    </h2>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                        {c.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-bold text-neutral-500">
                      {c.count} {c.count === 1 ? "product" : "products"}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-neutral-100 text-neutral-950 transition-colors group-hover:bg-[#ff5a1f] group-hover:text-white">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}