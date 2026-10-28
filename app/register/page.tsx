// app/register/page.tsx
"use client";

import { auth, db } from "@/lib/firebase/client";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";

/** Returns null for errors that should be silent (user closed the popup). */
function mapAuthError(code?: string): string | null {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
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
  return "/account";
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const busy = loading || socialLoading !== null;

  const applyPersistence = () => setPersistence(auth, browserLocalPersistence);

  // Helper to create the Firestore user document
  const createFirestoreUser = async (
    uid: string,
    displayName: string,
    userEmail: string,
    photoURL: string | null = null,
  ) => {
    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        displayName,
        email: userEmail,
        phone: null,
        photoURL,
        marketingOptIn: false,
        defaultAddressId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to create user profile in Firestore:", err);
      // Non-fatal, user is still authenticated
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await applyPersistence();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      // Update Firebase Auth Profile
      await updateProfile(userCredential.user, { displayName: name.trim() });

      // Create Firestore Document
      await createFirestoreUser(
        userCredential.user.uid,
        name.trim(),
        email.trim(),
      );

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

      const result = await signInWithPopup(auth, provider);

      // Ensure user document exists (good for first-time social logins)
      if (result.user) {
        await createFirestoreUser(
          result.user.uid,
          result.user.displayName || "Athlete",
          result.user.email || "",
          result.user.photoURL || null,
        );
      }

      router.replace(next);
    } catch (err) {
      setError(mapAuthError((err as { code?: string })?.code));
      setSocialLoading(null);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      {/* ================================================================= */}
      {/* LEFT PANEL: Image & Branding */}
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
              Start your journey
            </p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white lg:text-5xl xl:text-6xl">
              Built to <br />
              <span className="text-[#ff5a1f]">Move</span>
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-white/70">
              Join the community. Get early access to drops, exclusive offers,
              and performance gear.
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
      {/* RIGHT PANEL: Register Form */}
      {/* ================================================================= */}
      <div className="relative z-20 -mt-4 flex flex-1 flex-col justify-center rounded-t-2xl bg-white px-6 py-8 sm:px-10 lg:mt-0 lg:rounded-none lg:px-16 lg:py-12 xl:px-24">
        <div className="mx-auto w-full max-w-[400px]">
          {/* Top Nav */}
          <div className="mb-6 hidden items-center justify-end lg:flex">
            <p className="text-xs font-medium text-neutral-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-[#ff5a1f] transition-colors hover:text-[#e84912]"
              >
                Log in
              </Link>
            </p>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-neutral-950 sm:text-3xl">
              Create Account
            </h2>
            <p className="mt-1.5 text-xs font-medium text-neutral-500">
              Join Shera Sports Wear and gear up.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {/* Full Name Input */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                name="name"
                autoComplete="name"
                aria-label="Full name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="Full name"
                className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-4 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
              />
            </div>

            {/* Email Input */}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    passwordRef.current?.focus();
                  }
                }}
                disabled={busy}
                placeholder="Email address"
                className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-4 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                aria-label="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmPasswordRef.current?.focus();
                  }
                }}
                disabled={busy}
                placeholder="Password (min. 6 characters)"
                className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-12 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-neutral-500 transition-colors hover:text-neutral-950"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Confirm Password Input */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                ref={confirmPasswordRef}
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                aria-label="Confirm password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={busy}
                placeholder="Confirm password"
                className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-12 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-neutral-500 transition-colors hover:text-neutral-950"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                busy || !name || !email || !password || !confirmPassword
              }
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded bg-neutral-950 px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
              <span className="bg-white px-3 text-neutral-400">
                Or sign up with
              </span>
            </div>
          </div>

          {/* Social Login */}
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

          {/* Mobile Footer Nav */}
          <div className="mt-6 text-center lg:hidden">
            <p className="text-xs font-medium text-neutral-500">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-[#ff5a1f]">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
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
      <RegisterForm />
    </Suspense>
  );
}
