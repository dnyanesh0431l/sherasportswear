import Link from "next/link";
import type { BannerDoc } from "../../lib/home-data";

export function BannerStrip({ banners }: { banners: BannerDoc[] }) {
  return (
    <section>
      {banners.map((b) => {
        const align = b.theme?.alignment ?? "left";
        const overlay = b.theme?.overlayOpacity ?? 0.4;
        const alignmentClass =
          align === "center"
            ? "justify-center text-center"
            : align === "right"
              ? "justify-end text-right"
              : "justify-start text-left";

        return (
          <div key={b.id} className="relative w-full overflow-hidden">
            <div className="relative aspect-[16/6] min-h-[220px] w-full sm:aspect-[16/4]">
              <img
                src={b.image.url}
                alt={b.image.alt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
              <div className={`absolute inset-0 flex items-center ${alignmentClass}`}>
                <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
                  <h2 className="font-display text-4xl uppercase leading-none text-white sm:text-5xl">
                    {b.headline}
                  </h2>
                  {b.subtitle && (
                    <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">{b.subtitle}</p>
                  )}
                  {b.ctaLabel && b.ctaHref && (
                    <Link
                      href={b.ctaHref}
                      className="mt-4 inline-flex items-center gap-2 bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-orange-500 hover:text-white"
                    >
                      {b.ctaLabel} <span aria-hidden>→</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}