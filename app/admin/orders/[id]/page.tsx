"use client";

import { db } from "@/lib/firebase/client";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Plus,
  Save,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderItem = {
  productId?: string;
  variantId?: string;
  sku?: string;
  name?: string;
  size?: string;
  color?: string;
  quantity?: number;
  unitPricePaise?: number;
  mrpPaise?: number;
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
  email: string | null;
  phone: string | null;
  userId: string | null;
  status: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  currency: string;
  items: OrderItem[];
  shippingAddress: Address | null;
  billingAddress: Address | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  paymentId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
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

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "failed",
  "cancelled",
] as const;

const FULFILLMENT_STATUSES = [
  "unfulfilled",
  "partial",
  "fulfilled",
] as const;

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

const formatINR = (paise: number | undefined | null) =>
  typeof paise === "number"
    ? `₹${(paise / 100).toLocaleString("en-IN")}`
    : "—";

function Pill({ value }: { value: string | null }) {
  const s = (value || "unknown").toLowerCase();
  const cls =
    s === "delivered" || s === "captured" || s === "paid" || s === "confirmed"
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

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipLoading, setShipLoading] = useState(true);

  const [newCarrier, setNewCarrier] = useState("");
  const [newTracking, setNewTracking] = useState("");
  const [newTrackingUrl, setNewTrackingUrl] = useState("");
  const [newShipStatus, setNewShipStatus] = useState<
    (typeof SHIPMENT_STATUSES)[number]
  >("pending");
  const [addingShipment, setAddingShipment] = useState(false);
  const [deletingShipmentId, setDeletingShipmentId] = useState<string | null>(
    null
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "orders", id));
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      const d = snap.data();
      const items: OrderItem[] = Array.isArray(d.items) ? d.items : [];
      const mapped: Order = {
        id: snap.id,
        orderNumber: d.orderNumber || null,
        email: d.email || null,
        phone: d.phone || null,
        userId: d.userId || null,
        status: d.status || "pending",
        paymentStatus: d.paymentStatus || "pending",
        fulfillmentStatus: d.fulfillmentStatus || "unfulfilled",
        currency: d.currency || "INR",
        items,
        shippingAddress: d.shippingAddress || null,
        billingAddress: d.billingAddress || null,
        subtotalPaise: d.subtotalPaise || 0,
        discountPaise: d.discountPaise || 0,
        shippingPaise: d.shippingPaise || 0,
        taxPaise: d.taxPaise || 0,
        totalPaise: d.totalPaise || 0,
        paymentId: d.paymentId || null,
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
      };
      setOrder(mapped);
      setStatus(mapped.status || "pending");
      setPaymentStatus(mapped.paymentStatus || "pending");
      setFulfillmentStatus(mapped.fulfillmentStatus || "unfulfilled");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadShipments = useCallback(async () => {
    if (!id) return;
    setShipLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "orders", id, "shipments"),
          orderBy("createdAt", "desc")
        )
      );
      setShipments(
        snap.docs.map((d) => {
          const s = d.data();
          return {
            id: d.id,
            carrier: s.carrier || "",
            trackingNumber: s.trackingNumber || "",
            trackingUrl: s.trackingUrl || null,
            status: s.status || "pending",
            shippedAt: toDate(s.shippedAt),
            deliveredAt: toDate(s.deliveredAt),
          };
        })
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to load shipments");
    } finally {
      setShipLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadShipments();
  }, [load, loadShipments]);

  const saveMeta = async () => {
    if (!id) return;
    setSavingMeta(true);
    try {
      await updateDoc(doc(db, "orders", id), {
        status,
        paymentStatus,
        fulfillmentStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success("Order updated");
    } catch (e) {
      toast.error((e as Error)?.message || "Update failed");
    } finally {
      setSavingMeta(false);
    }
  };

  const addShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!newCarrier.trim() || !newTracking.trim()) {
      toast.error("Carrier and tracking number are required");
      return;
    }
    if (newTrackingUrl.trim()) {
      try {
        const u = new URL(newTrackingUrl.trim());
        if (!["http:", "https:"].includes(u.protocol)) {
          toast.error("Tracking URL must use http or https");
          return;
        }
      } catch {
        toast.error("Tracking URL is not a valid URL");
        return;
      }
    }
    setAddingShipment(true);
    try {
      const payload: Record<string, any> = {
        carrier: newCarrier.trim(),
        trackingNumber: newTracking.trim(),
        trackingUrl: newTrackingUrl.trim() || null,
        status: newShipStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (newShipStatus === "in_transit" || newShipStatus === "out_for_delivery") {
        payload.shippedAt = serverTimestamp();
      }
      if (newShipStatus === "delivered") {
        payload.shippedAt = serverTimestamp();
        payload.deliveredAt = serverTimestamp();
      }
      await addDoc(collection(db, "orders", id, "shipments"), payload);

      // Optionally auto-advance order status
      if (
        order &&
        (order.status === "pending" ||
          order.status === "confirmed" ||
          order.status === "processing") &&
        newShipStatus !== "pending"
      ) {
        await updateDoc(doc(db, "orders", id), {
          status: "shipped",
          fulfillmentStatus: newShipStatus === "delivered" ? "fulfilled" : "partial",
          updatedAt: serverTimestamp(),
        });
        setStatus("shipped");
        setFulfillmentStatus(newShipStatus === "delivered" ? "fulfilled" : "partial");
      }

      toast.success("Shipment added");
      setNewCarrier("");
      setNewTracking("");
      setNewTrackingUrl("");
      setNewShipStatus("pending");
      await loadShipments();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to add shipment");
    } finally {
      setAddingShipment(false);
    }
  };

  const deleteShipment = async (s: Shipment) => {
    if (!id) return;
    if (!confirm(`Delete shipment ${s.trackingNumber || s.id}?`)) return;
    setDeletingShipmentId(s.id);
    try {
      await deleteDoc(doc(db, "orders", id, "shipments", s.id));
      toast.success("Shipment deleted");
      setShipments((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Delete failed");
    } finally {
      setDeletingShipmentId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-10 text-center">
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
          href="/admin/orders"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const metaDirty =
    status !== (order.status || "") ||
    paymentStatus !== (order.paymentStatus || "") ||
    fulfillmentStatus !== (order.fulfillmentStatus || "");

  return (
    <div className="space-y-6">
      {/* Header ---------------------------------------------------------- */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/orders"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900 font-mono">
            {order.orderNumber || order.id.slice(0, 12)}
          </h1>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT: Items + totals ---------------------------------------- */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">Items</h2>
              <span className="text-xs text-neutral-500">
                {order.items.length} line item
                {order.items.length === 1 ? "" : "s"}
              </span>
            </div>
            {order.items.length === 0 ? (
              <div className="p-10 text-center">
                <Package className="h-10 w-10 text-neutral-300 mx-auto" />
                <p className="mt-3 text-sm text-neutral-500">
                  No items in this order.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {order.items.map((item, idx) => (
                  <li key={idx} className="p-4 flex items-center gap-4">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover bg-neutral-100 shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-neutral-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-900 truncate">
                        {item.name || "(unnamed)"}
                      </div>
                      <div className="text-xs text-neutral-500 truncate">
                        {item.sku && <span className="font-mono">{item.sku}</span>}
                        {item.size && <> · Size {item.size}</>}
                        {item.color && <> · {item.color}</>}
                      </div>
                      {item.variantId && (
                        <div className="text-[11px] text-neutral-400 truncate">
                          variant: {item.variantId}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-neutral-900">
                        {formatINR(item.lineTotalPaise)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {formatINR(item.unitPricePaise)} × {item.quantity ?? 1}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="font-semibold text-neutral-900 mb-4">Totals</h2>
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
                <Row
                  label="Total"
                  value={formatINR(order.totalPaise)}
                  bold
                />
              </div>
            </dl>
            <p className="text-[11px] text-neutral-400 mt-3">
              Amounts are immutable order snapshots — recalculated at checkout,
              stored server-side. Editing here is intentionally disabled.
            </p>
          </div>

          {/* Addresses */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-neutral-900">
                  Shipping address
                </h3>
              </div>
              <AddressBlock address={order.shippingAddress} />
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-neutral-900">
                  Billing address
                </h3>
              </div>
              <AddressBlock address={order.billingAddress} />
            </div>
          </div>
        </div>

        {/* RIGHT: Status, payment, shipments --------------------------- */}
        <div className="space-y-6">
          {/* Status controls */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="font-semibold text-neutral-900 mb-4">
              Status controls
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-neutral-600 mb-1.5">
                  Order status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputCls}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-neutral-600 mb-1.5">
                  Payment status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className={inputCls}
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Don't mark online payments as captured unless the provider
                  confirms it via webhook.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-neutral-600 mb-1.5">
                  Fulfillment status
                </label>
                <select
                  value={fulfillmentStatus}
                  onChange={(e) => setFulfillmentStatus(e.target.value)}
                  className={inputCls}
                >
                  {FULFILLMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={saveMeta}
                disabled={savingMeta || !metaDirty}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {savingMeta ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingMeta ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          {/* Customer info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="font-semibold text-neutral-900 mb-3">Customer</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Email" value={order.email || "—"} />
              <Row label="Phone" value={order.phone || "—"} />
              <Row
                label="User ID"
                value={
                  order.userId ? (
                    <Link
                      href={`/admin/customers?uid=${order.userId}`}
                      className="text-orange-600 hover:underline font-mono text-xs"
                    >
                      {order.userId.slice(0, 12)}…
                    </Link>
                  ) : (
                    "guest"
                  )
                }
              />
            </dl>
          </div>

          {/* Payment info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-orange-500" />
              <h2 className="font-semibold text-neutral-900">Payment</h2>
            </div>
            <dl className="space-y-2 text-sm">
              <Row
                label="Status"
                value={<Pill value={order.paymentStatus} />}
              />
              <Row
                label="Payment ID"
                value={
                  order.paymentId ? (
                    <span className="font-mono text-xs">
                      {order.paymentId.slice(0, 16)}…
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </div>

          {/* Shipments */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                <h2 className="font-semibold text-neutral-900">Shipments</h2>
              </div>
              <span className="text-xs text-neutral-500">
                {shipments.length}
              </span>
            </div>

            {/* Existing */}
            <div className="p-4 space-y-3">
              {shipLoading ? (
                <div className="text-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500 mx-auto" />
                </div>
              ) : shipments.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-2">
                  No shipments yet.
                </p>
              ) : (
                shipments.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-neutral-200 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900 truncate">
                          {s.carrier || "—"}
                        </div>
                        <div className="font-mono text-xs text-neutral-600 truncate">
                          {s.trackingNumber || "—"}
                        </div>
                        {s.trackingUrl && (
                          <a
                            href={s.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-orange-600 hover:underline"
                          >
                            Track →
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => deleteShipment(s)}
                        disabled={deletingShipmentId === s.id}
                        className="p-1.5 rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Delete shipment"
                      >
                        {deletingShipmentId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Pill value={s.status} />
                      {s.shippedAt && (
                        <span className="text-[11px] text-neutral-500">
                          Shipped{" "}
                          {s.shippedAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                      {s.deliveredAt && (
                        <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Delivered{" "}
                          {s.deliveredAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add shipment */}
            <form
              onSubmit={addShipment}
              className="border-t border-neutral-200 p-4 space-y-2 bg-neutral-50"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-600">
                Add shipment
              </div>
              <input
                placeholder="Carrier (e.g. Delhivery)"
                value={newCarrier}
                onChange={(e) => setNewCarrier(e.target.value)}
                className={inputCls}
              />
              <input
                placeholder="Tracking number"
                value={newTracking}
                onChange={(e) => setNewTracking(e.target.value)}
                className={inputCls}
              />
              <input
                placeholder="Tracking URL (optional, https://…)"
                value={newTrackingUrl}
                onChange={(e) => setNewTrackingUrl(e.target.value)}
                className={inputCls}
              />
              <select
                value={newShipStatus}
                onChange={(e) =>
                  setNewShipStatus(
                    e.target.value as (typeof SHIPMENT_STATUSES)[number]
                  )
                }
                className={inputCls}
              >
                {SHIPMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addingShipment}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {addingShipment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {addingShipment ? "Adding…" : "Add shipment"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  tone?: "green";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd
        className={`text-right ${
          bold
            ? "font-bold text-neutral-900 text-base"
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

function AddressBlock({ address }: { address: Address | null }) {
  if (!address) {
    return <p className="text-sm text-neutral-500">Not provided.</p>;
  }
  const lines = [
    address.fullName,
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
    address.country,
    address.phone && `Phone: ${address.phone}`,
  ].filter(Boolean);
  return (
    <address className="not-italic text-sm text-neutral-700 leading-relaxed">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </address>
  );
}