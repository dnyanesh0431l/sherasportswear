// app/(storefront)/layout.tsx
import { Poppins } from "next/font/google";
import Link from "next/link";
import { StorefrontProviders } from "./../providers";
import { StorefrontHeader } from "./_components/header";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
  display: "swap",
});

const ANNOUNCEMENTS = [
  "Free shipping on orders above ₹999",
  "Easy returns",
  "Premium quality",
];

const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      ["All Products", "/products"],
      ["Men", "/categories/men"],
      ["Women", "/categories/women"],
      ["Accessories", "/categories/accessories"],
      ["Footwear", "/categories/footwear"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Track Order", "/orders"],
      ["My Account", "/account"],
      ["Contact Us", "/contact"],
      ["Shipping", "/shipping"],
      ["Returns", "/returns"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
  // Required by Next.js 16 LayoutConfig — no dynamic segments,
  // so params resolves to an empty object. This satisfies the
  // LayoutProps<"/"> constraint in the generated type validator.
  params: Promise<Record<string, never>>;
}) {
  return (
    <StorefrontProviders>
      <div
        className={`${poppins.variable} flex min-h-screen flex-col bg-white font-display text-neutral-900`}
      >
        {/* Announcement bar */}
        <div className="bg-brand text-white">
          <p className="mx-auto flex max-w-7xl items-center justify-center gap-4 bg-[#ff5a1f] px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">
            {ANNOUNCEMENTS.map((text, i) => (
              <span
                key={text}
                className={i > 0 ? "hidden items-center gap-4 sm:flex" : ""}
              >
                {i > 0 && (
                  <span aria-hidden="true" className="h-3 w-px bg-white/60" />
                )}
                {text}
              </span>
            ))}
          </p>
        </div>

        <StorefrontHeader />

        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        <footer className="mt-8 bg-neutral-950 pb-20 text-neutral-300 md:mt-10 md:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              <div className="col-span-2 md:col-span-1">
                <div className="font-display text-xl font-black italic tracking-tighter text-white">
                  SHER<span className="text-brand">A</span>
                </div>
                <div className="mt-0.5 text-[9px] font-semibold tracking-[0.3em] text-brand">
                  SPORTS WEAR
                </div>
                <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-neutral-400">
                  Premium performance sportswear engineered for those who move.
                </p>
              </div>

              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                    {col.title}
                  </h4>
                  <ul className="mt-3 space-y-1.5 text-[13px]">
                    {col.links.map(([label, href]) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="transition-colors hover:text-brand"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-neutral-800 pt-4 text-[11px] text-neutral-500 sm:flex-row">
              <p>© 2026 Shera Sports Wear. All rights reserved.</p>
              <p className="text-[9px] uppercase tracking-widest">
                Built to move.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </StorefrontProviders>
  );
}
