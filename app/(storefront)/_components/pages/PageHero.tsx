import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, description, children }: Props) {
  return (
    <section className="relative overflow-hidden bg-neutral-950 text-white">
      {/* orange glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-[#FF6B00]/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#FF6B00]/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <nav className="mb-6 text-xs font-medium uppercase tracking-widest text-white/50">
          <Link href="/" className="hover:text-[#FF6B00]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/80">{title}</span>
        </nav>

        {eyebrow && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6B00]">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}