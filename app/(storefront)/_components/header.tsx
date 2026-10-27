// app/(storefront)/_components/header.tsx
"use client";

import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/products", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/collections", label: "Collections" },
  { href: "/about", label: "About" },
];

export function StorefrontHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      {/* Announcement bar */}
      <div className="bg-neutral-950 text-white text-[11px] tracking-wider uppercase text-center py-2 px-4">
        Free shipping on orders over ₹999 · Easy 30-day returns
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: mobile menu + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-neutral-700 hover:bg-neutral-100 rounded-md"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex flex-col leading-none">
              <span className="font-display text-xl tracking-wider text-neutral-900">
                SHERA
              </span>
              <span className="text-[9px] tracking-[0.3em] text-orange-500 font-semibold">
                SPORTS WEAR
              </span>
            </Link>
          </div>

          {/* Center: desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV.map((n) => {
              const active =
                pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`text-sm font-medium tracking-wide transition-colors ${
                    active
                      ? "text-orange-600"
                      : "text-neutral-700 hover:text-orange-600"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: search + account + cart */}
          <div className="flex items-center gap-1">
            {/* Desktop search */}
            <form
              onSubmit={handleSearch}
              className="hidden md:flex items-center gap-1 mr-2 rounded-md border border-neutral-300 px-2.5 py-1.5 bg-neutral-50 focus-within:border-orange-500 focus-within:bg-white transition-colors"
            >
              <Search className="h-4 w-4 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-40 lg:w-52 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
            </form>

            <Link
              href="/search"
              className="md:hidden p-2 text-neutral-700 hover:bg-neutral-100 rounded-md"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              href="/account"
              className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-md"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              href="/cart"
              className="relative p-2 text-neutral-700 hover:bg-neutral-100 rounded-md"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <span className="font-display text-lg tracking-wider">SHERA</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-md"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-neutral-800 hover:bg-orange-50 hover:text-orange-600"
                >
                  {n.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t border-neutral-200">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-neutral-800 hover:bg-orange-50 hover:text-orange-600"
                >
                  My Account
                </Link>
                <Link
                  href="/orders"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-neutral-800 hover:bg-orange-50 hover:text-orange-600"
                >
                  My Orders
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
