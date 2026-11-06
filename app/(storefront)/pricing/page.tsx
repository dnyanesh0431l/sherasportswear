import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/pages/PageHero";

export const metadata: Metadata = {
  title: "Pricing & Shipping — Shera Sports Wear",
  description:
    "Transparent pricing, free shipping over ₹999, bulk & team discounts, and GST-inclusive totals. No hidden fees.",
};

const shipping = [
  { name: "Standard", price: "₹79", eta: "4–6 business days", note: "Pan-India" },
  { name: "Express", price: "₹149", eta: "2–3 business days", note: "Metro cities" },
  { name: "Free shipping", price: "₹0", eta: "4–6 business days", note: "Orders over ₹999" },
  { name: "Cash on delivery", price: "₹49", eta: "5–7 business days", note: "Select PIN codes" },
];

const bulk = [
  { qty: "10–49 pairs", discount: "10% off", note: "Clubs, teams, gyms" },
  { qty: "50–99 pairs", discount: "15% off", note: "Schools & academies" },
  { qty: "100+ pairs", discount: "Custom quote", note: "Corporate gifting" },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Honest pricing. No surprises."
        description="Every price you see on Shera is GST-inclusive. Shipping is flat-rate across India, free over ₹999, and fully itemised at checkout."
      />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 space-y-16">
        {/* Product prices */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
            Product price ranges
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Current price bands by category. Exact price is always shown on the
            product page and at checkout.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950 text-white">
                <tr>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Price range</th>
                  <th className="px-5 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {[
                  ["Running shoes", "₹1,799 – ₹2,399", "Carbon-plated & daily trainers"],
                  ["Training & gym", "₹2,299", "Gym-ready cushioning"],
                  ["Walking shoes", "₹1,799 – ₹2,299", "Everyday comfort"],
                  ["Accessories", "₹499 – ₹1,499", "Socks, bags, bottles"],
                ].map(([cat, range, note]) => (
                  <tr key={cat} className="bg-white">
                    <td className="px-5 py-3 font-medium text-neutral-900">{cat}</td>
                    <td className="px-5 py-3 text-neutral-700">{range}</td>
                    <td className="px-5 py-3 text-neutral-500">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Shipping */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
            Shipping charges
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shipping.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl border border-neutral-200 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  {s.name}
                </p>
                <p className="mt-2 text-2xl font-black text-neutral-950">
                  {s.price}
                </p>
                <p className="mt-1 text-sm text-neutral-700">{s.eta}</p>
                <p className="mt-1 text-xs text-neutral-500">{s.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bulk */}
        <section>
          <div className="rounded-3xl bg-neutral-950 p-8 text-white sm:p-10">
            <h2 className="text-2xl font-bold tracking-tight">
              Bulk, team & corporate orders
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Discounts scale with volume. All bulk orders include GST invoice,
              custom size runs, and priority dispatch.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {bulk.map((b) => (
                <div
                  key={b.qty}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    {b.qty}
                  </p>
                  <p className="mt-2 text-xl font-bold text-[#FF6B00]">
                    {b.discount}
                  </p>
                  <p className="mt-1 text-xs text-white/60">{b.note}</p>
                </div>
              ))}
            </div>

            <Link
              href="/contact"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#FF6B00] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#e65f00]"
            >
              Request a bulk quote →
            </Link>
          </div>
        </section>

        {/* Fine print */}
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
          <h3 className="font-semibold text-neutral-950">Fine print</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>All prices are in Indian Rupees (₹) and inclusive of GST.</li>
            <li>
              Shipping timelines are estimates from dispatch date, not order
              date. Dispatch is within 24 business hours of payment confirmation.
            </li>
            <li>
              COD carries a ₹49 handling fee and is available on select PIN
              codes for orders up to ₹10,000.
            </li>
            <li>
              Prices are subject to change without notice. The price shown at
              checkout is final.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}