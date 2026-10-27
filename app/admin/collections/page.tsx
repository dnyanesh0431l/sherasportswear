"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import {
  AlertCircle,
  Edit3,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CollectionDoc = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  sortOrder: number | null;
  status: string;
  productCount: number;
};

export default function CollectionsListPage() {
  const [items, setItems] = useState<CollectionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "collections"), orderBy("sortOrder", "asc"))
      );
      setItems(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || d.id,
            slug: data.slug || "",
            description: data.description || "",
            image: data.image || null,
            sortOrder:
              typeof data.sortOrder === "number" ? data.sortOrder : null,
            status: data.status || "draft",
            productCount: Array.isArray(data.productIds)
              ? data.productIds.length
              : 0,
          };
        })
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `collections`."
          : (e as Error)?.message || "Failed to load collections"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.slug.toLowerCase().includes(s)
    );
  }, [items, search]);

  const handleDelete = async (c: CollectionDoc) => {
    if (
      !confirm(
        `Delete collection "${c.name}"?\n\nProducts referencing this collection will keep the ID but the collection will no longer appear on the storefront.`
      )
    )
      return;
    setDeleting(c.id);
    try {
      await deleteDoc(doc(db, "collections", c.id));
      toast.success(`Deleted "${c.name}"`);
      setItems((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Collections</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} total · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/admin/collections/new"
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add collection
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Layers className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No collections yet"
                : "No collections match your search"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-16">#</th>
                  <th className="px-4 py-3 text-left font-medium">Collection</th>
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-right font-medium">Products</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-500 font-mono text-xs">
                      {c.sortOrder ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover bg-neutral-100 shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-neutral-100 shrink-0 flex items-center justify-center">
                            <Layers className="h-4 w-4 text-neutral-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 truncate">
                            {c.name}
                          </div>
                          {c.description && (
                            <div className="text-xs text-neutral-500 truncate max-w-xs">
                              {c.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                      /{c.slug}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 bg-neutral-100 rounded px-2 py-0.5">
                        {c.productCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          c.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.status === "hidden"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/collections/${c.id}/edit`}
                          title="Edit"
                          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-orange-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deleting === c.id}
                          title="Delete"
                          className="p-2 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {deleting === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}