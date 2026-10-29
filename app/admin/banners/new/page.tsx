"use client";

import { db, storage } from "@/lib/firebase/client"; // Ensure storage is exported
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const PLACEMENTS = [
  "home_hero",
  "home_strip",
  "home_secondary",
  "category_banner",
  "collection_banner",
] as const;

/**
 * CTA URL validation:
 *   - internal paths must start with `/`
 *   - external URLs must be http/https
 *   - reject javascript:, data:, vbscript:, etc.
 */
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

export default function NewBannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nextSortOrder, setNextSortOrder] = useState<number>(1);

  // Form State
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [placement, setPlacement] = useState<string>("home_hero");
  const [sortOrder, setSortOrder] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");

  // Auto-suggest sortOrder
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "banners"), orderBy("sortOrder", "desc")),
        );
        const top = snap.docs[0]?.data()?.sortOrder;
        const next = typeof top === "number" ? top + 1 : 1;
        setNextSortOrder(next);
        setSortOrder(String(next));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // --- Upload Logic ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          null,
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setImageUrl(url);
            resolve();
          },
        );
      });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = () => setImageUrl("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!imageUrl.trim()) {
      toast.error("Please upload a banner image");
      return;
    }
    if (ctaUrl.trim() && !isValidCtaUrl(ctaUrl)) {
      toast.error(
        "CTA URL must be an internal path (starting with /) or an http/https URL",
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
      await addDoc(collection(db, "banners"), {
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl: imageUrl,
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        placement,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Banner created successfully");
      router.push("/admin/banners");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create banner");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/banners"
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Add New Banner
            </h1>
            <p className="text-xs text-neutral-500">
              Promotional banner for the storefront.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/banners"
            className="border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save Banner"}
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* LEFT COLUMN (Content & CTA) */}
        <div className="md:col-span-2 space-y-4">
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Banner Content
            </h2>

            <Field label="Title *">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Own Your Run"
                required
                className={inputCls}
              />
            </Field>

            <Field label="Subtitle">
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g., Columbus NXG Series is here."
                className={inputCls}
              />
            </Field>
          </section>

          {/* Image Upload */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Banner Image *
            </h2>

            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {imageUrl ? (
                  <div className="relative h-32 w-56 bg-neutral-100 border border-neutral-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Banner"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Replace image"
                        className="p-1.5 bg-white text-neutral-800 hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        title="Remove image"
                        className="p-1.5 bg-white text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-32 w-56 flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 hover:border-orange-500 hover:bg-orange-50 transition-colors text-neutral-500 hover:text-orange-600"
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="h-6 w-6 mb-1" />
                        <span className="text-[10px] font-medium text-center px-1">
                          Upload Image
                        </span>
                      </>
                    )}
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1 text-xs text-neutral-500 space-y-1 pt-1">
                <p className="font-medium text-neutral-700">
                  Upload a banner image
                </p>
                <p>• Recommended: Wide landscape (e.g., 1600x600px)</p>
                <p>• Format: JPG, PNG, or WebP</p>
                <p>• This is the background of your banner</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Call to Action
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Button Label">
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Shop Now"
                  className={inputCls}
                />
              </Field>
              <Field label="Button URL" hint="Internal path or https://">
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="/products"
                  className={inputCls}
                />
              </Field>
            </div>
            {ctaUrl.trim() && !isValidCtaUrl(ctaUrl) && (
              <p className="text-xs text-red-600">
                Invalid URL. Use an internal path starting with <code>/</code>{" "}
                or an http/https URL.
              </p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (Settings) */}
        <div className="space-y-4">
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Placement
            </h2>

            <Field label="Location">
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className={inputCls}
              >
                {PLACEMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sort Order" hint={`Suggested: ${nextSortOrder}`}>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputCls}
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
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

          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Schedule (Optional)
            </h2>

            <Field label="Starts At" hint="Hidden before this time">
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Ends At" hint="Hidden after this time">
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </section>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow";

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
