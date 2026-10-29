// app/login/page.tsx
"use client";

import { auth, db } from "@/lib/firebase/client";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Headphones,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** Returns null for errors that should be silent (user closed the popup). */
function mapAuthError(code?: string): string | null {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Only allow same-site relative paths to prevent open redirects. */
function getSafeNext(raw: string | null): string | null {
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\")
  ) {
    return raw;
  }
  return null;
}

/** Read `isAdmin` from users/{uid}. Falls back to false on any error. */
async function readIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    return snap.data()?.isAdmin === true;
  } catch (err) {
    console.error("[login] failed to read users/", uid, err);
    return false;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?next=/safe/path overrides the auto-decision.
  const explicitNext = getSafeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [showIpWarning, setShowIpWarning] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  const busy = loading || socialLoading !== null;

  useEffect(() => {
    if (
      window.location.protocol === "http:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setShowIpWarning(true);
    }
  }, []);

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  const applyPersistence = () =>
    setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence,
    );

  /**
   * After any successful sign-in:
   *   1. ?next= present        → go there
   *   2. users/{uid}.isAdmin   → /admin
   *   3. otherwise             → /
   */
  const routeAfterLogin = async (user: User) => {
    if (explicitNext) {
      router.replace(explicitNext);
      return;
    }
    const isAdmin = await readIsAdmin(user.uid);
    router.replace(isAdmin ? "/admin" : "/");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setLoading(true);
    try {
      await applyPersistence();
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await routeAfterLogin(cred.user);
    } catch (err) {
      setError(mapAuthError((err as { code?: string })?.code));
      setLoading(false);
    }
  };

  const handleSocial = async (kind: "google" | "apple") => {
    if (busy) return;
    setError(null);
    setSocialLoading(kind);
    try {
      await applyPersistence();
      const provider =
        kind === "google"
          ? new GoogleAuthProvider()
          : new OAuthProvider("apple.com");
      const cred = await signInWithPopup(auth, provider);
      await routeAfterLogin(cred.user);
    } catch (err) {
      setError(mapAuthError((err as { code?: string })?.code));
      setSocialLoading(null);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      {/* ================================================================= */}
      {/* LEFT PANEL */}
      {/* ================================================================= */}
      <div className="relative h-[35vh] w-full shrink-0 overflow-hidden bg-neutral-950 lg:h-auto lg:w-[55%]">
        <Image
          src="https://i.pinimg.com/736x/ff/44/e3/ff44e37249879fb73472f51aa20f7853.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover object-top opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent lg:bg-gradient-to-r lg:from-neutral-950/90 lg:via-neutral-950/40 lg:to-transparent" />
        <div className="absolute inset-0 bg-[#ff5a1f]/10 mix-blend-overlay" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-12 xl:p-16">
          <Link href="/" className="inline-flex w-fit flex-col items-start">
            <span className="font-display text-3xl font-black uppercase leading-none tracking-tighter text-white">
              SHERA<span className="text-[#ff5a1f]">.</span>
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
              Sports Wear
            </span>
          </Link>

          <div className="mb-8 mt-auto hidden sm:block lg:mb-12">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff5a1f]">
              Built for
            </p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white lg:text-5xl xl:text-6xl">
              Discipline <br />
              <span className="text-[#ff5a1f]">Everyday</span>
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-white/70">
              Premium sports wear for a stronger, healthier and more confident
              you.
            </p>
          </div>

          <div className="hidden items-center gap-6 border-t border-white/20 pt-4 lg:flex">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#ff5a1f]" />
              <div className="text-[11px] font-bold leading-tight text-white">
                Fast Delivery
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#ff5a1f]" />
              <div className="text-[11px] font-bold leading-tight text-white">
                Premium Quality
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-[#ff5a1f]" />
              <div className="text-[11px] font-bold leading-tight text-white">
                Support
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIGHT PANEL */}
      {/* ================================================================= */}
      <div className="relative z-20 -mt-4 flex flex-1 flex-col justify-center rounded-t-2xl bg-white px-6 py-8 sm:px-10 lg:mt-0 lg:rounded-none lg:px-16 lg:py-12 xl:px-24">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 hidden items-center justify-end lg:flex">
            <p className="text-xs font-medium text-neutral-500">
              New here?{" "}
              <Link
                href="/register"
                className="font-bold text-[#ff5a1f] transition-colors hover:text-[#e84912]"
              >
                Create an account
              </Link>
            </p>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-neutral-950 sm:text-3xl">
              Welcome Back
            </h2>
            <p className="mt-1.5 text-xs font-medium text-neutral-500">
              Login to your Shera Sports Wear account
            </p>
          </div>

          {showIpWarning && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[10px] font-medium text-amber-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Browsers block password saving on raw IPs. Use{" "}
                <code className="font-bold">localhost</code> for autofill.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                aria-label="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                disabled={busy}
                placeholder="Email address"
                className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-4 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                aria-label="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="Password"
                className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-12 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-neutral-500 transition-colors hover:text-neutral-950"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pb-1 pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-neutral-300 accent-[#ff5a1f]"
                />
                <span className="text-xs font-bold text-neutral-700">
                  Remember me
                </span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-[#ff5a1f] transition-colors hover:text-[#e84912]"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded bg-neutral-950 px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  Login
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
              <span className="bg-white px-3 text-neutral-400">
                Or continue with
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleSocial("google")}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded bg-neutral-100 px-4 py-3 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {socialLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </button>
          </div>

          <div className="mt-6 text-center lg:hidden">
            <p className="text-xs font-medium text-neutral-500">
              New here?{" "}
              <Link href="/register" className="font-bold text-[#ff5a1f]">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-white">
          <Loader2
            className="h-8 w-8 animate-spin text-[#ff5a1f]"
            aria-label="Loading"
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
