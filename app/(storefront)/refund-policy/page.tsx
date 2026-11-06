import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../_components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Shera Sports Wear",
  description:
    "Cancellation windows, return eligibility, refund timelines and exchange process for Shera Sports Wear orders.",
};

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "1. The short version",
    body: (
      <ul className="list-disc space-y-1 pl-6">
        <li>Cancel anytime before dispatch — full refund.</li>
        <li>7-day return window from delivery for unused items.</li>
        <li>Refunds processed in 5–7 business days after pickup.</li>
        <li>Exchanges (size/colour) are free for the first try.</li>
      </ul>
    ),
  },
  {
    id: "cancellation",
    title: "2. Order cancellation",
    body: (
      <>
        <p>
          You can cancel an order free of charge before it is dispatched. Once
          dispatched, cancellation is not possible — use the return process
          below instead.
        </p>
        <p>
          To cancel, email{" "}
          <a className="font-semibold text-[#FF6B00] hover:underline" href="mailto:support@sherasportswear.com">
            support@sherasportswear.com
          </a>{" "}
          with your order ID, or use the &ldquo;Cancel order&rdquo; button on
          the order page if you have an account.
        </p>
        <p>
          If we cancel an order due to unavailability, pricing error or a
          delivery PIN we can&rsquo;t service, you will receive a full refund
          automatically.
        </p>
      </>
    ),
  },
  {
    id: "returns",
    title: "3. Return eligibility",
    body: (
      <>
        <p>
          We accept returns within <strong>7 days of delivery</strong> when all
          of the following apply:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>The product is unused, unwashed and in original packaging</li>
          <li>Tags, insoles and shoe-boxes are intact</li>
          <li>You have the original invoice or order ID</li>
        </ul>
        <p>
          For hygiene reasons, <strong>socks and insoles are non-returnable</strong>{" "}
          once opened.
        </p>
      </>
    ),
  },
  {
    id: "non-returnable",
    title: "4. Non-returnable items",
    body: (
      <ul className="list-disc space-y-1 pl-6">
        <li>Products marked &ldquo;Final Sale&rdquo;</li>
        <li>Gift cards</li>
        <li>Opened innerwear, socks or insoles</li>
        <li>Products damaged due to misuse or normal wear &amp; tear</li>
      </ul>
    ),
  },
  {
    id: "process",
    title: "5. How to start a return",
    body: (
      <>
        <ol className="list-decimal space-y-1 pl-6">
          <li>
            Email{" "}
            <a className="font-semibold text-[#FF6B00] hover:underline" href="mailto:support@sherasportswear.com">
              support@sherasportswear.com
            </a>{" "}
            within 7 days of delivery.
          </li>
          <li>Include your order ID and the reason for return.</li>
          <li>We&rsquo;ll share a pickup slot with our courier partner.</li>
          <li>Hand the sealed package to the courier.</li>
          <li>We inspect on arrival and confirm the refund.</li>
        </ol>
      </>
    ),
  },
  {
    id: "refunds",
    title: "6. Refund timelines",
    body: (
      <>
        <p>
          Once your return passes inspection, we initiate the refund
          immediately. Crediting to your account takes:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>UPI / Net banking:</strong> 3–5 business days</li>
          <li><strong>Credit / debit card:</strong> 5–7 business days</li>
          <li><strong>COD orders:</strong> refunded to a bank account you nominate (5–7 business days)</li>
        </ul>
        <p>
          Original shipping charges are only refunded if the return is due to
          our error (wrong item, defective item, damaged in transit).
        </p>
      </>
    ),
  },
  {
    id: "exchanges",
    title: "7. Exchanges",
    body: (
      <p>
        We offer <strong>one free size/colour exchange</strong> per order for
        eligible items. After the free exchange, a ₹79 shipping fee applies.
        Exchanges are subject to stock availability.
      </p>
    ),
  },
  {
    id: "damaged",
    title: "8. Damaged or wrong items",
    body: (
      <p>
        If you receive a damaged, defective or incorrect item, email us within{" "}
        <strong>48 hours of delivery</strong> with photos of the product and the
        packaging. We&rsquo;ll arrange a free pickup and either replace or fully
        refund your order.
      </p>
    ),
  },
  {
    id: "contact",
    title: "9. Contact",
    body: (
      <p>
        All refund and cancellation queries:{" "}
        <a className="font-semibold text-[#FF6B00] hover:underline" href="mailto:support@sherasportswear.com">
          support@sherasportswear.com
        </a>
        . Please include your order ID for fastest resolution.
      </p>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      updatedAt="1 January 2025"
      intro="Straightforward windows, no hidden conditions. Here's exactly how cancellations, returns and refunds work."
      sections={sections}
    />
  );
}