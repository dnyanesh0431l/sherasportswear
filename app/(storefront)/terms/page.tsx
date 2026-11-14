// app/(storefront)/terms/page.tsx
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../_components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — Shera Sports Wear",
  description:
    "Terms and conditions governing your use of the Shera Sports Wear website and purchase of products.",
};

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of terms",
    body: (
      <>
        <p>
          By accessing or purchasing from sherasportswear.com (&ldquo;the
          Site&rdquo;), you agree to be bound by these Terms &amp; Conditions.
          If you do not agree, please do not use the Site.
        </p>
        <p>
          These terms are governed by the laws of India, including the
          Information Technology Act, 2000 and the Consumer Protection Act,
          2019.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    body: (
      <p>
        You must be at least 18 years old, or using the Site under the
        supervision of a parent or legal guardian, to make a purchase. You agree
        to provide accurate and complete information during checkout.
      </p>
    ),
  },
  {
    id: "orders",
    title: "3. Orders & acceptance",
    body: (
      <>
        <p>
          An order is an offer to purchase. All orders are subject to acceptance
          and availability. We may refuse or cancel an order before dispatch for
          reasons including but not limited to:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Product unavailability or pricing errors</li>
          <li>Suspected fraud or abuse</li>
          <li>Shipping restrictions to the delivery PIN code</li>
        </ul>
        <p>
          Once an order has been confirmed and paid for, it cannot be cancelled
          or modified by the customer. If we cancel an order before dispatch for
          any of the reasons above, any amount paid will be refunded in full.
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    title: "4. Pricing & payment",
    body: (
      <>
        <p>
          All prices are listed in Indian Rupees (₹) and are inclusive of GST
          unless stated otherwise. Prices may change without notice; the price
          at the time of purchase is final.
        </p>
        <p>
          We accept major credit/debit cards, UPI, net banking and — where
          available — cash on delivery. Payments are processed by third-party
          gateways; we do not store full card details.
        </p>
        <p className="font-semibold text-neutral-900">
          All sales are final. Please read our{" "}
          <a
            href="/refund-policy"
            className="font-semibold text-[#FF6B00] hover:underline"
          >
            No Returns &amp; No Refunds Policy
          </a>{" "}
          before placing an order.
        </p>
      </>
    ),
  },
  {
    id: "shipping",
    title: "5. Shipping & delivery",
    body: (
      <p>
        Shipping timelines are estimates. Risk of loss passes to you on
        delivery. Please verify your shipping address and contact number before
        placing the order; we are not responsible for delivery failures caused
        by incorrect information provided at checkout.
      </p>
    ),
  },
  {
    id: "returns",
    title: "6. Returns, refunds & cancellations",
    body: (
      <>
        <p className="font-semibold text-neutral-900">
          All sales are final. We do not accept returns, exchanges or offer
          refunds once an order has been placed and paid for.
        </p>
        <p>
          Because every order is treated as final, please review the product
          description, size guide, and colour swatches carefully before
          purchasing. If you have questions about a product before ordering,
          contact us at{" "}
          <a
            className="font-semibold text-[#FF6B00] hover:underline"
            href="mailto:support@sherasportswear.com"
          >
            support@sherasportswear.com
          </a>{" "}
          and we will be happy to help.
        </p>
        <p>
          The only exception is where we cancel your order before dispatch (e.g.
          product unavailable, pricing error, or failed delivery due to our
          error), in which case any amount paid will be refunded in full to the
          original payment method.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "7. Intellectual property",
    body: (
      <p>
        All content on the Site — including the Shera and Columbus brand marks,
        product photography, text and code — is owned by us or our licensors and
        is protected by Indian and international IP laws. You may not copy,
        reproduce or redistribute any portion without written permission.
      </p>
    ),
  },
  {
    id: "conduct",
    title: "8. Acceptable use",
    body: (
      <ul className="list-disc space-y-1 pl-6">
        <li>Do not use the Site for any unlawful purpose.</li>
        <li>
          Do not attempt to interfere with the Site&rsquo;s security or
          availability.
        </li>
        <li>Do not scrape or misuse product data.</li>
        <li>Do not submit false reviews or impersonate others.</li>
      </ul>
    ),
  },
  {
    id: "liability",
    title: "9. Limitation of liability",
    body: (
      <p>
        To the maximum extent permitted by law, Shera Sports Wear is not liable
        for indirect, incidental, or consequential damages arising from your use
        of the Site or products. Our total liability for any claim is limited to
        the amount you paid for the product in question.
      </p>
    ),
  },
  {
    id: "changes",
    title: "10. Changes to these terms",
    body: (
      <p>
        We may update these terms from time to time. The &ldquo;Last
        updated&rdquo; date at the top reflects the current version. Continued
        use of the Site after changes constitutes acceptance.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact",
    body: (
      <p>
        Questions about these terms? Email{" "}
        <a
          className="font-semibold text-[#FF6B00] hover:underline"
          href="mailto:support@sherasportswear.com"
        >
          support@sherasportswear.com
        </a>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updatedAt="15 November 2025"
      intro="Please read these terms carefully — they govern your use of the Site and your purchases from Shera Sports Wear. All sales are final; please review our no-returns and no-refunds policy before ordering."
      sections={sections}
    />
  );
}
