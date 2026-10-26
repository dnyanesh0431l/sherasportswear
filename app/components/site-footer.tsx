import Link from "next/link";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Footwear", href: "/categories/footwear" },
      { label: "Apparel", href: "/categories/apparel" },
      { label: "Accessories", href: "/categories/accessories" },
      { label: "Sale", href: "/collections/end-of-season-sale" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Track Order", href: "/orders" },
      { label: "Shipping", href: "/help/shipping" },
      { label: "Returns", href: "/help/returns" },
      { label: "Contact", href: "/help/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Stores", href: "/stores" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="font-display text-3xl uppercase text-white">
              Shera<span className="text-orange-500">.</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
              Built for the grind. Performance sports wear designed in India, worn everywhere.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {["Instagram", "Twitter", "YouTube"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-zinc-300 transition hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-zinc-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} Shera Sports Wear. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300">Terms</Link>
            <Link href="/cookies" className="hover:text-zinc-300">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}