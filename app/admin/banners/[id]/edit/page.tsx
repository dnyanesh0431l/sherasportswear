"use client";

import { db } from "@/lib/firebase/client";
import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, Image as ImageIcon, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PLACEMENTS = [
  "home_hero",
  "home_strip",
  "home_secondary",
  "category_banner",
  "collection_banner",
] as const;

function isValidCtaUrl(input: string): boolean {
  const v = input.trim();
  if (!v) return false;
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

function toLocalDateTimeString(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function EditBannerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [placement, setPlacement] = useState<string>("home_hero");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "banners", id));
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const b = snap.data();
        setTitle(b.title || "");
        setSubtitle(b.subtitle || "");
        setImageUrl(b.imageUrl || "");
        setCtaLabel(b.ctaLabel || "");
        setCtaUrl(b.ctaUrl || "");
        setPlacement(b.placement || "home_hero");
        setSortOrder(String(b.sortOrder ?? 0));
        setIsActive(!!b.isActive);
        setStartsAt(toLocalDateTimeString(toDate(b.startsAt)));
        setEndsAt(toLocalDateTimeString(toDate(b.endsAt)));
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load banner");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!imageUrl.trim()) {
      toast.error("Image URL is required");
      return;
    }
    if (ctaUrl.trim() && !isValidCtaUrl(ctaUrl)) {
      toast.error(
        "CTA URL must be an internal path (starting with /) or an http/https URL"
      );
      return;
    }
    if (ctaLabel.trim() && !ctaUrl.trim()) {
      toast.error("Please provide a CTA URL when a label is set");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      toast.error("End date must be after start date");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "banners", id), {
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl: imageUrl.trim(),
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        placement,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        updatedAt: serverTimestamp(),
      });
      toast.success("Banner updated");
      router.push("/admin/banners");
    } catch (e) {
      toast.error((e as Error)?.message || "Update failed");
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

  if (notFound) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
        <p className="text-sm font-medium text-neutral-700">
          Banner not found.
        </p>
        <Link
          href="/admin/banners"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to banners
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/banners"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Edit banner</h1>
          <p className="text-sm text-neutral-500 truncate">{title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Content</h2>

          <Field label="Title *">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Subtitle">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Image URL *">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              required
              className={inputCls}
            />
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 aspect-[16/9] max-w-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </Field>
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Call to action</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="CTA label">
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field
              label="CTA URL"
              hint="Internal path (/products) or https://…"
            >
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {ctaUrl.trim() && !isValidCtaUrl(ctaUrl) && (
            <p className="text-xs text-red-600">
              Invalid URL. Use an internal path starting with <code>/</code> or
              an http/https URL.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">
            Placement & schedule
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Placement">
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className={inputCls}
              >
                {PLACEMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Starts at">
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Ends at">
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-neutral-700">
              Active (visible on storefront)
            </span>
          </label>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/banners"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

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
      <label className="block text-xs font-medium uppercase tracking-wide text-neutral-600 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}