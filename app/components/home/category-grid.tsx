import Link from "next/link";
import type { CategoryDoc } from "../../lib/home-data";

export function CategoryGrid({
  title,
  subtitle,
  categories,
}: {
  title: string | null;
  subtitle: string | null;
  categories: CategoryDoc[];
}) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        {(title || subtitle) && (
          <div className="mb-10 sm:mb-14">
            {title && (
              <h2 className="font-display text-4xl uppercase text-white sm:text-5xl">{title}</h2>
            )}
            {subtitle && <p className="mt-2 text-zinc-400">{subtitle}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group relative aspect-square overflow-hidden bg-zinc-900"
            >
              {cat.image ? (
                <img
                  src={cat.image.url}
                  alt={cat.image.alt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
                  <span className="font-display text-7xl uppercase text-zinc-700">
                    {cat.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h3 className="font-display text-3xl uppercase text-white">{cat.name}</h3>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition group-hover:text-orange-400">
                  Shop now <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}