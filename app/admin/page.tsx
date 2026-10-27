// app/admin/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatKey =
  | "products"
  | "orders"
  | "users"
  | "categories"
  | "collections"
  | "banners";

type RecentProduct = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  status: string;
  image: string | null;
};

type RecentOrder = {
  id: string;
  orderNumber: string | null;
  email: string | null;
  totalPaise: number | null;
  status: string | null;
  createdAt: Date | null;
};

type RecentCustomer = {
  id: string;
  displayName: string | null;
  email: string | null;
  createdAt: Date | null;
};

type SimpleDoc = {
  id: string;
  name: string;
  status: string | null;
  image: string | null;
  sortOrder: number | null;
};

type BannerDoc = {
  id: string;
  title: string;
  placement: string | null;
  isActive: boolean;
  imageUrl: string;
};

type SectionDoc = {
  id: string;
  type: string;
  title: string | null;
  isActive: boolean;
  sortOrder: number | null;
};

const STATS: {
  key: StatKey;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "products",
    label: "Products",
    href: "/admin/products",
    icon: Package,
  },
  { key: "orders", label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { key: "users", label: "Customers", href: "/admin/customers", icon: Users },
  {
    key: "categories",
    label: "Categories",
    href: "/admin/categories",
    icon: Tags,
  },
  {
    key: "collections",
    label: "Collections",
    href: "/admin/collections",
    icon: FolderOpen,
  },
  { key: "banners", label: "Banners", href: "/admin/banners", icon: ImageIcon },
];

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
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
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

  let colorCls = "bg-neutral-100 text-neutral-600";
  let dotCls = "bg-neutral-400";

  if (s === "active" || s === "captured" || s === "delivered" || s === "paid") {
    colorCls = "bg-emerald-50 text-emerald-700";
    dotCls = "bg-emerald-500";
  } else if (s === "draft" || s === "pending" || s === "authorized") {
    colorCls = "bg-amber-50 text-amber-700";
    dotCls = "bg-amber-500";
  } else if (s === "archived" || s === "failed" || s === "cancelled") {
    colorCls = "bg-red-50 text-red-700";
    dotCls = "bg-red-500";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorCls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
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
    <div className="px-4 py-3 border-b border-black/[0.04] flex items-center justify-between bg-white/50">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-neutral-900 text-sm">{title}</h2>
        {typeof count === "number" && (
          <span className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 text-xs font-semibold text-[#ff5a1f] hover:text-[#e84912] transition-colors"
        >
          {action}
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-8 text-center flex flex-col items-center justify-center">
      <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center mb-2">
        <AlertCircle className="h-4 w-4 text-neutral-400" />
      </div>
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      {hint && (
        <p className="text-xs text-neutral-500 mt-1 max-w-[250px]">{hint}</p>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="p-3 flex items-center gap-3 animate-pulse border-b border-black/[0.04] last:border-0">
      <div className="h-10 w-10 rounded-lg bg-neutral-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/2 bg-neutral-100 rounded" />
        <div className="h-2.5 w-1/3 bg-neutral-100 rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<Record<StatKey, number | null>>({
    products: null,
    orders: null,
    users: null,
    categories: null,
    collections: null,
    banners: null,
  });
  const [products, setProducts] = useState<RecentProduct[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [customers, setCustomers] = useState<RecentCustomer[]>([]);
  const [categories, setCategories] = useState<SimpleDoc[]>([]);
  const [collections, setCollections] = useState<SimpleDoc[]>([]);
  const [banners, setBanners] = useState<BannerDoc[]>([]);
  const [sections, setSections] = useState<SectionDoc[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        countResults,
        productsSnap,
        ordersSnap,
        customersSnap,
        catsSnap,
        collsSnap,
        bannersSnap,
        sectionsSnap,
      ] = await Promise.all([
        Promise.all(
          STATS.map(({ key }) => getCountFromServer(collection(db, key))),
        ),
        getDocs(
          query(
            collection(db, "products"),
            orderBy("createdAt", "desc"),
            limit(5),
          ),
        ),
        getDocs(
          query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(5),
          ),
        ),
        getDocs(
          query(
            collection(db, "users"),
            orderBy("createdAt", "desc"),
            limit(5),
          ),
        ),
        getDocs(
          query(
            collection(db, "categories"),
            orderBy("sortOrder", "asc"),
            limit(8),
          ),
        ),
        getDocs(
          query(
            collection(db, "collections"),
            orderBy("sortOrder", "asc"),
            limit(8),
          ),
        ),
        getDocs(
          query(
            collection(db, "banners"),
            orderBy("sortOrder", "asc"),
            limit(6),
          ),
        ),
        getDocs(
          query(
            collection(db, "homepageSections"),
            orderBy("sortOrder", "asc"),
            limit(10),
          ),
        ),
      ]);

      const next = {} as Record<StatKey, number>;
      STATS.forEach((s, i) => {
        next[s.key] = countResults[i].data().count;
      });
      setCounts(next);

      setProducts(
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
          };
        }),
      );

      setOrders(
        ordersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            orderNumber: data.orderNumber || null,
            email: data.email || null,
            totalPaise:
              typeof data.totalPaise === "number" ? data.totalPaise : null,
            status: data.status || null,
            createdAt: toDate(data.createdAt),
          };
        }),
      );

      setCustomers(
        customersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            displayName: data.displayName || null,
            email: data.email || null,
            createdAt: toDate(data.createdAt),
          };
        }),
      );

      setCategories(
        catsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || d.id,
            status: data.status || null,
            image: data.image || null,
            sortOrder:
              typeof data.sortOrder === "number" ? data.sortOrder : null,
          };
        }),
      );

      setCollections(
        collsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || d.id,
            status: data.status || null,
            image: data.image || null,
            sortOrder:
              typeof data.sortOrder === "number" ? data.sortOrder : null,
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

      setSections(
        sectionsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type || "unknown",
            title: data.title || null,
            isActive: !!data.isActive,
            sortOrder:
              typeof data.sortOrder === "number" ? data.sortOrder : null,
          };
        }),
      );

      setLastUpdated(new Date());
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to load dashboard data";
      setError(
        msg.includes("permission-denied")
          ? "Permission denied. Deploy the Firestore admin rules so the dashboard can read data."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Header ---------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
        <div>
          <h1 className="text-xl font-black text-neutral-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs font-medium text-neutral-500 mt-0.5 flex items-center gap-2">
            Live snapshot of your store
            {lastUpdated && (
              <>
                <span className="h-1 w-1 rounded-full bg-neutral-300" />
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff5a1f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e84912] transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add Product
          </Link>
        </div>
      </div>

      {/* Error ----------------------------------------------------------- */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats ----------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STATS.map(({ key, label, href, icon: Icon }) => {
          const value = counts[key];
          return (
            <Link
              key={key}
              href={href}
              className="group bg-white rounded-xl border border-black/[0.06] p-3.5 hover:border-[#ff5a1f]/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-50 text-neutral-400 group-hover:bg-[#ff5a1f]/10 group-hover:text-[#ff5a1f] transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-neutral-300 group-hover:text-[#ff5a1f] transition-colors" />
              </div>
              <div>
                <div className="text-2xl font-black text-neutral-900 leading-none tracking-tight">
                  {value === null ? (
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-300" />
                  ) : (
                    value.toLocaleString()
                  )}
                </div>
                <div className="text-[11px] font-semibold text-neutral-500 mt-1 uppercase tracking-wider">
                  {label}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Grid (Orders + Customers) -------------------------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm flex flex-col">
          <PanelHeader
            title="Recent Orders"
            href="/admin/orders"
            count={counts.orders}
          />
          {loading ? (
            <div className="flex-1">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : orders.length === 0 ? (
            <EmptyBlock
              title="No orders yet"
              hint="Orders will appear here once customers checkout."
            />
          ) : (
            <ul className="divide-y divide-black/[0.04] flex-1">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="px-4 py-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {o.orderNumber || o.id}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate flex items-center gap-2">
                      {o.email || "guest"}{" "}
                      <span className="h-1 w-1 rounded-full bg-neutral-300" />{" "}
                      {timeAgo(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div className="text-sm font-bold text-neutral-900">
                      {o.totalPaise !== null ? formatINR(o.totalPaise) : "—"}
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Customers */}
        <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm flex flex-col">
          <PanelHeader
            title="New Customers"
            href="/admin/customers"
            count={counts.users}
          />
          {loading ? (
            <div className="flex-1">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : customers.length === 0 ? (
            <EmptyBlock title="No accounts yet" />
          ) : (
            <ul className="divide-y divide-black/[0.04] flex-1">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className="px-4 py-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f] text-xs font-bold">
                    {(c.displayName || c.email || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {c.displayName || "Anonymous"}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {c.email || c.id}
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-neutral-400 shrink-0">
                    {timeAgo(c.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Products + Categories/Collections ------------------------------ */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Products (Takes up 2 cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-black/[0.06] shadow-sm flex flex-col">
          <PanelHeader
            title="Recently Added Products"
            href="/admin/products"
            count={counts.products}
          />
          {loading ? (
            <div className="flex-1">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : products.length === 0 ? (
            <EmptyBlock
              title="No products yet"
              hint="Run `npm run seed` or add your first product."
            />
          ) : (
            <ul className="divide-y divide-black/[0.04] flex-1">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover bg-neutral-100 shrink-0 border border-black/5"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-neutral-100 shrink-0 border border-black/5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      /{p.slug}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-4">
                    <div className="text-sm font-bold text-neutral-900">
                      {formatINR(p.basePricePaise)}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Categories & Collections Stacked */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm flex-1 flex flex-col">
            <PanelHeader
              title="Categories"
              href="/admin/categories"
              count={counts.categories}
              action="Manage"
            />
            <div className="p-2 flex-1">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg bg-neutral-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <EmptyBlock title="No categories yet" />
              ) : (
                <ul className="grid grid-cols-2 gap-1.5">
                  {categories.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-col justify-center rounded-lg border border-black/[0.04] bg-neutral-50/50 px-2.5 py-1.5 hover:bg-white hover:border-[#ff5a1f]/30 transition-colors"
                    >
                      <div className="text-xs font-semibold text-neutral-900 truncate">
                        {c.name}
                      </div>
                      <div className="text-[9px] text-neutral-400 truncate mt-0.5">
                        {c.id}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm flex-1 flex flex-col">
            <PanelHeader
              title="Collections"
              href="/admin/collections"
              count={counts.collections}
              action="Manage"
            />
            <div className="p-2 flex-1">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg bg-neutral-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : collections.length === 0 ? (
                <EmptyBlock title="No collections yet" />
              ) : (
                <ul className="grid grid-cols-2 gap-1.5">
                  {collections.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-col justify-center rounded-lg border border-black/[0.04] bg-neutral-50/50 px-2.5 py-1.5 hover:bg-white hover:border-[#ff5a1f]/30 transition-colors"
                    >
                      <div className="text-xs font-semibold text-neutral-900 truncate">
                        {c.name}
                      </div>
                      <div className="text-[9px] text-neutral-400 truncate mt-0.5">
                        {c.id}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Storefront: Banners + Sections -------------------------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Banners */}
        <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm flex flex-col">
          <PanelHeader
            title="Active Banners"
            href="/admin/banners"
            count={counts.banners}
          />
          <div className="p-3 flex-1">
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-lg bg-neutral-100 animate-pulse"
                  />
                ))}
              </div>
            ) : banners.length === 0 ? (
              <EmptyBlock title="No banners yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="group relative rounded-lg border border-black/[0.06] overflow-hidden bg-neutral-50 aspect-video"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <div className="text-[10px] font-bold text-white truncate">
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

        {/* Homepage Sections */}
        <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm flex flex-col">
          <PanelHeader
            title="Homepage Layout"
            href="/admin/homepage"
            action="Manage"
          />
          <div className="flex-1">
            {loading ? (
              <SkeletonRow />
            ) : sections.length === 0 ? (
              <EmptyBlock title="No homepage sections yet" />
            ) : (
              <ul className="divide-y divide-black/[0.04]">
                {sections.map((s) => (
                  <li
                    key={s.id}
                    className="px-4 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="grid h-6 w-6 place-items-center rounded bg-neutral-100 text-[10px] font-black text-neutral-500 shrink-0">
                      {s.sortOrder ?? "—"}
                    </div>
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-900 truncate">
                        {s.title || s.id}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 border border-black/[0.06] px-1.5 py-0.5 rounded-sm">
                        {s.type}
                      </span>
                    </div>
                    <StatusBadge status={s.isActive ? "active" : "draft"} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
