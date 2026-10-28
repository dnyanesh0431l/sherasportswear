// app/(storefront)/components/storefront-header.tsx
"use client";

import { db } from "@/lib/firebase/client";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCart } from "./../../context/cart-context";
import { useWishlist } from "./../../context/wishlist-context";

type NavCategory = {
  id: string;
  label: string;
  href: string;
};

function Logo({ isDark = false }: { isDark?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Shera Sports Wear home"
      className="shrink-0 group"
    >
      <span
        className={`block font-black italic text-[22px] leading-none tracking-tighter lg:text-[26px] ${
          isDark ? "text-white" : "text-neutral-950"
        }`}
      >
        SHER<span className="text-[#ff5a1f]">A</span>
      </span>
      <span
        className={`mt-0.5 block text-[7px] font-bold uppercase tracking-[0.4em] ${
          isDark ? "text-white/70" : "text-neutral-500"
        }`}
      >
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
      className={`relative h-9 w-9 place-items-center rounded-full text-neutral-800 transition-colors hover:text-[#ff5a1f] ${
        className || "grid"
      }`}
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute right-0 top-0 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[#ff5a1f] px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function HeaderContent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "categories"), orderBy("sortOrder", "asc")),
        );
        const list: NavCategory[] = snap.docs
          .filter((d) => {
            const status = d.data().status;
            return status === "active" || status === undefined;
          })
          .map((d) => {
            const data = d.data();
            const slug = data.slug || d.id;
            return {
              id: d.id,
              label: data.name || d.id,
              href: `/categories/${slug}`,
            };
          });
        setCategories(list);
      } catch {
        /* silent — nav empty on failure */
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-3 sm:px-4 lg:h-14 lg:gap-6 lg:px-6">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-neutral-900 hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Logo />

          {/* Desktop Navigation — from Firestore categories */}
          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
            {loadingCats ? (
              <span className="text-[12px] font-medium text-neutral-400">
                Loading…
              </span>
            ) : (
              categories.map((c) => {
                const active =
                  pathname === c.href || pathname.startsWith(c.href + "/");
                return (
                  <Link
                    key={c.id}
                    href={c.href}
                    className={`text-[12px] font-bold uppercase tracking-wide transition-colors ${
                      active
                        ? "text-[#ff5a1f]"
                        : "text-neutral-700 hover:text-[#ff5a1f]"
                    }`}
                  >
                    {c.label}
                  </Link>
                );
              })
            )}
          </nav>

          {/* Desktop Search */}
          <form
            action="/products"
            role="search"
            className="hidden flex-1 lg:block"
          >
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="search"
                name="q"
                aria-label="Search products"
                placeholder="Search for products..."
                className="h-9 w-full rounded-full bg-neutral-100 pl-9 pr-4 text-[13px] font-medium text-neutral-900 outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-[#ff5a1f]/30"
              />
            </div>
          </form>

          {/* Right Icons */}
          <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
            <IconLink
              href="/products"
              label="Search"
              className="grid lg:hidden"
            >
              <Search className="h-5 w-5" />
            </IconLink>
            <IconLink
              href="/account"
              label="Account"
              className="hidden lg:grid"
            >
              <User className="h-5 w-5" />
            </IconLink>
            <IconLink href="/wishlist" label="Wishlist" badge={wishlistCount}>
              <Heart className="h-5 w-5" />
            </IconLink>
            <IconLink href="/cart" label="Cart" badge={cartCount}>
              <ShoppingCart className="h-5 w-5" />
            </IconLink>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <aside
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85%] p-6 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ backgroundColor: "#0a0a0b", color: "#ffffff" }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <Logo isDark />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav
            aria-label="Mobile"
            className="flex-1 mt-4 space-y-1 overflow-y-auto"
          >
            {loadingCats ? (
              <div className="px-3 py-3 text-sm text-white/60">Loading…</div>
            ) : (
              categories.map((c) => {
                const active =
                  pathname === c.href || pathname.startsWith(c.href + "/");
                return (
                  <Link
                    key={c.id}
                    href={c.href}
                    style={{ color: active ? "#ff5a1f" : "#ffffff" }}
                    className={`flex items-center justify-between rounded-lg px-3 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors ${
                      active ? "bg-[#ff5a1f]/10" : "hover:bg-white/10"
                    }`}
                  >
                    {c.label}
                    {active && (
                      <div className="h-2 w-2 rounded-full bg-[#ff5a1f]" />
                    )}
                  </Link>
                );
              })
            )}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-4 space-y-2">
            <Link
              href="/account"
              style={{ color: "#ffffff" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/5 transition-colors"
            >
              <User className="h-5 w-5 text-white" /> My Account
            </Link>
            <Link
              href="/wishlist"
              style={{ color: "#ffffff" }}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-white" /> Wishlist
              </div>
              {wishlistCount > 0 && (
                <span className="bg-[#ff5a1f] text-white text-xs px-2 py-0.5 rounded-full font-black">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              style={{ color: "#ffffff" }}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-white" /> Cart
              </div>
              {cartCount > 0 && (
                <span className="bg-[#ff5a1f] text-white text-xs px-2 py-0.5 rounded-full font-black">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

export function StorefrontHeader() {
  return (
    <Suspense
      fallback={
        <div className="h-12 border-b border-neutral-200 bg-white lg:h-14" />
      }
    >
      <HeaderContent />
    </Suspense>
  );
}
