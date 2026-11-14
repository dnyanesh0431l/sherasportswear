// app/(storefront)/_components/HeroSlider.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
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
const FADE_MS = 900;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

const HERO_SIZES = "(max-width: 768px) 100vw, 100vw";

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const imgWrapRefs = useRef<Array<HTMLDivElement | null>>([]);
  const touchX = useRef<number | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const applyActive = useCallback(
    (next: number, prev: number) => {
      const nextEl = slideRefs.current[next];
      const prevEl = slideRefs.current[prev];

      if (nextEl) {
        nextEl.style.willChange = "opacity";
        nextEl.style.zIndex = "10";
        nextEl.style.opacity = "1";
        nextEl.style.pointerEvents = "auto";
        nextEl.style.visibility = "visible";
      }
      if (prevEl && prev !== next) {
        prevEl.style.willChange = "opacity";
        prevEl.style.zIndex = "0";
        prevEl.style.opacity = "0";
        prevEl.style.pointerEvents = "none";
      }

      const nextImg = imgWrapRefs.current[next];
      const prevImg = imgWrapRefs.current[prev];
      if (nextImg) nextImg.style.transform = "scale(1)";
      if (prevImg && prev !== next) prevImg.style.transform = "scale(1.05)";

      const release = () => {
        if (nextEl) nextEl.style.willChange = "";
        if (prevEl) prevEl.style.willChange = "";
        if (prevEl && prev !== next) prevEl.style.visibility = "hidden";
      };
      if (reducedMotion) release();
      else window.setTimeout(release, FADE_MS + 50);
    },
    [reducedMotion],
  );

  const go = useCallback(
    (dir: number) => {
      setIndex((i) => {
        if (count <= 1) return i;
        const next = (i + dir + count) % count;
        applyActive(next, i);
        return next;
      });
    },
    [count, applyActive],
  );

  const jumpTo = useCallback(
    (next: number) => {
      if (next === index) return;
      applyActive(next, index);
      setIndex(next);
    },
    [index, applyActive],
  );

  useEffect(() => {
    if (count <= 1 || hydrated) return;
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1200);
    idle(() => setHydrated(true));
  }, [count, hydrated]);

  useEffect(() => {
    if (count <= 1 || reducedMotion) return;
    const t = window.setInterval(() => {
      if (paused.current) return;
      go(1);
    }, SLIDE_MS);
    return () => window.clearInterval(t);
  }, [count, go, reducedMotion]);

  useEffect(() => {
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = reducedMotion
        ? "none"
        : `opacity ${FADE_MS}ms ease-in-out`;
      el.style.opacity = i === 0 ? "1" : "0";
      el.style.visibility = i === 0 ? "visible" : "hidden";
      el.style.zIndex = i === 0 ? "10" : "0";
      el.style.pointerEvents = i === 0 ? "auto" : "none";
    });
    imgWrapRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = reducedMotion
        ? "none"
        : `transform ${FADE_MS * 3}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.transform = i === 0 ? "scale(1)" : "scale(1.05)";
    });
  }, [hydrated, reducedMotion]);

  if (!count) return null;

  const renderedSlides = hydrated ? slides : slides.slice(0, 1);

  return (
    <section
      className="relative w-full overflow-hidden bg-neutral-950 group"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        paused.current = true;
      }}
      onTouchEnd={(e) => {
        paused.current = false;
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (count > 1 && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      {/* ORIGINAL layout — same className as before, untouched */}
      <div className="relative w-full h-auto md:h-[65vh] lg:h-[75vh] max-h-[800px]">
        {slides.map((s, i) => {
          if (i >= renderedSlides.length) {
            return (
              <div
                key={s.id}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                className="absolute inset-0"
                style={{ opacity: 0, visibility: "hidden" }}
                aria-hidden
              />
            );
          }

          return (
            <div
              key={s.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="absolute inset-0"
              aria-hidden={i !== index}
            >
              <Link
                href={s.ctaUrl || "/products"}
                tabIndex={i === index ? 0 : -1}
                className={`relative block h-full w-full ${FOCUS}`}
              >
                <div
                  ref={(el) => {
                    imgWrapRefs.current[i] = el;
                  }}
                  className="absolute inset-0"
                >
                  <Image
                    src={s.imageUrl}
                    alt={s.title || "Hero Banner"}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    sizes={HERO_SIZES}
                    quality={78}
                    draggable={false}
                    className="object-contain md:object-cover md:object-[center_30%]"
                  />
                </div>
              </Link>
            </div>
          );
        })}
      </div>

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

      {count > 1 && (
        <div className="absolute bottom-5 sm:bottom-8 left-0 right-0 z-20 flex justify-center gap-2 pointer-events-none">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={(e) => {
                e.preventDefault();
                jumpTo(i);
              }}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
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