"use client";

import { db } from "@/lib/firebase/client";
import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Save,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Shipment = {
  id: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type OrderSummary = {
  orderNumber: string | null;
  email: string | null;
  totalPaise: number;
  status: string | null;
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

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

const inputCls =
  "w-full border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow";

function Pill({ value }: { value: string }) {
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

export default function ShipmentDetailPage() {
  const params = useParams<{ orderId: string; shipmentId: string }>();
  const orderId = params?.orderId;
  const shipmentId = params?.shipmentId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);

  const [status, setStatus] = useState<string>("pending");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !shipmentId) return;
    setLoading(true);
    try {
      const [shipSnap, orderSnap] = await Promise.all([
        getDoc(doc(db, "orders", orderId, "shipments", shipmentId)),
        getDoc(doc(db, "orders", orderId)),
      ]);

      if (!shipSnap.exists()) {
        setNotFound(true);
        return;
      }

      const s = shipSnap.data();
      const mapped: Shipment = {
        id: shipSnap.id,
        carrier: s.carrier || "",
        trackingNumber: s.trackingNumber || "",
        trackingUrl: s.trackingUrl || null,
        status: s.status || "pending",
        shippedAt: toDate(s.shippedAt),
        deliveredAt: toDate(s.deliveredAt),
        createdAt: toDate(s.createdAt),
        updatedAt: toDate(s.updatedAt),
      };
      setShipment(mapped);
      setStatus(mapped.status);
      setCarrier(mapped.carrier);
      setTrackingNumber(mapped.trackingNumber);
      setTrackingUrl(mapped.trackingUrl || "");

      if (orderSnap.exists()) {
        const o = orderSnap.data();
        setOrder({
          orderNumber: o.orderNumber || null,
          email: o.email || null,
          totalPaise: typeof o.totalPaise === "number" ? o.totalPaise : 0,
          status: o.status || null,
        });
      }
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to load shipment");
    } finally {
      setLoading(false);
    }
  }, [orderId, shipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !shipmentId) return;

    if (!carrier.trim() || !trackingNumber.trim()) {
      toast.error("Carrier and tracking number are required");
      return;
    }
    if (trackingUrl.trim()) {
      try {
        const u = new URL(trackingUrl.trim());
        if (!["http:", "https:"].includes(u.protocol)) {
          toast.error("Tracking URL must use http or https");
          return;
        }
      } catch {
        toast.error("Tracking URL is not a valid URL");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingUrl.trim() || null,
        status,
        updatedAt: serverTimestamp(),
      };

      if (
        (status === "in_transit" || status === "out_for_delivery") &&
        !shipment?.shippedAt
      ) {
        payload.shippedAt = serverTimestamp();
      }
      if (status === "delivered") {
        if (!shipment?.shippedAt) payload.shippedAt = serverTimestamp();
        if (!shipment?.deliveredAt) payload.deliveredAt = serverTimestamp();
      }

      await updateDoc(
        doc(db, "orders", orderId, "shipments", shipmentId),
        payload,
      );

      toast.success("Shipment updated");
      await load();

      if (status === "delivered") {
        try {
          await updateDoc(doc(db, "orders", orderId), {
            status: "delivered",
            fulfillmentStatus: "fulfilled",
            updatedAt: serverTimestamp(),
          });
          toast.success("Order marked as delivered");
        } catch {
          // non-fatal
        }
      }
    } catch (e) {
      toast.error((e as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  if (notFound || !shipment) {
    return (
      <div className="bg-white border border-neutral-200 p-10 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="h-10 w-10 text-neutral-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-neutral-700">
          Shipment not found.
        </p>
        <Link
          href="/admin/shipments"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to shipments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Shipment {shipment.trackingNumber || shipment.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-neutral-500">
              Order{" "}
              <Link
                href={`/admin/orders/${orderId}`}
                className="font-mono text-orange-600 hover:underline"
              >
                {order?.orderNumber || orderId?.slice(0, 12)}
              </Link>
              {order?.email && <> · {order.email}</>}
            </p>
          </div>
        </div>
        <Pill value={shipment.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Edit Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-2 bg-white border border-neutral-200 p-4 space-y-3"
        >
          <div className="flex items-center gap-2 border-b pb-2">
            <Truck className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-sm text-neutral-900">
              Shipment Details
            </h2>
          </div>

          <Field label="Carrier *">
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Tracking Number *">
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
              className={`${inputCls} font-mono`}
            />
          </Field>

          <Field label="Tracking URL">
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
              >
                Preview <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Field>

          <Field
            label="Status"
            hint='Setting "delivered" will auto-mark the parent order as delivered.'
          >
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputCls}
            >
              {SHIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/admin/shipments"
              className="border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>

        {/* RIGHT: Timeline & Order Info */}
        <div className="space-y-4">
          {/* Timeline */}
          <div className="bg-white border border-neutral-200 p-4">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2 mb-3">
              Timeline
            </h2>
            <dl className="space-y-2.5 text-sm">
              <TimelineRow
                label="Created"
                value={
                  shipment.createdAt
                    ? shipment.createdAt.toLocaleString("en-IN")
                    : "—"
                }
              />
              <TimelineRow
                label="Shipped"
                value={
                  shipment.shippedAt
                    ? shipment.shippedAt.toLocaleString("en-IN")
                    : "—"
                }
                done={!!shipment.shippedAt}
              />
              <TimelineRow
                label="Delivered"
                value={
                  shipment.deliveredAt
                    ? shipment.deliveredAt.toLocaleString("en-IN")
                    : "—"
                }
                done={!!shipment.deliveredAt}
              />
              <TimelineRow
                label="Last updated"
                value={
                  shipment.updatedAt
                    ? shipment.updatedAt.toLocaleString("en-IN")
                    : "—"
                }
              />
            </dl>
          </div>

          {/* Order Info */}
          {order && (
            <div className="bg-white border border-neutral-200 p-4">
              <div className="flex items-center gap-2 border-b pb-2 mb-3">
                <Package className="h-4 w-4 text-orange-500" />
                <h2 className="font-semibold text-sm text-neutral-900">
                  Order Info
                </h2>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Order #</dt>
                  <dd className="font-mono text-xs text-neutral-900 truncate max-w-[140px]">
                    {order.orderNumber || orderId?.slice(0, 12)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Customer</dt>
                  <dd className="text-xs text-neutral-900 truncate max-w-[140px]">
                    {order.email || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Total</dt>
                  <dd className="text-sm font-semibold text-neutral-900">
                    {formatINR(order.totalPaise)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Order status</dt>
                  <dd>
                    <span className="text-[10px] uppercase tracking-wide font-medium text-neutral-700 border border-neutral-200 bg-neutral-100 px-1.5 py-0.5">
                      {order.status || "—"}
                    </span>
                  </dd>
                </div>
              </dl>
              <Link
                href={`/admin/orders/${orderId}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
              >
                View full order <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-neutral-500 flex items-center gap-1.5 shrink-0">
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        {label}
      </dt>
      <dd className="text-xs text-neutral-700 text-right">{value}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}
