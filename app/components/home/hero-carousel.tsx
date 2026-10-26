"use client";
import Link from "next/link";
import { useState } from "react";
import type { BannerDoc } from "../../lib/home-data";

export function HeroCarousel({ banners }: { banners: BannerDoc[] }) {
  const [current, setCurrent] = useState(0);
  const b = banners[current];
  const align = b.theme?.alignment ?? "left";
  const overlay = b.theme?.overlayOpacity ?? 0.4;
  const textColor = b.theme?.textColor ?? "#FFFFFF";

  const alignmentClass =
    align === "center"
      ? "items-center justify-center text-center"
      : align === "right"
        ? "items-center justify-end text-right"
        : "items-center justify-start text-left";

  return (
    <section className="relative w-full overflow-hidden bg-zinc-900">
      <div className="relative aspect-[4/5] w-full sm:aspect-[21/9]">
        <img
          src={b.image.url}
          alt={b.image.alt}
          className="hidden h-full w-full object-cover sm:block"
          fetchPriority="high"
        />
        <img
          src={(b.mobileImage ?? b.image).url}
          alt={(b.mobileImage ?? b.image).alt}
          className="h-full w-full object-cover sm:hidden"
          fetchPriority="high"
        />

        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, rgba(0,0,0,${overlay + 0.25}) 0%, rgba(0,0,0,${overlay * 0.5}) 60%, rgba(0,0,0,0) 100%)`,
          }}
        />

        <div className={`absolute inset-0 flex ${alignmentClass}`}>
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-8" style={{ color: textColor }}>
            <div className="max-w-xl">
              <h1 className="font-display text-5xl uppercase leading-[0.9] sm:text-7xl lg:text-8xl">
                {b.headline}
              </h1>
              {b.subtitle && (
                <p className="mt-4 max-w-lg text-sm text-white/80 sm:text-base">
                  {b.subtitle}
                </p>
              )}
              {b.ctaLabel && b.ctaHref && (
                <Link
                  href={b.ctaHref}
                  className="mt-6 inline-flex items-center gap-2 bg-orange-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-orange-600"
                >
                  {b.ctaLabel}
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}