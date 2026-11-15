// app/admin/settings/page.tsx
"use client";

import { db, storage } from "@/lib/firebase/client";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/* -------------------------------- types --------------------------------- */

type Kind = "brand" | "category" | "collection";

type Item = {
  id: string;
  name: string;
  slug: string;
  status: string;
  image: string | null;
  description: string | null;
  sortOrder?: number;
  createdAt?: any;
};

type KindMeta = {
  key: Kind;
  label: string;
  singular: string;
  collectionName: string;
  hasSortOrder: boolean;
  hasDescription: boolean;
  storagePath: string;
  description: string;
};

const KIND_META: Record<Kind, KindMeta> = {
  brand: {
    key: "brand",
    label: "Brands",
    singular: "Brand",
    collectionName: "brands",
    hasSortOrder: false,
    hasDescription: false,
    storagePath: "brands",
    description: "Product manufacturers shown on the storefront.",
  },
  category: {
    key: "category",
    label: "Categories",
    singular: "Category",
    collectionName: "categories",
    hasSortOrder: true,
    hasDescription: true,
    storagePath: "categories",
    description: "Top-level product groupings used in navigation.",
  },
  collection: {
    key: "collection",
    label: "Collections",
    singular: "Collection",
    collectionName: "collections",
    hasSortOrder: true,
    hasDescription: true,
    storagePath: "collections",
    description: "Curated product groupings (New Arrivals, Bestsellers, etc.).",
  },
};

const TABS: Kind[] = ["brand", "category", "collection"];

/* ------------------------------ helpers --------------------------------- */

