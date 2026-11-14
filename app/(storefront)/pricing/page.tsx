// app/(storefront)/pricing/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/pages/PageHero";

export const metadata: Metadata = {
  title: "Pricing & Shipping — Shera Sports Wear",
  description:
    "Transparent pricing, GST-inclusive totals, and a flat ₹80 shipping fee on every order. No hidden fees.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Honest pricing. No surprises."
        description="Every price you see on Shera is GST-inclusive, and fully itemised at checkout — with a flat ₹80 shipping fee on every order."
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

        {/* Shipping — single flat rate */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
            Shipping charges
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            We charge one flat fee on every order, anywhere in India. It&rsquo;s
            shown in your cart and included in the total at checkout before you
            pay.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Standard shipping (Pan-India)
              </p>
              <p className="mt-2 text-3xl font-black text-neutral-950">₹80</p>
              <p className="mt-1 text-sm text-neutral-700">
                4–6 business days from dispatch
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Applies to every order, regardless of order value or PIN code.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 p-6 bg-neutral-50">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                What you&rsquo;ll see
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                <li>₹80 added once per order, not per item.</li>
                <li>Included in the total on cart and checkout.</li>
                <li>Itemised in your order summary before payment.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Fine print */}
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
          <h3 className="font-semibold text-neutral-950">Fine print</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>All prices are in Indian Rupees (₹) and inclusive of GST.</li>
            <li>
              A flat ₹80 shipping fee applies to every order. It is displayed
              in your cart and at checkout before you pay.
            </li>
            <li>
              Shipping timelines are estimates from dispatch date, not order
              date. Dispatch is within 24 business hours of payment confirmation.
            </li>
            <li>
              Prices are subject to change without notice. The price shown at
              checkout is final.
            </li>
            <li>
              All sales are final. Please review our{" "}
              <Link
                href="/refund-policy"
                className="font-semibold text-[#FF6B00] hover:underline"
              >
                No Returns &amp; No Refunds Policy
              </Link>{" "}
              before placing an order.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}