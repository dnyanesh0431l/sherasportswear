"use client";

import { db, storage } from "@/lib/firebase/client"; // Ensure storage is exported
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
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Option = { id: string; name: string };
type Attribute = { key: string; value: string };

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [brandId, setBrandId] = useState("columbus");
  const [productType, setProductType] = useState("");
  const [gender, setGender] = useState("unisex");
  const [categoryId, setCategoryId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "active" | "archived">(
    "draft",
  );
  const [basePrice, setBasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [inventoryValue, setInventoryValue] = useState("0");

  // Images & Attributes
  const [images, setImages] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [cSnap, colSnap, productSnap] = await Promise.all([
          getDocs(
            query(collection(db, "categories"), orderBy("sortOrder", "asc")),
          ),
          getDocs(
            query(collection(db, "collections"), orderBy("sortOrder", "asc")),
          ),
          getDoc(doc(db, "products", id)),
        ]);

        setCategories(
          cSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })),
        );
        setCollections(
          colSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })),
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
        setBrandId(p.brandId || "columbus");
        setProductType(p.productType || "");
        setGender(p.gender || "unisex");
        setCategoryId(p.categoryId || "");
        setCollectionIds(Array.isArray(p.collectionIds) ? p.collectionIds : []);
        setStatus((p.status as any) || "draft");
        setBasePrice(toRupees(p.basePricePaise));
        setMrp(toRupees(p.mrpPaise));
        setInventoryValue(p.inventoryValue?.toString() || "0");
        setImages(Array.isArray(p.images) ? p.images : []);

        // Convert attributes object to array for UI
        if (p.attributes && typeof p.attributes === "object") {
          const attrArray = Object.entries(p.attributes).map(
            ([key, value]) => ({
              key,
              value: String(value),
            }),
          );
          setAttributes(
            attrArray.length > 0 ? attrArray : [{ key: "", value: "" }],
          );
        } else {
          setAttributes([{ key: "", value: "" }]);
        }

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
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid],
    );
  };

  // --- Image Upload Logic ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages = [...images];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            null,
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              newImages.push(downloadURL);
              resolve();
            },
          );
        });
      }
      setImages(newImages);
      toast.success("Images uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload images");
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Attribute Logic ---
  const addAttribute = () => {
    setAttributes((prev) => [...prev, { key: "", value: "" }]);
  };

  const updateAttribute = (
    index: number,
    field: "key" | "value",
    val: string,
  ) => {
    const newAttrs = [...attributes];
    newAttrs[index][field] = val;
    setAttributes(newAttrs);
  };

  const removeAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!name.trim() || !slug.trim()) {
      toast.error("Product name and URL slug are required");
      return;
    }
    if (!basePrice || toPaise(basePrice) <= 0) {
      toast.error("Selling price must be greater than 0");
      return;
    }
    if (images.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    // Convert attributes array to object
    const attributesObj: Record<string, string> = {};
    attributes.forEach((attr) => {
      if (attr.key.trim() && attr.value.trim()) {
        attributesObj[attr.key.trim()] = attr.value.trim();
      }
    });

    setSaving(true);
    try {
      const dup = await getDocs(
        query(collection(db, "products"), where("slug", "==", slug.trim())),
      );
      const conflict = dup.docs.find((d) => d.id !== id);
      if (conflict) {
        toast.error(`URL slug "${slug}" is already used by another product`);
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, "products", id), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        brandId: brandId,
        brandName: brandId === "columbus" ? "Columbus" : "Shera",
        productType: productType.trim(),
        gender: gender,
        categoryId,
        collectionIds,
        status,
        basePricePaise: toPaise(basePrice),
        mrpPaise: toPaise(mrp || basePrice),
        inventoryValue: parseInt(inventoryValue, 10) || 0,
        images,
        attributes: attributesObj,
        seoTitle: seoTitle.trim() || name.trim(),
        seoDescription: seoDescription.trim() || shortDescription.trim(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Product updated successfully");
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
      <div className="bg-white border border-neutral-200 p-10 text-center max-w-lg mx-auto mt-10">
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
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Edit Product</h1>
            <p className="text-xs text-neutral-500 truncate max-w-md">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/products/${id}/variants`}
            className="text-sm font-medium text-orange-600 hover:underline px-2 py-1"
          >
            Manage Variants →
          </Link>
          <Link
            href="/admin/products"
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
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* LEFT COLUMN (Main Details) */}
        <div className="md:col-span-2 space-y-4">
          {/* Basics */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Product Name *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="URL Slug *" hint="Used in the web address">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Brand">
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className={inputCls}
                >
                  <option value="columbus">Columbus</option>
                  <option value="shera">Shera</option>
                </select>
              </Field>
              <Field label="Product Type">
                <input
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Gender">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={inputCls}
                >
                  <option value="unisex">Unisex</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                </select>
              </Field>
            </div>

            <Field label="Short Description">
              <input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Full Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={inputCls}
              />
            </Field>
          </section>

          {/* Media (Images) */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-sm text-neutral-900">
                Product Images
              </h2>
              <span className="text-xs text-neutral-500">
                First image is the main thumbnail
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden border border-neutral-200 group bg-neutral-50"
                >
                  <img
                    src={url}
                    alt={`Upload ${i}`}
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                      Main Image
                    </span>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 hover:border-orange-500 hover:bg-orange-50 transition-colors text-neutral-500 hover:text-orange-600"
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
              <input
                type="file"
                multiple
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </section>

          {/* Attributes */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-sm text-neutral-900">
                Product Attributes
              </h2>
              <button
                type="button"
                onClick={addAttribute}
                className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
              >
                <Plus className="h-3 w-3" /> Add Attribute
              </button>
            </div>

            <div className="space-y-2">
              {attributes.map((attr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="Key (e.g., Material)"
                    value={attr.key}
                    onChange={(e) => updateAttribute(i, "key", e.target.value)}
                    className={`${inputCls} flex-1`}
                  />
                  <input
                    placeholder="Value (e.g., Mesh)"
                    value={attr.value}
                    onChange={(e) =>
                      updateAttribute(i, "value", e.target.value)
                    }
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(i)}
                    className="p-2 text-neutral-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {attributes.length === 0 && (
                <p className="text-xs text-neutral-400 italic py-2">
                  No attributes added yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (Meta, Pricing, Status) */}
        <div className="space-y-4">
          {/* Status */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Visibility
            </h2>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "active" | "archived")
                }
                className={inputCls}
              >
                <option value="draft">Draft (Hidden)</option>
                <option value="active">Active (Visible)</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </section>

          {/* Pricing & Inventory */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Pricing & Stock
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling Price (₹) *">
                <input
                  type="number"
                  min="0"
                  step="1"
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
                  step="1"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field
              label="Total Inventory"
              hint="Total stock across all sizes/colors"
            >
              <input
                type="number"
                min="0"
                value={inventoryValue}
                onChange={(e) => setInventoryValue(e.target.value)}
                className={inputCls}
              />
            </Field>
          </section>

          {/* Taxonomy */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Organization
            </h2>
            <Field label="Category">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select Category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Collections">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {collections.map((c) => {
                  const active = collectionIds.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleCollection(c.id)}
                      className={`px-2.5 py-1 text-xs font-medium border transition-colors ${
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

          {/* SEO */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              SEO (Optional)
            </h2>
            <Field label="SEO Title">
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={name || "Defaults to product name"}
                className={inputCls}
              />
            </Field>
            <Field label="SEO Description">
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder={
                  shortDescription || "Defaults to short description"
                }
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
