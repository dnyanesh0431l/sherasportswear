import { getHomepageData } from "./lib/home-data";
import { HeroCarousel } from "./components/home/hero-carousel";
import { CategoryGrid } from "./components/home/category-grid";
import { ProductCarousel } from "./components/home/product-carousel";
import { BannerStrip } from "./components/home/banner-strip";
import type { ProductDoc } from "./lib/home-data";

export const runtime = "nodejs";
export const revalidate = 60; // ISR — admin edits reflect within 60s

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

export default async function HomePage() {
  const { sections, banners, categories, products, collections } = await getHomepageData();

  return (
    <div className="flex flex-col">
      {sections.map((section) => {
        switch (section.type) {
          case "hero_carousel": {
            const heroBanners = section.bannerIds.map((id) => banners[id]).filter(Boolean);
            if (heroBanners.length === 0) return null;
            return <HeroCarousel key={section.id} banners={heroBanners} />;
          }

          case "category_grid": {
            const cats = section.categoryIds.map((id) => categories[id]).filter(Boolean);
            if (cats.length === 0) return null;
            return (
              <CategoryGrid
                key={section.id}
                title={section.title}
                subtitle={section.subtitle}
                categories={cats}
              />
            );
          }

          case "product_carousel": {
            const direct = section.productIds.map((id) => products[id]).filter(Boolean) as ProductDoc[];
            const fromCols = section.collectionIds.flatMap((cid) =>
              (collections[cid]?.productIds ?? [])
                .map((pid) => products[pid])
                .filter(Boolean),
            ) as ProductDoc[];
            const list = dedupe([...direct, ...fromCols]);
            if (list.length === 0) return null;
            return (
              <ProductCarousel
                key={section.id}
                title={section.title}
                subtitle={section.subtitle}
                products={list}
              />
            );
          }

          case "banner_strip": {
            const strip = section.bannerIds.map((id) => banners[id]).filter(Boolean);
            if (strip.length === 0) return null;
            return <BannerStrip key={section.id} banners={strip} />;
          }

          case "collection_grid":
          case "rich_text":
            return null; // implement when needed

          default:
            return null;
        }
      })}
    </div>
  );
}