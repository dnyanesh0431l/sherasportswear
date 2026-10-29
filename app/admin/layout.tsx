// app/admin/layout.tsx
"use client";

import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Monitor,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Store,
  Tablet,
  Tags,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Toaster } from "sonner";

/* ----------------------------- navigation data ---------------------------- */

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/collections", label: "Collections", icon: FolderOpen },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/shipments", label: "Shipments", icon: Truck },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/admin/banners", label: "Banners", icon: ImageIcon },
      { href: "/admin/homepage", label: "Homepage", icon: LayoutGrid },
    ],
  },
  {
    label: "People",
    items: [{ href: "/admin/customers", label: "Customers", icon: Users }],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 64;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

/* --------------------------------- sidebar -------------------------------- */

function SidebarContent({
  pathname,
  email,
  collapsed,
  onSignOut,
  onNavigate,
}: {
  pathname: string;
  email: string;
  collapsed: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  const initial = (email?.[0] ?? "A").toUpperCase();

  return (
    <div className="flex h-full flex-col bg-[#0a0a0b] text-white">
      {/* Brand */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-white/[0.08] transition-all duration-300 ${
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        }`}
      >
        <div className="grid h-8 w-8 shrink-0 place-items-center bg-[#ff5a1f]">
          <span className="text-[13px] font-black leading-none text-white">
            S
          </span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-[12px] font-black leading-none tracking-tight text-white">
              SHERA
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]">
              Sports Wear
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className={`flex-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          collapsed ? "overflow-visible" : "overflow-y-auto"
        }`}
      >
        {NAV_GROUPS.map((group, idx) => (
          <div
            key={group.label}
            className={collapsed ? "px-2 pb-1.5" : "px-2 pb-1"}
          >
            {collapsed && idx > 0 && (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
            )}
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-2.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#737373]">
                {group.label}
              </div>
            )}

            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={`group relative flex items-center text-[12px] transition-colors duration-150 ${
                      collapsed
                        ? "justify-center px-2 py-2"
                        : "gap-2.5 px-2.5 py-1.5"
                    } ${
                      active
                        ? "bg-[#ff5a1f]/15 font-semibold text-white"
                        : "font-medium text-[#a3a3a3] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-[#ff5a1f]" />
                    )}
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active
                          ? "text-[#ff5a1f]"
                          : "text-[#737373] group-hover:text-white"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap bg-white px-2 py-1 text-xs font-semibold text-neutral-900 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                        {label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.08] p-2">
        {collapsed ? (
          <div className="flex justify-center">
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-8 w-8 place-items-center text-[#a3a3a3] transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-white/[0.04] p-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center bg-[#ff5a1f] text-[10px] font-black text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold text-white">
                {email || "Administrator"}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a3a3a3]">
                Admin
              </div>
            </div>
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-6 w-6 shrink-0 place-items-center text-[#a3a3a3] transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- header -------------------------------- */

function Header({
  collapsed,
  onToggleCollapse,
  onOpenDrawer,
  isFullscreen,
  onToggleFullscreen,
  currentPage,
  deviceView,
  setDeviceView,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenDrawer: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  currentPage: string;
  deviceView: "desktop" | "tablet" | "mobile";
  setDeviceView: (v: "desktop" | "tablet" | "mobile") => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-3 sm:px-4 lg:px-5">
      <button
        onClick={onToggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-8 w-8 place-items-center text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 lg:grid"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[17px] w-[17px]" />
        ) : (
          <PanelLeftClose className="h-[17px] w-[17px]" />
        )}
      </button>

      <button
        onClick={onOpenDrawer}
        title="Open menu"
        aria-label="Open menu"
        className="grid h-8 w-8 place-items-center text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
      >
        <Menu className="h-[17px] w-[17px]" />
      </button>

      <div className="flex items-center gap-1.5 sm:hidden">
        <span className="text-[13px] font-black tracking-tight text-neutral-900">
          SHERA
        </span>
        <span className="bg-[#ff5a1f]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#ff5a1f]">
          Admin
        </span>
      </div>

      <nav className="hidden items-center gap-1.5 pl-1 text-[12px] sm:flex">
        <span className="font-medium text-neutral-500">Admin</span>
        <ChevronRight className="h-3 w-3 text-neutral-400" />
        <span className="font-semibold text-neutral-900">{currentPage}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="grid h-8 w-8 place-items-center border border-black/[0.08] bg-white text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        <Link
          href="/"
          className="hidden items-center gap-1 bg-[#ff5a1f] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-100 transition-colors hover:bg-[#ff5a12] sm:inline-flex"
        >
          <Store className="h-3.5 w-3.5 " />
          Store
          <ArrowUpRight className="h-3 w-3 opacity-70" />
        </Link>
      </div>
    </header>
  );
}

/* ---------------------------------- content ------------------------------- */

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceView, setDeviceView] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setChecking(false);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      try {
        const token = await u.getIdTokenResult(true);
        const admin = token.claims.admin === true;
        setIsAdmin(admin);
        if (!admin) router.replace("/");
      } catch {
        setIsAdmin(false);
        router.replace("/");
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [router, pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* ignored */
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const currentPage =
    NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ??
    "Dashboard";

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0b]">
        <div className="flex flex-col items-center gap-5">
          <div className="grid h-12 w-12 place-items-center bg-[#ff5a1f] shadow-[0_16px_40px_-8px_rgba(255,90,31,0.7)]">
            <span className="text-xl font-black leading-none text-white">
              S
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm font-medium text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff5a1f]" />
            Verifying admin access
          </div>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0b] px-6">
        <div className="w-full max-w-sm border border-white/[0.08] bg-white/[0.03] p-8 text-center backdrop-blur">
          <div className="mx-auto grid h-12 w-12 place-items-center bg-[rgba(255,90,31,0.12)] ring-1 ring-inset ring-[rgba(255,90,31,0.3)]">
            <ShieldAlert className="h-6 w-6 text-[#ff5a1f]" />
          </div>
          <h1 className="mt-5 text-lg font-black tracking-tight text-white">
            Access denied
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-300">
            You don&apos;t have admin privileges for this console.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#ff5a1f] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#e84912]"
          >
            Back to store <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const previewMaxWidth =
    deviceView === "desktop" ? undefined : deviceView === "tablet" ? 820 : 430;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f6f7]">
      <Toaster position="top-right" richColors closeButton />

      <aside
        className="relative hidden shrink-0 transition-[width] duration-300 ease-out lg:block"
        style={{ width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }}
      >
        <SidebarContent
          pathname={pathname}
          email={user.email ?? ""}
          collapsed={collapsed}
          onSignOut={handleSignOut}
        />
      </aside>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[260px] shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center text-[#a3a3a3] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <SidebarContent
            pathname={pathname}
            email={user.email ?? ""}
            collapsed={false}
            onSignOut={handleSignOut}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenDrawer={() => setDrawerOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          currentPage={currentPage}
          deviceView={deviceView}
          setDeviceView={setDeviceView}
        />

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f6f6f7]">
          <div
            className="mx-auto w-full transition-[max-width] duration-300 ease-out"
            style={{ maxWidth: previewMaxWidth ?? "100%" }}
          >
            <div
              className={
                deviceView === "desktop" ? "p-4 sm:p-5 lg:p-6" : "p-2 sm:p-3"
              }
            >
              <div
                className={
                  deviceView === "desktop"
                    ? ""
                    : "overflow-hidden border border-black/[0.08] bg-white p-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)]"
                }
              >
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#0a0a0b]">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5a1f]" />
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
