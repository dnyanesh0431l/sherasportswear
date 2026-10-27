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
import {
  ArrowLeft,
  Check,
  Loader2,
  Package,
  Save,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductOption = {
  id: string;
  name: string;
  image: string | null;
  status: string;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function NewCollectionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [nextSortOrder, setNextSortOrder] = useState<number>(1);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [sortOrder, setSortOrder] = useState("1");
  const [status, setStatus] = useState<"active" | "hidden" | "archived">(
    "active"
  );
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);

  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "products"), orderBy("createdAt", "desc"))
        );
        setAllProducts(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || d.id,
              image: Array.isArray(data.images) ? data.images[0] || null : null,
              status: data.status || "draft",
            };
          })
        );
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "collections"), orderBy("sortOrder", "desc"))
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

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const filteredProducts = useMemo(() => {
    const s = productSearch.trim().toLowerCase();
    if (!s) return allProducts;
    return allProducts.filter((p) => p.name.toLowerCase().includes(s));
  }, [allProducts, productSearch]);

  const toggleProduct = (id: string) => {
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(true);
    try {
      const dup = await getDocs(
        query(collection(db, "collections"), where("slug", "==", slug.trim()))
      );
      if (!dup.empty) {
        toast.error(`Slug "${slug}" already exists`);
        setSaving(false);
        return;
      }

      await addDoc(collection(db, "collections"), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        image: image.trim() || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
        status,
        productIds,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Collection created");
      router.push("/admin/collections");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create collection");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/collections"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            New collection
          </h1>
          <p className="text-sm text-neutral-500">
            Curated group of products.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Details</h2>

          <Field label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Slug *" hint="Used in the URL.">
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

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </Field>

          <Field label="Image URL">
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">Display</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Sort order" hint={`Suggested: ${nextSortOrder}`}>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as "active" | "hidden" | "archived"
                  )
                }
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Products</h2>
            <span className="text-xs text-neutral-500">
              {productIds.length} selected
            </span>
          </div>

          {productIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {productIds.map((pid) => {
                const p = allProducts.find((x) => x.id === pid);
                if (!p) return null;
                return (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs text-orange-800"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => toggleProduct(pid)}
                      className="text-orange-600 hover:text-orange-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200 divide-y divide-neutral-100">
            {productsLoading ? (
              <div className="p-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500 mx-auto" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-6 text-center">
                <Package className="h-8 w-8 text-neutral-300 mx-auto" />
                <p className="mt-2 text-sm text-neutral-500">
                  No products match.
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      selected ? "bg-orange-50" : "hover:bg-neutral-50"
                    }`}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        className="h-9 w-9 rounded object-cover bg-neutral-100 shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded bg-neutral-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-900 truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-neutral-500 truncate">
                        {p.id}
                      </div>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                        selected
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "border-neutral-300"
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

        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h2 className="font-semibold text-neutral-900">SEO</h2>
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
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/collections"
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
            {saving ? "Saving…" : "Create collection"}
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