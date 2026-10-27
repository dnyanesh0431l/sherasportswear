"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
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

export default function EditCategoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "categories", id));
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const c = snap.data();
        setName(c.name || "");
        setSlug(c.slug || "");
        setDescription(c.description || "");
        setImage(c.image || "");
        setSortOrder(String(c.sortOrder ?? 0));
        setStatus((c.status as any) || "active");
        setSeoTitle(c.seoTitle || "");
        setSeoDescription(c.seoDescription || "");
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load category");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }

    setSaving(true);
    try {
      const dup = await getDocs(
        query(collection(db, "categories"), where("slug", "==", slug.trim())),
      );
      const conflict = dup.docs.find((d) => d.id !== id);
      if (conflict) {
        toast.error(`Slug "${slug}" is used by another category`);
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, "categories", id), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        image: image.trim() || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
        status,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Category updated");
      router.push("/admin/categories");
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
          Category not found.
        </p>
        <Link
          href="/admin/categories"
          className="inline-block mt-4 text-sm text-orange-600 hover:underline"
        >
          Back to categories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/categories"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Edit category</h1>
          <p className="text-sm text-neutral-500 truncate">{name}</p>
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

          <Field label="Slug *">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
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
              className={inputCls}
            />
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="mt-2 h-20 w-20 rounded-md object-cover bg-neutral-100"
              />
            )}
          </Field>
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
            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "hidden" | "archived")
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
            href="/admin/categories"
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
