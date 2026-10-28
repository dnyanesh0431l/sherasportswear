"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { ChevronRight, Loader2, Package, ShoppingBag } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useCustomer } from "../layout-client";

type Order = {
  id: string;
  orderNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
  totalPaise: number;
  itemCount: number;
  createdAt: Date | null;
  firstItemImage: string | null;
  firstItemName: string | null;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

function StatusPill({ value }: { value: string | null }) {
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

export default function MyOrdersPage() {
  const user = useCustomer();
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "orders"),
            where("userId", "==", user.uid)
          )
        );
        const mapped = snap.docs.map((d) => {
          const o = d.data();
          const items: any[] = Array.isArray(o.items) ? o.items : [];
          const first = items[0];
          return {
            id: d.id,
            orderNumber: o.orderNumber || null,
            status: o.status || null,
            paymentStatus: o.paymentStatus || null,
            totalPaise: typeof o.totalPaise === "number" ? o.totalPaise : 0,
            itemCount: items.length,
            createdAt: toDate(o.createdAt),
            firstItemImage: first?.imageUrl || null,
            firstItemName: first?.name || null,
          };
        });
        mapped.sort((a, b) => {
          const at = a.createdAt?.getTime() ?? 0;
          const bt = b.createdAt?.getTime() ?? 0;
          return bt - at;
        });
        setItems(mapped);
      } catch (e) {
        setError(
          (e as Error)?.message?.includes("permission-denied")
            ? "Permission denied. Ensure Firestore rules allow reading your own orders."
            : (e as Error)?.message || "Failed to load orders"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user.uid]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-wide text-neutral-900">
          My Orders
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          {items.length} order{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
          <ShoppingBag className="h-10 w-10 text-neutral-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-neutral-700">
            No orders yet
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Your orders will appear here once you place one.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 mt-5 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.id}`}
                className="block bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 hover:border-orange-400 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {o.firstItemImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.firstItemImage}
                      alt=""
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover bg-neutral-100 shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-neutral-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-neutral-900">
                        {o.orderNumber || o.id.slice(0, 10)}
                      </span>
                      <StatusPill value={o.status} />
                      <StatusPill value={o.paymentStatus} />
                    </div>
                    <div className="mt-1 text-sm text-neutral-700 truncate">
                      {o.firstItemName || "—"}
                      {o.itemCount > 1 && (
                        <span className="text-neutral-500">
                          {" "}
                          + {o.itemCount - 1} more
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
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
                    <div className="font-semibold text-neutral-900">
                      {formatINR(o.totalPaise)}
                    </div>
                    <div className="text-xs text-orange-600 mt-1 inline-flex items-center gap-1">
                      View <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}