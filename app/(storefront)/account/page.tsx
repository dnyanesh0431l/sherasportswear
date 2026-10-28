"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useCustomer } from "./layout-client";

type Profile = {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  marketingOptIn: boolean;
  createdAt: Date | null;
};

type OrderRow = {
  id: string;
  orderNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
  totalPaise: number;
  itemCount: number;
  firstItemName: string | null;
  firstItemImage: string | null;
  createdAt: Date | null;
};

type Stats = {
  orders: number;
  addresses: number;
  totalSpentPaise: number;
  deliveredPaise: number;
  pendingPaise: number;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

function shortINR(paise: number): string {
  const n = paise / 100;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

function StatusPill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "delivered" || s === "captured" || s === "confirmed"
      ? "bg-emerald-50 text-emerald-700"
      : s === "pending" || s === "processing" || s === "authorized"
        ? "bg-amber-50 text-amber-700"
        : s === "shipped"
          ? "bg-blue-50 text-blue-700"
          : s === "cancelled" || s === "failed"
            ? "bg-red-50 text-red-700"
            : "bg-neutral-100 text-neutral-600";
  return (
    <span
      className={`inline-flex text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}
    >
      {value || "—"}
    </span>
  );
}

export default function AccountOverviewPage() {
  const user = useCustomer();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    orders: 0,
    addresses: 0,
    totalSpentPaise: 0,
    deliveredPaise: 0,
    pendingPaise: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [profileSnap, ordersSnap, addressesSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDocs(
            query(collection(db, "orders"), where("userId", "==", user.uid))
          ).catch(() => null),
          getDocs(collection(db, "users", user.uid, "addresses")).catch(
            () => null
          ),
        ]);

        if (profileSnap.exists()) {
          const d = profileSnap.data();
          setProfile({
            displayName: d.displayName || null,
            email: d.email || null,
            phone: d.phone || null,
            marketingOptIn: !!d.marketingOptIn,
            createdAt: toDate(d.createdAt),
          });
        }

        if (ordersSnap) {
          const mapped: OrderRow[] = ordersSnap.docs.map((d) => {
            const o = d.data();
            const items: any[] = Array.isArray(o.items) ? o.items : [];
            const first = items[0];
            return {
              id: d.id,
              orderNumber: o.orderNumber || null,
              status: o.status || null,
              paymentStatus: o.paymentStatus || null,
              totalPaise:
                typeof o.totalPaise === "number" ? o.totalPaise : 0,
              itemCount: items.length,
              firstItemName: first?.name || null,
              firstItemImage: first?.imageUrl || null,
              createdAt: toDate(o.createdAt),
            };
          });

          mapped.sort((a, b) => {
            const at = a.createdAt?.getTime() ?? 0;
            const bt = b.createdAt?.getTime() ?? 0;
            return bt - at;
          });

          const captured = mapped.filter(
            (o) => o.paymentStatus === "captured"
          );
          const totalSpent = captured.reduce((s, o) => s + o.totalPaise, 0);
          const delivered = mapped
            .filter((o) => o.status === "delivered")
            .reduce((s, o) => s + o.totalPaise, 0);
          const pending = mapped
            .filter(
              (o) => o.status !== "delivered" && o.status !== "cancelled"
            )
            .reduce((s, o) => s + o.totalPaise, 0);

          setStats({
            orders: mapped.length,
            addresses: addressesSnap?.size ?? 0,
            totalSpentPaise: totalSpent,
            deliveredPaise: delivered,
            pendingPaise: pending,
          });
          setOrders(mapped);
        } else if (addressesSnap) {
          setStats((s) => ({ ...s, addresses: addressesSnap.size }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user.uid]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  const displayName =
    profile?.displayName || user.email?.split("@")[0] || "Athlete";
  const memberSince = profile?.createdAt
    ? profile.createdAt.toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-3">
      {/* Compact hero + stats combined */}
      <div className="rounded-xl bg-neutral-950 text-white overflow-hidden">
        <div className="px-4 py-4 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-orange-400">
                Welcome back
              </span>
              {memberSince && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-neutral-500">
                  · <Clock className="h-2.5 w-2.5" /> since {memberSince}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-xl sm:text-2xl uppercase tracking-wide leading-tight">
              {displayName}
            </h2>
            <span className="text-[11px] text-neutral-400 truncate">
              {profile?.email || user.email}
            </span>
          </div>
        </div>

        {/* Stats inside the hero — no separate cards */}
        <div className="grid grid-cols-4 divide-x divide-neutral-800 border-t border-neutral-800">
          <HeroStat label="Orders" value={stats.orders.toString()} />
          <HeroStat label="Spent" value={shortINR(stats.totalSpentPaise)} />
          <HeroStat label="Delivered" value={shortINR(stats.deliveredPaise)} />
          <HeroStat label="Pending" value={shortINR(stats.pendingPaise)} />
        </div>
      </div>

      {/* Scrollable order history */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-orange-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Order history
            </h3>
            {orders.length > 0 && (
              <span className="text-[10px] text-neutral-500">
                ({orders.length})
              </span>
            )}
          </div>
          {orders.length > 0 && (
            <Link
              href="/account/orders"
              className="text-[11px] font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <ShoppingBag className="h-7 w-7 text-neutral-300 mx-auto" />
            <p className="mt-2 text-sm font-medium text-neutral-800">
              No orders yet
            </p>
            <Link
              href="/products"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Start shopping <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y divide-neutral-100 scrollbar-thin">
            {orders.slice(0, 10).map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.id}`}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors"
                >
                  {o.firstItemImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.firstItemImage}
                      alt=""
                      className="h-9 w-9 rounded-md object-cover bg-neutral-100 shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-neutral-100 shrink-0 flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-neutral-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] text-neutral-500">
                        {o.orderNumber || o.id.slice(0, 8)}
                      </span>
                      <StatusPill value={o.status} />
                    </div>
                    <div className="text-xs font-medium text-neutral-900 truncate mt-0.5">
                      {o.firstItemName || "Order"}
                      {o.itemCount > 1 && (
                        <span className="text-neutral-500 font-normal">
                          {" "}
                          +{o.itemCount - 1}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-neutral-900">
                      {formatINR(o.totalPaise)}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {o.createdAt
                        ? o.createdAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Two-column: quick links + profile details */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Quick links — compact rows */}
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Quick links
            </h3>
          </div>
          <Link
            href="/account/orders"
            className="group flex items-center gap-2.5 px-4 py-2.5 hover:bg-neutral-50 transition-colors border-b border-neutral-100"
          >
            <Package className="h-4 w-4 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-neutral-900">
                My orders
              </div>
              <div className="text-[10px] text-neutral-500">
                Track shipments, reorder
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-neutral-400 shrink-0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
          <Link
            href="/account/addresses"
            className="group flex items-center gap-2.5 px-4 py-2.5 hover:bg-neutral-50 transition-colors"
          >
            <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-neutral-900">
                Addresses
              </div>
              <div className="text-[10px] text-neutral-500">
                {stats.addresses} saved address
                {stats.addresses === 1 ? "" : "es"}
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-neutral-400 shrink-0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* Profile details — compact, scrollable */}
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center gap-1.5">
            <UserCircle2 className="h-3.5 w-3.5 text-orange-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Profile
            </h3>
          </div>
          <dl className="max-h-40 overflow-y-auto scrollbar-thin">
            <CompactRow
              icon={UserCircle2}
              label="Name"
              value={profile?.displayName || "—"}
            />
            <CompactRow
              icon={Mail}
              label="Email"
              value={profile?.email || user.email || "—"}
            />
            <CompactRow
              icon={Phone}
              label="Phone"
              value={profile?.phone || "—"}
            />
            <CompactRow
              icon={Mail}
              label="Marketing"
              value={profile?.marketingOptIn ? "On" : "Off"}
              tone={profile?.marketingOptIn ? "good" : "muted"}
            />
          </dl>
        </div>
      </div>

      <p className="text-[10px] text-neutral-400 text-center">
        Need help?{" "}
        <a
          href="mailto:support@sherasportswear.com"
          className="text-orange-600 hover:text-orange-700 transition-colors"
        >
          support@sherasportswear.com
        </a>
      </p>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2.5 sm:px-3 sm:py-3 text-center">
      <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm sm:text-base font-bold text-white truncate">
        {value}
      </div>
    </div>
  );
}

function CompactRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "good" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-neutral-50 last:border-b-0">
      <dt className="flex items-center gap-1.5 text-[11px] text-neutral-500 shrink-0">
        <Icon className="h-3 w-3 text-neutral-400" />
        {label}
      </dt>
      <dd
        className={`text-xs text-right truncate ${
          tone === "good"
            ? "text-emerald-600 font-medium"
            : tone === "muted"
              ? "text-neutral-500"
              : "text-neutral-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}