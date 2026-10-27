"use client";

import { db } from "@/lib/firebase/client";
import {
  collectionGroup,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Shipment = {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date | null;
};

const SHIPMENT_STATUSES = [
  "pending",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "returned",
] as const;

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

function StatusPill({ value }: { value: string }) {
  const s = value.toLowerCase();
  const cls =
    s === "delivered"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "in_transit" || s === "out_for_delivery"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : s === "pending"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : s === "returned"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <span
      className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default function ShipmentsListPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(
          collectionGroup(db, "shipments"),
          orderBy("createdAt", "desc")
        )
      );
      setItems(
        snap.docs.map((d) => {
          const s = d.data();
          // doc.ref.parent -> shipments collection
          // doc.ref.parent.parent -> order doc
          const orderId = d.ref.parent.parent?.id ?? "unknown";
          return {
            id: d.id,
            orderId,
            carrier: s.carrier || "",
            trackingNumber: s.trackingNumber || "",
            trackingUrl: s.trackingUrl || null,
            status: s.status || "pending",
            shippedAt: toDate(s.shippedAt),
            deliveredAt: toDate(s.deliveredAt),
            createdAt: toDate(s.createdAt),
          };
        })
      );
    } catch (e) {
      const msg = (e as Error)?.message || "Failed to load shipments";
      setError(
        msg.includes("permission-denied")
          ? "Permission denied. Add a collection-group rule for `shipments` (see notes below)."
          : msg.includes("index")
            ? "Missing collection-group index for `shipments.createdAt`. Check console log for the auto-generated link."
            : msg
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const carriers = useMemo(
    () =>
      Array.from(
        new Set(items.map((s) => s.carrier).filter(Boolean))
      ),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (carrierFilter !== "all" && s.carrier !== carrierFilter) return false;
      if (!q) return true;
      return (
        s.trackingNumber.toLowerCase().includes(q) ||
        s.carrier.toLowerCase().includes(q) ||
        s.orderId.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter, carrierFilter]);

  const stats = useMemo(
    () => ({
      pending: items.filter((s) => s.status === "pending").length,
      inTransit: items.filter(
        (s) => s.status === "in_transit" || s.status === "out_for_delivery"
      ).length,
      delivered: items.filter((s) => s.status === "delivered").length,
    }),
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Shipments</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} total · {filtered.length} shown · across all orders
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

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Pending
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            In transit
          </div>
          <div className="mt-2 text-xl font-bold text-blue-600">
            {stats.inTransit}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Delivered
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            {stats.delivered}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking #, carrier, order…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All carriers</option>
          {carriers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Truck className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No shipments yet"
                : "No shipments match your filters"}
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Shipments are added from an order's detail page. Open an order
              and use "Add shipment" to create one.
            </p>
            <Link
              href="/admin/orders"
              className="inline-block mt-4 text-sm font-medium text-orange-600 hover:underline"
            >
              Go to orders →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Order</th>
                  <th className="px-4 py-3 text-left font-medium">Carrier</th>
                  <th className="px-4 py-3 text-left font-medium">Tracking</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Shipped</th>
                  <th className="px-4 py-3 text-left font-medium">Delivered</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((s) => (
                  <tr key={`${s.orderId}-${s.id}`} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${s.orderId}`}
                        className="font-mono text-xs font-semibold text-orange-600 hover:underline"
                      >
                        {s.orderId.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex text-[11px] uppercase tracking-wide bg-neutral-100 text-neutral-700 rounded px-2 py-0.5">
                        {s.carrier || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-neutral-700">
                        {s.trackingNumber || "—"}
                      </div>
                      {s.trackingUrl && (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-orange-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          Track <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={s.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                      {s.shippedAt
                        ? s.shippedAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {s.deliveredAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {s.deliveredAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/shipments/${s.orderId}/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        Manage <ChevronRight className="h-3 w-3" />
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