const safeId = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const sortItems = (items: Item[], kind: Kind): Item[] => {
  const meta = KIND_META[kind];
  const arr = [...items];
  if (meta.hasSortOrder) {
    arr.sort((a, b) => {
      const ao = typeof a.sortOrder === "number" ? a.sortOrder : 999;
      const bo = typeof b.sortOrder === "number" ? b.sortOrder : 999;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  } else {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  return arr;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB pre-compression
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Downscale + re-encode to WebP client-side to keep Storage cheap and admin
 * fast. Falls back to the original file if the browser can't handle it.
 */
async function compressImage(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  if (!("createImageBitmap" in window)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", 0.85),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/* ------------------------------- main page ------------------------------ */

export default function SettingsPage() {
  const [tab, setTab] = useState<Kind>("brand");

  const [itemsByKind, setItemsByKind] = useState<Record<Kind, Item[]>>({
    brand: [],
    category: [],
    collection: [],
  });
  const [loadingByKind, setLoadingByKind] = useState<Record<Kind, boolean>>({
    brand: true,
    category: true,
    collection: true,
  });
  const [errorByKind, setErrorByKind] = useState<Record<Kind, string | null>>({
    brand: null,
    category: null,
    collection: null,
  });

  /* --------------- create form state --------------- */
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newDescription, setNewDescription] = useState("");
  const newPreview = useObjectUrl(newFile);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  /* --------------- edit state --------------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const editPreview = useObjectUrl(editFile);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  /* --------------- load --------------- */
  const load = useCallback(async (kind: Kind) => {
    const meta = KIND_META[kind];
    setLoadingByKind((p) => ({ ...p, [kind]: true }));
    setErrorByKind((p) => ({ ...p, [kind]: null }));
    try {
      const q = meta.hasSortOrder
        ? query(
            collection(db, meta.collectionName),
            orderBy("sortOrder", "asc"),
          )
        : query(collection(db, meta.collectionName), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const rows: Item[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "",
          slug: data.slug || "",
          status: data.status || "active",
          image: data.image || null,
          description: data.description || null,
          sortOrder:
            typeof data.sortOrder === "number" ? data.sortOrder : undefined,
          createdAt: data.createdAt,
        };
      });
      setItemsByKind((p) => ({ ...p, [kind]: sortItems(rows, kind) }));
    } catch (e) {
      setErrorByKind((p) => ({
        ...p,
        [kind]: (e as Error)?.message?.includes("permission-denied")
          ? "Permission denied. Check Firestore rules."
          : (e as Error)?.message || "Failed to load",
      }));
    } finally {
      setLoadingByKind((p) => ({ ...p, [kind]: false }));
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const items = itemsByKind[tab];
  const loading = loadingByKind[tab];
  const error = errorByKind[tab];
  const meta = KIND_META[tab];

  const nextSortOrder = useMemo(() => {
    const max = items.reduce(
      (m, i) =>
        typeof i.sortOrder === "number" ? Math.max(m, i.sortOrder) : m,
      0,
    );
    return max + 1;
  }, [items]);

  /* --------------- upload helper --------------- */
  const uploadImage = async (
    file: File,
    folder: string,
  ): Promise<{ url: string; path: string }> => {
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop() || "webp";
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${folder}/${key}`;
    const refObj = storageRef(storage, path);
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(refObj, compressed, {
        contentType: compressed.type,
        cacheControl: "public, max-age=31536000, immutable",
      });
      task.on(
        "state_changed",
        undefined,
        (err) => reject(err),
        () => resolve(),
      );
    });
    const url = await getDownloadURL(refObj);
    return { url, path };
  };

  const deleteStorageObject = async (url: string | null | undefined) => {
    if (!url) return;
    try {
      // Only attempt delete if it's a Firebase Storage URL we own.
      const m = url.match(/\/o\/([^?]+)/);
      if (!m) return;
      const path = decodeURIComponent(m[1]);
      await deleteObject(storageRef(storage, path));
    } catch {
      // Non-fatal — orphaned files are just cleanup debt
    }
  };

  /* --------------- create --------------- */
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const slug = safeId(name);
    if (!slug) {
      toast.error("Name must include at least one letter or number");
      return;
    }
    if (newFile && !ACCEPTED.includes(newFile.type)) {
      toast.error("Use JPG, PNG, WebP, or AVIF");
      return;
    }
    if (newFile && newFile.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 8 MB");
      return;
    }

    setCreating(true);
    try {
      const dup = await getDocs(
        query(collection(db, meta.collectionName), where("slug", "==", slug)),
      );
      if (!dup.empty) {
        toast.error(`${meta.singular} "${name}" already exists`);
        return;
      }

      let imageUrl: string | null = null;
      if (newFile) {
        const uploaded = await uploadImage(newFile, meta.storagePath);
        imageUrl = uploaded.url;
      }

      const payload: Record<string, any> = {
        name,
        slug,
        status: "active",
        image: imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (meta.hasDescription && newDescription.trim()) {
        payload.description = newDescription.trim();
      }
      if (meta.hasSortOrder) payload.sortOrder = nextSortOrder;

      const refDoc = await addDoc(collection(db, meta.collectionName), payload);

      const newItem: Item = {
        id: refDoc.id,
        name,
        slug,
        status: "active",
        image: imageUrl,
        description:
          meta.hasDescription && newDescription.trim()
            ? newDescription.trim()
            : null,
        sortOrder: meta.hasSortOrder ? nextSortOrder : undefined,
      };
      setItemsByKind((p) => ({
        ...p,
        [tab]: sortItems([...p[tab], newItem], tab),
      }));

      setNewName("");
      setNewFile(null);
      setNewDescription("");
      if (newFileInputRef.current) newFileInputRef.current.value = "";
      toast.success(`${meta.singular} "${name}" created`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  /* --------------- edit --------------- */
  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || "");
    setEditFile(null);
    setEditRemoveImage(false);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditFile(null);
    setEditRemoveImage(false);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const saveEdit = async (item: Item) => {
    const name = editName.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    const slug = safeId(name);
    if (!slug) {
      toast.error("Name must include at least one letter or number");
      return;
    }

    const nameChanged = name !== item.name;
    const descChanged =
      meta.hasDescription &&
      (editDescription.trim() || null) !== (item.description || null);
    const imageChanged = !!editFile || editRemoveImage;

    if (!nameChanged && !descChanged && !imageChanged) {
      cancelEdit();
      return;
    }
    if (editFile && !ACCEPTED.includes(editFile.type)) {
      toast.error("Use JPG, PNG, WebP, or AVIF");
      return;
    }
    if (editFile && editFile.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 8 MB");
      return;
    }

    setBusyId(item.id);
    try {
      if (nameChanged) {
        const dup = await getDocs(
          query(collection(db, meta.collectionName), where("slug", "==", slug)),
        );
        const conflict = dup.docs.find((d) => d.id !== item.id);
        if (conflict) {
          toast.error(`Slug "${slug}" is already used`);
          return;
        }
      }

      let nextImage: string | null | undefined = undefined;
      if (editFile) {
        const uploaded = await uploadImage(editFile, meta.storagePath);
        nextImage = uploaded.url;
        // Best-effort cleanup of the old file
        await deleteStorageObject(item.image);
      } else if (editRemoveImage) {
        nextImage = null;
        await deleteStorageObject(item.image);
      }

      const payload: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };
      if (nameChanged) {
        payload.name = name;
        payload.slug = slug;
      }
      if (meta.hasDescription) {
        payload.description = editDescription.trim() || null;
      }
      if (nextImage !== undefined) {
        payload.image = nextImage;
      }

      await updateDoc(doc(db, meta.collectionName, item.id), payload);

      setItemsByKind((p) => ({
        ...p,
        [tab]: sortItems(
          p[tab].map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  name,
                  slug,
                  description: meta.hasDescription
                    ? editDescription.trim() || null
                    : x.description,
                  image: nextImage !== undefined ? nextImage : x.image,
                }
              : x,
          ),
          tab,
        ),
      }));
      cancelEdit();
      toast.success("Updated");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  /* --------------- toggle status --------------- */
  const toggleStatus = async (item: Item) => {
    const next = item.status === "active" ? "inactive" : "active";
    setBusyId(item.id);
    try {
      await updateDoc(doc(db, meta.collectionName, item.id), {
        status: next,
        updatedAt: serverTimestamp(),
      });
      setItemsByKind((p) => ({
        ...p,
        [tab]: p[tab].map((x) =>
          x.id === item.id ? { ...x, status: next } : x,
        ),
      }));
      toast.success(next === "active" ? "Activated" : "Deactivated");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  /* --------------- reorder --------------- */
  const move = async (item: Item, dir: -1 | 1) => {
    if (!meta.hasSortOrder) return;
    const sorted = items;
    const idx = sorted.findIndex((x) => x.id === item.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aOrder = typeof a.sortOrder === "number" ? a.sortOrder : idx + 1;
    const bOrder = typeof b.sortOrder === "number" ? b.sortOrder : swapIdx + 1;

    setBusyId(item.id);
    try {
      await Promise.all([
        updateDoc(doc(db, meta.collectionName, a.id), {
          sortOrder: bOrder,
          updatedAt: serverTimestamp(),
        }),
        updateDoc(doc(db, meta.collectionName, b.id), {
          sortOrder: aOrder,
          updatedAt: serverTimestamp(),
        }),
      ]);
      setItemsByKind((p) => ({
        ...p,
        [tab]: sortItems(
          p[tab].map((x) => {
            if (x.id === a.id) return { ...x, sortOrder: bOrder };
            if (x.id === b.id) return { ...x, sortOrder: aOrder };
            return x;
          }),
          tab,
        ),
      }));
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to reorder");
    } finally {
      setBusyId(null);
    }
  };

  /* --------------- delete --------------- */
  const handleDelete = async (item: Item) => {
    if (
      !confirm(
        `Delete ${meta.singular.toLowerCase()} "${item.name}"?\n\nProducts referencing it will keep the old id but it will no longer appear in dropdowns.`,
      )
    )
      return;
    setBusyId(item.id);
    try {
      await deleteDoc(doc(db, meta.collectionName, item.id));
      // Best-effort cleanup of associated image
      await deleteStorageObject(item.image);
      setItemsByKind((p) => ({
        ...p,
        [tab]: p[tab].filter((x) => x.id !== item.id),
      }));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  /* ----------------------------- render ------------------------------- */

  return (
    <div className="max-w-5xl mx-auto space-y-3 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Settings</h1>
          <p className="text-[11px] text-neutral-500">
            Manage store taxonomy used across the catalog.
          </p>
        </div>
        <button
          onClick={() => load(tab)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-1">
          {TABS.map((k) => {
            const active = tab === k;
            const count = itemsByKind[k].length;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {KIND_META[k].label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 inline-flex min-w-[16px] justify-center px-1 py-0.5 text-[9px] font-bold ${
                      active
                        ? "bg-orange-500 text-white"
                        : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-orange-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-neutral-500">{meta.description}</p>

      {error && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Create bar */}
      <div className="bg-white border border-neutral-200 p-3">
        <div className="flex gap-2 flex-col sm:flex-row">
          {/* Image picker */}
          <label
            className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100"
            title="Click to upload image"
          >
            <input
              ref={newFileInputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {newPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={newPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImagePlus className="h-5 w-5 text-neutral-400" />
            )}
            {newPreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setNewFile(null);
                  if (newFileInputRef.current)
                    newFileInputRef.current.value = "";
                }}
                className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
                aria-label="Remove image"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </label>

          <div className="flex-1 min-w-0 space-y-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder={`New ${meta.singular.toLowerCase()} name`}
              className="w-full border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            {meta.hasDescription && (
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description (optional)"
                className="w-full border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start bg-orange-500 px-3 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-neutral-200">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-xs text-neutral-500">
              No {meta.label.toLowerCase()} yet.
            </p>
            <p className="mt-1 text-[11px] text-neutral-400">
              Use the field above to create the first one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item, idx) => {
              const isEditing = editingId === item.id;
              const busy = busyId === item.id;
              const inactive = item.status !== "active";

              return (
                <li
                  key={item.id}
                  className={`px-3 py-2 text-xs transition-colors ${
                    inactive ? "bg-neutral-50" : "hover:bg-neutral-50"
                  }`}
                >
                  {isEditing ? (
                    /* ---------------- Edit mode ---------------- */
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <label
                          className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100"
                          title="Replace image"
                        >
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept={ACCEPTED.join(",")}
                            onChange={(e) =>
                              setEditFile(e.target.files?.[0] ?? null)
                            }
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                          {editPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={editPreview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : !editRemoveImage && item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="h-5 w-5 text-neutral-400" />
                          )}
                        </label>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit(item);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            className="w-full border border-orange-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          {meta.hasDescription && (
                            <input
                              value={editDescription}
                              onChange={(e) =>
                                setEditDescription(e.target.value)
                              }
                              placeholder="Short description (optional)"
                              className="w-full border border-orange-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                            {(editFile || item.image) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditFile(null);
                                  setEditRemoveImage(true);
                                  if (editFileInputRef.current)
                                    editFileInputRef.current.value = "";
                                }}
                                className="underline hover:text-red-600"
                              >
                                Remove image
                              </button>
                            )}
                            {editRemoveImage && (
                              <button
                                type="button"
                                onClick={() => setEditRemoveImage(false)}
                                className="underline hover:text-neutral-900"
                              >
                                Undo remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(item)}
                          disabled={busy}
                          title="Save"
                          className="inline-flex items-center gap-1 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={busy}
                          className="inline-flex items-center gap-1 border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ---------------- View mode ---------------- */
                    <div className="flex items-center gap-2">
                      {/* Order controls */}
                      {meta.hasSortOrder && (
                        <div className="flex flex-col -my-1 shrink-0">
                          <button
                            onClick={() => move(item, -1)}
                            disabled={idx === 0 || busy}
                            title="Move up"
                            className="p-0.5 text-neutral-400 hover:text-orange-600 disabled:opacity-25 disabled:hover:text-neutral-400"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => move(item, 1)}
                            disabled={idx === items.length - 1 || busy}
                            title="Move down"
                            className="p-0.5 text-neutral-400 hover:text-orange-600 disabled:opacity-25 disabled:hover:text-neutral-400"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Thumbnail */}
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-neutral-300">
                            <ImagePlus className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      {/* Name / slug / description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <button
                            onClick={() => startEdit(item)}
                            className={`truncate text-left font-medium ${
                              inactive
                                ? "text-neutral-500 line-through"
                                : "text-neutral-900 hover:text-orange-600"
                            }`}
                            title="Click to edit"
                          >
                            {item.name}
                          </button>
                          <span className="shrink-0 text-[10px] text-neutral-400 font-mono">
                            {item.slug}
                          </span>
                        </div>
                        {meta.hasDescription && item.description && (
                          <p className="truncate text-[10px] text-neutral-500">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <button
                        onClick={() => toggleStatus(item)}
                        disabled={busy}
                        className={`shrink-0 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                          inactive
                            ? "bg-neutral-100 border-neutral-300 text-neutral-600 hover:bg-neutral-200"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        }`}
                        title={inactive ? "Activate" : "Deactivate"}
                      >
                        {inactive ? "Inactive" : "Active"}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={busy}
                        title="Delete"
                        className="p-1 shrink-0 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer hint */}
      {items.length > 0 && (
        <p className="text-[10px] text-neutral-400 text-center">
          Click the name or thumbnail to edit · Toggle the pill to
          activate/deactivate
          {meta.hasSortOrder ? " · Use arrows to reorder" : ""}
        </p>
      )}
    </div>
  );
}
