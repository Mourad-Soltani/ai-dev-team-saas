"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlan, type PlanId } from "@/lib/plans";
import { canRun, getUsage, incrementUsage } from "@/lib/usage";
import { loadHistory, saveRun, type HistoryEntry } from "@/lib/history";

interface AgentOpinion {
  agent: string;
  verdict: string;
  confidence: number;
  rationale: string;
}

type HumanDecision = "approved" | "rejected" | null;

interface StepOutcome {
  stepId: string;
  description: string;
  gateDecision: string;
  confidence: number;
  riskLevel: string;
  riskScore: number;
  executed: boolean;
  note: string;
  agents: AgentOpinion[];
  humanDecision?: HumanDecision;
  decidedAt?: string;
}

interface RunResult {
  goal: string;
  outcomes: StepOutcome[];
  summary: { total: number; autoExecuted: number; escalated: number };
}

const DEFAULT_STEPS = [
  "Write unit tests for the new parser module",
  "Add a config flag for the new feature",
  "Deploy the updated auth service to production",
];

export default function Home() {
  const [goal, setGoal] = useState("Ship the parser feature");
  const [stepsText, setStepsText] = useState(DEFAULT_STEPS.join("\n"));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [planId, setPlanId] = useState<PlanId>("free");
  const [usage, setUsage] = useState({ date: "", runs: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const plan = getPlan(planId);

  useEffect(() => {
    setUsage(getUsage());
    setHistory(loadHistory());
    // Restore plan from localStorage (set after successful checkout)
    const stored = localStorage.getItem("ai-dev-team-plan");
    if (stored === "pro" || stored === "team") setPlanId(stored);

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      const p = params.get("plan");
      if (p === "pro" || p === "team") {
        localStorage.setItem("ai-dev-team-plan", p);
        setPlanId(p);
        setBanner(`Welcome to ${p === "pro" ? "Pro" : "Team"}! Unlimited runs unlocked.`);
      }
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canRun(plan.runsPerDay)) {
      setError(
        `Free plan limit reached (${plan.runsPerDay} runs/day). Upgrade to Pro for unlimited runs.`
      );
      return;
    }

    setLoading(true);
    setResult(null);

    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((description, i) => ({ id: `s${i + 1}`, description }));

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      data.outcomes = data.outcomes.map((o: StepOutcome) => ({
        ...o,
        humanDecision: null,
      }));
      setResult(data);

      const nextUsage = incrementUsage();
      setUsage(nextUsage);

      const entry: HistoryEntry = {
        id: `run_${Date.now()}`,
        goal: data.goal,
        createdAt: new Date().toISOString(),
        summary: {
          total: data.outcomes.length,
          executed: data.outcomes.filter((o: StepOutcome) => o.executed).length,
          escalated: data.outcomes.filter((o: StepOutcome) => !o.executed).length,
        },
        outcomes: data.outcomes.map((o: StepOutcome) => ({
          stepId: o.stepId,
          description: o.description,
          gateDecision: o.gateDecision,
          riskLevel: o.riskLevel,
          executed: o.executed,
          humanDecision: null,
        })),
      };
      saveRun(entry);
      setHistory(loadHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(
    stepId: string,
    decision: "approved" | "rejected"
  ) {
    if (!result) return;
    setDeciding(stepId);

    const updated: RunResult = {
      ...result,
      outcomes: result.outcomes.map((o) =>
        o.stepId === stepId
          ? {
              ...o,
              humanDecision: decision,
              decidedAt: new Date().toISOString(),
              executed: decision === "approved",
              note:
                decision === "approved"
                  ? "Human approved — step marked executed"
                  : "Human rejected — step blocked",
            }
          : o
      ),
      summary: result.summary,
    };
    updated.summary = {
      total: updated.outcomes.length,
      autoExecuted: updated.outcomes.filter((o) => o.executed).length,
      escalated: updated.outcomes.filter(
        (o) => !o.executed && o.humanDecision !== "rejected"
      ).length,
    };
    setResult(updated);

    try {
      await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: result.goal,
          stepId,
          decision,
          description: result.outcomes.find((o) => o.stepId === stepId)
            ?.description,
        }),
      });
    } catch {
      /* non-blocking */
    } finally {
      setDeciding(null);
    }
  }

  const pendingEscalations =
    result?.outcomes.filter(
      (o) =>
        !o.executed && o.gateDecision === "needs_human" && !o.humanDecision
    ).length ?? 0;

  const runsLeft =
    plan.runsPerDay < 0
      ? "Unlimited"
      : Math.max(0, plan.runsPerDay - usage.runs);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm font-medium text-sky-400">AI Dev Team SaaS</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">
              {plan.name}
              {plan.runsPerDay >= 0 && (
                <span className="text-slate-500">
                  {" "}
                  · {runsLeft} runs left today
                </span>
              )}
            </span>
            <Link
              href="/pricing"
              className="rounded-full bg-sky-500/15 text-sky-400 px-2.5 py-1 font-medium hover:bg-sky-500/25 transition"
            >
              Upgrade
            </Link>
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Multi-agent orchestration with risk gates
        </h1>
        <p className="text-slate-400 leading-relaxed">
          Submit a development goal. Six specialized agents reach consensus,
          score risk, and either auto-execute safe steps or escalate dangerous
          ones for your sign-off.
        </p>
      </header>

      {banner && (
        <div className="mb-6 rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-4 py-3 text-emerald-300 text-sm">
          {banner}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 mb-8 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Goal
          </label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="e.g. Ship the invoice PDF export"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Steps (one per line)
          </label>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition"
          >
            {loading ? "Running agents…" : "Run AI Dev Team"}
          </button>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {showHistory ? "Hide history" : `History (${history.length})`}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-red-300 text-sm mb-6">
          {error}{" "}
          {error.includes("Upgrade") && (
            <Link href="/pricing" className="underline text-sky-400">
              View plans
            </Link>
          )}
        </div>
      )}

      {showHistory && history.length > 0 && (
        <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold mb-3 text-slate-300">
            Recent runs
          </h3>
          <ul className="space-y-2 text-sm">
            {history.slice(0, 10).map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap justify-between gap-2 text-slate-400 border-b border-slate-800/80 pb-2"
              >
                <span className="text-slate-200">{h.goal}</span>
                <span className="text-xs">
                  {h.summary.executed}/{h.summary.total} executed ·{" "}
                  {new Date(h.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              {result.summary.total} steps
            </span>
            <span className="rounded-full bg-emerald-950 text-emerald-300 px-3 py-1">
              {result.outcomes.filter((o) => o.executed).length} executed
            </span>
            {pendingEscalations > 0 && (
              <span className="rounded-full bg-amber-950 text-amber-300 px-3 py-1">
                {pendingEscalations} awaiting your decision
              </span>
            )}
            {result.outcomes.some((o) => o.humanDecision === "rejected") && (
              <span className="rounded-full bg-red-950 text-red-300 px-3 py-1">
                {
                  result.outcomes.filter((o) => o.humanDecision === "rejected")
                    .length
                }{" "}
                rejected
              </span>
            )}
          </div>

          <h2 className="text-lg font-semibold">
            Goal:{" "}
            <span className="text-slate-300 font-normal">{result.goal}</span>
          </h2>

          <ul className="space-y-4">
            {result.outcomes.map((o) => (
              <li
                key={o.stepId}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <p className="font-medium">{o.description}</p>
                  <StatusBadge outcome={o} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
                  <span>
                    Risk: <RiskBadge level={o.riskLevel} score={o.riskScore} />
                  </span>
                  <span>Confidence: {(o.confidence * 100).toFixed(0)}%</span>
                </div>
                <p className="text-sm text-slate-400 mb-3">{o.note}</p>

                {!o.executed &&
                  o.gateDecision === "needs_human" &&
                  !o.humanDecision && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        disabled={deciding === o.stepId}
                        onClick={() => handleDecision(o.stepId, "approved")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                      >
                        {deciding === o.stepId ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={deciding === o.stepId}
                        onClick={() => handleDecision(o.stepId, "rejected")}
                        className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition"
                      >
                        {deciding === o.stepId ? "…" : "Reject"}
                      </button>
                    </div>
                  )}

                {o.humanDecision && o.decidedAt && (
                  <p className="text-xs text-slate-500 mb-2">
                    Decided {new Date(o.decidedAt).toLocaleString()}
                  </p>
                )}

                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-300">
                    Agent opinions ({o.agents.length})
                  </summary>
                  <ul className="mt-2 space-y-1 pl-2 border-l border-slate-800">
                    {o.agents.map((a) => (
                      <li key={a.agent}>
                        <span className="text-slate-400">{a.agent}</span>:{" "}
                        {a.verdict} ({(a.confidence * 100).toFixed(0)}%)
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
        <p>
          High-risk steps always need human sign-off. Safe steps auto-execute.
        </p>
        <Link href="/pricing" className="text-sky-500 hover:text-sky-400">
          Pricing
        </Link>
      </footer>
    </main>
  );
}

function StatusBadge({ outcome }: { outcome: StepOutcome }) {
  if (
    outcome.humanDecision === "approved" ||
    (outcome.executed &&
      !outcome.humanDecision &&
      outcome.gateDecision === "auto_approve")
  ) {
    return (
      <span className="shrink-0 rounded-md bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-xs font-medium">
        {outcome.humanDecision === "approved"
          ? "HUMAN APPROVED"
          : "AUTO-EXECUTED"}
      </span>
    );
  }
  if (outcome.humanDecision === "rejected") {
    return (
      <span className="shrink-0 rounded-md bg-red-500/15 text-red-400 px-2 py-0.5 text-xs font-medium">
        REJECTED
      </span>
    );
  }
  if (outcome.gateDecision === "blocked") {
    return (
      <span className="shrink-0 rounded-md bg-red-500/15 text-red-400 px-2 py-0.5 text-xs font-medium">
        BLOCKED
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-md bg-amber-500/15 text-amber-400 px-2 py-0.5 text-xs font-medium">
      AWAITING YOUR DECISION
    </span>
  );
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  const color =
    level === "high"
      ? "text-red-400"
      : level === "medium"
        ? "text-amber-400"
        : "text-emerald-400";
  return (
    <span className={color}>
      {level} ({score.toFixed(2)})
    </span>
  );
}
