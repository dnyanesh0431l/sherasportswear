// app/components/toaster.tsx
"use client";

import { Check, Info, Loader2, TriangleAlert, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Toaster } from "sonner";

/**
 * Themed toast host.
 *  - Flat solid black (same as our primary buttons): no border, no shadow.
 *    A light toast would vanish on the #fafafa pages without a border/shadow.
 *  - 4px corners like every other control.
 *  - Small square icon tile carries the status colour:
 *      success = green #22c55e · error = red · warning = amber · info = brand orange #ff5a1f
 *  - Action button ("View cart") is the brand orange.
 *  - Top-center so it never covers the sticky bottom bars on cart / product / checkout.
 *
 * Usage: replace <Toaster /> in your root layout with <AppToaster />.
 * Every existing toast.success / toast.error / toast.info call keeps working.
 */

function IconTile({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded ${className}`}
    >
      {children}
    </span>
  );
}

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      offset={16}
      gap={8}
      visibleToasts={3}
      duration={3500}
      style={{ "--width": "380px" } as CSSProperties}
      icons={{
        success: (
          <IconTile className="bg-[#22c55e] text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </IconTile>
        ),
        error: (
          <IconTile className="bg-red-500 text-white">
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </IconTile>
        ),
        warning: (
          <IconTile className="bg-amber-500 text-neutral-950">
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.5} />
          </IconTile>
        ),
        info: (
          <IconTile className="bg-[#ff5a1f] text-white">
            <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
          </IconTile>
        ),
        loading: (
          <IconTile className="bg-neutral-800 text-[#ff5a1f]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </IconTile>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded border border-white border-1 bg-neutral-950 px-3.5 py-3 text-white",
          content: "flex min-w-0 flex-1 flex-col",
          title: "text-sm font-semibold leading-snug text-white",
          description: "mt-0.5 text-xs leading-snug text-neutral-400",
          icon: "m-0 flex shrink-0 items-center",
          actionButton:
            "ml-1 shrink-0 cursor-pointer rounded bg-[#ff5a1f] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#e84912] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          cancelButton:
            "ml-1 shrink-0 cursor-pointer rounded bg-neutral-800 px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-300 transition-colors hover:bg-neutral-700",
        },
      }}
    />
  );
}