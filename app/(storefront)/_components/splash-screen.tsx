// app/components/splash-screen.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Brand splash.
 *
 * Timeline (SHOW_MS = 2.8s, then a 0.45s fade-out):
 *   Layout: runner on the LEFT, brand name on the RIGHT, the pair centered on screen.
 *   0.00s  runner slides in from the left edge into its place (with orange speed lines)
 *   0.65s  "SHERA" wipes in to the right of the runner, same style as the navbar logo
 *   1.20s  "SPORTS WEAR" fades in under it while its letter-spacing widens
 *   0.00s  thin orange progress bar fills along the bottom until exit
 *
 * - Plays once per browser tab session (sessionStorage). Pass oncePerSession={false} to always play.
 * - Waits for the runner image to load before starting, so it never "pops in".
 * - Respects prefers-reduced-motion (static logo, shorter hold).
 * - Locks page scroll while visible.
 *
 * Usage: render <SplashScreen /> once, as the first child of <body> in app/layout.tsx.
 * Image:  public/images/shera-runner.png
 */

const SESSION_KEY = "shera-splash-seen";
const SHOW_MS = 2800;
const SHOW_MS_REDUCED = 1200;
const EXIT_MS = 450;
const IMAGE_TIMEOUT_MS = 1500;

type Phase = "idle" | "run" | "exit" | "done";

const CSS = `
.sp-root{transition:opacity ${EXIT_MS}ms ease}
.sp-root[data-exit="true"]{opacity:0;pointer-events:none}

/* hidden until the animation starts */
.sp-runner{opacity:0;transform:translateX(-70vw);transform-origin:50% 100%;will-change:transform}
.sp-word{opacity:0}
.sp-sub{opacity:0;letter-spacing:.4em}
.sp-bar{transform:scaleX(0)}

.sp-root[data-run="true"] .sp-runner{animation:sp-run 1.1s cubic-bezier(.16,1,.3,1) forwards}
.sp-root[data-run="true"] .sp-line{animation:sp-line .55s ease-in .55s forwards}
.sp-root[data-run="true"] .sp-word{animation:sp-word .7s cubic-bezier(.22,1,.36,1) .65s forwards}
.sp-root[data-run="true"] .sp-sub{animation:sp-sub .6s ease-out 1.2s forwards}
.sp-root[data-run="true"] .sp-bar{animation:sp-bar var(--sp-total) linear forwards}

@keyframes sp-run{
  0%{opacity:0;transform:translateX(-70vw) skewX(-14deg)}
  12%{opacity:1}
  100%{opacity:1;transform:translateX(0) skewX(0)}
}
@keyframes sp-line{
  from{opacity:1;transform:scaleX(1)}
  to{opacity:0;transform:scaleX(0)}
}
@keyframes sp-word{
  from{opacity:1;clip-path:inset(-12% 100% -12% 0);transform:translateX(-14px)}
  to{opacity:1;clip-path:inset(-12% -12% -12% 0);transform:none}
}
@keyframes sp-sub{
  from{opacity:0;letter-spacing:.15em}
  to{opacity:1;letter-spacing:.4em}
}
@keyframes sp-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}

@media (prefers-reduced-motion:reduce){
  .sp-root .sp-runner,.sp-root .sp-word,.sp-root .sp-sub{
    animation:none!important;opacity:1!important;transform:none!important;clip-path:none!important
  }
  .sp-root .sp-line{display:none}
  .sp-root .sp-bar{animation:none!important;transform:scaleX(1)!important}
}
`;

export default function SplashScreen({
  src = "/images/shera-runner.png",
  oncePerSession = true,
}: {
  src?: string;
  oncePerSession?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (oncePerSession) {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) {
          setPhase("done");
          return;
        }
      } catch {
        // storage unavailable: just play the splash
      }
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const showMs = reduced ? SHOW_MS_REDUCED : SHOW_MS;

    let started = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      if (started) return;
      started = true;
      setPhase("run");
      exitTimer = setTimeout(() => setPhase("exit"), showMs);
      doneTimer = setTimeout(() => {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {}
        setPhase("done");
      }, showMs + EXIT_MS);
    };

    const img = imgRef.current;
    if (!img || img.complete) {
      start(); // already cached (or no image): go
    } else {
      img.addEventListener("load", start);
      img.addEventListener("error", start);
      fallbackTimer = setTimeout(start, IMAGE_TIMEOUT_MS);
    }

    return () => {
      img?.removeEventListener("load", start);
      img?.removeEventListener("error", start);
      clearTimeout(fallbackTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [oncePerSession]);

  // Lock scroll while the splash is on screen
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className="sp-root fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-white"
      data-run={phase === "run" || phase === "exit" ? "true" : "false"}
      data-exit={phase === "exit" ? "true" : "false"}
      role="status"
      aria-label="Shera Sports Wear is loading"
      style={{ "--sp-total": `${SHOW_MS}ms` } as React.CSSProperties}
    >
      <style>{CSS}</style>

      {/* Runner on the left, name on the right */}
      <div className="flex items-center gap-4 px-6 sm:gap-7">
        {/* Runner */}
        <div className="sp-runner relative shrink-0">
          {/* speed lines trail behind the runner */}
          <span className="sp-line absolute right-full top-[30%] mr-3 h-[3px] w-10 origin-right rounded-sm bg-[#ff5a1f] sm:w-14" />
          <span className="sp-line absolute right-full top-[46%] mr-5 h-[3px] w-16 origin-right rounded-sm bg-[#ff5a1f] sm:w-24" />
          <span className="sp-line absolute right-full top-[62%] mr-2 h-[3px] w-8 origin-right rounded-sm bg-[#ff5a1f] sm:w-10" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            fetchPriority="high"
            decoding="async"
            className="h-28 w-auto select-none sm:h-36 md:h-44"
          />
        </div>

        {/* Wordmark — same treatment as the navbar logo */}
        <div className="text-left">
          <span className="sp-word block text-5xl font-black italic leading-none tracking-tighter text-neutral-950 sm:text-6xl md:text-7xl">
            SHER<span className="text-[#ff5a1f]">A</span>
          </span>
          <span className="sp-sub mt-2 block text-[10px] font-bold uppercase text-neutral-500 sm:mt-3 sm:text-xs md:text-sm">
            Sports Wear
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-neutral-100">
        <div className="sp-bar h-full origin-left bg-[#ff5a1f]" />
      </div>
    </div>
  );
}
