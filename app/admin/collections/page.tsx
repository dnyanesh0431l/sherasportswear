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
        query(collection(db, "collections"), orderBy("sortOrder", "asc")),
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
          };
        }),
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `collections`."
          : (e as Error)?.message || "Failed to load collections",
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
        c.name.toLowerCase().includes(s) || c.slug.toLowerCase().includes(s),
    );
  }, [items, search]);

  const handleDelete = async (c: CollectionDoc) => {
    if (
      !confirm(
        `Are you sure you want to delete "${c.name}"?\n\nProducts assigned to this collection will keep the collection ID, but this collection will no longer be visible on the storefront.`,
      )
    )
      return;

    setDeleting(c.id);
    try {
      await deleteDoc(doc(db, "collections", c.id));
      toast.success(`Deleted "${c.name}"`);
      setItems((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to delete collection");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Collections</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} total · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/admin/collections/new"
            className="inline-flex items-center gap-2 bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add Collection
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 p-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by collection name or slug..."
            className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 overflow-hidden">
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
            {items.length === 0 && (
              <Link
                href="/admin/collections/new"
                className="inline-block mt-3 text-sm text-orange-600 hover:underline"
              >
                Create your first collection
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Collection
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-neutral-50 transition-colors group"
                  >
                    <td className="px-4 py-2.5 text-neutral-500 font-mono text-xs">
                      {c.sortOrder ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image}
                            alt=""
                            className="h-9 w-9 object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 bg-neutral-100 border border-neutral-200 shrink-0 flex items-center justify-center">
                            <Layers className="h-4 w-4 text-neutral-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 truncate">
                            {c.name}
                          </div>
                          {c.description && (
                            <div className="text-[11px] text-neutral-500 truncate max-w-xs">
                              {c.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral-600">
                      /{c.slug}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 border ${
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
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/admin/collections/${c.id}/edit`}
                          title="Edit Collection"
                          className="p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-orange-600 transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deleting === c.id}
                          title="Delete Collection"
                          className="p-1.5 text-neutral-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
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
