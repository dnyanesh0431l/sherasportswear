// app/admin/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Star,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RangeKey = "yesterday" | "week" | "month" | "custom";

type RangeStats = {
  cacheKey: string;
  startDate: string;
  endDate: string;
  revenue: {
    totalPaise: number;
    orderCount: number;
    deliveredOrderCount: number;
    cancelledOrderCount: number;
    avgOrderValuePaise: number;
  };
  statusCounts: Record<string, number>;
  paymentCounts: Record<string, number>;
  topProducts: { name: string; quantity: number; revenuePaise: number }[];
  topCustomers: {
    email: string;
    orderCount: number;
    totalSpentPaise: number;
  }[];
  dailyBreakdown: { day: string; totalPaise: number; orderCount: number }[];
  lowStockProducts: { id: string; name: string; stock: number }[];
  counts: {
    products: number;
    orders: number;
    users: number;
    categories: number;
    collections: number;
    banners: number;
  };
  lastUpdated: Date | null;
};

type RecentOrder = {
  id: string;
  orderNumber: string | null;
  email: string | null;
  totalPaise: number | null;
  status: string | null;
  paymentStatus: string | null;
  createdAt: Date | null;
};

type RecentProduct = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  status: string;
  image: string | null;
  inventoryValue: number;
};

type BannerDoc = {
  id: string;
  title: string;
  placement: string | null;
  isActive: boolean;
  imageUrl: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

function formatINR(paise: number): string {
  if (paise >= 10000000) return `₹${(paise / 10000000).toFixed(1)}Cr`;
  if (paise >= 100000) return `₹${(paise / 100000).toFixed(1)}L`;
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatINRFull(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Returns the [start, end) boundaries for the selected range.
 * End is always "today 00:00" so today's data is excluded.
 */
function getRange(
  range: RangeKey,
  customStart?: string,
  customEnd?: string,
): {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
} {
  const today = startOfDay(new Date());

  if (range === "yesterday") {
    const start = addDays(today, -1);
    return {
      start,
      end: today,
      startStr: toKey(start),
      endStr: toKey(addDays(today, -1)),
    };
  }
  if (range === "week") {
    const start = addDays(today, -7);
    return {
      start,
      end: today,
      startStr: toKey(start),
      endStr: toKey(addDays(today, -1)),
    };
  }
  if (range === "month") {
    const start = addDays(today, -30);
    return {
      start,
      end: today,
      startStr: toKey(start),
      endStr: toKey(addDays(today, -1)),
    };
  }
  // custom
  const s = startOfDay(new Date(customStart || toKey(addDays(today, -7))));
  const eExclusive = addDays(
    startOfDay(new Date(customEnd || toKey(addDays(today, -1)))),
    1,
  );
  return {
    start: s,
    end: eExclusive,
    startStr: toKey(s),
    endStr: toKey(addDays(eExclusive, -1)),
  };
}

function rangeCacheKey(startStr: string, endStr: string) {
  return `${startStr}_${endStr}`;
}

function rangeLabel(startStr: string, endStr: string): string {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  if (startStr === endStr) {
    return s.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return `${s.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${e.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "unknown").toLowerCase();
  let colorCls = "bg-neutral-100 text-neutral-600 border-neutral-200";
  let dotCls = "bg-neutral-400";
  if (s === "active" || s === "captured" || s === "delivered" || s === "paid") {
    colorCls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    dotCls = "bg-emerald-500";
  } else if (
    s === "draft" ||
    s === "pending" ||
    s === "authorized" ||
    s === "processing"
  ) {
    colorCls = "bg-amber-50 text-amber-700 border-amber-200";
    dotCls = "bg-amber-500";
  } else if (s === "archived" || s === "failed" || s === "cancelled") {
    colorCls = "bg-red-50 text-red-700 border-red-200";
    dotCls = "bg-red-500";
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${colorCls}`}
    >
      <span className={`h-1 w-1 ${dotCls}`} />
      {status || "unknown"}
    </span>
  );
}

function PanelHeader({
  title,
  href,
  action = "View all",
  count,
}: {
  title: string;
  href?: string;
  action?: string;
  count?: number | null;
}) {
  return (
    <div className="px-3 py-2 border-b border-black/[0.06] flex items-center justify-between bg-neutral-50">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">
          {title}
        </h2>
        {typeof count === "number" && (
          <span className="inline-flex items-center justify-center bg-white border border-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 text-[11px] font-semibold text-[#ff5a1f] hover:text-[#e84912] transition-colors"
        >
          {action}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-8 text-center flex flex-col items-center justify-center">
      <div className="h-8 w-8 bg-neutral-100 flex items-center justify-center mb-2 border border-neutral-200">
        <AlertCircle className="h-4 w-4 text-neutral-400" />
      </div>
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      {hint && (
        <p className="text-xs text-neutral-500 mt-1 max-w-[250px]">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compute stats for ANY date range (called only if cache miss)
// ---------------------------------------------------------------------------
async function computeRangeStats(
  start: Date,
  end: Date,
  startStr: string,
  endStr: string,
  cacheKey: string,
): Promise<RangeStats> {
  const [ordersSnap, productsSnap, usersSnap, catSnap, collSnap, banSnap] =
    await Promise.all([
      getDocs(
        query(
          collection(db, "orders"),
          orderBy("createdAt", "desc"),
          limit(3000),
        ),
      ),
      getDocs(collection(db, "products")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "collections")),
      getDocs(collection(db, "banners")),
    ]);

  let revenue = 0;
  let orderCount = 0;
  let deliveredOrderCount = 0;
  let cancelledOrderCount = 0;
  const statusCounts: Record<string, number> = {};
  const paymentCounts: Record<string, number> = {};
  const productSales: Record<
    string,
    { name: string; quantity: number; revenuePaise: number }
  > = {};
  const customerSpend: Record<
    string,
    { email: string; orderCount: number; totalSpentPaise: number }
  > = {};
  const dailyMap: Record<string, { totalPaise: number; orderCount: number }> =
    {};

  // Pre-fill daily buckets
  const cursor = new Date(start);
  while (cursor < end) {
    dailyMap[toKey(cursor)] = { totalPaise: 0, orderCount: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }

  ordersSnap.forEach((d) => {
    const o = d.data();
    const createdAt: Date | null = o.createdAt?.toDate?.() ?? null;
    if (!createdAt) return;
    if (createdAt < start || createdAt >= end) return;

    const total = typeof o.totalPaise === "number" ? o.totalPaise : 0;
    const status = o.status || "pending";
    const paymentStatus = o.paymentStatus || "pending";
    const email = o.email || "";

    orderCount++;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    paymentCounts[paymentStatus] = (paymentCounts[paymentStatus] || 0) + 1;

    if (status === "delivered") {
      revenue += total;
      deliveredOrderCount++;
    }
    if (status === "cancelled") {
      cancelledOrderCount++;
    }

    const dayKey = toKey(createdAt);
    if (dailyMap[dayKey]) {
      dailyMap[dayKey].totalPaise += total;
      dailyMap[dayKey].orderCount += 1;
    }

    (Array.isArray(o.items) ? o.items : []).forEach((it: any) => {
      const name = it.name || "Unknown";
      const qty = it.quantity || 1;
      const rev = it.lineTotalPaise || (it.unitPricePaise || 0) * qty;
      if (!productSales[name])
        productSales[name] = { name, quantity: 0, revenuePaise: 0 };
      productSales[name].quantity += qty;
      productSales[name].revenuePaise += rev;
    });

    if (email && status !== "cancelled") {
      if (!customerSpend[email])
        customerSpend[email] = { email, orderCount: 0, totalSpentPaise: 0 };
      customerSpend[email].orderCount++;
      customerSpend[email].totalSpentPaise += total;
    }
  });

  const lowStockProducts: { id: string; name: string; stock: number }[] = [];
  productsSnap.forEach((d) => {
    const p = d.data();
    const stock = typeof p.inventoryValue === "number" ? p.inventoryValue : 0;
    if (stock < 20)
      lowStockProducts.push({ id: d.id, name: p.name || d.id, stock });
  });

  const stats: RangeStats = {
    cacheKey,
    startDate: startStr,
    endDate: endStr,
    revenue: {
      totalPaise: revenue,
      orderCount,
      deliveredOrderCount,
      cancelledOrderCount,
      avgOrderValuePaise:
        deliveredOrderCount > 0 ? Math.round(revenue / deliveredOrderCount) : 0,
    },
    statusCounts,
    paymentCounts,
    topProducts: Object.values(productSales)
      .sort((a, b) => b.revenuePaise - a.revenuePaise)
      .slice(0, 5),
    topCustomers: Object.values(customerSpend)
      .sort((a, b) => b.totalSpentPaise - a.totalSpentPaise)
      .slice(0, 5),
    dailyBreakdown: Object.entries(dailyMap).map(([day, v]) => ({ day, ...v })),
    lowStockProducts: lowStockProducts.slice(0, 10),
    counts: {
      products: productsSnap.size,
      orders: ordersSnap.size,
      users: usersSnap.size,
      categories: catSnap.size,
      collections: collSnap.size,
      banners: banSnap.size,
    },
    lastUpdated: new Date(),
  };

  await setDoc(doc(db, "dashboardStats", cacheKey), {
    ...stats,
    lastUpdated: serverTimestamp(),
  });

  return stats;
}

// ---------------------------------------------------------------------------
// Range preset label
// ---------------------------------------------------------------------------
const RANGE_PRESETS: { key: RangeKey; label: string; short: string }[] = [
  { key: "yesterday", label: "Yesterday", short: "24h" },
  { key: "week", label: "Last 7 Days", short: "7d" },
  { key: "month", label: "Last 30 Days", short: "30d" },
  { key: "custom", label: "Custom Range", short: "…" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminDashboardPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("yesterday");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [stats, setStats] = useState<RangeStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [banners, setBanners] = useState<BannerDoc[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [wasCached, setWasCached] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setComputing(false);
    setWasCached(null);

    try {
      const { start, end, startStr, endStr } = getRange(
        rangeKey,
        customStart,
        customEnd,
      );
      const cacheKey = rangeCacheKey(startStr, endStr);

      // 1. Try cache
      const statsRef = doc(db, "dashboardStats", cacheKey);
      const statsSnap = await getDoc(statsRef);

      let finalStats: RangeStats;

      if (statsSnap.exists()) {
        const s = statsSnap.data();
        finalStats = {
          ...s,
          lastUpdated: toDate(s.lastUpdated),
        } as RangeStats;
        setWasCached(true);
      } else {
        // 2. Cache miss → compute + save
        setComputing(true);
        finalStats = await computeRangeStats(
          start,
          end,
          startStr,
          endStr,
          cacheKey,
        );
        setComputing(false);
        setWasCached(false);
      }

      setStats(finalStats);

      // 3. Load small live lists
      const [ordersSnap, productsSnap, bannersSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(5),
          ),
        ),
        getDocs(
          query(
            collection(db, "products"),
            orderBy("createdAt", "desc"),
            limit(6),
          ),
        ),
        getDocs(
          query(
            collection(db, "banners"),
            orderBy("sortOrder", "asc"),
            limit(6),
          ),
        ),
      ]);

      setRecentOrders(
        ordersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            orderNumber: data.orderNumber || null,
            email: data.email || null,
            totalPaise:
              typeof data.totalPaise === "number" ? data.totalPaise : null,
            status: data.status || null,
            paymentStatus: data.paymentStatus || null,
            createdAt: toDate(data.createdAt),
          };
        }),
      );

      setRecentProducts(
        productsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "(untitled)",
            slug: data.slug || d.id,
            basePricePaise:
              typeof data.basePricePaise === "number" ? data.basePricePaise : 0,
            status: data.status || "unknown",
            image: Array.isArray(data.images) ? data.images[0] : null,
            inventoryValue:
              typeof data.inventoryValue === "number" ? data.inventoryValue : 0,
          };
        }),
      );

      setBanners(
        bannersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || "(untitled)",
            placement: data.placement || null,
            isActive: !!data.isActive,
            imageUrl: data.imageUrl || "",
          };
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load dashboard";
      setError(
        msg.includes("permission-denied")
          ? "Permission denied. Check admin Firestore rules."
          : msg,
      );
    } finally {
      setLoading(false);
      setComputing(false);
    }
  }, [rangeKey, customStart, customEnd]);

  useEffect(() => {
    // Skip until custom dates are both set
    if (rangeKey === "custom" && (!customStart || !customEnd)) return;
    load();
  }, [load, rangeKey, customStart, customEnd]);

  // Default custom dates (last 7 days ending yesterday)
  useEffect(() => {
    if (!customStart || !customEnd) {
      const today = startOfDay(new Date());
      setCustomStart(toKey(addDays(today, -7)));
      setCustomEnd(toKey(addDays(today, -1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateLabel = useMemo(() => {
    if (!stats) return "";
    return rangeLabel(stats.startDate, stats.endDate);
  }, [stats]);

  const maxDailySales = useMemo(
    () =>
      Math.max(...(stats?.dailyBreakdown.map((d) => d.totalPaise) ?? [1]), 1),
    [stats],
  );

  const maxStatusCount = useMemo(
    () => Math.max(...Object.values(stats?.statusCounts ?? {}), 1),
    [stats],
  );

  const hasAlerts =
    !!stats &&
    ((stats.statusCounts.pending || 0) > 0 ||
      stats.lowStockProducts.length > 0 ||
      (stats.paymentCounts.failed || 0) > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-3 border border-neutral-200">
        <div>
          <h1 className="text-lg font-black text-neutral-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs font-medium text-neutral-500 mt-0.5 flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 text-[#ff5a1f]" />
            <span className="font-semibold text-neutral-700">
              {dateLabel || "Loading…"}
            </span>
            {wasCached === true && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-bold uppercase tracking-wider">
                Cached
              </span>
            )}
            {wasCached === false && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 font-bold uppercase tracking-wider">
                Just Calculated
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 bg-[#ff5a1f] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#e84912] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Product
          </Link>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white border border-neutral-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 border border-neutral-300 bg-neutral-100/70 p-0.5">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => setRangeKey(preset.key)}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                  rangeKey === preset.key
                    ? "bg-white text-neutral-900 shadow-sm border border-neutral-200"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {rangeKey === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={customStart}
                max={customEnd || toKey(addDays(startOfDay(new Date()), -1))}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-xs text-neutral-500">→</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={toKey(addDays(startOfDay(new Date()), -1))}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-[10px] text-neutral-400">
                (latest: yesterday)
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {computing && (
        <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Computing {dateLabel}… this runs only once, then it's cached.
        </div>
      )}

      {loading && !computing && !stats ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
        </div>
      ) : stats ? (
        <>
          {/* Alerts */}
          {hasAlerts && (
            <div className="bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">
                  Needs attention
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-amber-800">
                  {(stats.statusCounts.pending || 0) > 0 && (
                    <Link
                      href="/admin/orders?status=pending"
                      className="hover:underline font-medium"
                    >
                      → {stats.statusCounts.pending} pending order
                      {stats.statusCounts.pending > 1 ? "s" : ""} in this period
                    </Link>
                  )}
                  {stats.lowStockProducts.length > 0 && (
                    <Link
                      href="/admin/products"
                      className="hover:underline font-medium"
                    >
                      → {stats.lowStockProducts.length} product
                      {stats.lowStockProducts.length > 1 ? "s" : ""} low on
                      stock
                    </Link>
                  )}
                  {(stats.paymentCounts.failed || 0) > 0 && (
                    <Link
                      href="/admin/payments?status=failed"
                      className="hover:underline font-medium"
                    >
                      → {stats.paymentCounts.failed} failed payment
                      {stats.paymentCounts.failed > 1 ? "s" : ""}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Revenue
                </div>
                <Banknote className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-neutral-900">
                {formatINR(stats.revenue.totalPaise)}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {stats.revenue.deliveredOrderCount} delivered
              </div>
            </div>
            <div className="bg-white border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Orders
                </div>
                <ShoppingBag className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-neutral-900">
                {stats.revenue.orderCount}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {stats.revenue.cancelledOrderCount} cancelled
              </div>
            </div>
            <div className="bg-white border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Avg. Order Value
                </div>
                <Star className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-neutral-900">
                {formatINR(stats.revenue.avgOrderValuePaise)}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                per delivered order
              </div>
            </div>
            <div className="bg-white border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Days Covered
                </div>
                <CalendarDays className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-neutral-900">
                {stats.dailyBreakdown.length}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {rangeKey === "yesterday" ? "single day" : "in this range"}
              </div>
            </div>
          </div>

          {/* Counts Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              {
                label: "Products",
                href: "/admin/products",
                icon: Package,
                value: stats.counts.products,
              },
              {
                label: "Orders",
                href: "/admin/orders",
                icon: ShoppingBag,
                value: stats.counts.orders,
              },
              {
                label: "Customers",
                href: "/admin/customers",
                icon: Users,
                value: stats.counts.users,
              },
              {
                label: "Categories",
                href: "/admin/categories",
                icon: Tags,
                value: stats.counts.categories,
              },
              {
                label: "Collections",
                href: "/admin/collections",
                icon: FolderOpen,
                value: stats.counts.collections,
              },
              {
                label: "Banners",
                href: "/admin/banners",
                icon: ImageIcon,
                value: stats.counts.banners,
              },
            ].map(({ label, href, icon: Icon, value }) => (
              <Link
                key={label}
                href={href}
                className="group bg-white border border-neutral-200 p-3 hover:border-[#ff5a1f]/40 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="grid h-7 w-7 place-items-center bg-neutral-50 text-neutral-400 group-hover:bg-[#ff5a1f]/10 group-hover:text-[#ff5a1f] transition-colors border border-neutral-200">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <ArrowUpRight className="h-3 w-3 text-neutral-300 group-hover:text-[#ff5a1f] transition-colors" />
                </div>
                <div>
                  <div className="text-xl font-black text-neutral-900 leading-none tracking-tight">
                    {value.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-500 mt-1 uppercase tracking-wider">
                    {label}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Daily Breakdown + Top Products */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200">
              <PanelHeader
                title={`Daily Breakdown (${stats.dailyBreakdown.length} day${stats.dailyBreakdown.length !== 1 ? "s" : ""})`}
              />
              <div className="p-4">
                {stats.dailyBreakdown.length === 0 ? (
                  <EmptyBlock title="No data in range" />
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {stats.dailyBreakdown.map((d) => {
                      const pct = (d.totalPaise / maxDailySales) * 100;
                      const date = new Date(d.day);
                      return (
                        <div
                          key={d.day}
                          className="flex-1 flex flex-col items-center gap-1 min-w-0"
                        >
                          <div
                            className="w-full bg-[#ff5a1f] hover:bg-[#e84912] transition-colors"
                            style={{
                              height: `${Math.max(pct, 2)}%`,
                              minHeight: "4px",
                            }}
                            title={`${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · ${formatINRFull(d.totalPaise)} · ${d.orderCount} orders`}
                          />
                          <div className="text-[8px] font-medium text-neutral-500 uppercase truncate">
                            {date.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-neutral-200 flex flex-col">
              <PanelHeader
                title="Top Selling Products"
                href="/admin/products"
                action="Manage"
              />
              <div className="flex-1">
                {stats.topProducts.length === 0 ? (
                  <EmptyBlock title="No sales in range" />
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {stats.topProducts.map((p, i) => (
                      <li
                        key={p.name}
                        className="px-3 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="grid h-6 w-6 place-items-center bg-neutral-100 text-[10px] font-black text-neutral-600 border border-neutral-200 shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-neutral-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {p.quantity} units
                          </div>
                        </div>
                        <div className="text-xs font-bold text-neutral-900 shrink-0">
                          {formatINR(p.revenuePaise)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Status Breakdown + Top Customers */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200">
              <PanelHeader title="Orders by Status" />
              <div className="p-4 space-y-2">
                {Object.keys(stats.statusCounts).length === 0 ? (
                  <EmptyBlock title="No orders in range" />
                ) : (
                  Object.entries(stats.statusCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2">
                        <div className="w-24 text-[10px] font-bold uppercase tracking-wider text-neutral-600 truncate">
                          {status}
                        </div>
                        <div className="flex-1 bg-neutral-100 h-4 relative">
                          <div
                            className="bg-[#ff5a1f] h-full"
                            style={{
                              width: `${(count / maxStatusCount) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="text-[11px] font-bold text-neutral-900 w-8 text-right">
                          {count}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="bg-white border border-neutral-200 flex flex-col">
              <PanelHeader
                title="Top Customers"
                href="/admin/customers"
                count={stats.counts.users}
              />
              {stats.topCustomers.length === 0 ? (
                <EmptyBlock title="No customer data in range" />
              ) : (
                <ul className="divide-y divide-neutral-100 flex-1">
                  {stats.topCustomers.map((c) => (
                    <li
                      key={c.email}
                      className="px-3 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="grid h-7 w-7 place-items-center bg-[#ff5a1f]/10 text-[#ff5a1f] text-[10px] font-bold border border-[#ff5a1f]/20 shrink-0">
                        {c.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-neutral-900 truncate">
                          {c.email}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {c.orderCount} order{c.orderCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-neutral-900 shrink-0">
                        {formatINR(c.totalSpentPaise)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Low Stock + Quick Actions */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 flex flex-col">
              <PanelHeader
                title="Low Stock Products"
                href="/admin/products"
                action="Restock"
                count={stats.lowStockProducts.length}
              />
              <div className="flex-1">
                {stats.lowStockProducts.length === 0 ? (
                  <EmptyBlock
                    title="All products well-stocked"
                    hint="Products below 20 units appear here."
                  />
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {stats.lowStockProducts.map((p) => (
                      <li
                        key={p.id}
                        className="px-3 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                      >
                        <div
                          className={`grid h-7 w-7 place-items-center border shrink-0 ${p.stock === 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-neutral-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {p.id}
                          </div>
                        </div>
                        <div
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${p.stock === 0 ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200"}`}
                        >
                          {p.stock === 0 ? "Out" : `${p.stock} left`}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="bg-white border border-neutral-200">
              <PanelHeader title="Quick Actions" />
              <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-neutral-100">
                {[
                  {
                    href: "/admin/products/new",
                    icon: Plus,
                    label: "Add Product",
                  },
                  {
                    href: "/admin/orders",
                    icon: ShoppingBag,
                    label: "View Orders",
                  },
                  { href: "/admin/shipments", icon: Truck, label: "Shipments" },
                  {
                    href: "/admin/payments",
                    icon: CreditCard,
                    label: "Payments",
                  },
                  { href: "/admin/banners", icon: ImageIcon, label: "Banners" },
                  { href: "/", icon: ArrowRight, label: "View Store" },
                ].map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center justify-center gap-1.5 p-4 hover:bg-neutral-50 transition-colors group"
                  >
                    <Icon className="h-5 w-5 text-neutral-400 group-hover:text-[#ff5a1f]" />
                    <span className="text-[11px] font-medium text-neutral-700">
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders + Recent Products */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 flex flex-col">
              <PanelHeader
                title="Latest Orders"
                href="/admin/orders"
                count={stats.counts.orders}
              />
              {recentOrders.length === 0 ? (
                <EmptyBlock title="No orders yet" />
              ) : (
                <ul className="divide-y divide-neutral-100 flex-1">
                  {recentOrders.map((o) => (
                    <li
                      key={o.id}
                      className="px-3 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="grid h-7 w-7 shrink-0 place-items-center bg-neutral-100 text-neutral-500 border border-neutral-200">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-neutral-900 truncate">
                          {o.orderNumber || o.id}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate flex items-center gap-1.5">
                          {o.email || "guest"}{" "}
                          <span className="h-1 w-1 bg-neutral-300" />{" "}
                          {timeAgo(o.createdAt)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="text-xs font-bold text-neutral-900">
                          {o.totalPaise !== null
                            ? formatINRFull(o.totalPaise)
                            : "—"}
                        </div>
                        <StatusBadge status={o.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-neutral-200">
              <PanelHeader
                title="Recent Products"
                href="/admin/products"
                count={stats.counts.products}
              />
              {recentProducts.length === 0 ? (
                <EmptyBlock title="No products yet" />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {recentProducts.map((p) => (
                    <li
                      key={p.id}
                      className="px-3 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                    >
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="h-8 w-8 object-cover bg-neutral-100 shrink-0 border border-neutral-200"
                        />
                      ) : (
                        <div className="h-8 w-8 bg-neutral-100 shrink-0 border border-neutral-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-neutral-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">
                          /{p.slug}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        {p.inventoryValue === 0 ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5">
                            Out
                          </span>
                        ) : p.inventoryValue < 20 ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
                            {p.inventoryValue} left
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5">
                            {p.inventoryValue}
                          </span>
                        )}
                        <div className="text-xs font-bold text-neutral-900">
                          {formatINR(p.basePricePaise)}
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Banners */}
          <div className="bg-white border border-neutral-200">
            <PanelHeader
              title="Active Banners"
              href="/admin/banners"
              count={stats.counts.banners}
            />
            <div className="p-2">
              {banners.length === 0 ? (
                <EmptyBlock title="No banners yet" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {banners.map((b) => (
                    <div
                      key={b.id}
                      className="group relative border border-neutral-200 overflow-hidden bg-neutral-50 aspect-video"
                    >
                      {b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-100" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                        <div className="text-[9px] font-bold text-white truncate">
                          {b.title}
                        </div>
                        <div className="text-[8px] text-white/70 truncate uppercase tracking-wider">
                          {b.placement || "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
