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
import { useParams } from "next/navigation";
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

function Pill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "delivered" || s === "captured" || s === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "pending" || s === "processing" || s === "authorized"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : s === "shipped" || s === "in_transit" || s === "out_for_delivery"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : s === "cancelled" || s === "failed" || s === "returned"
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

export default function MyOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useCustomer();
  const orderId = params?.id;

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
        // Ownership check (defensive, in addition to rules)
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

        // Load shipments
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
          /* rules may not permit; non-fatal */
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, user.uid]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
        <AlertCircle className="h-10 w-10 text-neutral-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-neutral-700">
          Order not found.
        </p>
        <Link
          href="/account/orders"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/account/orders"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-2xl uppercase tracking-wide text-neutral-900">
            Order {order.orderNumber || order.id.slice(0, 8)}
          </h2>
          <p className="text-sm text-neutral-500">
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
        <div className="flex items-center gap-2">
          <Pill value={order.status} />
          <Pill value={order.paymentStatus} />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Items</h3>
        </div>
        <ul className="divide-y divide-neutral-100">
          {order.items.map((it, i) => (
            <li key={i} className="p-4 flex items-center gap-4">
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover bg-neutral-100 shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-neutral-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-900 truncate">
                  {it.name || "(unnamed)"}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {it.sku && <span className="font-mono">{it.sku}</span>}
                  {it.size && <> · Size {it.size}</>}
                  {it.color && <> · {it.color}</>}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Qty {it.quantity ?? 1}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-neutral-900">
                  {formatINR(it.lineTotalPaise || 0)}
                </div>
                <div className="text-xs text-neutral-500">
                  {formatINR(it.unitPricePaise || 0)} ea.
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Shipments */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
            <Truck className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-neutral-900">Shipments</h3>
          </div>
          <ul className="divide-y divide-neutral-100">
            {shipments.map((s) => (
              <li key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">
                      {s.carrier || "—"}
                    </div>
                    <div className="font-mono text-xs text-neutral-600 mt-0.5">
                      {s.trackingNumber || "—"}
                    </div>
                    {s.trackingUrl && (
                      <a
                        href={s.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-600 hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        Track shipment{" "}
                        <ArrowLeft className="h-3 w-3 rotate-180" />
                      </a>
                    )}
                  </div>
                  <Pill value={s.status} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500 flex-wrap">
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
                      <CheckCircle2 className="h-3 w-3" />
                      Delivered{" "}
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Address */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-neutral-900">Shipping address</h3>
          </div>
          {order.shippingAddress ? (
            <address className="not-italic text-sm text-neutral-700 leading-relaxed">
              {order.shippingAddress.fullName && (
                <div className="font-medium text-neutral-900">
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
                <div className="text-neutral-500 mt-1">
                  Phone: {order.shippingAddress.phone}
                </div>
              )}
            </address>
          ) : (
            <p className="text-sm text-neutral-500">Not provided.</p>
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-neutral-900">Order total</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatINR(order.subtotalPaise)} />
            {order.discountPaise > 0 && (
              <Row
                label="Discount"
                value={`−${formatINR(order.discountPaise)}`}
                tone="green"
              />
            )}
            <Row label="Shipping" value={formatINR(order.shippingPaise)} />
            <Row label="Tax" value={formatINR(order.taxPaise)} />
            <div className="border-t border-neutral-200 pt-2 mt-2">
              <Row label="Total" value={formatINR(order.totalPaise)} bold />
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "green";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd
        className={`text-right ${
          bold
            ? "font-bold text-neutral-900"
            : tone === "green"
              ? "text-emerald-600 font-medium"
              : "text-neutral-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
