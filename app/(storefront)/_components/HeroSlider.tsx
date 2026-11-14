// app/(storefront)/_components/HeroSlider.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

const SLIDE_MS = 5000;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setInterval(() => go(1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [count, paused, go]);

  if (!count) return null;

  return (
    <section
      className="relative w-full overflow-hidden bg-neutral-950 group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        setPaused(false);
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (count > 1 && Math.abs(dx) > 40) {
          go(dx < 0 ? 1 : -1);
        }
      }}
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      <div className="relative w-full h-auto md:h-[65vh] lg:h-[75vh] max-h-[800px]">
        {slides.map((s, i) => {
          const active = i === index;
          return (
            <Link
              key={s.id}
              href={s.ctaUrl || "/products"}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              className={`w-full block transition-opacity duration-700 ease-in-out ${FOCUS} ${
                active
                  ? "relative z-10 opacity-100"
                  : "absolute inset-0 z-0 opacity-0 pointer-events-none"
              }`}
            >
              {s.imageUrl && (
                <img
                  src={s.imageUrl}
                  alt={s.title || "Hero Banner"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  loading={i === 0 ? "eager" : "lazy"}
                  className={`w-full h-auto object-contain md:h-full md:object-cover md:object-[center_30%] transition-transform duration-[2000ms] ease-out ${
                    active ? "scale-100" : "scale-105"
                  }`}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* 
        Arrows को नीचे की तरफ (bottom-6) कर दिया है ताकि ये इमेज के बीच में आकर कंटेंट को न ढकें।
        मोबाइल पर इन्हें थोड़ा छोटा और ट्रांसपेरेंट रखा है।
      */}
      {count > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              go(-1);
            }}
            className={`absolute left-2 sm:left-6 bottom-4 sm:bottom-6 z-20 grid h-8 w-8 sm:h-11 sm:w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/80 ${FOCUS}`}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              go(1);
            }}
            className={`absolute right-2 sm:right-6 bottom-4 sm:bottom-6 z-20 grid h-8 w-8 sm:h-11 sm:w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/80 ${FOCUS}`}
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>
        </>
      )}

      {/* Dots - ये भी नीचे बिल्कुल सेंटर में हैं */}
      {count > 1 && (
        <div className="absolute bottom-5 sm:bottom-8 left-0 right-0 z-20 flex justify-center gap-2 pointer-events-none">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={(e) => {
                e.preventDefault();
                setIndex(i);
              }}
              aria-label={`Go to slide ${i + 1}`}
              className={`pointer-events-auto h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-8 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/80"
              } ${FOCUS}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
