// app/(storefront)/providers.tsx
"use client";

import { CartProvider } from "./context/cart-context";
import { WishlistProvider } from "./context/wishlist-context";

export function StorefrontProviders({ children }: { children: React.ReactNode }) {
  return (
    <WishlistProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </WishlistProvider>
  );
}