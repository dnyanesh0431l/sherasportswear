// app/(storefront)/products/[slug]/page.tsx
"use client";

import { useCart } from "./../../../context/cart-context";
import { useWishlist } from "./../../../context/wishlist-context";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowLeft,
  Check,
  Heart,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "../../../../lib/firebase/client";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  colors: string[];
  sizes: string[];
  categoryId: string;
  stock: number;
};

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const { addItem: addToCart } = useCart();
  const {
    addItem: addToWishlist,
    removeItem: removeFromWishlist,
    isInWishlist,
  } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const q = query(collection(db, "products"), where("slug", "==", slug));
        const snap = await getDocs(q);

        if (snap.empty) {
          setLoading(false);
          return;
        }

        const d = snap.docs[0];
        const p = d.data();
        setProduct({
          id: d.id,
          name: p.name || "",
          slug: p.slug || d.id,
          description:
            p.description ||
            "Premium performance wear engineered for the modern athlete.",
          basePricePaise:
            typeof p.basePricePaise === "number" ? p.basePricePaise : 0,
          mrpPaise: typeof p.mrpPaise === "number" ? p.mrpPaise : 0,
          images: Array.isArray(p.images) ? p.images : [],
          colors: Array.isArray(p.colors) ? p.colors : ["#000000"],
          sizes: Array.isArray(p.sizes) ? p.sizes : ["S", "M", "L", "XL"],
          categoryId: p.categoryId || "",
          stock: typeof p.stock === "number" ? p.stock : 10,
        });
        if (Array.isArray(p.sizes) && p.sizes.length > 0) {
          setSelectedSize(p.sizes[0]);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleAddToCart = () => {
    if (product?.sizes.length && !selectedSize) {
      toast.error("Please select a size");
      return;
    }

    addToCart({
      id: product!.id,
      name: product!.name,
      slug: product!.slug,
      price: product!.basePricePaise,
      mrp: product!.mrpPaise,
      image: product!.images[0] || "",
      size: selectedSize || "One Size",
      color: product!.colors[selectedColor] || "#000000",
      quantity: quantity,
    });

    toast.success("Added to cart!");
  };

  const toggleWishlist = () => {
    if (!product) return;
    const isSaved = isInWishlist(product.id);
    if (isSaved) {
      removeFromWishlist(product.id);
      toast.info("Removed from wishlist");
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.basePricePaise,
        mrp: product.mrpPaise,
        image: product.images[0] || "",
      });
      toast.success("Added to wishlist");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-4 text-center">
        <h1 className="text-2xl font-black italic uppercase">
          Product Not Found
        </h1>
        <p className="mt-2 text-neutral-500">
          The item you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/products"
          className="mt-6 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const discount =
    product.mrpPaise > product.basePricePaise
      ? Math.round(
          ((product.mrpPaise - product.basePricePaise) / product.mrpPaise) *
            100,
        )
      : 0;

  const isSaved = isInWishlist(product.id);

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-brand transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-100">
              {product.images[activeImage] ? (
                <img
                  src={product.images[activeImage]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-neutral-300">
                  No Image
                </div>
              )}
              {discount > 0 && (
                <span className="absolute left-4 top-4 rounded bg-brand px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                  {discount}% OFF
                </span>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                      activeImage === i
                        ? "border-brand"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand mb-2">
              Shera Sports Wear
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black italic uppercase leading-[0.95] tracking-tight text-neutral-950">
              {product.name}
            </h1>

            <div className="mt-4 flex items-end gap-3">
              <span className="text-2xl font-bold text-neutral-950">
                {formatINR(product.basePricePaise)}
              </span>
              {product.mrpPaise > product.basePricePaise && (
                <>
                  <span className="text-lg text-neutral-400 line-through mb-0.5">
                    {formatINR(product.mrpPaise)}
                  </span>
                  <span className="text-sm font-bold text-emerald-600 mb-1">
                    Save {formatINR(product.mrpPaise - product.basePricePaise)}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Tax included. Shipping calculated at checkout.
            </p>

            <div className="mt-8 border-t border-neutral-200 pt-6">
              {/* Colors */}
              {product.colors.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-3">
                    Color
                  </h3>
                  <div className="flex gap-3">
                    {product.colors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedColor(i)}
                        className={`grid h-8 w-8 place-items-center rounded-full border-2 transition-all ${
                          selectedColor === i
                            ? "border-neutral-900 scale-110"
                            : "border-neutral-200"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select color ${color}`}
                      >
                        {selectedColor === i && (
                          <Check className="h-4 w-4 text-white mix-blend-difference" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                      Size
                    </h3>
                    <button className="text-[11px] text-neutral-500 underline hover:text-brand">
                      Size Guide
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`h-11 rounded-md border text-sm font-semibold transition-all ${
                          selectedSize === size
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity & Add to Cart */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <div className="flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2 sm:w-32 shrink-0">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="text-neutral-500 hover:text-black"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-semibold text-sm">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="text-neutral-500 hover:text-black"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 rounded-md bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-brand-hover flex items-center justify-center gap-2"
                >
                  Add to Cart
                </button>
                <button
                  onClick={toggleWishlist}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-md border transition-colors ${
                    isSaved
                      ? "border-brand text-brand"
                      : "border-neutral-300 text-neutral-500 hover:text-brand hover:border-brand"
                  }`}
                >
                  <Heart className={`h-5 w-5 ${isSaved ? "fill-brand" : ""}`} />
                </button>
              </div>
            </div>

            {/* Description / Accordion */}
            <div className="mt-10 border-t border-neutral-200 pt-6">
              <h3 className="text-sm font-bold text-neutral-900 mb-2">
                Product Details
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-8">
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto text-neutral-800 mb-2" />
                <p className="text-[10px] font-bold uppercase">Fast Delivery</p>
              </div>
              <div className="text-center">
                <RotateCcw className="h-6 w-6 mx-auto text-neutral-800 mb-2" />
                <p className="text-[10px] font-bold uppercase">7-Day Returns</p>
              </div>
              <div className="text-center">
                <ShieldCheck className="h-6 w-6 mx-auto text-neutral-800 mb-2" />
                <p className="text-[10px] font-bold uppercase">
                  Secure Checkout
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <ProductDetail />
    </Suspense>
  );
}
