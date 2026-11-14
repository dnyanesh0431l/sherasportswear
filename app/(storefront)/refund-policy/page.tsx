// app/(storefront)/refund-policy/page.tsx
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../_components/legal/LegalPage";

export const metadata: Metadata = {
  title: "No Returns & No Refunds Policy — Shera Sports Wear",
  description:
    "All sales are final at Shera Sports Wear. We do not accept returns, exchanges or issue refunds once an order has been placed and paid for, except in the limited cases described in this policy.",
};

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "1. The short version",
    body: (
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <strong>All sales are final.</strong> No returns, no exchanges and no
          refunds once an order is placed and paid for.
        </li>
        <li>
          Orders <strong>cannot be cancelled</strong> once confirmed and paid.
        </li>
        <li>
          The only exceptions are when <em>we</em> cancel an order before
          dispatch, a duplicate payment is charged, or you receive a damaged,
          defective or wrong item — in which case the cases in sections 4 and 5
          apply.
        </li>
        <li>
          Please review size, colour and product details <strong>before</strong>{" "}
          you order.
        </li>
      </ul>
    ),
  },
  {
    id: "final-sale",
    title: "2. All sales are final",
    body: (
      <>
        <p className="font-semibold text-neutral-900">
          All purchases made on sherasportswear.com are final. We do not accept
          returns or exchanges and we do not issue refunds once an order has
          been placed and paid for.
        </p>
        <p>
          By placing an order on the Site, you confirm that you have reviewed
          the product description, size guide, colour swatches and final price,
          and that you are purchasing the item as-is with no right to return it
          or receive a refund later, except in the limited cases described in
          this policy.
        </p>
      </>
    ),
  },
  {
    id: "before-ordering",
    title: "3. Please check before you order",
    body: (
      <>
        <p>
          Because orders cannot be returned or refunded, please double-check the
          following before you check out:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Size:</strong> compare measurements against our size guide.
          </li>
          <li>
            <strong>Colour:</strong> note that colours may vary slightly between
            screens and in person.
          </li>
          <li>
            <strong>Variant and quantity:</strong> confirm the correct size,
            colour and quantity.
          </li>
          <li>
            <strong>Shipping address and phone number:</strong> make sure these
            are accurate — we cannot deliver to incorrect addresses.
          </li>
        </ul>
        <p>
          If you are unsure about a product before ordering, contact us at{" "}
          <a
            className="font-semibold text-[#FF6B00] hover:underline"
            href="mailto:support@sherasportswear.com"
          >
            support@sherasportswear.com
          </a>{" "}
          and we&rsquo;ll help you choose the right item before you buy.
        </p>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "4. Cancellations",
    body: (
      <>
        <p>
          Once an order is confirmed and paid for, it{" "}
          <strong>cannot be cancelled or modified</strong> by the customer.
        </p>
        <p>
          We reserve the right to cancel an order before dispatch in limited
          cases such as product unavailability, pricing errors, suspected fraud,
          or delivery restrictions to your PIN code. If we cancel your order
          before dispatch, any amount paid will be refunded in full to the
          original payment method.
        </p>
      </>
    ),
  },
  {
    id: "refund-exceptions",
    title: "5. Refunds (limited exceptions only)",
    body: (
      <>
        <p>
          Refunds are issued <strong>only</strong> in the following situations:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            We cancel your order before dispatch (product unavailable, pricing
            error, suspected fraud, or delivery restrictions).
          </li>
          <li>A duplicate payment is captured for the same order.</li>
          <li>
            A payment is captured but the corresponding order could not be
            created on our side.
          </li>
          <li>
            You receive a <strong>damaged, defective or wrong item</strong> and
            we approve your claim under section 6 below.
          </li>
          <li>
            A refund is required by applicable Indian consumer law or a
            competent authority.
          </li>
        </ul>
        <p>
          Approved refunds are made to the original payment method within 5–7
          working days. Refunds are not issued for change of mind, incorrect
          size ordered, colour differences, or any other reason once an order
          has been delivered, except as expressly set out in this policy.
        </p>
      </>
    ),
  },
  {
    id: "damaged",
    title: "6. Damaged, defective or wrong items",
    body: (
      <>
        <p>
          If you receive an item that is <strong>damaged in transit</strong>,{" "}
          <strong>defective on arrival</strong>, or{" "}
          <strong>different from what you ordered</strong>, contact us within{" "}
          <strong>48 hours of delivery</strong> at{" "}
          <a
            className="font-semibold text-[#FF6B00] hover:underline"
            href="mailto:support@sherasportswear.com"
          >
            support@sherasportswear.com
          </a>{" "}
          with:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your order ID / order number</li>
          <li>Photos of the item and its packaging</li>
          <li>A short description of the issue</li>
        </ul>
        <p>
          After review, we may (at our sole discretion) offer a replacement, a
          store credit, or a refund to the original payment method. Items
          showing signs of use, washing, or damage caused after delivery will
          not be accepted. Claims raised after 48 hours of delivery may not be
          honoured.
        </p>
      </>
    ),
  },
  {
    id: "delivery-failures",
    title: "7. Failed deliveries",
    body: (
      <>
        <p>
          If delivery fails due to an incorrect address, unavailable recipient,
          refusal to accept the package, or repeated failed delivery attempts,
          the order will not be refunded. Where possible, re-shipping will be
          arranged at additional cost to the customer.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "8. Contact",
    body: (
      <p>
        Questions about this policy? Email{" "}
        <a
          className="font-semibold text-[#FF6B00] hover:underline"
          href="mailto:support@sherasportswear.com"
        >
          support@sherasportswear.com
        </a>{" "}
        before placing your order. Please include your order ID for fastest
        resolution.
      </p>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="No Returns & No Refunds Policy"
      updatedAt="15 November 2025"
      intro="All sales are final. Please read this policy carefully before placing an order — we do not accept returns, exchanges or offer refunds once an order has been placed and paid for, except in the limited cases described below."
      sections={sections}
    />
  );
}
