// app/login/page.tsx
"use client";

import { auth } from "@/lib/firebase/client";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
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
function getSafeNext(raw: string | null): string {
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\")
  ) {
    return raw;
  }
  return "/admin";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));

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

  // Enter in the email field moves to password. Enter in the password field
  // submits the form natively.
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setLoading(true);
    try {
      await applyPersistence();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace(next);
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
      await signInWithPopup(auth, provider);
      router.replace(next);
    } catch (err) {
      setError(mapAuthError((err as { code?: string })?.code));
      setSocialLoading(null);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      {/* ================================================================= */}
      {/* LEFT PANEL: Image & Branding (Desktop: 55% width / Mobile: Top 45vh) */}
      {/* ================================================================= */}
      <div className="relative h-[45vh] w-full shrink-0 overflow-hidden bg-[var(--brand-black)] lg:h-auto lg:w-[55%]">
        {/* Background Image (decorative) */}
        <Image
          src="https://i.pinimg.com/736x/ff/44/e3/ff44e37249879fb73472f51aa20f7853.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover object-top opacity-80"
        />

        {/* Dark Gradient Overlays for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-black)] via-[var(--brand-black)]/40 to-transparent lg:bg-gradient-to-r lg:from-[var(--brand-black)]/90 lg:via-[var(--brand-black)]/40 lg:to-transparent" />
        <div className="absolute inset-0 bg-[var(--brand-orange)]/10 mix-blend-overlay" />

        {/* Content Container */}
        <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-16 xl:p-20">
          {/* Logo */}
          <Link href="/" className="inline-flex w-fit flex-col items-start">
            <span className="font-heading text-3xl font-black uppercase leading-none tracking-tighter text-white">
              SHERA<span className="text-[var(--brand-orange)]">.</span>
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
              Sports Wear
            </span>
          </Link>

          {/* Hero Text */}
          <div className="mb-10 mt-auto hidden sm:block lg:mb-16">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-orange)]">
              Built for
            </p>
            <h1 className="font-heading text-5xl font-black uppercase leading-[0.9] tracking-tighter text-white lg:text-6xl xl:text-7xl">
              Discipline <br />
              <span className="text-[var(--brand-orange)]">Everyday</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-white/70">
              Premium sports wear for a stronger, healthier and more confident
              you.
            </p>
          </div>

          {/* Features (Desktop only) */}
          <div className="hidden items-center gap-8 border-t border-white/20 pt-6 lg:flex">
            <div className="flex items-center gap-3">
              <Truck
                className="h-5 w-5 text-[var(--brand-orange)]"
                aria-hidden="true"
              />
              <div className="text-xs font-bold leading-tight text-white">
                Fast
                <br />
                Delivery
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck
                className="h-5 w-5 text-[var(--brand-orange)]"
                aria-hidden="true"
              />
              <div className="text-xs font-bold leading-tight text-white">
                Premium
                <br />
                Quality
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Headphones
                className="h-5 w-5 text-[var(--brand-orange)]"
                aria-hidden="true"
              />
              <div className="text-xs font-bold leading-tight text-white">
                Dedicated
                <br />
                Support
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIGHT PANEL: Login Form (Desktop: 45% width / Mobile: Bottom Card) */}
      {/* ================================================================= */}
      <div className="relative z-20 -mt-6 flex flex-1 flex-col justify-center rounded-t-3xl bg-white px-6 py-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:px-12 lg:mt-0 lg:rounded-none lg:px-16 lg:shadow-none xl:px-24">
        <div className="mx-auto w-full max-w-[400px]">
          {/* Top Nav (Desktop only; mobile has the footer link) */}
          <div className="mb-16 hidden items-center justify-end lg:flex">
            <p className="text-sm font-medium text-[var(--muted)]">
              New here?{" "}
              <Link
                href="/register"
                className="font-bold text-[var(--brand-orange)] transition-colors hover:text-[var(--brand-orange-hover)]"
              >
                Create an account
              </Link>
            </p>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="font-heading text-3xl font-black tracking-tight text-[var(--brand-black)] sm:text-4xl">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm font-medium text-[var(--muted)]">
              Login to your Shera Sports Wear account
            </p>
          </div>

          {/* IP Warning (Subtle) */}
          {showIpWarning && (
            <div className="mb-6 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] font-medium text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Browsers block password saving on raw IPs. Use{" "}
                <code className="font-bold">localhost</code> for autofill.
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div className="auth-field">
              <Mail
                className="h-5 w-5 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
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
              />
            </div>

            {/* Password */}
            <div className="auth-field">
              <Lock
                className="h-5 w-5 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
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
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="rounded text-[var(--muted)] transition-colors hover:text-[var(--brand-black)]"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between pb-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-[var(--brand-orange)]"
                />
                <span className="text-xs font-semibold text-[var(--brand-black)]">
                  Remember me
                </span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-[var(--brand-orange)] transition-colors hover:text-[var(--brand-orange-hover)]"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-600"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-4 py-4 text-sm font-bold text-white transition-all hover:bg-[var(--brand-orange-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Logging in</span>
                </>
              ) : (
                <>
                  Login
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
              <span className="bg-white px-3 text-[var(--muted)]">Or</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocial("google")}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3.5 text-sm font-semibold text-[var(--brand-black)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {socialLoading === "google" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
            <button
              type="button"
              onClick={() => handleSocial("apple")}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3.5 text-sm font-semibold text-[var(--brand-black)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {socialLoading === "apple" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M16.365 21.44c-.96.67-1.98.62-2.936.07-1.05-.6-2.037-.6-3.097 0-.94.55-1.96.6-2.92.07-2.22-1.22-3.897-3.243-4.717-5.756-.87-2.64-.26-5.528 1.613-7.318 1.817-1.74 4.436-1.885 6.08-.406.686.617 1.294.617 1.98 0 1.613-1.457 4.21-1.34 6.055.37 1.163.108 2.36.642 3.247 1.55-2.428 1.34-2.023 4.84.59 5.96-.57 1.78-1.45 3.37-2.61 4.59l-.003.003c-.567.6-1.16 1.18-1.886 1.848zM12.057 7.352c1.08-1.298.893-3.316-.303-4.495-1.227-1.208-3.253-1.38-4.41-.258-.993 1.13-.9 3.204.288 4.4 1.206 1.214 3.31 1.38 4.425.353z" />
                </svg>
              )}
              Continue with Apple
            </button>
          </div>

          {/* Mobile Footer Nav */}
          <div className="mt-8 text-center lg:hidden">
            <p className="text-sm font-medium text-[var(--muted)]">
              New here?{" "}
              <Link
                href="/register"
                className="font-bold text-[var(--brand-orange)]"
              >
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
            className="h-8 w-8 animate-spin text-[var(--brand-orange)]"
            aria-label="Loading"
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
