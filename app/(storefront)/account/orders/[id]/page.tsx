// app/(storefront)/account/orders/[id]/page.tsx
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MyOrderDetailPage from "./client-page";

// This route is user-specific and reads dynamic params.
// Opt it out of instant-navigation validation so the build does not
// require a static shell for [id].
export const instant = false;

function OrderDetailFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<OrderDetailFallback />}>
      <MyOrderDetailPage />
    </Suspense>
  );
}