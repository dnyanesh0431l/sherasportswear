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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
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

const PAGE_SIZES = [10, 25, 50, 100] as const;

type JoinedRange = "all" | "today" | "week" | "month" | "last30" | "custom";

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

/** Local-midnight boundaries used for "joined" filtering. */
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  // Week starts Monday
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function daysAgo(d: Date, n: number) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - n);
  return x;
}

function toInputDate(d: Date) {
  // yyyy-mm-dd for <input type="date">
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseInputDate(v: string, endOfDay = false): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(
    y,
    m - 1,
    d,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return date;
}

export default function CustomersListPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Joined-date filter
  const [joinedRange, setJoinedRange] = useState<JoinedRange>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), orderBy("createdAt", "desc")),
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
        }),
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `users`."
          : (e as Error)?.message || "Failed to load customers",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to first page whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, joinedRange, customFrom, customTo]);

  /** Compute [from, to] window for the joined-date filter. */
  const joinedWindow = useMemo<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    switch (joinedRange) {
      case "today": {
        const from = startOfDay(now);
        const to = new Date(from);
        to.setDate(to.getDate() + 1);
        return { from, to }; // [today 00:00, tomorrow 00:00)
      }
      case "week": {
        const from = startOfWeek(now);
        const to = new Date(from);
        to.setDate(to.getDate() + 7);
        return { from, to };
      }
      case "month": {
        const from = startOfMonth(now);
        const to = new Date(from);
        to.setMonth(to.getMonth() + 1);
        return { from, to };
      }
      case "last30": {
        const from = daysAgo(now, 29); // inclusive of today -> 30 days
        const to = new Date(startOfDay(now));
        to.setDate(to.getDate() + 1);
        return { from, to };
      }
      case "custom": {
        const from = parseInputDate(customFrom, false);
        const to = parseInputDate(customTo, true);
        // If only one side is set, use it as an open-ended bound
        return {
          from: from ?? null,
          to: to ? new Date(to.getTime() + 1) : null,
        };
      }
      default:
        return { from: null, to: null };
    }
  }, [joinedRange, customFrom, customTo]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const { from, to } = joinedWindow;
    return items.filter((c) => {
      // Joined-date filter
      if (from || to) {
        if (!c.createdAt) return false;
        if (from && c.createdAt < from) return false;
        if (to && c.createdAt >= to) return false;
      }
      // Search
      if (!s) return true;
      return (
        (c.displayName || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s)
      );
    });
  }, [items, search, joinedWindow]);

  const optInCount = useMemo(
    () => items.filter((c) => c.marketingOptIn).length,
    [items],
  );

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const rangeStart =
    filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  const pageNumbers = useMemo<(number | "ellipsis")[]>(() => {
    const total = totalPages;
    const current = currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);
    if (left > 2) pages.push("ellipsis");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push("ellipsis");
    pages.push(total);
    return pages;
  }, [totalPages, currentPage]);

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
  };

  // Human label for the active joined filter, shown in the header
  const joinedLabel = useMemo(() => {
    switch (joinedRange) {
      case "today":
        return "joined today";
      case "week":
        return "joined this week";
      case "month":
        return "joined this month";
      case "last30":
        return "joined in last 30 days";
      case "custom": {
        if (customFrom && customTo) return `joined ${customFrom} → ${customTo}`;
        if (customFrom) return `joined on/after ${customFrom}`;
        if (customTo) return `joined on/before ${customTo}`;
        return "custom joined range";
      }
      default:
        return null;
    }
  }, [joinedRange, customFrom, customTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customers</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} total · {filtered.length} shown
            {joinedLabel ? ` · ${joinedLabel}` : ""}
            {" · "}
            {optInCount} marketing opt-ins
            {filtered.length > 0 && ` · page ${currentPage} of ${totalPages}`}
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

      {/* Toolbar: search + joined filter + page size */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or UID…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Joined
          </label>
          <select
            value={joinedRange}
            onChange={(e) => setJoinedRange(e.target.value as JoinedRange)}
            className="border border-neutral-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="last30">Last 30 days</option>
            <option value="custom">Custom range…</option>
          </select>

          {joinedRange === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-neutral-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Joined from"
              />
              <span className="text-xs text-neutral-400">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-neutral-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Joined to"
              />
              {(customFrom || customTo) && (
                <button
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-800 underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {joinedRange !== "all" && joinedRange !== "custom" && (
            <button
              onClick={() => setJoinedRange("all")}
              className="text-xs text-neutral-500 hover:text-neutral-800 underline"
            >
              Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <label
              htmlFor="page-size"
              className="text-xs font-medium text-neutral-500 uppercase tracking-wider"
            >
              Rows
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-neutral-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
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
                : "No customers match your filters"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Customer accounts appear here once they register.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Contact</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Marketing
                    </th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginated.map((c) => (
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

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 bg-neutral-50">
              <div className="text-xs text-neutral-600">
                Showing{" "}
                <span className="font-medium text-neutral-900">
                  {rangeStart}
                </span>
                –
                <span className="font-medium text-neutral-900">{rangeEnd}</span>{" "}
                of{" "}
                <span className="font-medium text-neutral-900">
                  {filtered.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
                  title="First page"
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {pageNumbers.map((p, idx) =>
                  p === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-xs text-neutral-400 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`min-w-[28px] px-2 py-1 text-xs border rounded-md ${
                        p === currentPage
                          ? "bg-orange-600 border-orange-600 text-white font-semibold"
                          : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                      }`}
                      aria-current={p === currentPage ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
                  title="Next page"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
                  title="Last page"
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
