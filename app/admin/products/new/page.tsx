"use client";

import { db, storage } from "@/lib/firebase/client";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  ArrowLeft,
  Check,
  ChevronDown,
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
type ProductMode = "simple" | "variant";

type Variant = {
  size: string;
  color: string;
  sku: string;
  price: number;
  mrp: number;
  stock: number;
};

const SIZE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];
const DEFAULT_BRAND_OPTIONS: Option[] = [
  { id: "columbus", name: "Columbus" },
  { id: "shera", name: "Shera" },
];

const COLOR_OPTIONS = [
  "Black",
  "White",
  "Grey",
  "Silver",
  "Black/White",
  "White/Black",
  "Black/Yellow",
  "Grey/Black",
  "Mist/Aqua",
  "Mist/Grey",
  "White/Blue",
  "White/Green",
  "White/Orange",
  "White/Red",
  "Navy/White",
  "Red/Black",
  "Blue/White",
  "Pista/White",
  "Ember Green/Black",
  "Aqua Green/Black",
];

const toPaise = (rupees: string | number): number => {
  const n = typeof rupees === "number" ? rupees : parseFloat(rupees);
  return isNaN(n) ? 0 : Math.round(n * 100);
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const safeId = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function writeBatchChunked(
  items: { id: string; data: Record<string, any> }[],
  makeRef: (id: string) => ReturnType<typeof doc>,
) {
  const CHUNK = 400;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const it of items.slice(i, i + CHUNK)) {
      batch.set(makeRef(it.id), it.data);
    }
    await batch.commit();
  }
}

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brands, setBrands] = useState<Option[]>(DEFAULT_BRAND_OPTIONS);
  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Core
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [brandId, setBrandId] = useState("columbus");
  const [gender, setGender] = useState("unisex");
  const [categoryId, setCategoryId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Pricing
  const [basePrice, setBasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [simpleStock, setSimpleStock] = useState("0");

  // Mode
  const [mode, setMode] = useState<ProductMode>("simple");

  // Variant fields
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  // Media
  const [images, setImages] = useState<string[]>([]);

  // Attributes
  const [attributes, setAttributes] = useState<Attribute[]>([
    { key: "", value: "" },
  ]);
  const [showAttributes, setShowAttributes] = useState(false);

  // Quick-add state
  const [quickAdd, setQuickAdd] = useState<
    null | "brand" | "category" | "collection"
  >(null);
  const [quickAddValue, setQuickAddValue] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [bSnap, cSnap, colSnap] = await Promise.all([
          getDocs(query(collection(db, "brands"), orderBy("name", "asc"))),
          getDocs(
            query(collection(db, "categories"), orderBy("sortOrder", "asc")),
          ),
          getDocs(
            query(collection(db, "collections"), orderBy("sortOrder", "asc")),
          ),
        ]);
        const loadedBrands = bSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        if (loadedBrands.length > 0) setBrands(loadedBrands);
        setCategories(
          cSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })),
        );
        setCollections(
          colSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })),
        );
      } catch {
        toast.error("Failed to load brands/categories/collections");
      }
    })();
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Regenerate matrix when sizes/colors change
  useEffect(() => {
    if (mode !== "variant") return;
    setVariants((prev) => {
      const prevMap = new Map(
        prev.map((v) => [`${safeId(v.size)}__${safeId(v.color)}`, v]),
      );
      const next: Variant[] = [];
      for (const size of sizes) {
        for (const color of colors) {
          const key = `${safeId(size)}__${safeId(color)}`;
          const existing = prevMap.get(key);
          next.push(
            existing ?? {
              size,
              color,
              sku: `${safeId(slug || "prod")}-${safeId(size)}-${safeId(
                color,
              )}`.toUpperCase(),
              price: Number(basePrice) || 0,
              mrp: Number(mrp) || Number(basePrice) || 0,
              stock: 0,
            },
          );
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes, colors, mode]);

  const toggleCollection = (id: string) => {
    setCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSize = (s: string) =>
    setSizes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleColor = (c: string) =>
    setColors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const updateVariant = (
    index: number,
    field: keyof Variant,
    value: string | number,
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  };

  // Quick add — brand
  const handleQuickAddBrand = async () => {
    const v = quickAddValue.trim();
    if (!v) return;
    try {
      const slug = safeId(v);
      const dup = await getDocs(
        query(collection(db, "brands"), where("slug", "==", slug)),
      );
      if (!dup.empty) {
        toast.error(`Brand "${v}" already exists`);
        return;
      }
      const refDoc = await addDoc(collection(db, "brands"), {
        name: v,
        slug,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setBrands((prev) => [...prev, { id: refDoc.id, name: v }]);
      setBrandId(refDoc.id);
      setQuickAdd(null);
      setQuickAddValue("");
      toast.success(`Brand "${v}" created`);
    } catch {
      toast.error("Failed to create brand");
    }
  };

  // Quick add — category
  const handleQuickAddCategory = async () => {
    const v = quickAddValue.trim();
    if (!v) return;
    try {
      const slug = safeId(v);
      const dup = await getDocs(
        query(collection(db, "categories"), where("slug", "==", slug)),
      );
      if (!dup.empty) {
        toast.error(`Category "${v}" already exists`);
        return;
      }
      const refDoc = await addDoc(collection(db, "categories"), {
        name: v,
        slug,
        sortOrder: categories.length + 1,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCategories((prev) => [...prev, { id: refDoc.id, name: v }]);
      setCategoryId(refDoc.id);
      setQuickAdd(null);
      setQuickAddValue("");
      toast.success(`Category "${v}" created`);
    } catch {
      toast.error("Failed to create category");
    }
  };

  // Quick add — collection
  const handleQuickAddCollection = async () => {
    const v = quickAddValue.trim();
    if (!v) return;
    try {
      const slug = safeId(v);
      const dup = await getDocs(
        query(collection(db, "collections"), where("slug", "==", slug)),
      );
      if (!dup.empty) {
        toast.error(`Collection "${v}" already exists`);
        return;
      }
      const refDoc = await addDoc(collection(db, "collections"), {
        name: v,
        slug,
        sortOrder: collections.length + 1,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCollections((prev) => [...prev, { id: refDoc.id, name: v }]);
      setCollectionIds((prev) => [...prev, refDoc.id]);
      setQuickAdd(null);
      setQuickAddValue("");
      toast.success(`Collection "${v}" created`);
    } catch {
      toast.error("Failed to create collection");
    }
  };

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
      toast.success("Images uploaded");
    } catch (error) {
      toast.error("Failed to upload images");
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  const addAttribute = () =>
    setAttributes((prev) => [...prev, { key: "", value: "" }]);

  const updateAttribute = (
    index: number,
    field: "key" | "value",
    val: string,
  ) => {
    const newAttrs = [...attributes];
    newAttrs[index][field] = val;
    setAttributes(newAttrs);
  };

  const removeAttribute = (index: number) =>
    setAttributes((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

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
    if (mode === "variant") {
      if (sizes.length === 0 || colors.length === 0) {
        toast.error("Select at least one size and one color");
        return;
      }
      if (variants.length === 0) {
        toast.error("No variants generated");
        return;
      }
      const badSku = variants.find((v) => !v.sku.trim());
      if (badSku) {
        toast.error(`SKU missing for ${badSku.size} / ${badSku.color}`);
        return;
      }
      const seen = new Set<string>();
      for (const v of variants) {
        const k = v.sku.trim().toUpperCase();
        if (seen.has(k)) {
          toast.error(`Duplicate SKU: ${v.sku}`);
          return;
        }
        seen.add(k);
      }
    }

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
        return;
      }

      const isVariant = mode === "variant";
      const totalStock = isVariant
        ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
        : Math.max(0, parseInt(simpleStock, 10) || 0);

      const docRef = await addDoc(collection(db, "products"), {
        name: name.trim(),
        slug: slug.trim(),
        shortDescription: shortDescription.trim(),
        brandId,
        brandName: brands.find((b) => b.id === brandId)?.name ?? brandId,
        gender,
        categoryId,
        collectionIds,
        status: isActive ? "active" : "draft",
        basePricePaise: toPaise(basePrice),
        mrpPaise: toPaise(mrp || basePrice),
        images,
        attributes: attributesObj,
        hasVariants: isVariant,
        totalInventory: totalStock,
        sizes: isVariant ? sizes : [],
        colors: isVariant ? colors : [],
        ...(isVariant ? {} : { inventoryValue: totalStock }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (isVariant) {
        await writeBatchChunked(
          variants.map((v) => ({
            id: `${safeId(v.size)}__${safeId(v.color)}`,
            data: {
              size: v.size,
              color: v.color,
              sku: v.sku.trim(),
              pricePaise: toPaise(v.price),
              mrpPaise: toPaise(v.mrp || v.price),
              inventoryValue: Math.max(0, Math.floor(v.stock)),
              status: "active",
              attributes: {},
              images: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          })),
          (id) => doc(db, "products", docRef.id, "variants", id),
        );
        await updateDoc(doc(db, "products", docRef.id), {
          totalInventory: totalStock,
          updatedAt: serverTimestamp(),
        });
      }

      toast.success("Product created successfully");
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create product");
    } finally {
      // Always reset — even on success, so a re-mount never shows stale "Saving…"
      setSaving(false);
    }
  };

  const totalVariantStock = variants.reduce(
    (s, v) => s + (Number(v.stock) || 0),
    0,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-3 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              Add New Product
            </h1>
            <p className="text-[11px] text-neutral-500">
              Fill in the details below to create a new item.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products"
            className="border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Saving…" : "Save Product"}
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-3">
          {/* Basics */}
          <section className="bg-white border border-neutral-200 p-3 space-y-2.5">
            <h2 className="font-semibold text-xs text-neutral-900 border-b pb-1.5 uppercase tracking-wide">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Field label="Product Name *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Columbus Victory Running Shoes"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="URL Slug *" hint="Auto-generated">
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

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Brand">
                <div className="flex gap-1.5">
                  <SelectBox
                    value={brandId}
                    onChange={setBrandId}
                    options={brands}
                  />
                  <QuickAddButton
                    active={quickAdd === "brand"}
                    onClick={() => {
                      setQuickAdd(quickAdd === "brand" ? null : "brand");
                      setQuickAddValue("");
                    }}
                  />
                </div>
                {quickAdd === "brand" && (
                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      autoFocus
                      value={quickAddValue}
                      onChange={(e) => setQuickAddValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleQuickAddBrand();
                        }
                      }}
                      placeholder="New brand name"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddBrand}
                      className="bg-orange-500 text-white px-2.5 text-xs font-medium hover:bg-orange-600"
                    >
                      Add
                    </button>
                  </div>
                )}
              </Field>
              <Field label="Gender">
                <SelectBox
                  value={gender}
                  onChange={setGender}
                  options={[
                    { id: "unisex", name: "Unisex" },
                    { id: "men", name: "Men" },
                    { id: "women", name: "Women" },
                  ]}
                />
              </Field>
            </div>

            <Field label="Category">
              <div className="flex gap-1.5">
                <SelectBox
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categories}
                  placeholder="— Select Category —"
                />
                <QuickAddButton
                  active={quickAdd === "category"}
                  onClick={() => {
                    setQuickAdd(quickAdd === "category" ? null : "category");
                    setQuickAddValue("");
                  }}
                />
              </div>
              {quickAdd === "category" && (
                <div className="flex gap-1.5 mt-1.5">
                  <input
                    autoFocus
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickAddCategory();
                      }
                    }}
                    placeholder="New category name"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCategory}
                    className="bg-orange-500 text-white px-2.5 text-xs font-medium hover:bg-orange-600"
                  >
                    Add
                  </button>
                </div>
              )}
            </Field>

            <Field label="Collections">
              <div className="flex gap-1.5 items-start">
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {collections.length === 0 && (
                    <span className="text-[11px] text-neutral-400 italic py-1">
                      No collections yet
                    </span>
                  )}
                  {collections.map((c) => {
                    const active = collectionIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCollection(c.id)}
                        className={`px-2 py-0.5 text-[11px] font-medium border transition-colors ${
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
                <QuickAddButton
                  active={quickAdd === "collection"}
                  onClick={() => {
                    setQuickAdd(
                      quickAdd === "collection" ? null : "collection",
                    );
                    setQuickAddValue("");
                  }}
                />
              </div>
              {quickAdd === "collection" && (
                <div className="flex gap-1.5 mt-1.5">
                  <input
                    autoFocus
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickAddCollection();
                      }
                    }}
                    placeholder="New collection name"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCollection}
                    className="bg-orange-500 text-white px-2.5 text-xs font-medium hover:bg-orange-600"
                  >
                    Add
                  </button>
                </div>
              )}
            </Field>

            <Field label="Short Description" hint="Shown on product cards">
              <input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A brief catchy summary"
                className={inputCls}
              />
            </Field>
          </section>

          {/* Pricing & Stock */}
          <section className="bg-white border border-neutral-200 p-3 space-y-2.5">
            <h2 className="font-semibold text-xs text-neutral-900 border-b pb-1.5 uppercase tracking-wide">
              Pricing &amp; Stock
            </h2>

            <div className="grid grid-cols-3 gap-2.5">
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
              <Field label="MRP (₹)">
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
              <Field label="Stock">
                <input
                  type="number"
                  min="0"
                  value={simpleStock}
                  onChange={(e) => setSimpleStock(e.target.value)}
                  disabled={mode === "variant"}
                  className={`${inputCls} ${
                    mode === "variant" ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] text-neutral-500">
                Product type:
              </span>
              <div className="flex gap-1">
                <ToggleChip
                  active={mode === "simple"}
                  onClick={() => setMode("simple")}
                  label="Simple"
                />
                <ToggleChip
                  active={mode === "variant"}
                  onClick={() => setMode("variant")}
                  label="Has variants"
                />
              </div>
            </div>
          </section>

          {/* Variant builder */}
          {mode === "variant" && (
            <section className="bg-white border border-neutral-200 p-3 space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h2 className="font-semibold text-xs text-neutral-900 uppercase tracking-wide">
                  Sizes &amp; Colors
                </h2>
                <span className="text-[11px] text-neutral-500">
                  {variants.length} variant{variants.length === 1 ? "" : "s"}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-neutral-700">
                    Sizes
                  </label>
                  {sizes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSizes([])}
                      className="text-[10px] text-neutral-500 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {SIZE_OPTIONS.map((s) => {
                    const active = sizes.includes(s);
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => toggleSize(s)}
                        className={`min-w-[40px] border px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "bg-white border-neutral-300 text-neutral-700 hover:border-orange-400"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-neutral-700">
                    Colors
                  </label>
                  {colors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setColors([])}
                      className="text-[10px] text-neutral-500 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {COLOR_OPTIONS.map((c) => {
                    const active = colors.includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => toggleColor(c)}
                        className={`border px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-white border-neutral-300 text-neutral-700 hover:border-blue-400"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {variants.length > 0 ? (
                <div className="pt-2 border-t">
                  <p className="text-[11px] text-neutral-500 mb-1.5">
                    {sizes.length} sizes × {colors.length} colors ={" "}
                    <span className="font-semibold text-neutral-700">
                      {variants.length} variants
                    </span>
                    {" · "}
                    total stock{" "}
                    <span className="font-semibold text-neutral-900">
                      {totalVariantStock}
                    </span>
                  </p>

                  <div className="overflow-x-auto border border-neutral-200">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-neutral-50 text-neutral-600">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">
                            Size
                          </th>
                          <th className="px-2 py-1.5 text-left font-medium">
                            Color
                          </th>
                          <th className="px-2 py-1.5 text-left font-medium">
                            SKU
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            Price
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            MRP
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            Stock
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {variants.map((v, i) => (
                          <tr
                            key={`${safeId(v.size)}__${safeId(v.color)}`}
                            className="hover:bg-neutral-50"
                          >
                            <td className="px-2 py-1 whitespace-nowrap font-medium">
                              {v.size}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {v.color}
                            </td>
                            <td className="px-2 py-1">
                              <input
                                value={v.sku}
                                onChange={(e) =>
                                  updateVariant(i, "sku", e.target.value)
                                }
                                className="w-full min-w-[140px] border border-neutral-200 px-1.5 py-0.5 text-[11px] font-mono"
                              />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <input
                                type="number"
                                min="0"
                                value={v.price}
                                onChange={(e) =>
                                  updateVariant(
                                    i,
                                    "price",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-20 border border-neutral-200 px-1.5 py-0.5 text-[11px] text-right"
                              />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <input
                                type="number"
                                min="0"
                                value={v.mrp}
                                onChange={(e) =>
                                  updateVariant(
                                    i,
                                    "mrp",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-20 border border-neutral-200 px-1.5 py-0.5 text-[11px] text-right"
                              />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <input
                                type="number"
                                min="0"
                                value={v.stock}
                                onChange={(e) =>
                                  updateVariant(
                                    i,
                                    "stock",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-16 border border-neutral-200 px-1.5 py-0.5 text-[11px] text-right"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">
                  Select at least one size and one color to generate variants.
                </p>
              )}
            </section>
          )}

          {/* Images */}
          <section className="bg-white border border-neutral-200 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h2 className="font-semibold text-xs text-neutral-900 uppercase tracking-wide">
                Images
              </h2>
              <span className="text-[10px] text-neutral-500">
                First image = main thumbnail
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {images.map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden border border-neutral-200 group bg-neutral-50"
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
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 hover:border-orange-500 hover:bg-orange-50 transition-colors text-neutral-500 hover:text-orange-600"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5 mb-0.5" />
                    <span className="text-[9px] font-medium text-center px-1">
                      Upload
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
          <CollapsibleSection
            title="Attributes"
            subtitle="Optional"
            open={showAttributes}
            onToggle={() => setShowAttributes((v) => !v)}
          >
            <div className="space-y-1.5">
              {attributes.map((attr, i) => (
                <div key={i} className="flex items-center gap-1.5">
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
                    className="p-1.5 text-neutral-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAttribute}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 hover:text-orange-700"
              >
                <Plus className="h-3 w-3" /> Add Attribute
              </button>
            </div>
          </CollapsibleSection>
        </div>

        {/* RIGHT */}
        <div className="space-y-3">
          {/* Status Toggle */}
          <section className="bg-white border border-neutral-200 p-3 space-y-2">
            <h2 className="font-semibold text-xs text-neutral-900 border-b pb-1.5 uppercase tracking-wide">
              Status
            </h2>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 border transition-colors ${
                isActive
                  ? "bg-green-50 border-green-300"
                  : "bg-neutral-50 border-neutral-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isActive ? "bg-green-500" : "bg-neutral-400"
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    isActive ? "text-green-700" : "text-neutral-600"
                  }`}
                >
                  {isActive ? "Active" : "Draft"}
                </span>
              </div>
              <div
                className={`relative h-4 w-7 rounded-full transition-colors ${
                  isActive ? "bg-green-500" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                    isActive ? "left-3.5" : "left-0.5"
                  }`}
                />
              </div>
            </button>
          </section>

          {/* Summary */}
          <section className="bg-white border border-neutral-200 p-3 space-y-2">
            <h2 className="font-semibold text-xs text-neutral-900 border-b pb-1.5 uppercase tracking-wide">
              Summary
            </h2>
            <div className="space-y-1.5 text-[11px]">
              <SummaryRow
                label="Images"
                value={`${images.length}`}
                ok={images.length > 0}
              />
              <SummaryRow
                label="Mode"
                value={mode === "variant" ? "Variants" : "Simple"}
              />
              {mode === "variant" && (
                <SummaryRow
                  label="Variants"
                  value={`${variants.length}`}
                  ok={variants.length > 0}
                />
              )}
              <SummaryRow
                label="Total stock"
                value={`${
                  mode === "variant"
                    ? totalVariantStock
                    : parseInt(simpleStock, 10) || 0
                }`}
              />
              <SummaryRow
                label="Price"
                value={basePrice ? `₹${basePrice}` : "—"}
                ok={!!basePrice}
              />
              <SummaryRow
                label="Category"
                value={categories.find((c) => c.id === categoryId)?.name ?? "—"}
                ok={!!categoryId}
              />
              <SummaryRow
                label="Collections"
                value={`${collectionIds.length}`}
              />
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow";

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
      <label className="block text-[11px] font-medium text-neutral-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-neutral-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} appearance-none pr-6`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400 pointer-events-none" />
    </div>
  );
}

function QuickAddButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-orange-500 border-orange-500 text-white"
          : "bg-white border-neutral-300 text-neutral-600 hover:border-orange-400 hover:text-orange-600"
      }`}
    >
      <Plus className="h-3 w-3" />
    </button>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-orange-500 border-orange-500 text-white"
          : "bg-white border-neutral-300 text-neutral-700 hover:border-orange-400"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span
        className={`font-medium ${
          ok === false ? "text-red-500" : "text-neutral-900"
        }`}
      >
        {value}
        {ok === true && (
          <Check className="inline h-3 w-3 text-green-500 ml-1" />
        )}
      </span>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-neutral-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 border-b border-neutral-200 text-left"
      >
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold text-xs text-neutral-900 uppercase tracking-wide">
            {title}
          </h2>
          {subtitle && (
            <span className="text-[10px] text-neutral-500">{subtitle}</span>
          )}
        </div>
        <span className="text-[11px] text-neutral-500">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}
