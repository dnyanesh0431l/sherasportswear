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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  brandName: string;
  status: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function ProductsListPage() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

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
            brandName: data.brandName || data.brand || "—",
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

  // Reset to first page whenever filters / search change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!s) return true;
      return (
        p.name.toLowerCase().includes(s) ||
        p.slug.toLowerCase().includes(s) ||
        p.categoryId.toLowerCase().includes(s) ||
        p.brandName.toLowerCase().includes(s)
      );
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  // Keep page in range if filtered result shrinks (e.g. after delete)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const rangeStart =
    filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  // Compact page-number window (e.g. 1 … 4 5 6 … 12)
  const pageNumbers = useMemo<(number | "ellipsis")[]>(() => {
    const total = totalPages;
    const current = currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);
    if (left > 2) pages.push("ellipsis");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push("ellipsis");
    pages.push(total);
    return pages;
  }, [totalPages, currentPage]);

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
  };

  const handleDelete = async (p: Product) => {
    if (
      !confirm(
        `Are you sure you want to delete "${p.name}"?\n\nThis will also remove all its variants. This cannot be undone.`,
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
      toast.error((e as Error)?.message || "Failed to delete product");
    } finally {
      setDeleting(null);
    }
  };

  const openProduct = (id: string) => {
    router.push(`/admin/products/${id}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Products</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} total · {filtered.length} shown
            {filtered.length > 0 && ` · page ${currentPage} of ${totalPages}`}
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
            href="/admin/products/new"
            className="inline-flex items-center gap-2 bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add Product
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
      <div className="bg-white border border-neutral-200 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, brand, or category..."
            className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border border-neutral-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="Rows per page"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 overflow-hidden">
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
                : "No products match your search"}
            </p>
            {items.length === 0 && (
              <Link
                href="/admin/products/new"
                className="inline-block mt-3 text-sm text-orange-600 hover:underline"
              >
                Create your first product
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider">
                      Price
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
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => openProduct(p.id)}
                      className="hover:bg-neutral-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {p.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-10 w-10 object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-neutral-100 border border-neutral-200 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate">
                              /{p.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-neutral-700">
                          {p.brandName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5">
                          <Tag className="h-3 w-3" />
                          {p.categoryId || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-semibold text-neutral-900">
                          {formatINR(p.basePricePaise)}
                        </div>
                        {p.mrpPaise > p.basePricePaise && (
                          <div className="text-[11px] text-neutral-400 line-through">
                            {formatINR(p.mrpPaise)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 border ${
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
                      <td className="px-4 py-2.5">
                        <div
                          className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            title="Edit Product"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-orange-600 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(p);
                            }}
                            disabled={deleting === p.id}
                            title="Delete Product"
                            className="p-1.5 text-neutral-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
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

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 bg-neutral-50">
              <div className="text-xs text-neutral-600">
                Showing{" "}
                <span className="font-medium text-neutral-900">
                  {rangeStart}
                </span>
                –
                <span className="font-medium text-neutral-900">{rangeEnd}</span>{" "}
                of{" "}
                <span className="font-medium text-neutral-900">
                  {filtered.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="First page"
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {pageNumbers.map((p, idx) =>
                  p === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-xs text-neutral-400 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`min-w-[28px] px-2 py-1 text-xs border ${
                        p === currentPage
                          ? "bg-orange-600 border-orange-600 text-white font-semibold"
                          : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                      }`}
                      aria-current={p === currentPage ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next page"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Last page"
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
