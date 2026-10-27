"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  deleteDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import {
  AlertCircle,
  Boxes,
  Edit3,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  status: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
};

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function ProductsListPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "products"), orderBy("createdAt", "desc")),
      );
      setItems(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || "",
            categoryId: data.categoryId || "",
            status: data.status || "draft",
            basePricePaise:
              typeof data.basePricePaise === "number" ? data.basePricePaise : 0,
            mrpPaise: typeof data.mrpPaise === "number" ? data.mrpPaise : 0,
            images: Array.isArray(data.images) ? data.images : [],
          };
        }),
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `products`."
          : (e as Error)?.message || "Failed to load products",
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
    return items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!s) return true;
      return (
        p.name.toLowerCase().includes(s) ||
        p.slug.toLowerCase().includes(s) ||
        p.categoryId.toLowerCase().includes(s)
      );
    });
  }, [items, search, statusFilter]);

  const handleDelete = async (p: Product) => {
    if (
      !confirm(
        `Delete "${p.name}"?\n\nThis also removes all variants. Cannot be undone.`,
      )
    )
      return;
    setDeleting(p.id);
    try {
      const variantsSnap = await getDocs(
        collection(db, "products", p.id, "variants"),
      );
      await Promise.all(variantsSnap.docs.map((v) => deleteDoc(v.ref)));
      await deleteDoc(doc(db, "products", p.id));
      toast.success(`Deleted "${p.name}"`);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
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
          <h1 className="text-2xl font-bold text-neutral-900">Products</h1>
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
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add product
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No products yet"
                : "No products match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.images[0]}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover bg-neutral-100 shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-neutral-100 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            /{p.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-600 bg-neutral-100 rounded px-2 py-0.5">
                        <Tags className="h-3 w-3" />
                        {p.categoryId || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-neutral-900">
                        {formatINR(p.basePricePaise)}
                      </div>
                      {p.mrpPaise > p.basePricePaise && (
                        <div className="text-xs text-neutral-400 line-through">
                          {formatINR(p.mrpPaise)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : p.status === "draft"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/products/${p.id}/variants`}
                          title="Manage variants"
                          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-orange-600"
                        >
                          <Boxes className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          title="Edit"
                          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-orange-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deleting === p.id}
                          title="Delete"
                          className="p-2 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {deleting === p.id ? (
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
