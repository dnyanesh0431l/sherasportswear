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
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
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
      className={`inline-flex text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 border ${cls}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default function ShipmentsListPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexUrl, setIndexUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");

  const copyIndexUrl = async () => {
    if (!indexUrl) return;
    try {
      await navigator.clipboard.writeText(indexUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — user can still select manually
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIndexUrl(null);
    try {
      const snap = await getDocs(
        query(collectionGroup(db, "shipments"), orderBy("createdAt", "desc")),
      );
      setItems(
        snap.docs.map((d) => {
          const s = d.data();
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
        }),
      );
    } catch (e) {
      const msg = (e as Error)?.message || "Failed to load shipments";
      const match = msg.match(
        /https:\/\/console\.firebase\.google\.com\/[^\s"']+/,
      );
      if (match) {
        setIndexUrl(match[0]);
        setError(
          "Missing collection-group index for `shipments.createdAt`. Use the one-click link below to create it.",
        );
      } else if (msg.includes("permission-denied")) {
        setError(
          "Permission denied. Add a collection-group rule for `shipments` (see notes below).",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const carriers = useMemo(
    () => Array.from(new Set(items.map((s) => s.carrier).filter(Boolean))),
    [items],
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
        (s) => s.status === "in_transit" || s.status === "out_for_delivery",
      ).length,
      delivered: items.filter((s) => s.status === "delivered").length,
    }),
    [items],
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Shipments</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} total · {filtered.length} shown · across all orders
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
        <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div>{error}</div>

            {indexUrl && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={indexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Open index creation page
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={copyIndexUrl}
                    className="inline-flex items-center gap-1.5 border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy link
                      </>
                    )}
                  </button>
                </div>
                <div className="border border-red-200 bg-white px-2 py-1.5 font-mono text-[11px] text-red-800 break-all select-all">
                  {indexUrl}
                </div>
                <p className="text-[11px] text-red-600/80">
                  After the index finishes building (usually 1–2 min), click
                  Refresh above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 p-4">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
            Pending
          </div>
          <div className="mt-1 text-lg font-bold text-amber-600">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 p-4">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
            In Transit
          </div>
          <div className="mt-1 text-lg font-bold text-blue-600">
            {stats.inTransit}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 p-4">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
            Delivered
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-600">
            {stats.delivered}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking #, carrier, order..."
            className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Carriers</option>
          {carriers.map((c) => (
            <option key={c} value={c}>
              {c}
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
            <Truck className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No shipments yet"
                : "No shipments match your filters"}
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Shipments are added from an order's detail page. Open an order and
              use "Add shipment" to create one.
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
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Tracking
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Shipped
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs uppercase tracking-wider">
                    Delivered
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((s) => (
                  <tr
                    key={`${s.orderId}-${s.id}`}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/orders/${s.orderId}`}
                        className="font-mono text-xs font-semibold text-orange-600 hover:underline"
                      >
                        {s.orderId.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex text-[10px] uppercase tracking-wide font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5">
                        {s.carrier || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs text-neutral-700">
                        {s.trackingNumber || "—"}
                      </div>
                      {s.trackingUrl && (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-orange-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          Track <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill value={s.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-600 whitespace-nowrap">
                      {s.shippedAt
                        ? s.shippedAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
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
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/shipments/${s.orderId}/${s.id}`}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline px-2 py-1"
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
