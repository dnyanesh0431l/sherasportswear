"use client";

import { db } from "@/lib/firebase/client";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ArrowLeft,
  Boxes,
  Check,
  Edit3,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Variant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  pricePaise: number;
  mrpPaise: number;
  status: string;
};

const toPaise = (rupees: string): number => {
  const n = parseFloat(rupees);
  return isNaN(n) ? 0 : Math.round(n * 100);
};
const toRupees = (paise: number | undefined): string =>
  typeof paise === "number" ? (paise / 100).toString() : "";
const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function VariantsPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;

  const [productName, setProductName] = useState<string>("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "archived">(
    "active"
  );

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [pSnap, vSnap] = await Promise.all([
        getDoc(doc(db, "products", productId)),
        getDocs(
          query(
            collection(db, "products", productId, "variants"),
            orderBy("createdAt", "desc")
          )
        ),
      ]);
      setProductName(pSnap.exists() ? pSnap.data().name || productId : productId);
      setVariants(
        vSnap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            sku: v.sku || "",
            size: v.size || "",
            color: v.color || "",
            pricePaise:
              typeof v.pricePaise === "number" ? v.pricePaise : 0,
            mrpPaise: typeof v.mrpPaise === "number" ? v.mrpPaise : 0,
            status: v.status || "active",
          };
        })
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to load variants");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setSize("");
    setColor("");
    setSku("");
    setPrice("");
    setMrp("");
    setStatus("active");
  };

  const startEdit = (v: Variant) => {
    setEditingId(v.id);
    setSize(v.size);
    setColor(v.color);
    setSku(v.sku);
    setPrice(toRupees(v.pricePaise));
    setMrp(toRupees(v.mrpPaise));
    setStatus(v.status as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    if (!sku.trim()) {
      toast.error("SKU is required");
      return;
    }
    if (!price || toPaise(price) <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sku: sku.trim(),
        size: size.trim(),
        color: color.trim(),
        pricePaise: toPaise(price),
        mrpPaise: toPaise(mrp || price),
        status,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "products", productId, "variants", editingId),
          payload
        );
        toast.success("Variant updated");
      } else {
        await addDoc(collection(db, "products", productId, "variants"), {
          ...payload,
          attributes: {},
          images: [],
          createdAt: serverTimestamp(),
        });
        toast.success("Variant added");
      }

      resetForm();
      await load();
    } catch (e) {
      toast.error((e as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Variant) => {
    if (!productId) return;
    if (!confirm(`Delete variant ${v.sku || v.id}?`)) return;
    setBusyId(v.id);
    try {
      await deleteDoc(doc(db, "products", productId, "variants", v.id));
      toast.success("Variant deleted");
      setVariants((prev) => prev.filter((x) => x.id !== v.id));
      if (editingId === v.id) resetForm();
    } catch (e) {
      toast.error((e as Error)?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/products"
          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900">Variants</h1>
          <p className="text-sm text-neutral-500 truncate">{productName}</p>
        </div>
        <Link
          href={`/admin/products/${productId}/edit`}
          className="text-sm font-medium text-orange-600 hover:underline"
        >
          ← Edit product
        </Link>
      </div>

      {/* Add / Edit form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-neutral-200 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-900">
            {editingId ? "Edit variant" : "Add variant"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
            >
              <X className="h-3 w-3" /> Cancel edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            placeholder="SKU *"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className={inputCls}
            required
          />
          <input
            placeholder="Size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className={inputCls}
          />
          <input
            placeholder="Color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className={inputCls}
          />
          <input
            placeholder="Price ₹ *"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
            required
          />
          <input
            placeholder="MRP ₹"
            type="number"
            min="0"
            step="0.01"
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
            className={inputCls}
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "active" | "inactive" | "archived")
            }
            className={inputCls}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {saving ? "Saving…" : editingId ? "Update variant" : "Add variant"}
          </button>
        </div>
      </form>

      {/* Variants table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">
            Existing variants
          </h2>
          <span className="text-xs text-neutral-500">
            {variants.length} total
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
          </div>
        ) : variants.length === 0 ? (
          <div className="p-10 text-center">
            <Boxes className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-neutral-700">
              No variants yet
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Add the first variant above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Size</th>
                  <th className="px-4 py-3 text-left font-medium">Color</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">MRP</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {variants.map((v) => (
                  <tr key={v.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-800">
                      {v.sku || v.id}
                    </td>
                    <td className="px-4 py-3">{v.size || "—"}</td>
                    <td className="px-4 py-3">{v.color || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                      {formatINR(v.pricePaise)}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500">
                      {formatINR(v.mrpPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          v.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : v.status === "inactive"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(v)}
                          title="Edit"
                          className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-orange-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          disabled={busyId === v.id}
                          title="Delete"
                          className="p-2 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {busyId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";