// app/admin/settings/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
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
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/* -------------------------------- types --------------------------------- */

type Kind = "brand" | "category" | "collection";

type Item = {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder?: number;
  createdAt?: any;
};

type KindMeta = {
  key: Kind;
  label: string;
  singular: string;
  collectionName: string;
  hasSortOrder: boolean;
  description: string;
};

const KIND_META: Record<Kind, KindMeta> = {
  brand: {
    key: "brand",
    label: "Brands",
    singular: "Brand",
    collectionName: "brands",
    hasSortOrder: false,
    description: "Product manufacturers shown on the storefront.",
  },
  category: {
    key: "category",
    label: "Categories",
    singular: "Category",
    collectionName: "categories",
    hasSortOrder: true,
    description: "Top-level product groupings used in navigation.",
  },
  collection: {
    key: "collection",
    label: "Collections",
    singular: "Collection",
    collectionName: "collections",
    hasSortOrder: true,
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
  const [errorByKind, setErrorByKind] = useState<
    Record<Kind, string | null>
  >({ brand: null, category: null, collection: null });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);

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
        : query(
            collection(db, meta.collectionName),
            orderBy("name", "asc"),
          );
      const snap = await getDocs(q);
      const rows: Item[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "",
          slug: data.slug || "",
          status: data.status || "active",
          sortOrder:
            typeof data.sortOrder === "number" ? data.sortOrder : undefined,
          createdAt: data.createdAt,
        };
      });
      setItemsByKind((p) => ({ ...p, [kind]: sortItems(rows, kind) }));
    } catch (e) {
      setErrorByKind((p) => ({
        ...p,
        [kind]:
          (e as Error)?.message?.includes("permission-denied")
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
      (m, i) => (typeof i.sortOrder === "number" ? Math.max(m, i.sortOrder) : m),
      0,
    );
    return max + 1;
  }, [items]);

  /* ----------------------------- create ------------------------------- */

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

    setCreating(true);
    try {
      const dup = await getDocs(
        query(
          collection(db, meta.collectionName),
          where("slug", "==", slug),
        ),
      );
      if (!dup.empty) {
        toast.error(`${meta.singular} "${name}" already exists`);
        return;
      }

      const payload: Record<string, any> = {
        name,
        slug,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (meta.hasSortOrder) payload.sortOrder = nextSortOrder;

      const refDoc = await addDoc(
        collection(db, meta.collectionName),
        payload,
      );

      const newItem: Item = {
        id: refDoc.id,
        name,
        slug,
        status: "active",
        sortOrder: meta.hasSortOrder ? nextSortOrder : undefined,
      };
      setItemsByKind((p) => ({
        ...p,
        [tab]: sortItems([...p[tab], newItem], tab),
      }));
      setNewName("");
      toast.success(`${meta.singular} "${name}" created`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  /* ----------------------------- rename ------------------------------- */

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (item: Item) => {
    const name = editingName.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    if (name === item.name) {
      cancelEdit();
      return;
    }
    const slug = safeId(name);
    if (!slug) {
      toast.error("Name must include at least one letter or number");
      return;
    }
    setBusyId(item.id);
    try {
      // Slug conflict (excluding self)
      const dup = await getDocs(
        query(
          collection(db, meta.collectionName),
          where("slug", "==", slug),
        ),
      );
      const conflict = dup.docs.find((d) => d.id !== item.id);
      if (conflict) {
        toast.error(`Slug "${slug}" is already used`);
        return;
      }
      await updateDoc(doc(db, meta.collectionName, item.id), {
        name,
        slug,
        updatedAt: serverTimestamp(),
      });
      setItemsByKind((p) => ({
        ...p,
        [tab]: sortItems(
          p[tab].map((x) =>
            x.id === item.id ? { ...x, name, slug } : x,
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

  /* ---------------------------- toggle status -------------------------- */

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

  /* ---------------------------- reorder ------------------------------- */

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

  /* ---------------------------- delete -------------------------------- */

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

      {/* Description */}
      <p className="text-[11px] text-neutral-500">{meta.description}</p>

      {error && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Create bar */}
      <div className="bg-white border border-neutral-200 p-3">
        <div className="flex gap-1.5">
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
            className="flex-1 border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="inline-flex items-center gap-1.5 bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
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
                  className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    inactive ? "bg-neutral-50" : "hover:bg-neutral-50"
                  }`}
                >
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

                  {/* Name / slug */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit(item);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="w-full border border-orange-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    ) : (
                      <div className="flex items-baseline gap-2 min-w-0">
                        <button
                          onClick={() => startEdit(item)}
                          className={`truncate text-left font-medium ${
                            inactive
                              ? "text-neutral-500 line-through"
                              : "text-neutral-900 hover:text-orange-600"
                          }`}
                          title="Click to rename"
                        >
                          {item.name}
                        </button>
                        <span className="shrink-0 text-[10px] text-neutral-400 font-mono">
                          {item.slug}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <button
                    onClick={() => toggleStatus(item)}
                    disabled={busy || isEditing}
                    className={`shrink-0 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                      inactive
                        ? "bg-neutral-100 border-neutral-300 text-neutral-600 hover:bg-neutral-200"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    }`}
                    title={inactive ? "Activate" : "Deactivate"}
                  >
                    {inactive ? "Inactive" : "Active"}
                  </button>

                  {/* Actions */}
                  {isEditing ? (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => saveEdit(item)}
                        disabled={busy}
                        title="Save"
                        className="p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={busy}
                        title="Cancel"
                        className="p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
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
          Click a name to rename · Toggle the pill to activate/deactivate
          {meta.hasSortOrder ? " · Use arrows to reorder" : ""}
        </p>
      )}
    </div>
  );
}