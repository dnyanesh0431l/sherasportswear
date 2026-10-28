// app/(storefront)/account/layout.tsx
import { AccountLayoutClient } from "./layout-client";

// The account section is auth-gated and inherently dynamic — it cannot
// render an instant static shell, so instant-navigation validation
// doesn't apply here. Opting the segment out keeps the console clean.
export const instant = false;

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountLayoutClient>{children}</AccountLayoutClient>;
}