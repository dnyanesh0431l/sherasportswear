// app/(storefront)/layout.tsx
import Link from "next/link";
// import { Instagram, Facebook, Twitter } from "lucide-react";
import { StorefrontHeader } from "./_components/header";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <StorefrontHeader />

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-neutral-950 text-neutral-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="font-display text-2xl tracking-wider text-white">
                SHERA
              </div>
              <div className="text-[10px] tracking-[0.3em] text-orange-500 font-semibold mt-0.5">
                SPORTS WEAR
              </div>
              <p className="text-sm text-neutral-400 mt-4 leading-relaxed">
                Premium performance sportswear engineered for those who move.
              </p>
              {/* <div className="flex items-center gap-3 mt-5">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md bg-neutral-900 hover:bg-orange-500 hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md bg-neutral-900 hover:bg-orange-500 hover:text-white transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md bg-neutral-900 hover:bg-orange-500 hover:text-white transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              </div> */}
            </div>

            {/* Shop */}
            <div>
              <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-white">
                Shop
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/products" className="hover:text-orange-400 transition-colors">
                    All Products
                  </Link>
                </li>
                <li>
                  <Link href="/categories/men" className="hover:text-orange-400 transition-colors">
                    Men
                  </Link>
                </li>
                <li>
                  <Link href="/categories/women" className="hover:text-orange-400 transition-colors">
                    Women
                  </Link>
                </li>
                <li>
                  <Link href="/categories/accessories" className="hover:text-orange-400 transition-colors">
                    Accessories
                  </Link>
                </li>
                <li>
                  <Link href="/categories/footwear" className="hover:text-orange-400 transition-colors">
                    Footwear
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-white">
                Support
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/orders" className="hover:text-orange-400 transition-colors">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link href="/account" className="hover:text-orange-400 transition-colors">
                    My Account
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-orange-400 transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/shipping" className="hover:text-orange-400 transition-colors">
                    Shipping
                  </Link>
                </li>
                <li>
                  <Link href="/returns" className="hover:text-orange-400 transition-colors">
                    Returns
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-white">
                Company
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/about" className="hover:text-orange-400 transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-orange-400 transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-orange-400 transition-colors">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
            <p>
              © {new Date().getFullYear()} Shera Sports Wear. All rights
              reserved.
            </p>
            <p className="text-[10px] tracking-widest uppercase">
              Built to move.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}