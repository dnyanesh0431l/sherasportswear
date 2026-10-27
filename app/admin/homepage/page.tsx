"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Edit3,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Section = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  sortOrder: number;
  isActive: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  hero: "bg-orange-50 text-orange-700 border-orange-200",
  featured_products: "bg-blue-50 text-blue-700 border-blue-200",
  bestsellers: "bg-purple-50 text-purple-700 border-purple-200",
  category_grid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  collection: "bg-indigo-50 text-indigo-700 border-indigo-200",
  promo_strip: "bg-amber-50 text-amber-700 border-amber-200",
  brand_story: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

const TYPE_LABELS: Record<string, string> = {
  hero: "Hero banner",
  featured_products: "Featured products",
  bestsellers: "Bestsellers",
  category_grid: "Category grid",
  collection: "Collection",
  promo_strip: "Promo strip",
  brand_story: "Brand story",
};

export default function HomepageSectionsListPage() {
  const [items, setItems] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "homepageSections"), orderBy("sortOrder", "asc"))
      );
      setItems(
        snap.docs.map((d) => {
          const s = d.data();
          return {
            id: d.id,
            type: s.type || "unknown",
            title: s.title || "",
            subtitle: s.subtitle || "",
            sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : 0,
            isActive: !!s.isActive,
          };
        })
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `homepageSections`."
          : (e as Error)?.message || "Failed to load sections"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (s: Section) => {
    setBusyId(s.id);
    try {
      await updateDoc(doc(db, "homepageSections", s.id), {
        isActive: !s.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(!s.isActive ? `"${s.title}" activated` : `"${s.title}" hidden`);
      setItems((prev) =>
        prev.map((x) =>
          x.id === s.id ? { ...x, isActive: !s.isActive } : x
        )
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to toggle");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (s: Section) => {
    if (
      !confirm(
        `Delete section "${s.title || TYPE_LABELS[s.type] || s.type}"? It will disappear from the homepage.`
      )
    )
      return;
    setDeleting(s.id);
    try {
      await deleteDoc(doc(db, "homepageSections", s.id));
      toast.success("Section deleted");
      setItems((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    if (reordering) return;

    // Swap sortOrder of the two adjacent items
    const a = items[index];
    const b = items[target];
    setReordering(true);
    try {
      await Promise.all([
        updateDoc(doc(db, "homepageSections", a.id), {
          sortOrder: b.sortOrder,
          updatedAt: serverTimestamp(),
        }),
        updateDoc(doc(db, "homepageSections", b.id), {
          sortOrder: a.sortOrder,
          updatedAt: serverTimestamp(),
        }),
      ]);
      // Swap locally
      const next = [...items];
      next[index] = b;
      next[target] = a;
      setItems(next);
    } catch (e) {
      toast.error((e as Error)?.message || "Reorder failed");
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Homepage sections
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} section{items.length === 1 ? "" : "s"} · top to
            bottom defines the storefront layout
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/homepage/new"
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add section
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <LayoutGrid className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              No homepage sections yet
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Add a hero, featured products, categories, and more to build the
              storefront.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((s, idx) => (
              <li
                key={s.id}
                className="p-4 flex items-center gap-3 hover:bg-neutral-50"
              >
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || reordering}
                    className="p-1 rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1 || reordering}
                    className="p-1 rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Order number */}
                <div className="h-8 w-8 rounded-md bg-neutral-100 text-neutral-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {s.sortOrder}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-neutral-900 truncate">
                      {s.title || "(untitled)"}
                    </span>
                    <span
                      className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        TYPE_COLORS[s.type] ||
                        "bg-neutral-100 text-neutral-600 border-neutral-200"
                      }`}
                    >
                      {TYPE_LABELS[s.type] || s.type}
                    </span>
                  </div>
                  {s.subtitle && (
                    <div className="text-xs text-neutral-500 truncate mt-0.5">
                      {s.subtitle}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {s.isActive ? (
                    <span className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Visible
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide bg-neutral-100 text-neutral-500 border border-neutral-200 px-2 py-0.5 rounded-full">
                      Hidden
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => toggleActive(s)}
                    disabled={busyId === s.id}
                    className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                    title={s.isActive ? "Hide" : "Show"}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : s.isActive ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <Link
                    href={`/admin/homepage/${s.id}/edit`}
                    className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-orange-600"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={deleting === s.id}
                    className="p-2 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}