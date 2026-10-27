"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SectionType =
  | "hero"
  | "featured_products"
  | "bestsellers"
  | "category_grid"
  | "collection"
  | "promo_strip"
  | "brand_story";

type BannerOption = { id: string; title: string };
type CollectionOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };

const TYPE_OPTIONS: { value: SectionType; label: string; hint: string }[] = [
  { value: "hero", label: "Hero banner", hint: "Large banner at the top" },
  {
    value: "featured_products",
    label: "Featured products",
    hint: "Grid of hand-picked products",
  },
  { value: "bestsellers", label: "Bestsellers", hint: "Top products by activity" },
  { value: "category_grid", label: "Category grid", hint: "Grid of categories" },
  { value: "collection", label: "Collection", hint: "Curated collection highlight" },
  { value: "promo_strip", label: "Promo strip", hint: "Thin promotional strip" },
  { value: "brand_story", label: "Brand story", hint: "Text block / about" },
];

export default function EditSectionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [type, setType] = useState<SectionType>("hero");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [bannerId, setBannerId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [limit, setLimit] = useState("8");
  const [bodyText, setBodyText] = useState("");

  const [banners, setBanners] = useState<BannerOption[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [bSnap, cSnap, catSnap, sectionSnap] = await Promise.all([
          getDocs(query(collection(db, "banners"), orderBy("sortOrder", "asc"))),
          getDocs(
            query(collection(db, "collections"), orderBy("sortOrder", "asc"))
          ),
          getDocs(
            query(collection(db, "categories"), orderBy("sortOrder", "asc"))
          ),
          getDoc(doc(db, "homepageSections", id)),
        ]);

        setBanners(
          bSnap.docs.map((d) => ({ id: d.id, title: d.data().title || d.id }))
        );
        setCollections(
          cSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))
        );
        setCategories(
          catSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))
        );

        if (!sectionSnap.exists()) {
          setNotFound(true);
          return;
        }

        const s = sectionSnap.data();
        setType((s.type as SectionType) || "hero");
        setTitle(s.title || "");
        setSubtitle(s.subtitle || "");
        setSortOrder(String(s.sortOrder ?? 0));
        setIsActive(!!s.isActive);

        const cfg = (s.config as Record<string, any>) || {};
        setBannerId(cfg.bannerId || "");
        setCollectionId(cfg.collectionId || "");
        setLimit(String(cfg.limit ?? 8));
        setBodyText(cfg.bodyText || "");

        if (Array.isArray(s.categoryIds)) {
          setSelectedCategoryIds(s.categoryIds);
        }
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load section");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleCategory = (cid: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const buildConfig = (): Record<string, unknown> => {
    switch (type) {
      case "hero":
      case "promo_strip":
        return { bannerId: bannerId || null };
      case "collection":
        return {
          collectionId: collectionId || null,
          limit: parseInt(limit, 10) || 8,
        };
      case "featured_products":
      case "bestsellers":
        return { limit: parseInt(limit, 10) || 8 };
      case "category_grid":
        return {};
      case "brand_story":
        return { bodyText: bodyText.trim() };
      default:
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if ((type === "hero" || type === "promo_strip") && !bannerId) {
      toast.error("Please select a banner");
      return;
    }
    if (type === "collection" && !collectionId) {
      toast.error("Please select a collection");
      return;
    }
    if (type === "brand_story" && !bodyText.trim()) {
      toast.error("Body text is required for brand story");
      return;
    }

    setSaving(true);
    try {
      const data: Record<string, any> = {
        type,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive,
        config: buildConfig(),
        updatedAt: serverTimestamp(),
      };

      // categoryIds only meaningful for category_grid
      if (type === "category_grid" && selectedCategoryIds.length > 0) {
        data.categoryIds = selectedCategoryIds;
      } else {
        // Remove if not applicable
        data.categoryIds = [];
      }

      await updateDoc(doc(db, "homepageSections", id), data);
      toast.success("Section updated");
      router.push("/admin/homepage");
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
          Section not found.
        </p>
        <Link
          href="/admin/homepage"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/homepage"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Edit section</h1>
          <p className="text-sm text-neutral-500 truncate">{title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Section type</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-orange-500 bg-orange-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="font-medium text-sm text-neutral-900">
                    {opt.label}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {opt.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

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

          {(type === "hero" || type === "promo_strip") && (
            <Field label="Banner *">
              <select
                value={bannerId}
                onChange={(e) => setBannerId(e.target.value)}
                className={inputCls}
              >
                <option value="">— select —</option>
                {banners.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {type === "collection" && (
            <>
              <Field label="Collection *">
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— select —</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Products shown">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {(type === "featured_products" || type === "bestsellers") && (
            <Field label="Products shown">
              <input
                type="number"
                min="1"
                max="24"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          {type === "category_grid" && (
            <Field
              label="Categories to show"
              hint="Leave empty to show all active categories."
            >
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const active = selectedCategoryIds.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleCategory(c.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border ${
                        active
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-white border-neutral-300 text-neutral-700 hover:border-orange-400"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {type === "brand_story" && (
            <Field label="Body text *">
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={5}
                className={inputCls}
              />
            </Field>
          )}
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Display</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Sort order">
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Visibility">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-neutral-700">
                  Visible on storefront
                </span>
              </label>
            </Field>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/homepage"
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