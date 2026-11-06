import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../_components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Shera Sports Wear",
  description:
    "How Shera Sports Wear collects, uses, and protects your personal data in accordance with Indian data protection law.",
};

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "1. Scope",
    body: (
      <p>
        This Privacy Policy explains how Shera Sports Wear (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, shares and protects your personal
        information when you use sherasportswear.com and related services.
      </p>
    ),
  },
  {
    id: "collect",
    title: "2. Information we collect",
    body: (
      <>
        <p>
          <strong>You give us:</strong> name, email, phone, shipping/billing
          address, order history, and any messages you send us.
        </p>
        <p>
          <strong>We collect automatically:</strong> IP address, browser/device
          data, pages viewed, and cookies needed to keep your cart and session
          working.
        </p>
        <p>
          <strong>From third parties:</strong> payment confirmation from our
          payment gateway (we never see your full card number).
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "3. How we use your data",
    body: (
      <ul className="list-disc space-y-1 pl-6">
        <li>To fulfil and deliver your orders</li>
        <li>To send transactional updates (dispatch, delivery, refunds)</li>
        <li>To provide customer support</li>
        <li>To prevent fraud and secure the Site</li>
        <li>To send marketing emails — only if you opted in (unsubscribe anytime)</li>
        <li>To comply with legal and tax obligations</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "4. Cookies",
    body: (
      <p>
        We use essential cookies to keep your cart and login session working,
        and analytics cookies (e.g. Google Analytics) to understand how the Site
        is used. You can disable non-essential cookies in your browser settings.
      </p>
    ),
  },
  {
    id: "share",
    title: "5. Sharing your information",
    body: (
      <>
        <p>We share data only with parties needed to run the store:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Payment gateways (Razorpay / similar) for processing payments</li>
          <li>Logistics partners for delivery</li>
          <li>Email/SMS providers for transactional messages</li>
          <li>Cloud hosting and analytics providers</li>
          <li>Government authorities when required by law</li>
        </ul>
        <p>We never sell your personal data.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "6. Data retention",
    body: (
      <p>
        Order records are retained for at least 8 years to comply with Indian
        tax law. Marketing data is retained until you unsubscribe. Support
        emails are deleted within 24 months.
      </p>
    ),
  },
  {
    id: "security",
    title: "7. Security",
    body: (
      <p>
        We use HTTPS everywhere, encrypt sensitive data in transit, and store
        data on reputable cloud infrastructure. No system is 100% secure — if
        you suspect unauthorised access, contact us immediately.
      </p>
    ),
  },
  {
    id: "rights",
    title: "8. Your rights",
    body: (
      <>
        <p>You may request:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Access to the personal data we hold about you</li>
          <li>Correction of inaccurate data</li>
          <li>Deletion of your data (subject to legal retention)</li>
          <li>Withdrawal of marketing consent</li>
        </ul>
        <p>
          Email{" "}
          <a className="font-semibold text-[#FF6B00] hover:underline" href="mailto:support@sherasportswear.com">
            support@sherasportswear.com
          </a>{" "}
          with your request — we will respond within 30 days.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "9. Children",
    body: (
      <p>
        The Site is not intended for children under 13. If we learn we have
        inadvertently collected data from a child, we will delete it.
      </p>
    ),
  },
  {
    id: "updates",
    title: "10. Updates to this policy",
    body: (
      <p>
        We may update this policy from time to time. Material changes will be
        announced on the Site or by email.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updatedAt="1 January 2025"
      intro="We collect the minimum data required to run the store, and never sell it. This page explains exactly what we collect and why."
      sections={sections}
    />
  );
}