// app/(storefront)/page.tsx
import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import { getDocs, query, collection, orderBy } from "firebase/firestore";
import { adminDb  } from "../../lib/firebase/admin";
import type { Metadata } from "next";
export const dynamic = "force-dynamic"; // <-- ADD THIS LINE
export const metadata: Metadata = {
  title: "Shera Sports Wear — Built to Move",
  description:
    "Premium performance sportswear engineered for training, running, and everyday movement.",
};

// Homepage data changes when admin edits. 60s ISR is a fair trade.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  placement: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  basePricePaise: number;
  mrpPaise: number;
  images: string[];
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  productIds: string[];
};

type HomepageSection = {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  config: Record<string, any>;
  categoryIds?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getHomepageData() {
  const db = adminDb;

  const [
    sectionsSnap,
    bannersSnap,
    productsSnap,
    categoriesSnap,
    collectionsSnap,
  ] = await Promise.all([
    db.collection("homepageSections").orderBy("sortOrder", "asc").get(),
    db.collection("banners").orderBy("sortOrder", "asc").get(),
    db.collection("products").orderBy("createdAt", "desc").limit(48).get(),
    db.collection("categories").orderBy("sortOrder", "asc").get(),
    db.collection("collections").orderBy("sortOrder", "asc").get(),
  ]);

  const banners: Record<string, Banner> = {};
  bannersSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.isActive === false) return;
    banners[d.id] = {
      id: d.id,
      title: data.title || "",
      subtitle: data.subtitle || null,
      imageUrl: data.imageUrl || "",
      ctaLabel: data.ctaLabel || null,
      ctaUrl: data.ctaUrl || null,
      placement: data.placement || "",
    };
  });

  const products: Product[] = productsSnap.docs
    .filter((d) => d.data().status === "active")
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || d.id,
        basePricePaise:
          typeof data.basePricePaise === "number" ? data.basePricePaise : 0,
        mrpPaise: typeof data.mrpPaise === "number" ? data.mrpPaise : 0,
        images: Array.isArray(data.images) ? data.images : [],
        categoryId: data.categoryId || "",
      };
    });

  const categories: Category[] = categoriesSnap.docs
    .filter((d) => d.data().status === "active")
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || d.id,
        image: data.image || null,
        description: data.description || null,
      };
    });

  const collections: Collection[] = collectionsSnap.docs
    .filter((d) => d.data().status === "active")
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || d.id,
        image: data.image || null,
        description: data.description || null,
        productIds: Array.isArray(data.productIds) ? data.productIds : [],
      };
    });

  const sections: HomepageSection[] = sectionsSnap.docs
    .filter((d) => d.data().isActive === true)
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type || "",
        title: data.title || null,
        subtitle: data.subtitle || null,
        sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
        config: data.config || {},
        categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
      };
    });

  return { sections, banners, products, categories, collections };
}

