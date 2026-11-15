// app/forgot-password/page.tsx
"use client";

import { auth } from "@/lib/firebase/client";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "sent";

/** Maps Firebase error codes to user-friendly messages. */
function mapResetError(code?: string): string | null {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
      return null; // silent — don't leak account existence
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const RESEND_COOLDOWN = 45; // seconds

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = status === "sending";

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || cooldown > 0) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      emailRef.current?.focus();
      return;
    }

    setError(null);
    setStatus("sending");

    try {
      await sendPasswordResetEmail(auth, trimmed);
      setStatus("sent");
      startCooldown();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(mapResetError(code));
      setStatus("idle");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    setError(null);
    setStatus("sending");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setStatus("sent");
      startCooldown();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(mapResetError(code));
      setStatus("sent");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      {/* ============================= LEFT PANEL ============================= */}
      <div className="relative h-[35vh] w-full shrink-0 overflow-hidden bg-neutral-950 lg:h-auto lg:w-[55%]">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
        <div className="absolute inset-0 bg-[#ff5a1f]/10 mix-blend-overlay" />
        {/* subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

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
              Account Recovery
            </p>
            <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white lg:text-5xl xl:text-6xl">
              Reset <br />
              <span className="text-[#ff5a1f]">Password</span>
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-white/70">
              No worries — it happens. We&apos;ll send a secure link to your
              email so you can get back in.
            </p>
          </div>

          <div className="hidden items-center gap-2 border-t border-white/20 pt-4 lg:flex">
            <ShieldCheck className="h-4 w-4 text-[#ff5a1f]" />
            <div className="text-[11px] font-bold leading-tight text-white">
              Secure password reset link
            </div>
          </div>
        </div>
      </div>

      {/* ============================= RIGHT PANEL ============================= */}
      <div className="relative z-20 -mt-4 flex flex-1 flex-col justify-center rounded-t-2xl bg-white px-6 py-8 sm:px-10 lg:mt-0 lg:rounded-none lg:px-16 lg:py-12 xl:px-24">
        <div className="mx-auto w-full max-w-[400px]">
          <Link
            href="/login"
            className="mb-8 inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 transition-colors hover:text-neutral-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>

          {status === "sent" ? (
            /* ---------- SUCCESS STATE ---------- */
            <div className="text-center">
              <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-green-50">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight text-neutral-950 sm:text-3xl">
                Check your inbox
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-neutral-500">
                If an account exists for{" "}
                <span className="font-bold text-neutral-950">{email.trim()}</span>
                , we&apos;ve sent a password reset link. It may take a minute
                to arrive — check your spam folder too.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-left text-xs font-medium text-red-600"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || busy}
                  className="flex w-full items-center justify-center gap-2 rounded bg-neutral-950 px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Resending...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>Resend in {cooldown}s</span>
                  ) : (
                    <span>Resend email</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setError(null);
                  }}
                  className="w-full rounded px-4 py-2.5 text-xs font-bold text-neutral-500 transition-colors hover:text-neutral-950"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            /* ---------- FORM STATE ---------- */
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-black uppercase tracking-tight text-neutral-950 sm:text-3xl">
                  Forgot Password?
                </h2>
                <p className="mt-1.5 text-xs font-medium text-neutral-500">
                  Enter the email linked to your account and we&apos;ll send a
                  reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input
                    ref={emailRef}
                    type="email"
                    name="email"
                    autoComplete="email"
                    aria-label="Email address"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={busy}
                    placeholder="Email address"
                    className="w-full rounded bg-neutral-100 py-3.5 pl-11 pr-4 text-sm font-medium text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus:bg-neutral-200"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded bg-neutral-950 px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs font-medium text-neutral-500">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[#ff5a1f] transition-colors hover:text-[#e84912]"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}

          {/* trust note */}
          <div className="mt-8 flex items-start gap-2 border-t border-neutral-200 pt-4">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <p className="text-[10px] font-medium leading-relaxed text-neutral-400">
              For your security, we never reveal whether an email is registered
              with us. The reset link expires after 1 hour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}