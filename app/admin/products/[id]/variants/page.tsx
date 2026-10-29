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
  inventoryValue: number;
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
  const [inventory, setInventory] = useState("0");
  const [status, setStatus] = useState<"active" | "inactive" | "archived">(
    "active",
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
            orderBy("createdAt", "desc"),
          ),
        ),
      ]);
      setProductName(
        pSnap.exists() ? pSnap.data().name || productId : productId,
      );
      setVariants(
        vSnap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            sku: v.sku || "",
            size: v.size || "",
            color: v.color || "",
            pricePaise: typeof v.pricePaise === "number" ? v.pricePaise : 0,
            mrpPaise: typeof v.mrpPaise === "number" ? v.mrpPaise : 0,
            inventoryValue:
              typeof v.inventoryValue === "number" ? v.inventoryValue : 0,
            status: v.status || "active",
          };
        }),
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
    setInventory("0");
    setStatus("active");
  };

  const startEdit = (v: Variant) => {
    setEditingId(v.id);
    setSize(v.size);
    setColor(v.color);
    setSku(v.sku);
    setPrice(toRupees(v.pricePaise));
    setMrp(toRupees(v.mrpPaise));
    setInventory(v.inventoryValue.toString());
    setStatus(v.status as any);
    // Scroll to form smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        inventoryValue: parseInt(inventory, 10) || 0,
        status,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "products", productId, "variants", editingId),
          payload,
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
    if (!confirm(`Are you sure you want to delete variant ${v.sku || v.id}?`))
      return;
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
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
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
            <h1 className="text-xl font-bold text-neutral-900">
              Manage Variants
            </h1>
            <p className="text-xs text-neutral-500 truncate max-w-md">
              {productName}
            </p>
          </div>
        </div>
        <Link
          href={`/admin/products/${productId}/edit`}
          className="text-sm font-medium text-orange-600 hover:underline px-2 py-1"
        >
          ← Back to Product Edit
        </Link>
      </div>

      {/* Add / Edit form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-neutral-200 p-4 space-y-3"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-semibold text-sm text-neutral-900">
            {editingId ? "Edit Variant" : "Add New Variant"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              <X className="h-3 w-3" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Field label="SKU *" hint="Unique ID">
            <input
              placeholder="e.g. CLB-RED-9"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Size">
            <input
              placeholder="e.g. 9"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Color">
            <input
              placeholder="e.g. Black/Red"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Price (₹) *">
            <input
              placeholder="0"
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="MRP (₹)">
            <input
              placeholder="0"
              type="number"
              min="0"
              step="1"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Stock Qty">
            <input
              placeholder="0"
              type="number"
              min="0"
              value={inventory}
              onChange={(e) => setInventory(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div className="w-1/3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as "active" | "inactive" | "archived",
                  )
                }
                className={inputCls}
              >
                <option value="active">Active (Visible)</option>
                <option value="inactive">Inactive (Hidden)</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 mt-5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {saving ? "Saving…" : editingId ? "Update Variant" : "Add Variant"}
          </button>
        </div>
      </form>

      {/* Variants table */}
      <div className="bg-white border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <h2 className="font-semibold text-sm text-neutral-900">
            Existing Variants
          </h2>
          <span className="text-xs font-medium text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5">
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
              Use the form above to add the first variant (size, color, etc.).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-xs">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs">
                    Size
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs">
                    Color
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs">
                    Price
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs">
                    MRP
                  </th>
                  <th className="px-4 py-2 text-center font-medium text-xs">
                    Stock
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-xs">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-xs">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {variants.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral-800">
                      {v.sku || v.id}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{v.size || "—"}</td>
                    <td className="px-4 py-2.5">{v.color || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-900">
                      {formatINR(v.pricePaise)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-500 line-through">
                      {v.mrpPaise > v.pricePaise ? formatINR(v.mrpPaise) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium border ${v.inventoryValue > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}
                      >
                        {v.inventoryValue}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex text-[10px] uppercase tracking-wide px-2 py-0.5 border ${
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
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(v)}
                          title="Edit"
                          className="p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-orange-600 transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          disabled={busyId === v.id}
                          title="Delete"
                          className="p-1.5 text-neutral-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
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
