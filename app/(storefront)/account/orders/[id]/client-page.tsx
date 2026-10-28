// app/(storefront)/account/orders/[id]/client-page.tsx
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
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomer } from "../../layout-client";

type OrderItem = {
  name?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity?: number;
  unitPricePaise?: number;
  lineTotalPaise?: number;
  imageUrl?: string;
};

type Address = {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type Order = {
  id: string;
  orderNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
  currency: string;
  items: OrderItem[];
  shippingAddress: Address | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  createdAt: Date | null;
};

type Shipment = {
  id: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

// Borderless, flat status pills
function Pill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "delivered" || s === "captured" || s === "confirmed"
      ? "bg-emerald-50 text-emerald-700"
      : s === "pending" || s === "processing" || s === "authorized"
        ? "bg-amber-50 text-amber-700"
        : s === "shipped" || s === "in_transit" || s === "out_for_delivery"
          ? "bg-blue-50 text-blue-700"
          : s === "cancelled" || s === "failed" || s === "returned"
            ? "bg-red-50 text-red-700"
            : "bg-neutral-100 text-neutral-600";
  return (
    <span
      className={`inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cls}`}
    >
      {value || "—"}
    </span>
  );
}

export default function MyOrderDetailPage({ orderId }: { orderId: string }) {
  const user = useCustomer();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "orders", orderId));
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const d = snap.data();
        if (d.userId !== user.uid) {
          setNotFound(true);
          return;
        }
        setOrder({
          id: snap.id,
          orderNumber: d.orderNumber || null,
          status: d.status || null,
          paymentStatus: d.paymentStatus || null,
          currency: d.currency || "INR",
          items: Array.isArray(d.items) ? d.items : [],
          shippingAddress: d.shippingAddress || null,
          subtotalPaise: d.subtotalPaise || 0,
          discountPaise: d.discountPaise || 0,
          shippingPaise: d.shippingPaise || 0,
          taxPaise: d.taxPaise || 0,
          totalPaise: d.totalPaise || 0,
          createdAt: toDate(d.createdAt),
        });

        try {
          const shipSnap = await getDocs(
            query(
              collection(db, "orders", orderId, "shipments"),
              orderBy("createdAt", "desc"),
            ),
          );
          setShipments(
            shipSnap.docs.map((sd) => {
              const s = sd.data();
              return {
                id: sd.id,
                carrier: s.carrier || "",
                trackingNumber: s.trackingNumber || "",
                trackingUrl: s.trackingUrl || null,
                status: s.status || "pending",
                shippedAt: toDate(s.shippedAt),
                deliveredAt: toDate(s.deliveredAt),
              };
            }),
          );
        } catch {
          /* non-fatal */
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, user.uid]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#ff5a1f]" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-8 w-8 text-neutral-400 mb-3" />
        <p className="text-sm font-medium text-neutral-700">Order not found.</p>
        <Link
          href="/account/orders"
          className="mt-4 rounded bg-neutral-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#ff5a1f] transition-colors"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center gap-3 flex-wrap border-b border-neutral-200 pb-3">
        <Link
          href="/account/orders"
          className="p-1.5 rounded bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-black italic uppercase tracking-tight text-neutral-900">
            Order #{order.orderNumber || order.id.slice(0, 8)}
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            {order.createdAt
              ? order.createdAt.toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill value={order.status} />
          <Pill value={order.paymentStatus} />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* LEFT COLUMN: Items + Shipments */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Items List */}
          <div className="bg-white rounded-lg p-4 sm:p-5">
            <h3 className="text-[11px] font-black uppercase tracking-wide text-neutral-900 mb-3">
              Items ({order.items.length})
            </h3>
            <ul className="divide-y divide-neutral-100">
              {order.items.map((it, i) => (
                <li
                  key={i}
                  className="py-3 first:pt-0 last:pb-0 flex items-center gap-3"
                >
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.imageUrl}
                      alt=""
                      className="h-14 w-14 aspect-square shrink-0 rounded object-cover bg-[#f5f5f5]"
                    />
                  ) : (
                    <div className="h-14 w-14 aspect-square shrink-0 rounded bg-[#f5f5f5] grid place-items-center">
                      <Package className="h-4 w-4 text-neutral-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="text-sm font-bold text-neutral-900 truncate">
                      {it.name || "(unnamed)"}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {it.size && <span>Size: {it.size}</span>}
                      {it.size && it.color && <span> · </span>}
                      {it.color && <span>{it.color}</span>}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-medium mt-0.5">
                      Qty: {it.quantity ?? 1}
                    </div>
                  </div>
                  <div className="text-right shrink-0 py-0.5">
                    <div className="text-sm font-bold text-neutral-950 tabular-nums">
                      {formatINR(it.lineTotalPaise || 0)}
                    </div>
                    <div className="text-[10px] text-neutral-400 tabular-nums">
                      {formatINR(it.unitPricePaise || 0)} ea.
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Shipments List */}
          {shipments.length > 0 && (
            <div className="bg-white rounded-lg p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4 text-[#ff5a1f]" />
                <h3 className="text-[11px] font-black uppercase tracking-wide text-neutral-900">
                  Shipments ({shipments.length})
                </h3>
              </div>
              <ul className="divide-y divide-neutral-100">
                {shipments.map((s) => (
                  <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-neutral-900">
                          {s.carrier || "—"}
                        </div>
                        <div className="font-mono text-xs text-neutral-500 mt-0.5">
                          {s.trackingNumber || "—"}
                        </div>
                        {s.trackingUrl && (
                          <a
                            href={s.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#ff5a1f] hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            Track shipment{" "}
                            <ArrowLeft className="h-3 w-3 rotate-180" />
                          </a>
                        )}
                      </div>
                      <Pill value={s.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-neutral-500 flex-wrap">
                      {s.shippedAt && (
                        <span>
                          Shipped{" "}
                          {s.shippedAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                      {s.deliveredAt && (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Delivered{" "}
                          {s.deliveredAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Address + Totals */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-24">
          {/* Totals Receipt */}
          <div className="bg-white rounded-lg p-4 sm:p-5">
            <h3 className="text-[11px] font-black uppercase tracking-wide text-neutral-900 mb-3">
              Order Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-medium">Subtotal</span>
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {formatINR(order.subtotalPaise)}
                </span>
              </div>
              {order.discountPaise > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 font-medium">Discount</span>
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    −{formatINR(order.discountPaise)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-medium">Shipping</span>
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {order.shippingPaise === 0 ? (
                    <span className="text-[#22c55e] font-bold uppercase text-[10px] tracking-wide">
                      Free
                    </span>
                  ) : (
                    formatINR(order.shippingPaise)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-medium">Tax (5%)</span>
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {formatINR(order.taxPaise)}
                </span>
              </div>
              <div className="flex justify-between items-end border-t border-neutral-100 pt-3 mt-1">
                <span className="text-sm font-black text-neutral-900 uppercase">
                  Total
                </span>
                <span className="text-lg font-black text-neutral-950 tabular-nums">
                  {formatINR(order.totalPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-[#ff5a1f]" />
              <h3 className="text-[11px] font-black uppercase tracking-wide text-neutral-900">
                Shipping Address
              </h3>
            </div>
            {order.shippingAddress ? (
              <address className="not-italic text-xs text-neutral-600 leading-relaxed">
                {order.shippingAddress.fullName && (
                  <div className="font-bold text-neutral-950 text-sm mb-1">
                    {order.shippingAddress.fullName}
                  </div>
                )}
                {order.shippingAddress.line1 && (
                  <div>{order.shippingAddress.line1}</div>
                )}
                {order.shippingAddress.line2 && (
                  <div>{order.shippingAddress.line2}</div>
                )}
                <div>
                  {[
                    order.shippingAddress.city,
                    order.shippingAddress.state,
                    order.shippingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                {order.shippingAddress.country && (
                  <div>{order.shippingAddress.country}</div>
                )}
                {order.shippingAddress.phone && (
                  <div className="mt-1.5 font-medium text-neutral-900">
                    Phone: {order.shippingAddress.phone}
                  </div>
                )}
              </address>
            ) : (
              <p className="text-xs text-neutral-500">Not provided.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
