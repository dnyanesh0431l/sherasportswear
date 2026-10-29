"use client";

import { db, storage } from "@/lib/firebase/client"; // Ensure storage is exported
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
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function EditCategoryPage() {
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

  // --- Upload Logic ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `categories/${Date.now()}_${file.name}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and URL slug are required");
      return;
    }
    if (!image) {
      toast.error("Please upload a category image");
      return;
    }

    setSaving(true);
    try {
      const dup = await getDocs(
        query(collection(db, "categories"), where("slug", "==", slug.trim())),
      );
      const conflict = dup.docs.find((d) => d.id !== id);
      if (conflict) {
        toast.error(`URL slug "${slug}" is already used by another category`);
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, "categories", id), {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        image: image,
        sortOrder: parseInt(sortOrder, 10) || 0,
        status,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Category updated successfully");
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
      <div className="bg-white border border-neutral-200 p-10 text-center max-w-lg mx-auto mt-10">
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
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/categories"
            className="p-1.5 text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Edit Category
            </h1>
            <p className="text-xs text-neutral-500 truncate max-w-md">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/categories"
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
        {/* LEFT COLUMN */}
        <div className="md:col-span-2 space-y-4">
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Category Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category Name *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="URL Slug *" hint="Used in web address">
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
                placeholder="Brief description of this category..."
                className={inputCls}
              />
            </Field>
          </section>

          {/* Image Upload */}
          <section className="bg-white border border-neutral-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-neutral-900 border-b pb-2">
              Category Image *
            </h2>

            <div className="flex items-start gap-4">
              {/* Preview / Upload Area */}
              <div className="shrink-0">
                {image ? (
                  <div className="relative h-28 w-28 bg-neutral-100 border border-neutral-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt="Category"
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

              {/* Instructions */}
              <div className="flex-1 text-xs text-neutral-500 space-y-1 pt-1">
                <p className="font-medium text-neutral-700">
                  Upload a category image
                </p>
                <p>• Recommended: Square (e.g., 500x500px)</p>
                <p>• Format: JPG, PNG, or WebP</p>
                <p>• This shows on the homepage and category pages</p>
              </div>
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
                placeholder={name || "Defaults to category name"}
                className={inputCls}
              />
            </Field>
            <Field label="SEO Description">
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                placeholder={description || "Defaults to category description"}
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
