import Link from "next/link";
import type { ProductDoc } from "../../lib/home-data";

export function formatINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function ProductCard({ product }: { product: ProductDoc }) {
  const primary = product.images?.[0];
  const hover = product.hoverImage ?? product.images?.[1] ?? null;

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden bg-zinc-900">
        {primary && (
          <img
            src={primary.url}
            alt={primary.alt}
            className="h-full w-full object-cover transition duration-500 group-hover:opacity-0"
            loading="lazy"
          />
        )}
        {hover && (
          <img
            src={hover.url}
            alt={hover.alt}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
            loading="lazy"
          />
        )}
        {product.discountPercent > 0 && (
          <span className="absolute left-3 top-3 bg-orange-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {product.discountPercent}% off
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {product.brand}
        </p>
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-100 transition group-hover:text-white">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">{formatINR(product.price)}</span>
          {product.mrp > product.price && (
            <span className="text-xs text-zinc-500 line-through">{formatINR(product.mrp)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}