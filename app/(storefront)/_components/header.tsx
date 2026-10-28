// app/(storefront)/components/storefront-header.tsx
"use client";

import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowRight,
  Heart,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Tag,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "./../../context/cart-context";
import { useWishlist } from "./../../context/wishlist-context";

// ---------------------------------------------------------------------------
// Types for Search
// ---------------------------------------------------------------------------
type NavCategory = {
  id: string;
  label: string;
  href: string;
};

type SearchProduct = {
  id: string;
  name: string;
  slug: string;
  pricePaise: number;
  image: string;
};

type SearchCollection = {
  id: string;
  name: string;
  slug: string;
};

type SearchData = {
  products: SearchProduct[];
  collections: SearchCollection[];
  categories: NavCategory[];
};

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Search Dropdown Component
// ---------------------------------------------------------------------------
function SearchDropdown({
  data,
  searchQuery,
  onClose,
}: {
  data: SearchData;
  searchQuery: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const q = searchQuery.toLowerCase().trim();

  const matchedCategories = useMemo(
    () => data.categories.filter((c) => c.label.toLowerCase().includes(q)),
    [data.categories, q],
  );
  const matchedCollections = useMemo(
    () => data.collections.filter((c) => c.name.toLowerCase().includes(q)),
    [data.collections, q],
  );
  const matchedProducts = useMemo(
    () =>
      data.products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      ),
    [data.products, q],
  );

  const hasResults =
    matchedCategories.length > 0 ||
    matchedCollections.length > 0 ||
    matchedProducts.length > 0;

  if (!q) return null;

  return (
    <div className="absolute top-full left-0 mt-2 w-full min-w-[320px] rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-100 overflow-hidden z-50">
      {!hasResults ? (
        <div className="p-6 text-center text-sm text-neutral-500">
          No results found for &quot;{searchQuery}&quot;
        </div>
      ) : (
        <div className="max-h-[80vh] overflow-y-auto p-2">
          {/* Categories */}
          {matchedCategories.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Categories
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {matchedCategories.map((c) => (
                  <Link
                    key={c.id}
                    href={c.href}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition-colors"
                  >
                    <Tag className="h-3 w-3 text-neutral-500" />
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {matchedCollections.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Collections
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {matchedCollections.map((c) => (
                  <Link
                    key={c.id}
                    href={`/collections/${c.slug}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 transition-colors"
                  >
                    <Package className="h-3 w-3 text-neutral-500" />
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {matchedProducts.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                <span>Products</span>
                <span>{matchedProducts.length} found</span>
              </div>
              <ul className="space-y-1">
                {matchedProducts.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-50 transition-colors group"
                    >
                      <div className="h-10 w-10 aspect-square shrink-0 rounded bg-neutral-100 overflow-hidden">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt=""
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <Package className="h-4 w-4 text-neutral-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate group-hover:text-[#ff5a1f] transition-colors">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {formatINR(p.pricePaise)}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-[#ff5a1f] transition-colors shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
              {matchedProducts.length > 5 && (
                <button
                  onClick={() => {
                    router.push(
                      `/products?q=${encodeURIComponent(searchQuery)}`,
                    );
                    onClose();
                  }}
                  className="w-full text-center py-2 text-xs font-bold text-[#ff5a1f] hover:underline"
                >
                  View all {matchedProducts.length} results
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Header Content
// ---------------------------------------------------------------------------
function HeaderContent() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false); // Mobile drawer state
  const [loadingCats, setLoadingCats] = useState(true);

  // Search State
  const [searchData, setSearchData] = useState<SearchData>({
    products: [],
    collections: [],
    categories: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  // Fetch all data for live search on mount
  useEffect(() => {
    (async () => {
      try {
        const [catSnap, colSnap, prodSnap] = await Promise.all([
          getDocs(
            query(collection(db, "categories"), orderBy("sortOrder", "asc")),
          ),
          getDocs(
            query(collection(db, "collections"), orderBy("sortOrder", "asc")),
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("status", "==", "active"),
              limit(100),
            ),
          ),
        ]);

        const categories = catSnap.docs
          .filter((d) => {
            const s = d.data().status;
            return s === "active" || s === undefined;
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

        const collections = colSnap.docs
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
          });

        const products = prodSnap.docs.map((d) => {
          const data = d.data();
          const images = Array.isArray(data.images) ? data.images : [];
          return {
            id: d.id,
            name: data.name || d.id,
            slug: data.slug || d.id,
            pricePaise: data.basePricePaise || 0,
            image: images[0] || "",
          };
        });

        setSearchData({ categories, collections, products });
      } catch (err) {
        console.error("Failed to load search data", err);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
    }
  };

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

          {/* Desktop Navigation */}
          <nav aria-label="Main" className="hidden items-center gap-5 lg:flex">
            {loadingCats ? (
              <span className="text-[12px] font-medium text-neutral-400">
                Loading…
              </span>
            ) : (
              searchData.categories.map((c) => {
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

          {/* Live Search Bar (Desktop) */}
          <div className="hidden flex-1 lg:block relative" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} role="search">
              <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  aria-label="Search products"
                  placeholder="Search for products, collections..."
                  className="h-9 w-full rounded-full bg-neutral-100 pl-9 pr-4 text-[13px] font-medium text-neutral-900 outline-none placeholder:text-neutral-500 focus:bg-white focus:ring-1 focus:ring-neutral-950 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchFocused(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Dropdown */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <SearchDropdown
                data={searchData}
                searchQuery={searchQuery}
                onClose={() => {
                  setIsSearchFocused(false);
                  setSearchQuery("");
                }}
              />
            )}
          </div>

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
              searchData.categories.map((c) => {
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
