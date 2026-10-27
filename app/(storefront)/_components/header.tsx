"use client";

import { Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { label: "Men", href: "/categories/men" },
  { label: "Women", href: "/categories/women" },
  { label: "Collections", href: "/collections" },
  { label: "New Arrivals", href: "/collections/new-arrivals" },
  { label: "Offers", href: "/offers" },
];

function Logo() {
  return (
    <Link href="/" aria-label="Shera Sports Wear home" className="shrink-0">
      <span className="block font-display text-[26px] font-black italic leading-none tracking-tighter text-neutral-950 lg:text-[30px]">
        SHER<span className="text-brand">A</span>
      </span>
      <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.4em] text-neutral-900">
        Sports Wear
      </span>
    </Link>
  );
}

function IconLink({
  href,
  label,
  badge,
  className = "",
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`relative h-10 w-10 place-items-center rounded-full text-neutral-900 transition-colors hover:text-brand ${className || "grid"}`}
    >
      {children}
      {!!badge && (
        <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

// TODO: pass the real cart count from your cart store/context.
export function StorefrontHeader({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-[72px] lg:gap-8 lg:px-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-2 grid h-10 w-10 place-items-center rounded-full lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-xs font-semibold transition-colors ${
                  active ? "text-brand" : "text-neutral-900 hover:text-brand"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <form action="/products" role="search" className="hidden flex-1 lg:block">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="search"
              name="q"
              aria-label="Search products"
              placeholder="Search for products, categories..."
              className="h-10 w-full rounded-full bg-neutral-100 pl-10 pr-4 text-xs outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center lg:ml-0">
          <IconLink href="/products" label="Search" className="grid lg:hidden">
            <Search className="h-5 w-5" />
          </IconLink>
          <IconLink href="/account" label="Account" className="hidden lg:grid">
            <User className="h-5 w-5" />
          </IconLink>
          <IconLink href="/wishlist" label="Wishlist">
            <Heart className="h-5 w-5" />
          </IconLink>
          <IconLink href="/cart" label="Cart" badge={cartCount}>
            <ShoppingCart className="h-5 w-5" />
          </IconLink>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Mobile" className="mt-6 divide-y divide-neutral-100">
              {NAV.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block py-3.5 text-sm font-semibold text-neutral-900 hover:text-brand"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}