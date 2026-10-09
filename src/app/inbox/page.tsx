"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Pending {
  id: string;
  run_id: string;
  step_id: string;
  description: string;
  risk_level: string;
  confidence: number;
  note: string;
  created_at: string;
  goal?: string;
}

export default function InboxPage() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [db, setDb] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inbox")
      .then((r) => r.json())
      .then((data) => {
        setPending(data.pending || []);
        setDb(!!data.db);
        setMessage(data.message || null);
      })
      .catch(() => setMessage("Failed to load inbox"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to app
        </Link>
      </div>

      <header className="mb-8">
        <p className="text-sm font-medium text-sky-400 mb-2">Team inbox</p>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Pending escalations
        </h1>
        <p className="text-slate-400 text-sm">
          Steps that need human sign-off across recent runs. Requires Supabase
          for cross-session persistence.
        </p>
      </header>

      {loading && <p className="text-slate-500 text-sm">Loading…</p>}

      {message && (
        <div className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-amber-200 text-sm">
          {message}
        </div>
      )}

      {db && pending.length === 0 && !loading && (
        <p className="text-slate-500 text-sm">No pending escalations.</p>
      )}

      <ul className="space-y-4">
        {pending.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
          >
            <div className="flex flex-wrap justify-between gap-2 mb-1">
              <p className="font-medium">{p.description}</p>
              <span className="text-xs rounded-md bg-amber-500/15 text-amber-400 px-2 py-0.5">
                {p.risk_level} risk
              </span>
            </div>
            {p.goal && (
              <p className="text-sm text-slate-400 mb-1">Goal: {p.goal}</p>
            )}
            <p className="text-xs text-slate-500">
              {new Date(p.created_at).toLocaleString()} · confidence{" "}
              {(p.confidence * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-slate-400 mt-2">{p.note}</p>
            <Link
              href="/"
              className="inline-block mt-3 text-xs text-sky-400 hover:text-sky-300"
            >
              Open app to approve/reject →
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
