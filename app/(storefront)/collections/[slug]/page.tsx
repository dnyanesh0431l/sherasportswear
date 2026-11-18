// app/(storefront)/collections/[slug]/page.tsx
"use client";

import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Heart,
  LayoutGrid,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useWishlist } from "../../../context/wishlist-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CollectionInfo = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  mrpPaise: number;
  image: string;
  categoryId: string;
  createdAtMs: number;
};

type SortKey = "featured" | "newest" | "price-asc" | "price-desc" | "discount";

// ---------------------------------------------------------------------------
// Layout tokens
// ---------------------------------------------------------------------------
const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";
const HIDE_SCROLLBAR =
  "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a1f]";
const PAGE_SIZE = 12;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const discountPercent = (mrp: number, price: number) =>
  mrp <= price ? 0 : Math.round(((mrp - price) / mrp) * 100);

// --- Helpers used to make matching resilient -------------------------------
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const norm = (s: string) => decode(s).trim().toLowerCase();

/** Only explicit "draft"/"inactive" hides an item. Missing status => visible. */
const isVisible = (status: unknown): boolean => {
  if (status === undefined || status === null) return true;
  const s = String(status).toLowerCase();
  return s !== "draft" && s !== "inactive" && s !== "archived";
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "discount", label: "Biggest discount" },
];

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------
function ProductCard({
  p,
  saved,
  onToggleWishlist,
}: {
  p: ProductCardData;
  saved: boolean;
  onToggleWishlist: () => void;
}) {
  const d = discountPercent(p.mrpPaise, p.basePricePaise);
  return (
    <div className="group relative rounded-xl bg-white p-2.5 transition-colors hover:bg-neutral-50 sm:p-3">
      <Link href={`/products/${p.slug}`} className={cx("block", FOCUS)}>
        <div className="relative aspect-square overflow-hidden rounded bg-neutral-100">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt={p.name}
              loading="lazy"
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-400">
              <Tag className="h-7 w-7" />
            </div>
          )}
          {d > 0 && (
            <span className="absolute left-2 top-2 rounded bg-[#ff5a1f] px-1.5 py-0.5 text-[11px] font-bold text-white">
              {d}% OFF
            </span>
          )}
        </div>

        <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-neutral-950 transition-colors group-hover:text-[#ff5a1f]">
          {p.name}
        </h3>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-black tabular-nums text-neutral-950">
            {formatINR(p.basePricePaise)}
          </span>
          {d > 0 && (
            <span className="text-xs tabular-nums text-neutral-400 line-through">
              {formatINR(p.mrpPaise)}
            </span>
          )}
        </p>
      </Link>

      <button
        type="button"
        onClick={onToggleWishlist}
        aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={saved}
        className={cx(
          "absolute right-4 top-4 grid h-9 w-9 place-items-center rounded bg-white/90 transition-colors sm:right-5 sm:top-5",
          FOCUS,
          saved ? "text-red-500" : "text-neutral-600 hover:text-red-500",
        )}
      >
        <Heart
          className={cx("h-[18px] w-[18px]", saved && "fill-red-500")}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function CollectionSkeleton() {
  return (
    <div
      className="min-h-screen animate-pulse bg-[#fafafa] pb-14 pt-6 md:pt-8"
      aria-busy="true"
      aria-label="Loading collection"
    >
      <div className={WRAP}>
        <div className="mb-5 h-3 w-48 rounded bg-neutral-200" />
        <div className="mb-5 h-8 w-64 rounded bg-neutral-200" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-2.5 sm:p-3">
              <div className="aspect-square rounded bg-neutral-200" />
              <div className="mt-3 h-4 w-4/5 rounded bg-neutral-200" />
              <div className="mt-2 h-4 w-1/3 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function CollectionBody() {
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const {
    addItem: addToWishlist,
    removeItem: removeFromWishlist,
    isInWishlist,
  } = useWishlist();

  const [allCollections, setAllCollections] = useState<CollectionInfo[]>([]);
  const [current, setCurrent] = useState<CollectionInfo | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [sort, setSort] = useState<SortKey>("featured");
  const [activeCat, setActiveCat] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Guards against a slower, older load() overwriting a newer one.
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!slug) return;
    const myLoadId = ++loadIdRef.current;
    const isStale = () => loadIdRef.current !== myLoadId;

    setLoading(true);
    setError(false);
    setCurrent(null);
    setProducts([]);
    setActiveCat("all");
    setSort("featured");
    setVisible(PAGE_SIZE);

    try {
      // ---- 1. Collections (fetch all, filter client-side) ---------------
      // We do NOT filter by status server-side. Manually-created collections
      // (or ones missing a `status` field) would otherwise be invisible.
      const [colSnap, catSnap] = await Promise.all([
        getDocs(collection(db, "collections")),
        getDocs(collection(db, "categories")).catch(() => null),
      ]);
      if (isStale()) return;

      const cols: CollectionInfo[] = colSnap.docs
        .filter((d) => isVisible(d.data().status))
        .map((d) => {
          const c = d.data();
          return {
            id: d.id,
            name: c.name || d.id,
            slug: c.slug || d.id,
            description: c.description || "",
            sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : 999,
          };
        })
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
      setAllCollections(cols);

      if (catSnap) {
        const names: Record<string, string> = {};
        catSnap.docs.forEach((d) => {
          names[d.id] = d.data().name || d.id;
        });
        setCategoryNames(names);
      }

      // ---- 2. Match the requested slug --------------------------------
      // Try in priority: exact slug, case-insensitive slug, by doc id.
      const want = norm(slug);
      const found =
        cols.find((c) => c.slug === slug) ??
        cols.find((c) => norm(c.slug) === want) ??
        cols.find((c) => c.id === slug) ??
        cols.find((c) => norm(c.id) === want) ??
        null;

      setCurrent(found);
      if (!found) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[collection] not found", {
            slug,
            wanted: want,
            available: cols.map((c) => ({ id: c.id, slug: c.slug })),
          });
        }
        return;
      }

      // ---- 3. Products in this collection -----------------------------
      // array-contains on the collection doc ID (exactly what admin saves).
      const pSnap = await getDocs(
        query(
          collection(db, "products"),
          where("collectionIds", "array-contains", found.id),
        ),
      );
      if (isStale()) return;

      const list: ProductCardData[] = pSnap.docs
        .filter((d) => isVisible(d.data().status))
        .map((d) => {
          const p = d.data();
          return {
            id: d.id,
            name: p.name || "",
            slug: p.slug || d.id,
            basePricePaise:
              typeof p.basePricePaise === "number"
                ? p.basePricePaise
                : typeof p.pricePaise === "number"
                  ? p.pricePaise
                  : 0,
            mrpPaise:
              typeof p.mrpPaise === "number"
                ? p.mrpPaise
                : typeof p.basePricePaise === "number"
                  ? p.basePricePaise
                  : 0,
            image: Array.isArray(p.images) ? p.images[0] || "" : "",
            categoryId: p.categoryId || "",
            createdAtMs: p.createdAt?.toMillis?.() ?? 0,
          };
        });

      if (process.env.NODE_ENV === "development") {
        // Actionable diagnostic — if rawProducts > visibleProducts but list
        // is 0, statuses are killing it; if rawProducts is 0, collectionIds
        // on products is wrong.
        console.info("[collection] loaded", {
          slug,
          collectionId: found.id,
          rawProducts: pSnap.size,
          visibleProducts: list.length,
          hiddenByStatus: pSnap.docs
            .filter((d) => !isVisible(d.data().status))
            .map((d) => ({ id: d.id, status: d.data().status })),
        });
      }

      setProducts(list);
    } catch (e) {
      if (isStale()) return;
      console.error("Error loading collection:", e);
      setError(true);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // ----- Category chips
  const categoryIds = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.categoryId).filter(Boolean))),
    [products],
  );

  // ----- Filter + sort
  const shown = useMemo(() => {
    const filtered =
      activeCat === "all"
        ? products
        : products.filter((p) => p.categoryId === activeCat);
    const arr = filtered.slice();
    switch (sort) {
      case "newest":
        arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
        break;
      case "price-asc":
        arr.sort((a, b) => a.basePricePaise - b.basePricePaise);
        break;
      case "price-desc":
        arr.sort((a, b) => b.basePricePaise - a.basePricePaise);
        break;
      case "discount":
        arr.sort(
          (a, b) =>
            discountPercent(b.mrpPaise, b.basePricePaise) -
            discountPercent(a.mrpPaise, a.basePricePaise),
        );
        break;
      default:
        break;
    }
    return arr;
  }, [products, activeCat, sort]);

  const toggleWishlist = (p: ProductCardData) => {
    if (isInWishlist(p.id)) {
      removeFromWishlist(p.id);
      toast.info("Removed from wishlist");
    } else {
      addToWishlist({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.basePricePaise,
        mrp: p.mrpPaise,
        image: p.image,
      });
      toast.success("Added to wishlist");
    }
  };

  if (loading) return <CollectionSkeleton />;

  if (error || !current) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <LayoutGrid className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-900 md:text-3xl">
          {error ? "Couldn't load collection" : "Collection not found"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          {error
            ? "Something went wrong. Check your connection and try again."
            : "This collection doesn't exist or is no longer available."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {error && (
            <button
              type="button"
              onClick={load}
              className={cx(
                "inline-flex items-center rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
                FOCUS,
              )}
            >
              Try again
            </button>
          )}
          <Link
            href="/collections"
            className={cx(
              "inline-flex items-center gap-2 rounded-md px-8 py-3 text-sm font-bold uppercase tracking-wider transition-colors",
              FOCUS,
              error
                ? "bg-neutral-100 text-neutral-950 hover:bg-neutral-200"
                : "bg-neutral-950 text-white hover:bg-[#ff5a1f]",
            )}
          >
            All collections
          </Link>
        </div>
      </div>
    );
  }

  const visibleProducts = shown.slice(0, visible);
  const hasMore = shown.length > visible;

  return (
    <div className="min-h-screen bg-[#fafafa] pb-14 pt-6 md:pt-8">
      <div className={WRAP}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-neutral-500">
            <li className="shrink-0">
              <Link
                href="/"
                className="transition-colors hover:text-neutral-950"
              >
                Home
              </Link>
            </li>
            <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
            <li className="shrink-0">
              <Link
                href="/collections"
                className="transition-colors hover:text-neutral-950"
              >
                Collections
              </Link>
            </li>
            <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
            <li
              className="min-w-0 truncate font-semibold text-neutral-950"
              aria-current="page"
            >
              {current.name}
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-5 border-b border-neutral-200 pb-4">
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-950 md:text-3xl">
              {current.name}{" "}
              <span className="ml-1 text-sm font-medium normal-case not-italic tracking-normal text-neutral-500">
                ({shown.length} {shown.length === 1 ? "product" : "products"})
              </span>
            </h1>
          </div>
          {current.description && (
            <p className="mt-2 max-w-xl text-sm text-neutral-600">
              {current.description}
            </p>
          )}
        </div>

        {/* Collection switcher */}
        {allCollections.length > 1 && (
          <div
            className={cx(
              HIDE_SCROLLBAR,
              "-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0",
            )}
          >
            <Link
              href="/products"
              className={cx(
                "inline-flex h-10 shrink-0 items-center rounded bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100",
                FOCUS,
              )}
            >
              All products
            </Link>
            {allCollections.map((c) => {
              const on = c.id === current.id;
              return (
                <Link
                  key={c.id}
                  href={`/collections/${c.slug}`}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "inline-flex h-10 shrink-0 items-center rounded px-4 text-sm font-medium transition-colors",
                    FOCUS,
                    on
                      ? "hover:bg-neutral-300 text-[#00000] bg-[#ff5a1f]"
                      : "bg-white text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Toolbar */}
        {products.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div
              className={cx(
                HIDE_SCROLLBAR,
                "flex min-w-0 flex-1 gap-2 overflow-x-auto",
              )}
              role="group"
              aria-label="Filter by category"
            >
              {categoryIds.length > 1 && (
                <>
                  {["all", ...categoryIds].map((id) => {
                    const on = activeCat === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setActiveCat(id);
                          setVisible(PAGE_SIZE);
                        }}
                        className={cx(
                          "h-9 shrink-0 rounded px-3.5 text-xs font-bold transition-colors",
                          FOCUS,
                          on
                            ? "bg-neutral-200 text-neutral-950"
                            : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-950",
                        )}
                      >
                        {id === "all" ? "All" : (categoryNames[id] ?? id)}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="relative shrink-0">
              <label htmlFor="sort" className="sr-only">
                Sort products
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortKey);
                  setVisible(PAGE_SIZE);
                }}
                className={cx(
                  "h-10 appearance-none rounded bg-white pl-3.5 pr-9 text-sm font-medium text-neutral-950 outline-none transition-colors hover:bg-neutral-100",
                  FOCUS,
                )}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>
          </div>
        )}

        {/* Grid */}
        {shown.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl bg-white px-4 py-16 text-center">
            <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
              <Tag className="h-9 w-9 text-neutral-400" />
            </div>
            <h2 className="font-display text-xl font-black uppercase italic tracking-tight text-neutral-900">
              {products.length === 0
                ? "Nothing here yet"
                : "No products in this category"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              {products.length === 0
                ? "We're adding products to this collection. Check back soon."
                : "Try a different category."}
            </p>
            {products.length === 0 ? (
              <Link
                href="/products"
                className={cx(
                  "mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
                  FOCUS,
                )}
              >
                Shop all <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setActiveCat("all")}
                className={cx(
                  "mt-6 inline-flex items-center rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
                  FOCUS,
                )}
              >
                Show all
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    p={p}
                    saved={isInWishlist(p.id)}
                    onToggleWishlist={() => toggleWishlist(p)}
                  />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <p className="text-xs text-neutral-500">
                  Showing {visibleProducts.length} of {shown.length}
                </p>
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className={cx(
                    "inline-flex h-12 items-center rounded bg-neutral-950 px-10 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
                    FOCUS,
                  )}
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<CollectionSkeleton />}>
      <CollectionBody />
    </Suspense>
  );
}
