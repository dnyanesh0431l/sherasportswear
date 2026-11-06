import type { Metadata } from "next";
import { PageHero } from "../_components/pages/PageHero";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us — Shera Sports Wear",
  description:
    "Questions about sizing, orders, returns or bulk orders? Reach the Shera Sports Wear support team.",
};

const channels = [
  {
    label: "Customer support",
    value: "support@sherasportswear.com",
    href: "mailto:support@sherasportswear.com",
    note: "Replies within 24 hours, Mon–Sat",
  },
  {
    label: "Bulk & team orders",
    value: "bulk@sherasportswear.com",
    href: "mailto:bulk@sherasportswear.com",
    note: "For 10+ pairs or corporate gifting",
  },
  {
    label: "Call / WhatsApp",
    value: "+91 00000 00000",
    href: "tel:+910000000000",
    note: "Mon–Sat, 10am–7pm IST",
  },
  {
    label: "Registered office",
    value: "Shera Sports Wear, [Street], [City], [State] – [PIN], India",
    href: "#",
    note: "By appointment only",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        description="Sizing question? Order issue? Bulk enquiry? Send us a message — a real human will reply within one working day."
      />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
          {/* Left: channels */}
          <div className="space-y-4">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="block rounded-2xl border border-neutral-200 p-5 transition hover:border-[#FF6B00]/60 hover:shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  {c.label}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-neutral-950">
                  {c.value}
                </p>
                <p className="mt-1 text-sm text-neutral-500">{c.note}</p>
              </a>
            ))}
          </div>

          {/* Right: form */}
          <div className="rounded-2xl border border-neutral-200 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
              Send a message
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              All fields are required unless marked optional.
            </p>
            <ContactForm />
          </div>
        </div>
      </main>
    </>
  );
}