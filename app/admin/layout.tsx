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
import { useEffect, useState } from "react";
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

const SIDEBAR_W = 264;
const SIDEBAR_W_COLLAPSED = 76;

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
      <Toaster position="top-right" richColors closeButton />
      {/* brand */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-white/[0.08] transition-all duration-300 ${
          collapsed ? "justify-center px-3" : "gap-3 px-5"
        }`}
      >
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ff5a1f] shadow-lg shadow-[#ff5a1f]/20">
          <span className="text-[15px] font-black leading-none text-white">
            S
          </span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-[13px] font-black leading-none tracking-tight text-white">
              SHERA
            </div>
            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">
              Sports Wear
            </div>
          </div>
        )}
      </div>

      {/* nav - hidden scrollbar for clean look */}
      <nav
        className={`flex-1 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          collapsed ? "overflow-visible" : "overflow-y-auto"
        }`}
      >
        {NAV_GROUPS.map((group, idx) => (
          <div
            key={group.label}
            className={collapsed ? "px-2 pb-2" : "px-3 pb-1"}
          >
            {collapsed && idx > 0 && (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
            )}
            {!collapsed && (
              <div className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#737373]">
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
                    className={`group relative flex items-center rounded-lg text-[13px] transition-colors duration-150 ${
                      collapsed
                        ? "justify-center px-2.5 py-2.5"
                        : "gap-3 px-3 py-2"
                    } ${
                      active
                        ? "bg-[#ff5a1f]/15 font-semibold text-white"
                        : "font-medium text-[#a3a3a3] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#ff5a1f]" />
                    )}
                    <Icon
                      className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                        active
                          ? "text-[#ff5a1f]"
                          : "text-[#737373] group-hover:text-white"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-900 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
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

      {/* footer */}
      <div className="shrink-0 border-t border-white/[0.08] p-3">
        {collapsed ? (
          <div className="flex justify-center">
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg text-[#a3a3a3] transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff5a1f] to-[#c2410c] text-[11px] font-black text-white ring-1 ring-white/20">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-white">
                {email || "Administrator"}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
                Admin
              </div>
            </div>
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#a3a3a3] transition-colors hover:bg-white/10 hover:text-white"
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
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-3 sm:px-4 lg:px-5">
      {/* sidebar toggle — desktop */}
      <button
        onClick={onToggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-9 w-9 place-items-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 lg:grid"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        ) : (
          <PanelLeftClose className="h-[18px] w-[18px]" />
        )}
      </button>

      {/* menu — mobile */}
      <button
        onClick={onOpenDrawer}
        title="Open menu"
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {/* mobile brand */}
      <div className="flex items-center gap-2 sm:hidden">
        <span className="text-sm font-black tracking-tight text-neutral-900">
          SHERA
        </span>
        <span className="rounded-full bg-[#ff5a1f]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#ff5a1f]">
          Admin
        </span>
      </div>

      {/* breadcrumb — sm+ */}
      <nav className="hidden items-center gap-2 pl-1 text-sm sm:flex">
        <span className="font-medium text-neutral-500">Admin</span>
        <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
        <span className="font-semibold text-neutral-900">{currentPage}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* device preview segmented control */}
        <div className="hidden items-center gap-0.5 rounded-lg border border-black/[0.08] bg-neutral-100/70 p-0.5 sm:flex">
          {(
            [
              { id: "desktop", icon: Monitor },
              { id: "tablet", icon: Tablet },
              { id: "mobile", icon: Smartphone },
            ] as const
          ).map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setDeviceView(id)}
              title={`${id} preview`}
              aria-label={`${id} preview`}
              className={`grid h-7 w-7 place-items-center rounded-md transition-all duration-150 ${
                deviceView === id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* fullscreen */}
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="grid h-9 w-9 place-items-center rounded-lg border border-black/[0.08] bg-white text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        {/* store link */}
        <Link
          href="/"
          className="hidden items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#ff5a1f] sm:inline-flex"
        >
          <Store className="h-3.5 w-3.5" />
          Store
          <ArrowUpRight className="h-3 w-3 opacity-70" />
        </Link>
      </div>
    </header>
  );
}

/* ---------------------------------- layout -------------------------------- */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  /* auth */
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

  /* close drawer on route change */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* escape to close drawer */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* lock body scroll while drawer open */
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  /* track fullscreen state */
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
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

  /* -------------------------------- loading ------------------------------- */
  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0b]">
        <div className="flex flex-col items-center gap-6">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ff5a1f] shadow-[0_16px_40px_-8px_rgba(255,90,31,0.7)]">
            <span className="text-2xl font-black leading-none text-white">
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

  /* ----------------------------- access denied ---------------------------- */
  if (!user || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0b] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center backdrop-blur">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(255,90,31,0.12)] ring-1 ring-inset ring-[rgba(255,90,31,0.3)]">
            <ShieldAlert className="h-6 w-6 text-[#ff5a1f]" />
          </div>
          <h1 className="mt-6 text-xl font-black tracking-tight text-white">
            Access denied
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            You don&apos;t have admin privileges for this console.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5a1f] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#e84912]"
          >
            Back to store
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  /* --------------------------------- main --------------------------------- */
  const previewMaxWidth =
    deviceView === "desktop" ? undefined : deviceView === "tablet" ? 820 : 430;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f6f7]">
      {/* desktop sidebar */}
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

      {/* mobile drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          drawerOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[280px] shadow-2xl transition-transform duration-300 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-lg text-[#a3a3a3] transition-colors hover:bg-white/10 hover:text-white"
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

      {/* main column */}
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
                deviceView === "desktop" ? "p-4 sm:p-6 lg:p-8" : "p-3 sm:p-4"
              }
            >
              <div
                className={
                  deviceView === "desktop"
                    ? ""
                    : "overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)]"
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
