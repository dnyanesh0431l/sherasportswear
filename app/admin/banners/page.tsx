"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

export default function BannersListPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [placementFilter, setPlacementFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "banners"), orderBy("sortOrder", "asc"))
      );
      setItems(
        snap.docs.map((d) => {
          const b = d.data();
          return {
            id: d.id,
            title: b.title || "",
            subtitle: b.subtitle || "",
            imageUrl: b.imageUrl || "",
            ctaLabel: b.ctaLabel || "",
            ctaUrl: b.ctaUrl || "",
            placement: b.placement || "",
            sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
            isActive: !!b.isActive,
            startsAt: toDate(b.startsAt),
            endsAt: toDate(b.endsAt),
          };
        })
      );
    } catch (e) {
      setError(
        (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules for admin reads on `banners`."
          : (e as Error)?.message || "Failed to load banners"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const placements = Array.from(
    new Set(items.map((b) => b.placement).filter(Boolean))
  );

  const filtered =
    placementFilter === "all"
      ? items
      : items.filter((b) => b.placement === placementFilter);

  const toggleActive = async (b: Banner) => {
    setTogglingId(b.id);
    try {
      await updateDoc(doc(db, "banners", b.id), {
        isActive: !b.isActive,
        updatedAt: Timestamp.now(),
      });
      toast.success(
        !b.isActive ? `"${b.title}" activated` : `"${b.title}" deactivated`
      );
      setItems((prev) =>
        prev.map((x) =>
          x.id === b.id ? { ...x, isActive: !b.isActive } : x
        )
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to toggle");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm(`Delete banner "${b.title}"? This cannot be undone.`))
      return;
    setDeleting(b.id);
    try {
      await deleteDoc(doc(db, "banners", b.id));
      toast.success(`Deleted "${b.title}"`);
      setItems((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Banners</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} total · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/banners/new"
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add banner
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <select
          value={placementFilter}
          onChange={(e) => setPlacementFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All placements</option>
          {placements.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
          <ImageIcon className="h-10 w-10 text-neutral-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-neutral-700">
            {items.length === 0
              ? "No banners yet"
              : "No banners for this placement"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col"
            >
              {/* Image */}
              <div className="relative bg-neutral-100 aspect-[16/9]">
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-neutral-300" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide bg-neutral-900/80 text-white px-2 py-0.5 rounded-full">
                    {b.placement || "no placement"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide bg-neutral-900/80 text-white px-2 py-0.5 rounded-full">
                    #{b.sortOrder}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  {b.isActive ? (
                    <span className="text-[10px] uppercase tracking-wide bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide bg-neutral-500 text-white px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-neutral-900 truncate">
                  {b.title || "(no title)"}
                </h3>
                {b.subtitle && (
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    {b.subtitle}
                  </p>
                )}
                {b.ctaLabel && (
                  <div className="mt-2 inline-flex items-center gap-1 self-start rounded-md bg-orange-50 text-orange-700 text-xs px-2 py-0.5">
                    {b.ctaLabel}
                    {b.ctaUrl && (
                      <span className="font-mono text-[10px] text-orange-600/70 truncate max-w-[120px]">
                        → {b.ctaUrl}
                      </span>
                    )}
                  </div>
                )}
                {(b.startsAt || b.endsAt) && (
                  <div className="text-[11px] text-neutral-500 mt-2">
                    {b.startsAt && (
                      <div>
                        From{" "}
                        {b.startsAt.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    )}
                    {b.endsAt && (
                      <div>
                        Until{" "}
                        {b.endsAt.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(b)}
                    disabled={togglingId === b.id}
                    className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                    title={b.isActive ? "Deactivate" : "Activate"}
                  >
                    {togglingId === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : b.isActive ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <Link
                    href={`/admin/banners/${b.id}/edit`}
                    className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-orange-600"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Link>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDelete(b)}
                    disabled={deleting === b.id}
                    className="p-2 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}