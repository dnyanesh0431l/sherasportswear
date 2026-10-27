"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Profile = {
  uid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  photoURL: string | null;
  marketingOptIn: boolean;
  defaultAddressId: string | null;
  createdAt: Date | null;
};

type Address = {
  id: string;
  fullName: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  label: string | null;
  isDefault: boolean;
};

type OrderSummary = {
  id: string;
  orderNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
  totalPaise: number | null;
  itemCount: number;
  createdAt: Date | null;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

const formatINR = (paise: number | null) =>
  paise === null ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

function Pill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "delivered" || s === "captured" || s === "confirmed"
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
      className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}
    >
      {value || "—"}
    </span>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const uid = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [profileSnap, addressesSnap, ordersSnap] = await Promise.all([
        getDoc(doc(db, "users", uid)),
        getDocs(
          query(
            collection(db, "users", uid, "addresses"),
            orderBy("createdAt", "desc")
          )
        ).catch(() => null),
        getDocs(
          query(collection(db, "orders"), where("userId", "==", uid))
        ).catch(() => null),
      ]);

      if (!profileSnap.exists()) {
        setNotFound(true);
        return;
      }
      const p = profileSnap.data();
      setProfile({
        uid: profileSnap.id,
        displayName: p.displayName || null,
        email: p.email || null,
        phone: p.phone || null,
        photoURL: p.photoURL || null,
        marketingOptIn: !!p.marketingOptIn,
        defaultAddressId: p.defaultAddressId || null,
        createdAt: toDate(p.createdAt),
      });

      if (addressesSnap) {
        setAddresses(
          addressesSnap.docs.map((d) => {
            const a = d.data();
            return {
              id: d.id,
              fullName: a.fullName || null,
              phone: a.phone || null,
              line1: a.line1 || null,
              line2: a.line2 || null,
              city: a.city || null,
              state: a.state || null,
              postalCode: a.postalCode || null,
              country: a.country || null,
              label: a.label || null,
              isDefault: !!a.isDefault,
            };
          })
        );
      }

      if (ordersSnap) {
        const mapped = ordersSnap.docs.map((d) => {
          const o = d.data();
          return {
            id: d.id,
            orderNumber: o.orderNumber || null,
            status: o.status || null,
            paymentStatus: o.paymentStatus || null,
            totalPaise:
              typeof o.totalPaise === "number" ? o.totalPaise : null,
            itemCount: Array.isArray(o.items) ? o.items.length : 0,
            createdAt: toDate(o.createdAt),
          };
        });
        mapped.sort((a, b) => {
          const at = a.createdAt?.getTime() ?? 0;
          const bt = b.createdAt?.getTime() ?? 0;
          return bt - at;
        });
        setOrders(mapped);
      } else {
        setOrdersError(
          "Orders require an index on `orders` (userId asc, createdAt desc). Check the browser console for a link to create it."
        );
      }
    } catch (e) {
      const msg = (e as Error)?.message || "Failed to load customer";
      if (msg.includes("permission-denied")) {
        setNotFound(false);
        setOrdersError(
          "Permission denied. Ensure Firestore rules allow admin reads on users and orders."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
        <AlertCircle className="h-10 w-10 text-neutral-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-neutral-700">
          Customer not found.
        </p>
        <Link
          href="/admin/customers"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  const totalSpent = orders
    .filter((o) => o.paymentStatus === "captured" && o.totalPaise)
    .reduce((sum, o) => sum + (o.totalPaise ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/customers"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {profile.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoURL}
              alt=""
              className="h-12 w-12 rounded-full object-cover bg-neutral-100 shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-lg font-semibold shrink-0">
              {(profile.displayName || profile.email || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-neutral-900 truncate">
              {profile.displayName || "(no name)"}
            </h1>
            <p className="text-xs text-neutral-500 font-mono truncate">
              {profile.uid}
            </p>
          </div>
        </div>
        {profile.marketingOptIn ? (
          <span className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            Marketing: opted in
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wide bg-neutral-100 text-neutral-500 border border-neutral-200 px-2 py-0.5 rounded-full">
            Marketing: no
          </span>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Orders
          </div>
          <div className="mt-2 text-xl font-bold text-neutral-900">
            {orders.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Total spent (captured)
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            {formatINR(totalSpent)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Addresses
          </div>
          <div className="mt-2 text-xl font-bold text-neutral-900">
            {addresses.length}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT: profile + addresses */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="font-semibold text-neutral-900 mb-3">Contact</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Email
                </dt>
                <dd className="flex items-center gap-1.5 text-neutral-900 break-all">
                  <Mail className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  {profile.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Phone
                </dt>
                <dd className="flex items-center gap-1.5 text-neutral-900">
                  <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  {profile.phone || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500 mb-0.5">
                  Joined
                </dt>
                <dd className="text-neutral-900">
                  {profile.createdAt
                    ? profile.createdAt.toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Addresses */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-500" />
                <h2 className="font-semibold text-neutral-900">Addresses</h2>
              </div>
              <span className="text-xs text-neutral-500">
                {addresses.length}
              </span>
            </div>
            {addresses.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs text-neutral-500">
                  No saved addresses.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {addresses.map((a) => (
                  <li key={a.id} className="p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-neutral-900 truncate">
                            {a.fullName || "—"}
                          </span>
                          {a.label && (
                            <span className="text-[10px] uppercase tracking-wide bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                              {a.label}
                            </span>
                          )}
                          {a.isDefault && (
                            <span className="text-[10px] uppercase tracking-wide bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-600 mt-1 leading-relaxed">
                          {[a.line1, a.line2].filter(Boolean).join(", ")}
                          <br />
                          {[a.city, a.state, a.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                          <br />
                          {a.country}
                        </div>
                        {a.phone && (
                          <div className="text-xs text-neutral-500 mt-1">
                            {a.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: orders */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-orange-500" />
                <h2 className="font-semibold text-neutral-900">
                  Order history
                </h2>
              </div>
              <span className="text-xs text-neutral-500">{orders.length}</span>
            </div>

            {ordersError && (
              <div className="p-4 border-b border-neutral-200">
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{ordersError}</span>
                </div>
              </div>
            )}

            {orders.length === 0 ? (
              <div className="p-10 text-center">
                <Package className="h-10 w-10 text-neutral-300 mx-auto" />
                <p className="mt-3 text-sm text-neutral-500">
                  No orders from this customer yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {orders.map((o) => (
                  <li key={o.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-mono text-xs font-semibold text-orange-600 hover:underline"
                          >
                            {o.orderNumber || o.id.slice(0, 10)}
                          </Link>
                          <Pill value={o.status} />
                          <Pill value={o.paymentStatus} />
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                          {o.createdAt
                            ? o.createdAt.toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-neutral-900">
                          {formatINR(o.totalPaise)}
                        </div>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-orange-600 hover:underline mt-1"
                        >
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </div>
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