// ---------------------------------------------------------------------------
// Reusable pieces
// ---------------------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  cta = "View all",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 mb-2">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-neutral-900 tracking-wide">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm sm:text-base text-neutral-600 mt-2 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 hover:text-orange-600 shrink-0"
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.mrpPaise, product.basePricePaise);
  const image = product.images[0];

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-neutral-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300">
            <Tag className="h-10 w-10" />
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase bg-orange-500 text-white px-2.5 py-1 rounded-full">
            {discount}% off
          </span>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-neutral-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-neutral-900">
            {formatINR(product.basePricePaise)}
          </span>
          {discount > 0 && (
            <>
              <span className="text-xs text-neutral-500 line-through">
                {formatINR(product.mrpPaise)}
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                Save {formatINR(product.mrpPaise - product.basePricePaise)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function ProductGrid({
  eyebrow,
  title,
  subtitle,
  products,
  href,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  products: Product[];
  href?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        href={href}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {href && (
        <div className="mt-10 text-center sm:hidden">
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:border-orange-500 hover:text-orange-600"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function HeroSection({
  section,
  banner,
}: {
  section: HomepageSection;
  banner?: Banner;
}) {
  const title = banner?.title || section.title || "Own Your Grind";
  const subtitle = banner?.subtitle || section.subtitle;
  const imageUrl = banner?.imageUrl;
  const ctaLabel = banner?.ctaLabel || "Shop now";
  const ctaUrl = banner?.ctaUrl || "/products";

  return (
    <section className="relative overflow-hidden bg-neutral-950">
      <div className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-70"
            priority-fetch="high"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500 mb-4">
              New Season Drop
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white uppercase tracking-wide leading-[0.95]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-5 text-lg text-neutral-200 max-w-xl">
                {subtitle}
              </p>
            )}
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <Link
                href={ctaUrl}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-orange-600 transition-colors"
              >
                {ctaLabel} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/collections/new-arrivals"
                className="inline-flex items-center gap-2 rounded-md border border-white/30 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-white hover:text-neutral-900 transition-colors"
              >
                New Arrivals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PromoStripSection({
  section,
  banner,
}: {
  section: HomepageSection;
  banner?: Banner;
}) {
  const title = banner?.title || section.title || "";
  const subtitle = banner?.subtitle || section.subtitle;
  const ctaLabel = banner?.ctaLabel || "Explore";
  const ctaUrl = banner?.ctaUrl || "/products";

  return (
    <section className="bg-orange-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/90 text-sm mt-1">{subtitle}</p>
          )}
        </div>
        <Link
          href={ctaUrl}
          className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-neutral-800 transition-colors"
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function CategoryGridSection({
  section,
  categories,
}: {
  section: HomepageSection;
  categories: Category[];
}) {
  const shown =
    section.categoryIds && section.categoryIds.length > 0
      ? categories.filter((c) => section.categoryIds!.includes(c.id))
      : categories;

  if (shown.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <SectionHeading
        eyebrow="Shop"
        title={section.title || "Shop by category"}
        subtitle={section.subtitle}
        href="/categories"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {shown.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="group relative overflow-hidden rounded-lg aspect-[4/5] bg-neutral-100"
          >
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.image}
                alt={c.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-neutral-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <h3 className="font-display text-xl sm:text-2xl text-white uppercase tracking-wide">
                {c.name}
              </h3>
              {c.description && (
                <p className="text-xs text-white/80 mt-1 line-clamp-1">
                  {c.description}
                </p>
              )}
              <div className="mt-2 text-xs uppercase tracking-wider font-semibold text-orange-400 inline-flex items-center gap-1">
                Shop <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CollectionSection({
  section,
  collections,
  products,
}: {
  section: HomepageSection;
  collections: Collection[];
  products: Product[];
}) {
  const col = collections.find((c) => c.id === section.config?.collectionId);
  if (!col) return null;

  const limit = Number(section.config?.limit) || 8;
  const prods = col.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p)
    .slice(0, limit);

  return (
    <ProductGrid
      eyebrow="Curated"
      title={section.title || col.name}
      subtitle={section.subtitle || col.description}
      products={prods}
      href={`/collections/${col.slug}`}
    />
  );
}

function BrandStorySection({ section }: { section: HomepageSection }) {
  const body =
    section.config?.bodyText ||
    "Born from the grit of everyday athletes. Shera Sports Wear builds performance gear that moves the way you do — engineered, tested, and refined for the modern athlete.";

  return (
    <section className="bg-neutral-50 py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-600 mb-4">
          Our Story
        </div>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-neutral-900 uppercase tracking-wide">
          {section.title || "Built to move"}
        </h2>
        {section.subtitle && (
          <p className="mt-4 text-lg text-neutral-600">{section.subtitle}</p>
        )}
        <p className="mt-6 text-base text-neutral-700 leading-relaxed whitespace-pre-line">
          {body}
        </p>
      </div>
    </section>
  );
}

function SectionRenderer({
  section,
  data,
}: {
  section: HomepageSection;
  data: Awaited<ReturnType<typeof getHomepageData>>;
}) {
  switch (section.type) {
    case "hero": {
      const bannerId = section.config?.bannerId;
      return (
        <HeroSection
          section={section}
          banner={bannerId ? data.banners[bannerId] : undefined}
        />
      );
    }

    case "promo_strip": {
      const bannerId = section.config?.bannerId;
      return (
        <PromoStripSection
          section={section}
          banner={bannerId ? data.banners[bannerId] : undefined}
        />
      );
    }

    case "featured_products": {
      const limit = Number(section.config?.limit) || 8;
      return (
        <ProductGrid
          eyebrow="Featured"
          title={section.title || "Featured products"}
          subtitle={section.subtitle}
          products={data.products.slice(0, limit)}
          href="/products"
        />
      );
    }

    case "bestsellers": {
      const limit = Number(section.config?.limit) || 8;
      // Until we track real sales, bestsellers = newest first (same as featured).
      // Swap in a sales-count query when implemented.
      return (
        <ProductGrid
          eyebrow="Top picks"
          title={section.title || "Bestsellers"}
          subtitle={section.subtitle}
          products={data.products.slice(0, limit)}
          href="/products"
        />
      );
    }

    case "category_grid":
      return (
        <CategoryGridSection section={section} categories={data.categories} />
      );

    case "collection":
      return (
        <CollectionSection
          section={section}
          collections={data.collections}
          products={data.products}
        />
      );

    case "brand_story":
      return <BrandStorySection section={section} />;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StorefrontHomePage() {
  const data = await getHomepageData();

  // Graceful empty state — happens if admin hasn't created sections yet
  if (data.sections.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-wide text-neutral-900">
          Shera Sports Wear
        </h1>
        <p className="mt-4 text-neutral-600">
          The store is being set up. Check back soon.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 mt-8 rounded-md bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-orange-600"
        >
          Browse products <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <>
      {data.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} data={data} />
      ))}

      {/* Newsletter (static — wire to a server action later) */}
      <section className="bg-neutral-950 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500 mb-3">
            Stay in the loop
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-white uppercase tracking-wide">
            Join the movement
          </h2>
          <p className="mt-3 text-neutral-400 text-sm max-w-lg mx-auto">
            New drops, training stories, and early access. No spam.
          </p>
          <form
            action="#"
            className="mt-6 max-w-md mx-auto flex items-stretch gap-2"
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="rounded-md bg-orange-500 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-orange-600"
            >
              Subscribe
            </button>
          </form>
          <p className="mt-3 text-[11px] text-neutral-600">
            By subscribing you consent to receive marketing emails. Unsubscribe
            anytime.
          </p>
        </div>
      </section>
    </>
  );
}