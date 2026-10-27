// context/wishlist-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type WishlistItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  image: string;
};

type WishlistContextType = {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  wishlistCount: number;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("shera_wishlist");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("shera_wishlist", JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addItem = (newItem: WishlistItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === newItem.id)) return prev;
      return [...prev, newItem];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const isInWishlist = (id: string) => items.some((i) => i.id === id);
  const wishlistCount = items.length;

  return (
    <WishlistContext.Provider value={{ items, addItem, removeItem, isInWishlist, wishlistCount }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
};