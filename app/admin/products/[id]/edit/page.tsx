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
  where,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Option = { id: string; name: string };

const toPaise = (rupees: string): number => {
  const n = parseFloat(rupees);
  return isNaN(n) ? 0 : Math.round(n * 100);
};
const toRupees = (paise: number | undefined): string =>
  typeof paise === "number" ? (paise / 100).toString() : "";
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [productType, setProductType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [basePrice, setBasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [attributesText, setAttributesText] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [cSnap, colSnap, productSnap] = await Promise.all([
          getDocs(query(collection(db, "categories"), orderBy("sortOrder", "asc"))),
          getDocs(query(collection(db, "collections"), orderBy("sortOrder", "asc"))),
          getDoc(doc(db, "products", id)),
        ]);

        setCategories(
          cSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))
        );
        setCollections(
          colSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))
        );

        if (!productSnap.exists()) {
          setNotFound(true);
          return;
        }
        const p = productSnap.data();
        setName(p.name || "");
        setSlug(p.slug || "");
        setDescription(p.description || "");
        setShortDescription(p.shortDescription || "");
        setBrand(p.brand || "");
        setProductType(p.productType || "");
        setCategoryId(p.categoryId || "");
        setCollectionIds(Array.isArray(p.collectionIds) ? p.collectionIds : []);
        setStatus((p.status as any) || "draft");
        setBasePrice(toRupees(p.basePricePaise));
        setMrp(toRupees(p.mrpPaise));
        setImagesText(Array.isArray(p.images) ? p.images.join("\n") : "");
        setAttributesText(
          p.attributes ? JSON.stringify(p.attributes, null, 2) : ""
        );
        setSeoTitle(p.seoTitle || "");
        setSeoDescription(p.seoDescription || "");
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleCollection = (cid: string) => {
    setCollectionIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    if (!basePrice || toPaise(basePrice) <= 0) {
      toast.error("Base price must be greater than 0");
      return;
    }

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
      const dup = await getDocs(
        query(collection(db, "products"), where("slug", "==", slug.trim()))
      );
      const conflict = dup.docs.find((d) => d.id !== id);
      if (conflict) {
        toast.error(`Slug "${slug}" is used by another product`);
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, "products", id), {
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
        updatedAt: serverTimestamp(),
      });

      toast.success("Product updated");
      router.push("/admin/products");
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
          Product not found.
        </p>
        <Link
          href="/admin/products"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-900">Edit product</h1>
          <p className="text-sm text-neutral-500 truncate">{name}</p>
        </div>
        <Link
          href={`/admin/products/${id}/variants`}
          className="text-sm font-medium text-orange-600 hover:underline"
        >
          Manage variants →
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

          <Field label="Slug *">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
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
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Media & attributes</h2>

          <Field label="Image URLs (one per line)">
            <textarea
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </Field>

          <Field label="Attributes (JSON)">
            <textarea
              value={attributesText}
              onChange={(e) => setAttributesText(e.target.value)}
              rows={4}
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        </section>

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