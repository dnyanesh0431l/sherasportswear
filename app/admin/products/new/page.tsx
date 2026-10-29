"use client";

import { db, storage } from "@/lib/firebase/client"; // Ensure storage is exported from your firebase client config
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
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
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Option = { id: string; name: string };
type Attribute = { key: string; value: string };

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [brandId, setBrandId] = useState("columbus"); // Default brand
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

  // Images
  const [images, setImages] = useState<string[]>([]);

  // Attributes
  const [attributes, setAttributes] = useState<Attribute[]>([
    { key: "", value: "" },
  ]);

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
          cSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })),
        );
        setCollections(
          colSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })),
        );
      } catch (e) {
        toast.error("Failed to load categories/collections");
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
      if (!dup.empty) {
        toast.error(`URL slug "${slug}" is already taken`);
        setSaving(false);
        return;
      }

      const docRef = await addDoc(collection(db, "products"), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        brandId: brandId,
        brandName: brandId === "columbus" ? "Columbus" : "Shera", // Simple mapping for now
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Product created successfully");
      router.push(`/admin/products/${docRef.id}/variants`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create product");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Add New Product
            </h1>
            <p className="text-xs text-neutral-500">
              Fill in the details below to create a new item.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save Product"}
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
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Product Name *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Columbus Victory Running Shoes"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="URL Slug *" hint="Auto-generated from name">
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
                  placeholder="e.g., Running Shoe"
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

            <Field label="Short Description" hint="Appears on product cards">
              <input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A brief catchy summary"
                className={inputCls}
              />
            </Field>

            <Field label="Full Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Detailed information about the product..."
                className={inputCls}
              />
            </Field>
          </section>

          {/* Media (Images) */}
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-sm text-neutral-900">
                Product Images
              </h2>
              <span className="text-xs text-neutral-500">
                First image will be the main thumbnail
              </span>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-md overflow-hidden border border-neutral-200 group bg-neutral-50"
                >
                  <Image
                    src={url}
                    alt={`Upload ${i}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square flex flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-300 hover:border-orange-500 hover:bg-orange-50 transition-colors text-neutral-500 hover:text-orange-600"
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
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
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

            <p className="text-xs text-neutral-500 mb-2">
              Add specifications like Material, Weight, Drop, etc.
            </p>

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
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
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
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
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
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <Field label="MRP (₹)" hint="Original price">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder={basePrice || "0"}
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
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
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
                      className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
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
          <section className="bg-white rounded-md border border-neutral-200 p-4 space-y-3">
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
  "w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow";

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
