"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserCircle2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Customer = {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  photoURL: string | null;
  marketingOptIn: boolean;
  createdAt: Date | null;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

export default function CustomersListPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), orderBy("createdAt", "desc"))
      );
      setItems(
        snap.docs.map((d) => {
          const u = d.data();
          return {
            id: d.id,
            displayName: u.displayName || null,
            email: u.email || null,
            phone: u.phone || null,
            photoURL: u.photoURL || null,
            marketingOptIn: !!u.marketingOptIn,
            createdAt: toDate(u.createdAt),
          };
        })
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `users`."
          : (e as Error)?.message || "Failed to load customers"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (c) =>
        (c.displayName || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s)
    );
  }, [items, search]);

  const optInCount = useMemo(
    () => items.filter((c) => c.marketingOptIn).length,
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customers</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} total · {filtered.length} shown ·{" "}
            {optInCount} marketing opt-ins
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or UID…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              {items.length === 0
                ? "No customers yet"
                : "No customers match your search"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Customer accounts appear here once they register.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Contact</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-left font-medium">Marketing</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.photoURL}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover bg-neutral-100 shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-semibold shrink-0">
                            {(c.displayName ||
                              c.email ||
                              "?")[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 truncate max-w-[200px]">
                            {c.displayName || "(no name)"}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono truncate max-w-[200px]">
                            {c.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-neutral-700 flex items-center gap-1 truncate max-w-[240px]">
                        <Mail className="h-3 w-3 text-neutral-400 shrink-0" />
                        {c.email || "—"}
                      </div>
                      {c.phone && (
                        <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-neutral-400 shrink-0" />
                          {c.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                      {c.createdAt
                        ? c.createdAt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.marketingOptIn ? (
                        <span className="inline-flex text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Opted in
                        </span>
                      ) : (
                        <span className="inline-flex text-[10px] uppercase tracking-wide bg-neutral-100 text-neutral-500 border border-neutral-200 px-2 py-0.5 rounded-full">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        View <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}