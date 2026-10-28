// app/(storefront)/products/[slug]/page.tsx
import ClientProductPage from "./client-page";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ClientProductPage slug={slug} />;
}