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
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ExternalLink,
  IndianRupee,
  Loader2,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Payment = {
  id: string;
  orderId: string | null;
  userId: string | null;
  provider: string | null;
  providerPaymentId: string | null;
  amountPaise: number;
  currency: string;
  status: string | null;
  method: string | null;
  capturedAt: Date | null;
  failureReason: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type WebhookEvent = {
  id: string;
  provider: string | null;
  providerEventId: string | null;
  eventType: string | null;
  status: string | null;
  processedAt: Date | null;
  createdAt: Date | null;
  payload: unknown;
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
    s === "captured" || s === "processed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "authorized" || s === "received"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : s === "pending"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : s === "failed" || s === "cancelled" || s === "ignored"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <span
      className={`inline-flex text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 border ${cls}`}
    >
      {value || "—"}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-neutral-100 last:border-b-0">
      <dt className="text-sm text-neutral-500 shrink-0">{label}</dt>
      <dd className="text-sm text-neutral-900 text-right break-all">{value}</dd>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);

  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "payments", id));
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      const p = snap.data();
      setPayment({
        id: snap.id,
        orderId: p.orderId || null,
        userId: p.userId || null,
        provider: p.provider || null,
        providerPaymentId: p.providerPaymentId || null,
        amountPaise: typeof p.amountPaise === "number" ? p.amountPaise : 0,
        currency: p.currency || "INR",
        status: p.status || null,
        method: p.method || null,
        capturedAt: toDate(p.capturedAt),
        failureReason: p.failureReason || null,
        createdAt: toDate(p.createdAt),
        updatedAt: toDate(p.updatedAt),
      });
    } catch {
      // handled by notFound state
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadEvents = useCallback(async () => {
    if (!id) return;
    setEventsLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "payments", id, "webhookEvents"),
          orderBy("createdAt", "desc"),
        ),
      );
      setEvents(
        snap.docs.map((d) => {
          const e = d.data();
          return {
            id: d.id,
            provider: e.provider || null,
            providerEventId: e.providerEventId || null,
            eventType: e.eventType || null,
            status: e.status || null,
            processedAt: toDate(e.processedAt),
            createdAt: toDate(e.createdAt),
            payload: e.payload ?? null,
          };
        }),
      );
    } catch {
      // ignore
    } finally {
      setEventsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadEvents();
  }, [load, loadEvents]);

  if (loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  if (notFound || !payment) {
    return (
      <div className="bg-white border border-neutral-200 p-10 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="h-10 w-10 text-neutral-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-neutral-700">
          Payment not found.
        </p>
        <Link
          href="/admin/payments"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to payments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/payments"
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 font-mono">
              {payment.id}
            </h1>
            <p className="text-xs text-neutral-500">
              {payment.createdAt
                ? payment.createdAt.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium bg-neutral-900 text-white px-2 py-1">
            <CreditCard className="h-3 w-3" />
            {payment.provider || "unknown"}
          </span>
          <Pill value={payment.status} />
        </div>
      </div>

      {/* Read-only warning */}
      <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Read-only</p>
          <p className="text-xs mt-0.5">
            Payment state is driven by the provider webhook. To refund, cancel,
            or reconcile, use the provider dashboard.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-4">
          {/* Amount Hero */}
          <div className="bg-neutral-900 text-white p-5 border border-neutral-800">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              Amount
            </div>
            <div className="mt-1 text-3xl font-bold flex items-center gap-1">
              <IndianRupee className="h-6 w-6" />
              {(payment.amountPaise / 100).toLocaleString("en-IN")}
              <span className="text-sm font-normal text-neutral-400 ml-2">
                {payment.currency}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Pill value={payment.status} />
              {payment.method && (
                <span className="text-[10px] bg-white/10 px-2 py-0.5 uppercase tracking-wide border border-white/10">
                  {payment.method}
                </span>
              )}
              {payment.capturedAt && (
                <span className="text-[11px] text-neutral-300">
                  Captured{" "}
                  {payment.capturedAt.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
            {payment.failureReason && (
              <div className="mt-3 bg-red-500/20 border border-red-400/40 px-3 py-2 text-sm text-red-100">
                <span className="font-medium">Failure: </span>
                {payment.failureReason}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-white border border-neutral-200 p-4">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2 mb-2">
              Payment Details
            </h2>
            <dl className="divide-y divide-neutral-100">
              <Row
                label="Payment ID"
                value={<span className="font-mono text-xs">{payment.id}</span>}
              />
              <Row
                label="Provider Payment ID"
                value={
                  payment.providerPaymentId ? (
                    <span className="font-mono text-xs">
                      {payment.providerPaymentId}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Provider" value={payment.provider || "—"} />
              <Row label="Method" value={payment.method || "—"} />
              <Row
                label="Order"
                value={
                  payment.orderId ? (
                    <Link
                      href={`/admin/orders/${payment.orderId}`}
                      className="text-orange-600 hover:underline font-mono text-xs inline-flex items-center gap-1"
                    >
                      {payment.orderId.slice(0, 16)}…
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Customer UID"
                value={
                  payment.userId ? (
                    <span className="font-mono text-xs">{payment.userId}</span>
                  ) : (
                    "guest"
                  )
                }
              />
              <Row
                label="Created"
                value={
                  payment.createdAt
                    ? payment.createdAt.toLocaleString("en-IN")
                    : "—"
                }
              />
              <Row
                label="Updated"
                value={
                  payment.updatedAt
                    ? payment.updatedAt.toLocaleString("en-IN")
                    : "—"
                }
              />
            </dl>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* Webhook Events */}
          <div className="bg-white border border-neutral-200">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-orange-500" />
                <h2 className="font-semibold text-sm text-neutral-900">
                  Webhook Events
                </h2>
              </div>
              <span className="text-xs text-neutral-500">{events.length}</span>
            </div>

            {eventsLoading ? (
              <div className="p-6 text-center">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500 mx-auto" />
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-neutral-500">
                  No webhook events recorded.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {events.map((e) => {
                  const expanded = expandedId === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className="w-full px-3 py-2 text-left hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-neutral-900 truncate">
                                {e.eventType || "unknown event"}
                              </span>
                              <Pill value={e.status} />
                            </div>
                            <div className="text-[10px] text-neutral-500 mt-0.5 truncate font-mono">
                              {e.providerEventId || e.id}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">
                              {e.createdAt
                                ? e.createdAt.toLocaleString("en-IN")
                                : "—"}
                            </div>
                          </div>
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-3 pb-3">
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>
                              Contains sensitive provider data — do not share.
                            </span>
                          </div>
                          <pre className="text-[10px] font-mono bg-neutral-950 text-neutral-100 p-2.5 overflow-x-auto max-h-64 overflow-y-auto">
                            {JSON.stringify(e.payload ?? {}, null, 2)}
                          </pre>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Provider Dashboard */}
          <div className="bg-white border border-neutral-200 p-4">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2 mb-2">
              Provider Dashboard
            </h2>
            <p className="text-xs text-neutral-600 mb-3">
              Open the provider's dashboard to inspect gateway logs, process
              refunds, or reconcile mismatches.
            </p>
            <a
              href={
                payment.provider === "razorpay"
                  ? "https://dashboard.razorpay.com/app/payments"
                  : payment.provider === "stripe"
                    ? "https://dashboard.stripe.com/payments"
                    : payment.provider === "cashfree"
                      ? "https://merchant.cashfree.com/merchants/pg/transactions"
                      : "#"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
            >
              Open dashboard <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
