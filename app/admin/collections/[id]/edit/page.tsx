"use client";

import { db, storage } from "@/lib/firebase/client";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
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
  ImagePlus,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ProductOption = {
  id: string;
  name: string;
  image: string | null;
  status: string;
  createdAtMs: number;
};

const BATCH_LIMIT = 400; // stay under Firestore's 500-op hard cap

export default function EditCollectionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [status, setStatus] = useState<"active" | "hidden" | "archived">(
    "active",
  );
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);

  // Products
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");

  // Membership snapshot — the IDs actually present in products.collectionIds
  // at load time. Used to compute the write-diff on save.
  const [loadedFromProducts, setLoadedFromProducts] = useState<Set<string>>(
    new Set(),
  );
  const [driftCount, setDriftCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // --- Collections doc + products + true membership -----------------
        // NOTE: no orderBy("createdAt") — that silently drops any product
        // that lacks the field. We sort client-side instead.
        const [colSnap, prodSnap, memberSnap] = await Promise.all([
          getDoc(doc(db, "collections", id)),
          getDocs(collection(db, "products")),
          getDocs(
            query(
              collection(db, "products"),
              where("collectionIds", "array-contains", id),
            ),
          ),
        ]);

        const products: ProductOption[] = prodSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || d.id,
              image: Array.isArray(data.images) ? data.images[0] || null : null,
              status: data.status || "draft",
              createdAtMs: data.createdAt?.toMillis?.() ?? 0,
            };
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        setAllProducts(products);
        const existingIds = new Set(products.map((p) => p.id));

        // Source of truth for the storefront: products whose collectionIds
        // contains this collection's id.
        const actualIds = new Set(memberSnap.docs.map((d) => d.id));
        setLoadedFromProducts(actualIds);

        if (!colSnap.exists()) {
          setNotFound(true);
          return;
        }

        const c = colSnap.data();
        setName(c.name || "");
        setSlug(c.slug || "");
        setDescription(c.description || "");
        setImage(c.image || "");
        setSortOrder(String(c.sortOrder ?? 0));
        setStatus((c.status as any) || "active");
        setSeoTitle(c.seoTitle || "");
        setSeoDescription(c.seoDescription || "");

        // Legacy array on the collection doc. Filter out any dead IDs and
        // union with the products-derived membership so the picker reflects
        // reality regardless of which side last wrote.
        const legacy = Array.isArray(c.productIds)
          ? (c.productIds as string[]).filter((x) => existingIds.has(x))
          : [];
        const union = Array.from(new Set([...legacy, ...actualIds]));
        setProductIds(union);

        // How much are the two sources out of sync? Used for the badge.
        const drift =
          legacy.filter((x) => !actualIds.has(x)).length +
          [...actualIds].filter((x) => !legacy.includes(x)).length;
        setDriftCount(drift);
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load collection");
      } finally {
        setLoading(false);
        setProductsLoading(false);
      }
    })();
  }, [id]);

  const filteredProducts = useMemo(() => {
    const s = productSearch.trim().toLowerCase();
    if (!s) return allProducts;
    return allProducts.filter((p) => p.name.toLowerCase().includes(s));
  }, [allProducts, productSearch]);

  const toggleProduct = (pid: string) => {
    setProductIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  // --- Upload Logic ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `collections/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          null,
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setImage(url);
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

  const removeImage = () => setImage("");

  const syncProductsToCollection = async (
    collectionId: string,
    desired: Set<string>,
    actual: Set<string>,
  ) => {
    const toAdd = [...desired].filter((x) => !actual.has(x));
    const toRemove = [...actual].filter((x) => !desired.has(x));

    for (let i = 0; i < toAdd.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const pid of toAdd.slice(i, i + BATCH_LIMIT)) {
        batch.update(doc(db, "products", pid), {
          collectionIds: arrayUnion(collectionId),
        });
      }
      await batch.commit();
    }

    for (let i = 0; i < toRemove.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const pid of toRemove.slice(i, i + BATCH_LIMIT)) {
        batch.update(doc(db, "products", pid), {
          collectionIds: arrayRemove(collectionId),
        });
      }
      await batch.commit();
    }

    return { added: toAdd.length, removed: toRemove.length };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!id || saving) return;
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and URL slug are required");
      return;
    }
    if (!image) {
      toast.error("Please upload a collection image");
      return;
    }

    setSaving(true);
    try {
      // Slug uniqueness
      const dup = await getDocs(
        query(collection(db, "collections"), where("slug", "==", slug.trim())),
      );
      const conflict = dup.docs.find((d) => d.id !== id);
      if (conflict) {
        toast.error(
          `URL slug "${slug}" is already used by another collection`,
        );
        return;
      }

      // Only persist IDs that still exist as products (drops stale refs)
      const existingIds = new Set(allProducts.map((p) => p.id));
      const cleanProductIds = productIds.filter((pid) => existingIds.has(pid));

      // 1. Write the collection doc (both productIds and metadata)
      await updateDoc(doc(db, "collections", id), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        image,
        sortOrder: parseInt(sortOrder, 10) || 0,
        status,
        productIds: cleanProductIds, // kept for admin/back-compat
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        updatedAt: serverTimestamp(),
      });

      // 2. Mirror onto every product's collectionIds so the storefront's
      //    array-contains query actually finds them. Uses write diffs, so
      //    only changed products are touched.
      const { added, removed } = await syncProductsToCollection(
        id,
        new Set(cleanProductIds),
        loadedFromProducts,
      );

      toast.success(
        added || removed
          ? `Collection saved · ${added} added, ${removed} removed on products`
          : "Collection updated successfully",
      );
      router.push("/admin/collections");
    } catch (e) {
      toast.error((e as Error)?.message || "Update failed");
    } finally {
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
          Collection not found.
        </p>
        <Link
          href="/admin/collections"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to collections
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/collections"
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Edit Collection
            </h1>
            <p className="text-xs text-neutral-500 truncate max-w-md">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/collections"
            className="border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit()}
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
        {/* LEFT COLUMN */}
        <div className="md:col-span-2 space-y-4">
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Collection Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Collection Name *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="URL Slug *">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brief description of this collection..."
                className={inputCls}
              />
            </Field>
          </section>

          {/* Image Upload */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Collection Image *
            </h2>

            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {image ? (
                  <div className="relative h-28 w-28 bg-neutral-100 border border-neutral-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt="Collection"
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
                    className="h-28 w-28 flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 hover:border-orange-500 hover:bg-orange-50 transition-colors text-neutral-500 hover:text-orange-600"
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
                  Upload a collection image
                </p>
                <p>• Recommended: Landscape (e.g., 800x400px)</p>
                <p>• Format: JPG, PNG, or WebP</p>
                <p>• This shows on the storefront collection page</p>
              </div>
            </div>
          </section>

          {/* Products Selector */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-sm text-neutral-900">
                Assign Products
              </h2>
              <div className="flex items-center gap-2">
                {driftCount > 0 && (
                  <span
                    title="The collection's productIds and the products' collectionIds were out of sync. Saving will fix this."
                    className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"
                  >
                    {driftCount} need sync
                  </span>
                )}
                <span className="text-xs font-medium text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5">
                  {productIds.length} selected
                </span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500">
              Saving updates both the collection and each product&apos;s
              <code className="mx-1 bg-neutral-100 px-1">collectionIds</code>
              field, so the storefront picks these up immediately.
            </p>

            {productIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {productIds.map((pid) => {
                  const p = allProducts.find((x) => x.id === pid);
                  if (!p) return null;
                  return (
                    <span
                      key={pid}
                      className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 px-2 py-1 text-xs text-orange-800"
                    >
                      {p.name}
                      <button
                        type="button"
                        onClick={() => toggleProduct(pid)}
                        className="text-orange-500 hover:text-orange-900 ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name..."
                className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto border border-neutral-200 divide-y divide-neutral-100">
              {productsLoading ? (
                <div className="p-6 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500 mx-auto" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-6 text-center">
                  <Package className="h-8 w-8 text-neutral-300 mx-auto" />
                  <p className="mt-2 text-sm text-neutral-500">
                    {allProducts.length === 0
                      ? "No products found in the database."
                      : "No products match your search."}
                  </p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const selected = productIds.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => toggleProduct(p.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        selected ? "bg-orange-50" : "hover:bg-neutral-50"
                      }`}
                    >
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt=""
                          className="h-8 w-8 object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 bg-neutral-100 border border-neutral-200 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">
                          {p.id} · {p.status}
                        </div>
                      </div>
                      <div
                        className={`h-4 w-4 border flex items-center justify-center shrink-0 ${
                          selected
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "border-neutral-300 bg-white"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              SEO Settings (Optional)
            </h2>
            <Field label="SEO Title">
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={name || "Defaults to collection name"}
                className={inputCls}
              />
            </Field>
            <Field label="SEO Description">
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                placeholder={
                  description || "Defaults to collection description"
                }
                className={inputCls}
              />
            </Field>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Visibility & Order
            </h2>

            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "hidden" | "archived")
                }
                className={inputCls}
              >
                <option value="active">Active (Visible)</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </select>
            </Field>

            <Field label="Sort Order" hint="Lower numbers appear first">
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
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