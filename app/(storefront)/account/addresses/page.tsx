"use client";

import { useEffect, useState } from "react";
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
} from "firebase/firestore";
import {
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase/client";
import { useCustomer } from "../layout-client";

type Address = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label: string;
  isDefault: boolean;
};

const EMPTY: Omit<Address, "id"> = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  label: "",
  isDefault: false,
};

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function AddressesPage() {
  const user = useCustomer();
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // "new" | addressId | null
  const [form, setForm] = useState<Omit<Address, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", user.uid, "addresses"),
          orderBy("createdAt", "desc")
        )
      );
      setItems(
        snap.docs.map((d) => {
          const a = d.data();
          return {
            id: d.id,
            fullName: a.fullName || "",
            phone: a.phone || "",
            line1: a.line1 || "",
            line2: a.line2 || "",
            city: a.city || "",
            state: a.state || "",
            postalCode: a.postalCode || "",
            country: a.country || "India",
            label: a.label || "",
            isDefault: !!a.isDefault,
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  const startNew = () => {
    setEditing("new");
    setForm(EMPTY);
  };

  const startEdit = (a: Address) => {
    setEditing(a.id);
    setForm({
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      label: a.label,
      isDefault: a.isDefault,
    });
  };

  const cancel = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error("Full name and phone are required");
      return;
    }
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim()) {
      toast.error("Address line 1, city, and state are required");
      return;
    }
    if (!/^\d{4,10}$/.test(form.postalCode.trim())) {
      toast.error("Postal code must be 4–10 digits");
      return;
    }
    if (!/^\+?\d[\d\s-]{6,}$/.test(form.phone.trim())) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim() || "India",
        label: form.label.trim(),
        isDefault: form.isDefault,
        updatedAt: serverTimestamp(),
      };

      // If this address is now default, unset any previous default
      if (form.isDefault) {
        const prevDefaults = items.filter(
          (x) => x.isDefault && x.id !== editing
        );
        for (const prev of prevDefaults) {
          await updateDoc(
            doc(db, "users", user.uid, "addresses", prev.id),
            { isDefault: false, updatedAt: serverTimestamp() }
          );
        }
      }

      if (editing === "new") {
        await addDoc(collection(db, "users", user.uid, "addresses"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Address saved");
      } else {
        await updateDoc(
          doc(db, "users", user.uid, "addresses", editing),
          payload
        );
        toast.success("Address updated");
      }

      cancel();
      await load();
    } catch (e) {
      toast.error((e as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Address) => {
    if (!confirm(`Delete address for ${a.fullName}?`)) return;
    setDeleting(a.id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "addresses", a.id));
      toast.success("Address deleted");
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      toast.error((e as Error)?.message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const makeDefault = async (a: Address) => {
    try {
      // Unset all
      for (const x of items) {
        if (x.isDefault && x.id !== a.id) {
          await updateDoc(
            doc(db, "users", user.uid, "addresses", x.id),
            { isDefault: false }
          );
        }
      }
      await updateDoc(doc(db, "users", user.uid, "addresses", a.id), {
        isDefault: true,
        updatedAt: serverTimestamp(),
      });
      toast.success("Default address updated");
      await load();
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to update");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide text-neutral-900">
            Addresses
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} saved
          </p>
        </div>
        {!editing && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add address
          </button>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <form
          onSubmit={save}
          className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">
              {editing === "new" ? "New address" : "Edit address"}
            </h3>
            <button
              type="button"
              onClick={cancel}
              className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              placeholder="Full name *"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              className={inputCls}
            />
            <input
              placeholder="Phone *"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              className={inputCls}
            />
          </div>
          <input
            placeholder="Address line 1 *"
            value={form.line1}
            onChange={(e) => setForm({ ...form, line1: e.target.value })}
            required
            className={inputCls}
          />
          <input
            placeholder="Address line 2 (optional)"
            value={form.line2}
            onChange={(e) => setForm({ ...form, line2: e.target.value })}
            className={inputCls}
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              placeholder="City *"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
              className={inputCls}
            />
            <input
              placeholder="State *"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              required
              className={inputCls}
            />
            <input
              placeholder="PIN code *"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              required
              className={inputCls}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              placeholder="Country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Label (Home / Work)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-neutral-700">
              Set as default address
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
        </div>
      ) : items.length === 0 && !editing ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
          <MapPin className="h-10 w-10 text-neutral-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-neutral-700">
            No addresses yet
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Add an address to speed up checkout.
          </p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="bg-white rounded-xl border border-neutral-200 p-4 relative"
            >
              {a.isDefault && (
                <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  Default
                </span>
              )}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="font-medium text-neutral-900">
                  {a.fullName}
                </span>
                {a.label && (
                  <span className="text-[10px] uppercase tracking-wide bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                    {a.label}
                  </span>
                )}
              </div>
              <div className="text-sm text-neutral-700 leading-relaxed">
                {a.line1}
                {a.line2 && <>, {a.line2}</>}
                <br />
                {[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}
                <br />
                {a.country}
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Phone: {a.phone}
              </div>

              <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2 flex-wrap">
                {!a.isDefault && (
                  <button
                    onClick={() => makeDefault(a)}
                    className="text-xs font-medium text-orange-600 hover:underline"
                  >
                    Set as default
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => startEdit(a)}
                  className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100"
                  aria-label="Edit address"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(a)}
                  disabled={deleting === a.id}
                  className="p-1.5 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label="Delete address"
                >
                  {deleting === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}