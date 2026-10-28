// app/(storefront)/account/layout-client.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { Loader2, LogOut, MapPin, Package, UserCircle2 } from "lucide-react";
import { auth } from "@/lib/firebase/client";

const CustomerContext = createContext<User | null>(null);
export function useCustomer(): User {
  const u = useContext(CustomerContext);
  if (!u) throw new Error("useCustomer called outside /account");
  return u;
}

const NAV = [
  { href: "/account", label: "Overview", icon: UserCircle2 },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
] as const;

export function AccountLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });
    return () => unsub();
  }, [router, pathname]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      </div>
    );
  }

  const displayName =
    user.displayName || user.email?.split("@")[0] || "Athlete";
  const initial = (user.displayName || user.email || "?")[0]?.toUpperCase();

  return (
    <CustomerContext.Provider value={user}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Compact user header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Account
              </div>
              <div className="font-semibold text-neutral-900 truncate">
                {displayName}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Mobile pill tabs */}
        <nav className="lg:hidden -mx-4 px-4 mb-5 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max pb-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/account"
                  ? pathname === href
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
                    active
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white border-neutral-200 text-neutral-900 hover:border-orange-300"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Desktop: sidebar + content */}
        <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-0.5">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/account"
                    ? pathname === href
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 mb-2 rounded-md px-3 py-2 text-sm font-medium   ${
                      active
                        ? "bg-neutral-300 text-neutral-50"
                        : "text-neutral-900 hover:bg-neutral-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </CustomerContext.Provider>
  );
}