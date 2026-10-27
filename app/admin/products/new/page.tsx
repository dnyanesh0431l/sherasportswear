"use client";

import { db } from "@/lib/firebase/client";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Option = { id: string; name: string };

const toPaise = (rupees: string): number => {
  const n = parseFloat(rupees);
  return isNaN(n) ? 0 : Math.round(n * 100);
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [brand, setBrand] = useState("Shera Sports Wear");
  const [productType, setProductType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "active" | "archived">(
    "draft",
  );
  const [basePrice, setBasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [attributesText, setAttributesText] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [cSnap, colSnap] = await Promise.all([
          getDocs(
            query(collection(db, "categories"), orderBy("sortOrder", "asc")),
          ),
          getDocs(
            query(collection(db, "collections"), orderBy("sortOrder", "asc")),
          ),
        ]);
        setCategories(
          cSnap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
          })),
        );
        setCollections(
          colSnap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
          })),
        );
      } catch (e) {
        toast.error(
          (e as Error)?.message || "Failed to load categories/collections",
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const toggleCollection = (id: string) => {
    setCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    if (!basePrice || toPaise(basePrice) <= 0) {
      toast.error("Base price must be greater than 0");
      return;
    }

    // Parse attributes
    let attributes: Record<string, unknown> = {};
    if (attributesText.trim()) {
      try {
        attributes = JSON.parse(attributesText);
      } catch {
        toast.error("Attributes must be valid JSON");
        return;
      }
    }

    const images = imagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      // Slug uniqueness
      const dup = await getDocs(
        query(collection(db, "products"), where("slug", "==", slug.trim())),
      );
      if (!dup.empty) {
        toast.error(`Slug "${slug}" already exists`);
        setSaving(false);
        return;
      }

      const docRef = await addDoc(collection(db, "products"), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        brand: brand.trim(),
        productType: productType.trim(),
        categoryId,
        collectionIds,
        status,
        basePricePaise: toPaise(basePrice),
        mrpPaise: toPaise(mrp || basePrice),
        images,
        attributes,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Product created");
      router.push(`/admin/products/${docRef.id}/variants`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create product");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">New product</h1>
          <p className="text-sm text-neutral-500">
            Create a product, then add variants.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basics */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Basics</h2>

          <Field label="Product name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field
            label="Slug *"
            hint="Used in the URL. Auto-generated from name."
          >
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              required
              className={inputCls}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Brand">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Product type">
              <input
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="T-Shirt, Shorts, Shoe…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Short description">
            <input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={inputCls}
            />
          </Field>
        </section>

        {/* Taxonomy */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Taxonomy</h2>

          <Field label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Collections">
            <div className="flex flex-wrap gap-2">
              {collections.length === 0 && (
                <span className="text-xs text-neutral-500">
                  No collections yet.
                </span>
              )}
              {collections.map((c) => {
                const active = collectionIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleCollection(c.id)}
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
        </section>

        {/* Pricing */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Pricing</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Selling price (₹) *">
              <input
                type="number"
                min="0"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="MRP (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder={basePrice || "—"}
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        {/* Media & attributes */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Media & attributes</h2>

          <Field label="Image URLs (one per line)">
            <textarea
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              rows={3}
              placeholder="https://…&#10;https://…"
              className={inputCls}
            />
          </Field>

          <Field
            label="Attributes (JSON)"
            hint='Optional. Example: { "fabric": "Polyester", "fit": "Regular" }'
          >
            <textarea
              value={attributesText}
              onChange={(e) => setAttributesText(e.target.value)}
              rows={3}
              placeholder='{ "fabric": "Polyester" }'
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        </section>

        {/* SEO & status */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">SEO & visibility</h2>

          <Field label="SEO title">
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="SEO description">
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "draft" | "active" | "archived")
              }
              className={inputCls}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/products"
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
            {saving ? "Saving…" : "Create product"}
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
