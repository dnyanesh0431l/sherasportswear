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
      className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}
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
        query(collection(db, "payments"), orderBy("createdAt", "desc"))
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
            amountPaise:
              typeof p.amountPaise === "number" ? p.amountPaise : 0,
            currency: p.currency || "INR",
            status: p.status || null,
            method: p.method || null,
            createdAt: toDate(p.createdAt),
          };
        })
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `payments`."
          : (e as Error)?.message || "Failed to load payments"
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
        new Set(items.map((p) => p.provider).filter((x): x is string => !!x))
      ),
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Payments</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} total · {filtered.length} shown
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Captured
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            {formatINR(totals.captured)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Pending / authorized
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {formatINR(totals.pending)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Failed / cancelled
          </div>
          <div className="mt-2 text-xl font-bold text-neutral-500">
            {formatINR(totals.failed)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by payment, order, or provider ID…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="captured">Captured</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
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
                  <th className="px-4 py-3 text-left font-medium">Payment</th>
                  <th className="px-4 py-3 text-left font-medium">Order</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Method</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-neutral-900">
                        {p.id.slice(0, 12)}
                      </div>
                      {p.providerPaymentId && (
                        <div className="text-[11px] text-neutral-400 font-mono truncate max-w-[180px]">
                          {p.providerPaymentId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <span className="inline-flex text-[11px] uppercase tracking-wide bg-neutral-100 text-neutral-700 rounded px-2 py-0.5">
                        {p.provider || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {p.method || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900 whitespace-nowrap">
                      <span className="inline-flex items-center gap-0.5">
                        <IndianRupee className="h-3 w-3 text-neutral-400" />
                        {(p.amountPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/payments/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
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