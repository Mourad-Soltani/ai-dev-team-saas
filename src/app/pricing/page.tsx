"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(planId: string) {
    if (planId === "free") return;
    setLoading(planId);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to app
        </Link>
      </div>

      <header className="text-center mb-12">
        <p className="text-sm font-medium text-sky-400 mb-2">Pricing</p>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Simple plans for AI-assisted delivery
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Start free. Upgrade when you need unlimited runs, longer history, and
          team features.
        </p>
      </header>

      {error && (
        <div className="mb-8 rounded-lg border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-amber-200 text-sm max-w-2xl mx-auto">
          <p className="font-medium mb-1">Checkout not ready yet</p>
          <p className="text-amber-200/80">{error}</p>
          <p className="mt-2 text-xs text-amber-200/60">
            Add Stripe keys in Vercel → Settings → Environment Variables, then
            redeploy. See README for the exact variable names.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-6 flex flex-col ${
              plan.highlighted
                ? "border-sky-500/60 bg-sky-950/20 shadow-lg shadow-sky-900/20"
                : "border-slate-800 bg-slate-900/50"
            }`}
          >
            {plan.highlighted && (
              <span className="text-xs font-semibold text-sky-400 mb-2">
                Most popular
              </span>
            )}
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-2 mb-4">
              <span className="text-3xl font-bold">${plan.priceMonthly}</span>
              <span className="text-slate-400 text-sm">/mo</span>
            </p>
            <ul className="space-y-2 text-sm text-slate-300 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={plan.id === "free" || loading === plan.id}
              onClick={() => startCheckout(plan.id)}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                plan.highlighted
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "bg-slate-800 text-slate-100 hover:bg-slate-700"
              }`}
            >
              {loading === plan.id ? "Redirecting…" : plan.cta}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-slate-500">
        Cancel anytime. Stripe handles tax and invoices. Questions? Open an
        issue on the GitHub repo.
      </p>
    </main>
  );
}
