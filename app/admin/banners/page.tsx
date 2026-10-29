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
        prev.map((x) => (x.id === b.id ? { ...x, isActive: !b.isActive } : x))
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to toggle");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm(`Are you sure you want to delete "${b.title}"? This cannot be undone.`))
      return;
    setDeleting(b.id);
    try {
      await deleteDoc(doc(db, "banners", b.id));
      toast.success(`Deleted "${b.title}"`);
      setItems((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to delete banner");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Banners</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} total · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/banners/new"
            className="inline-flex items-center gap-2 bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add Banner
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white border border-neutral-200 p-3 flex items-center gap-2">
        <select
          value={placementFilter}
          onChange={(e) => setPlacementFilter(e.target.value)}
          className="border border-neutral-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Placements</option>
          {placements.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white border border-neutral-200 p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-10 text-center">
          <ImageIcon className="h-10 w-10 text-neutral-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-neutral-700">
            {items.length === 0 ? "No banners yet" : "No banners for this placement"}
          </p>
          {items.length === 0 && (
            <Link href="/admin/banners/new" className="inline-block mt-3 text-sm text-orange-600 hover:underline">
              Create your first banner
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-white border border-neutral-200 flex flex-col"
            >
              {/* Image Preview */}
              <div className="relative bg-neutral-100 aspect-[16/9] border-b border-neutral-200">
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
                
                {/* Overlay Badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="text-[9px] uppercase tracking-wider font-medium bg-neutral-900/80 text-white px-1.5 py-0.5 border border-white/10">
                    {b.placement || "no placement"}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-medium bg-neutral-900/80 text-white px-1.5 py-0.5 border border-white/10">
                    #{b.sortOrder}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  {b.isActive ? (
                    <span className="text-[9px] uppercase tracking-wider font-medium bg-emerald-500 text-white px-1.5 py-0.5 border border-emerald-600">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider font-medium bg-neutral-500 text-white px-1.5 py-0.5 border border-neutral-600">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-sm text-neutral-900 truncate">
                  {b.title || "(no title)"}
                </h3>
                {b.subtitle && (
                  <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">
                    {b.subtitle}
                  </p>
                )}
                {b.ctaLabel && (
                  <div className="mt-2 inline-flex items-center gap-1 self-start bg-orange-50 text-orange-700 text-[10px] font-medium px-1.5 py-0.5 border border-orange-200">
                    {b.ctaLabel}
                    {b.ctaUrl && (
                      <span className="font-mono text-[9px] text-orange-600/70 truncate max-w-[120px]">
                        → {b.ctaUrl}
                      </span>
                    )}
                  </div>
                )}
                {(b.startsAt || b.endsAt) && (
                  <div className="text-[10px] text-neutral-500 mt-2">
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
                <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(b)}
                    disabled={togglingId === b.id}
                    className="p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50 transition-colors"
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
                    className="p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-orange-600 transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Link>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDelete(b)}
                    disabled={deleting === b.id}
                    className="p-1.5 text-neutral-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors"
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