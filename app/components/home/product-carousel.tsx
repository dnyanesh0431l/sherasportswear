import Link from "next/link";
import type { ProductDoc } from "../../lib/home-data";
import { ProductCard } from "./product-card";

export function ProductCarousel({
  title,
  subtitle,
  products,
}: {
  title: string | null;
  subtitle: string | null;
  products: ProductDoc[];
}) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mb-10 flex items-end justify-between sm:mb-14">
          <div>
            {title && (
              <h2 className="font-display text-4xl uppercase text-white sm:text-5xl">{title}</h2>
            )}
            {subtitle && <p className="mt-2 text-zinc-400">{subtitle}</p>}
          </div>
          {products.length > 4 && (
            <Link
              href="/products"
              className="hidden shrink-0 text-sm font-medium text-zinc-400 transition hover:text-white sm:block"
            >
              View all →
            </Link>
          )}
        </div>

        <div className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {products.map((p) => (
            <div key={p.id} className="w-64 flex-shrink-0 snap-start sm:w-auto">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}