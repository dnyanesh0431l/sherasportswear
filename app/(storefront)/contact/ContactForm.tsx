"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      orderId: String(form.get("orderId") ?? "").trim(),
      topic: String(form.get("topic") ?? "").trim(),
      message: String(form.get("message") ?? "").trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus("error");
      setError("Please fill in your name, email and message.");
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.text()) || "Send failed");
      setStatus("success");
      e.currentTarget.reset();
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please email us directly.",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
        ✅ Thanks! Your message is on its way. We&rsquo;ll reply within 24
        hours.
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 block text-xs font-semibold text-green-900 underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" required />
        <Field label="Email" name="email" type="email" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Order ID (optional)"
          name="orderId"
          placeholder="e.g. ORD-10482"
        />
        <div>
          <label
            htmlFor="topic"
            className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500"
          >
            Topic
          </label>
          <select
            id="topic"
            name="topic"
            defaultValue="order"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/30"
          >
            <option value="order">Order / delivery</option>
            <option value="sizing">Sizing & fit</option>
            <option value="returns">Returns / refund</option>
            <option value="bulk">Bulk / team order</option>
            <option value="other">Something else</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="Tell us what's up…"
          className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/30"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center justify-center rounded-full bg-[#FF6B00] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#e65f00] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/30"
      />
    </div>
  );
}