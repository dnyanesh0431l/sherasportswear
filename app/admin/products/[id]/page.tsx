// app/admin/products/[id]/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
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
  Calendar,
  Copy,
  Edit3,
  Image as ImageIcon,
  Loader2,
  Package,
  Tag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Variant = {
  id: string;
  size: string;
  color: string;
  sku: string;
  pricePaise: number;
  mrpPaise: number;
  inventoryValue: number;
  status: string;
};

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function ProductViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [pSnap, vSnap] = await Promise.all([
          getDoc(doc(db, "products", id)),
          getDocs(
            query(
              collection(db, "products", id, "variants"),
              orderBy("size", "asc"),
            ),
          ),
        ]);
        if (!pSnap.exists()) {
          setNotFound(true);
          return;
        }
        setProduct({ id: pSnap.id, ...pSnap.data() });
        setVariants(
          vSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              size: data.size || "",
              color: data.color || "",
              sku: data.sku || "",
              pricePaise:
                typeof data.pricePaise === "number" ? data.pricePaise : 0,
              mrpPaise: typeof data.mrpPaise === "number" ? data.mrpPaise : 0,
              inventoryValue:
                typeof data.inventoryValue === "number"
                  ? data.inventoryValue
                  : 0,
              status: data.status || "active",
            };
          }),
        );
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleStatus = async () => {
    if (!product || togglingStatus) return;
    setTogglingStatus(true);
    const nextStatus = product.status === "active" ? "draft" : "active";
    try {
      await updateDoc(doc(db, "products", product.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setProduct({ ...product, status: nextStatus });
      toast.success(
        nextStatus === "active" ? "Product activated" : "Product set to draft",
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(product.id);
      toast.success("Product ID copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-6xl mx-auto p-10 text-center">
        <Package className="h-10 w-10 text-neutral-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-neutral-700">
          Product not found
        </p>
        <Link
          href="/admin/products"
          className="inline-block mt-3 text-sm text-orange-600 hover:underline"
        >
          Back to products
        </Link>
      </div>
    );
  }

  const images: string[] = Array.isArray(product.images) ? product.images : [];
  const attributes: Record<string, string> =
    product.attributes && typeof product.attributes === "object"
      ? product.attributes
      : {};
  const attributeEntries = Object.entries(attributes);
  const collectionIds: string[] = Array.isArray(product.collectionIds)
    ? product.collectionIds
    : [];
  const hasVariants = !!product.hasVariants && variants.length > 0;
  const isActive = product.status === "active";

  const totalStock = hasVariants
    ? variants.reduce((s, v) => s + (v.inventoryValue || 0), 0)
    : typeof product.inventoryValue === "number"
      ? product.inventoryValue
      : 0;

  const totalVariantValue = hasVariants
    ? variants.reduce(
        (s, v) => s + (v.pricePaise || 0) * (v.inventoryValue || 0),
        0,
      )
    : (product.basePricePaise || 0) * totalStock;

  const hasDiscount =
    product.mrpPaise > product.basePricePaise && product.basePricePaise > 0;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.mrpPaise - product.basePricePaise) / product.mrpPaise) * 100,
      )
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-3 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/products")}
            className="p-1.5 text-neutral-500 hover:bg-neutral-100"
            title="Back to products"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              {product.name}
            </h1>
            <p className="text-[11px] text-neutral-500">/{product.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleStatus}
            disabled={togglingStatus}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
              isActive
                ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                : "bg-neutral-50 border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {togglingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive ? "bg-green-500" : "bg-neutral-400"
                }`}
              />
            )}
            {isActive ? "Active" : "Draft"}
          </button>
          <button
            onClick={() => router.push(`/admin/products/${product.id}/edit`)}
            className="inline-flex items-center gap-1.5 bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* LEFT: hero image + details */}
        <div className="lg:col-span-2 space-y-3">
          {/* Image hero */}
          <section className="bg-white border border-neutral-200 p-3">
            {images.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs italic">No images uploaded</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative aspect-[4/3] w-full border border-neutral-200 bg-neutral-50 overflow-hidden">
                  <Image
                    src={images[activeImage] || images[0]}
                    alt={product.name}
                    fill
                    className="object-contain"
                  />
                </div>
                {images.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {images.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`relative h-16 w-16 border overflow-hidden transition-colors ${
                          activeImage === i
                            ? "border-orange-500 ring-1 ring-orange-500"
                            : "border-neutral-200 hover:border-neutral-400"
                        }`}
                      >
                        <Image
                          src={url}
                          alt={`thumb ${i}`}
                          fill
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Short description */}
          {product.shortDescription && (
            <section className="bg-white border border-neutral-200 p-3 space-y-1.5">
              <h2 className="font-semibold text-xs text-neutral-900 border-b pb-1.5 uppercase tracking-wide">
                Description
              </h2>
              <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed">
                {product.shortDescription}
              </p>
            </section>
          )}

          {/* Variants */}
          {hasVariants && (
            <section className="bg-white border border-neutral-200 p-3 space-y-2">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h2 className="font-semibold text-xs text-neutral-900 uppercase tracking-wide">
                  Variants
                </h2>
                <span className="text-[11px] text-neutral-500">
                  {variants.length} variant
                  {variants.length === 1 ? "" : "s"} · {totalStock} in stock
                </span>
              </div>
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
                      <th className="px-2 py-1.5 text-left font-medium">SKU</th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Price
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        MRP
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Stock
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-neutral-50">
                        <td className="px-2 py-1 font-medium whitespace-nowrap">
                          {v.size}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {v.color}
                        </td>
                        <td className="px-2 py-1 font-mono text-[10px]">
                          {v.sku}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">
                          {formatINR(v.pricePaise)}
                        </td>
                        <td className="px-2 py-1 text-right text-neutral-400 line-through">
                          {v.mrpPaise > v.pricePaise
                            ? formatINR(v.mrpPaise)
                            : "—"}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <span
                            className={`font-medium ${
                              v.inventoryValue === 0
                                ? "text-red-600"
                                : v.inventoryValue < 5
                                  ? "text-amber-600"
                                  : "text-neutral-900"
                            }`}
                          >
                            {v.inventoryValue}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right">
                          <span
                            className={`inline-flex text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 border ${
                              v.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Attributes */}
          {attributeEntries.length > 0 && (
            <section className="bg-white border border-neutral-200 p-3 space-y-2">
              <h2 className="font-semibold text-xs text-neutral-900 border-b pb-1.5 uppercase tracking-wide">
                Attributes
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {attributeEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between border border-neutral-200 px-2 py-1 text-[11px]"
                  >
                    <span className="text-neutral-500">{key}</span>
                    <span className="font-medium text-neutral-900 text-right truncate ml-2">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: big, readable info cards */}
        <div className="space-y-3">
          {/* Pricing hero card */}
          <section className="bg-white border border-neutral-200">
            <div className="px-4 pt-3 pb-2 border-b border-neutral-200">
              <h2 className="font-semibold text-sm text-neutral-900">
                Pricing
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] text-neutral-500 mb-1">
                  Selling price
                </p>
                <p className="text-2xl font-bold text-neutral-900 leading-none">
                  {formatINR(product.basePricePaise || 0)}
                </p>
                {hasDiscount && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-neutral-400 line-through">
                      {formatINR(product.mrpPaise)}
                    </span>
                    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5">
                      {discountPct}% OFF
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-100">
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">
                    Total stock
                  </p>
                  <p
                    className={`text-lg font-bold leading-none ${
                      totalStock === 0
                        ? "text-red-600"
                        : totalStock < 5
                          ? "text-amber-600"
                          : "text-neutral-900"
                    }`}
                  >
                    {totalStock}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">
                    Stock value
                  </p>
                  <p className="text-lg font-bold text-neutral-900 leading-none">
                    {formatINR(totalVariantValue)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Organization */}
          <section className="bg-white border border-neutral-200">
            <div className="px-4 pt-3 pb-2 border-b border-neutral-200">
              <h2 className="font-semibold text-sm text-neutral-900">
                Organization
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow label="Brand" value={product.brandName || "—"} />
              <InfoRow
                label="Gender"
                value={
                  product.gender
                    ? product.gender.charAt(0).toUpperCase() +
                      product.gender.slice(1)
                    : "—"
                }
              />
              <InfoRow label="Category" value={product.categoryId || "—"} />

              <div className="pt-2 border-t border-neutral-100">
                <p className="text-[11px] text-neutral-500 mb-1.5">
                  Collections
                </p>
                {collectionIds.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 italic">None</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {collectionIds.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Details */}
          <section className="bg-white border border-neutral-200">
            <div className="px-4 pt-3 pb-2 border-b border-neutral-200">
              <h2 className="font-semibold text-sm text-neutral-900">
                Details
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow
                label="Type"
                value={hasVariants ? "Has variants" : "Simple"}
              />
              <div>
                <p className="text-[11px] text-neutral-500 mb-1">Product ID</p>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 text-[11px] font-mono bg-neutral-50 border border-neutral-200 px-2 py-1 truncate text-neutral-700">
                    {product.id}
                  </code>
                  <button
                    onClick={copyId}
                    className="p-1.5 text-neutral-500 hover:bg-neutral-100 border border-neutral-200"
                    title="Copy ID"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Created</p>
                  <p className="text-xs font-medium text-neutral-900 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-neutral-400" />
                    {formatDate(product.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Updated</p>
                  <p className="text-xs font-medium text-neutral-900 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-neutral-400" />
                    {formatDate(product.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-900 text-right truncate">
        {value}
      </span>
    </div>
  );
}

function formatDate(ts: any): string {
  if (!ts) return "—";
  try {
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
