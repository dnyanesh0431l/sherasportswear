// app/(storefront)/account/orders/[id]/page.tsx
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import MyOrderDetailPage from "./client-page";

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