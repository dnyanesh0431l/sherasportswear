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
  ChevronRight,
  CreditCard,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Payment = {
  id: string;
  orderId: string | null;
  userId: string | null;
  provider: string | null;
  providerPaymentId: string | null;
  amountPaise: number;
  currency: string;
  status: string | null;
  method: string | null;
  createdAt: Date | null;
};

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

function StatusPill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "captured"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "authorized"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : s === "pending"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : s === "failed" || s === "cancelled"
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

export default function PaymentsListPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "payments"), orderBy("createdAt", "desc")),
      );
      setItems(
        snap.docs.map((d) => {
          const p = d.data();
          return {
            id: d.id,
            orderId: p.orderId || null,
            userId: p.userId || null,
            provider: p.provider || null,
            providerPaymentId: p.providerPaymentId || null,
            amountPaise: typeof p.amountPaise === "number" ? p.amountPaise : 0,
            currency: p.currency || "INR",
            status: p.status || null,
            method: p.method || null,
            createdAt: toDate(p.createdAt),
          };
        }),
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `payments`."
          : (e as Error)?.message || "Failed to load payments",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { filtered, totals } = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (providerFilter !== "all" && p.provider !== providerFilter)
        return false;
      if (!s) return true;
      return (
        p.id.toLowerCase().includes(s) ||
        (p.orderId || "").toLowerCase().includes(s) ||
        (p.providerPaymentId || "").toLowerCase().includes(s)
      );
    });

    const totals = {
      captured: filtered
        .filter((p) => p.status === "captured")
        .reduce((sum, p) => sum + p.amountPaise, 0),
      pending: filtered
        .filter((p) => p.status === "pending" || p.status === "authorized")
        .reduce((sum, p) => sum + p.amountPaise, 0),
      failed: filtered
        .filter((p) => p.status === "failed" || p.status === "cancelled")
        .reduce((sum, p) => sum + p.amountPaise, 0),
    };

    return { filtered, totals };
  }, [items, search, statusFilter, providerFilter]);

  const providers = useMemo(
    () =>
      Array.from(
        new Set(items.map((p) => p.provider).filter((x): x is string => !!x)),
      ),
    [items],
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Payments</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} total · {filtered.length} shown
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 p-4">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
            Captured
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-600">
            {formatINR(totals.captured)}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 p-4">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
            Pending / Authorized
          </div>
          <div className="mt-1 text-lg font-bold text-amber-600">
            {formatINR(totals.pending)}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 p-4">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
            Failed / Cancelled
          </div>
          <div className="mt-1 text-lg font-bold text-neutral-500">
            {formatINR(totals.failed)}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by payment, order, or provider ID..."
            className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="captured">Captured</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
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
            <CreditCard className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No payments yet"
                : "No payments match your filters"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Payments are created automatically during checkout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Payment ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs font-semibold text-neutral-900">
                        {p.id.slice(0, 12)}
                      </div>
                      {p.providerPaymentId && (
                        <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[180px]">
                          {p.providerPaymentId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.orderId ? (
                        <Link
                          href={`/admin/orders/${p.orderId}`}
                          className="text-xs font-mono text-orange-600 hover:underline"
                        >
                          {p.orderId.slice(0, 10)}…
                        </Link>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex text-[10px] uppercase tracking-wide font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5">
                        {p.provider || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-600">
                      {p.method || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 whitespace-nowrap">
                      <span className="inline-flex items-center gap-0.5">
                        <IndianRupee className="h-3 w-3 text-neutral-400" />
                        {(p.amountPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill value={p.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/payments/${p.id}`}
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
        )}
      </div>
    </div>
  );
}
