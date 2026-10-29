// app/(storefront)/_components/splash-screen.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Brand splash — runner on the LEFT, brand name on the RIGHT, centered.
 *
 * Plays on EVERY full page load / reload. It lives in the root layout, which
 * stays mounted during in-app navigation, so clicking around the store does
 * not replay it.
 *
 * Fully fluid: every size is derived from one CSS variable (--h = runner
 * height) that scales with the viewport, so the pair always fits from a
 * 320px phone to a 4K desktop, portrait or landscape.
 *
 * Timeline (SHOW_MS = 3s, then a 0.45s fade-out)
 *   0.00s  runner slides in from the left edge into place (+ orange speed lines)
 *   0.60s  "SHERA" wipes in to the right of the runner
 *   1.10s  "SPORTS WEAR" fades in while its letter-spacing widens
 *   0.00s  orange progress bar fills along the bottom until exit (3s)
 *
 * Waits for the runner image before starting. Respects prefers-reduced-motion.
 * Image: public/images/shera-runner.png
 */

const SHOW_MS = 3000;
const SHOW_MS_REDUCED = 1500;
const EXIT_MS = 450;
const IMAGE_TIMEOUT_MS = 1500;

type Phase = "idle" | "run" | "exit" | "done";

const CSS = `
.sp-root{transition:opacity ${EXIT_MS}ms ease}
.sp-root[data-exit="true"]{opacity:0;pointer-events:none}

/* one fluid unit drives every size */
.sp-stage{
  --h:clamp(88px,min(34vw,30vh),220px);
  display:flex;align-items:center;justify-content:center;
  gap:calc(var(--h)*.16);
  max-width:100%;padding:0 5vw;
}
.sp-runner{position:relative;flex:none;opacity:0;transform:translateX(-80vw);transform-origin:50% 100%;will-change:transform}
.sp-img{display:block;height:var(--h);width:auto;max-width:none;user-select:none;-webkit-user-drag:none}

.sp-line{position:absolute;right:100%;height:max(2px,calc(var(--h)*.017));border-radius:2px;background:#ff5a1f;transform-origin:right}
.sp-line-1{top:30%;margin-right:calc(var(--h)*.07);width:calc(var(--h)*.28)}
.sp-line-2{top:46%;margin-right:calc(var(--h)*.11);width:calc(var(--h)*.5)}
.sp-line-3{top:62%;margin-right:calc(var(--h)*.04);width:calc(var(--h)*.2)}

.sp-text{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.sp-word{
  display:block;white-space:nowrap;opacity:0;
  font-size:calc(var(--h)*.42);font-weight:900;font-style:italic;
  line-height:1;letter-spacing:-.05em;color:#0a0a0a;
}
.sp-a{color:#ff5a1f}
.sp-sub{
  display:block;white-space:nowrap;opacity:0;
  margin-top:calc(var(--h)*.06);
  font-size:max(10px,calc(var(--h)*.078));font-weight:700;
  text-transform:uppercase;letter-spacing:.4em;color:#737373;
}

.sp-barwrap{position:absolute;left:0;right:0;bottom:0;height:3px;background:#f5f5f5}
.sp-bar{height:100%;background:#ff5a1f;transform-origin:left;transform:scaleX(0)}

.sp-root[data-run="true"] .sp-runner{animation:sp-run 1s cubic-bezier(.16,1,.3,1) forwards}
.sp-root[data-run="true"] .sp-line{animation:sp-line .5s ease-in .5s forwards}
.sp-root[data-run="true"] .sp-word{animation:sp-word .7s cubic-bezier(.22,1,.36,1) .6s forwards}
.sp-root[data-run="true"] .sp-sub{animation:sp-sub .6s ease-out 1.1s forwards}
.sp-root[data-run="true"] .sp-bar{animation:sp-bar var(--sp-total) linear forwards}

@keyframes sp-run{
  0%{opacity:0;transform:translateX(-80vw) skewX(-14deg)}
  12%{opacity:1}
  100%{opacity:1;transform:translateX(0) skewX(0)}
}
@keyframes sp-line{from{opacity:1;transform:scaleX(1)}to{opacity:0;transform:scaleX(0)}}
@keyframes sp-word{
  from{opacity:1;clip-path:inset(-12% 100% -12% 0);transform:translateX(-14px)}
  to{opacity:1;clip-path:inset(-12% -12% -12% 0);transform:none}
}
@keyframes sp-sub{from{opacity:0;letter-spacing:.15em}to{opacity:1;letter-spacing:.4em}}
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
}: {
  src?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
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
      doneTimer = setTimeout(() => setPhase("done"), showMs + EXIT_MS);
    };

    const img = imgRef.current;
    if (!img || img.complete) {
      start(); // image already cached (or missing): go
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
  }, []);

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
      className="sp-root fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white"
      data-run={phase === "run" || phase === "exit" ? "true" : "false"}
      data-exit={phase === "exit" ? "true" : "false"}
      role="status"
      aria-label="Shera Sports Wear is loading"
      style={{ "--sp-total": `${SHOW_MS}ms` } as React.CSSProperties}
    >
      <style>{CSS}</style>

      <div className="sp-stage">
        {/* Runner (left) */}
        <div className="sp-runner">
          <span className="sp-line sp-line-1" />
          <span className="sp-line sp-line-2" />
          <span className="sp-line sp-line-3" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            fetchPriority="high"
            decoding="async"
            className="sp-img"
          />
        </div>

        {/* Name (right) — same treatment as the navbar logo */}
        <div className="sp-text">
          <span className="sp-word">
            SHER<span className="sp-a">A</span>
          </span>
          <span className="sp-sub">Sports Wear</span>
        </div>
      </div>

      <div className="sp-barwrap">
        <div className="sp-bar" />
      </div>
    </div>
  );
}