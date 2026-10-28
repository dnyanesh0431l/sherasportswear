// app/(storefront)/_components/header.tsx
"use client";

import { db } from "@/lib/firebase/client";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

export function StorefrontHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query_, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "categories"), orderBy("sortOrder", "asc")),
        );
        setCategories(
          snap.docs
            .filter((d) => {
              const s = d.data().status;
              return s === "active" || s === undefined;
            })
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: data.name || d.id,
                slug: data.slug || d.id,
              };
            }),
        );
      } catch {
        /* silent — no categories is not an error */
      }
    })();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query_.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: mobile menu + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex flex-col leading-none">
              <span className="font-display text-lg sm:text-xl tracking-wider text-neutral-900">
                SHERA
              </span>
              <span className="text-[8px] sm:text-[9px] tracking-[0.3em] text-orange-500 font-semibold">
                SPORTS WEAR
              </span>
            </Link>
          </div>

          {/* Center: desktop category nav */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            {categories.length === 0 ? (
              <span className="text-sm text-neutral-400">Loading…</span>
            ) : (
              categories.map((c) => {
                const href = `/categories/${c.slug}`;
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={c.id}
                    href={href}
                    className={`text-sm font-medium tracking-wide transition-colors ${
                      active
                        ? "text-orange-600"
                        : "text-neutral-700 hover:text-orange-600"
                    }`}
                  >
                    {c.name}
                  </Link>
                );
              })
            )}
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
                value={query_}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-36 lg:w-48 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
            </form>

            <Link
              href="/search"
              className="md:hidden p-2 text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              href="/account"
              className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              href="/cart"
              className="relative p-2 text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
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
                className="p-2 hover:bg-neutral-100 rounded-md transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold px-3 py-2">
                Shop by category
              </div>
              {categories.length === 0 ? (
                <div className="px-3 py-2 text-sm text-neutral-400">
                  Loading…
                </div>
              ) : (
                categories.map((c) => {
                  const href = `/categories/${c.slug}`;
                  const active =
                    pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={c.id}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? "bg-orange-50 text-orange-600"
                          : "text-neutral-800 hover:bg-orange-50 hover:text-orange-600"
                      }`}
                    >
                      {c.name}
                    </Link>
                  );
                })
              )}

              <div className="pt-4 mt-4 border-t border-neutral-200">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-neutral-800 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  My Account
                </Link>
                <Link
                  href="/account/orders"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-neutral-800 hover:bg-orange-50 hover:text-orange-600 transition-colors"
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
