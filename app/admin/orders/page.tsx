"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  orderNumber: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  paymentStatus: string | null;
  totalPaise: number | null;
  currency: string | null;
  itemCount: number;
  createdAt: Date | null;
};

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const PAGE_SIZES = [10, 25, 50, 100] as const;

const formatINR = (paise: number | null) =>
  paise === null ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

function StatusPill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "delivered" || s === "captured" || s === "paid" || s === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "pending" || s === "processing" || s === "authorized"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : s === "shipped"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : s === "cancelled" || s === "failed"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <span
      className={`inline-flex text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 border ${cls}`}
    >
      {value || "—"}
    </span>
  );
}

export default function OrdersListPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc")),
      );
      setItems(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            orderNumber: data.orderNumber || null,
            email: data.email || null,
            phone: data.phone || null,
            status: data.status || null,
            paymentStatus: data.paymentStatus || null,
            totalPaise:
              typeof data.totalPaise === "number" ? data.totalPaise : null,
            currency: data.currency || "INR",
            itemCount: Array.isArray(data.items) ? data.items.length : 0,
            createdAt: toDate(data.createdAt),
          };
        }),
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `orders`."
          : (e as Error)?.message || "Failed to load orders",
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
  }, [search, statusFilter, paymentFilter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (paymentFilter !== "all" && o.paymentStatus !== paymentFilter)
        return false;
      if (!s) return true;
      return (
        (o.orderNumber || "").toLowerCase().includes(s) ||
        (o.email || "").toLowerCase().includes(s) ||
        (o.phone || "").toLowerCase().includes(s) ||
        o.id.toLowerCase().includes(s)
      );
    });
  }, [items, search, statusFilter, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  // Keep page in range if filtered result shrinks
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

  // Build a compact page-number window (e.g. 1 … 4 5 6 … 12)
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

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Orders</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} total · {filtered.length} shown
            {filtered.length > 0 && ` · page ${currentPage} of ${totalPages}`}
          </p>
        </div>
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
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, email, phone..."
            className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Payments</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="captured">Captured</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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
            <ShoppingBag className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No orders yet"
                : "No orders match your filters"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Orders will appear here once customers check out.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-xs uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginated.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs font-semibold text-neutral-900">
                          {o.orderNumber || o.id.slice(0, 10)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm text-neutral-900 truncate max-w-[200px]">
                          {o.email || "guest"}
                        </div>
                        {o.phone && (
                          <div className="text-[11px] text-neutral-500">
                            {o.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600 whitespace-nowrap">
                        {o.createdAt
                          ? o.createdAt.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-700 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5">
                          <Package className="h-3 w-3" />
                          {o.itemCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 whitespace-nowrap">
                        {formatINR(o.totalPaise)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill value={o.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill value={o.paymentStatus} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline px-2 py-1"
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </Link>
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
