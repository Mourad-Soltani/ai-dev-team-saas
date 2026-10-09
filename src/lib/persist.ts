import { getSupabase } from "./supabase";

export async function saveRun(opts: {
  userId?: string | null;
  goal: string;
  liveModel?: boolean;
  liveProvider?: string;
  summary: Record<string, unknown>;
  outcomes: {
    stepId: string;
    description: string;
    gateDecision: string;
    riskLevel: string;
    riskScore: number;
    confidence: number;
    executed: boolean;
    note: string;
    agents: unknown[];
  }[];
}): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: run, error } = await sb
    .from("runs")
    .insert({
      user_id: opts.userId || null,
      goal: opts.goal,
      live_model: !!opts.liveModel,
      live_provider: opts.liveProvider || null,
      summary: opts.summary,
    })
    .select("id")
    .single();

  if (error || !run) {
    console.error("[persist] run", error);
    return null;
  }

  const rows = opts.outcomes.map((o) => ({
    run_id: run.id,
    step_id: o.stepId,
    description: o.description,
    gate_decision: o.gateDecision,
    risk_level: o.riskLevel,
    risk_score: o.riskScore,
    confidence: o.confidence,
    executed: o.executed,
    note: o.note,
    agents: o.agents,
  }));

  const { error: stepErr } = await sb.from("steps").insert(rows);
  if (stepErr) console.error("[persist] steps", stepErr);

  return run.id as string;
}

export async function saveDecision(opts: {
  runId?: string | null;
  stepId: string;
  decision: "approved" | "rejected";
  description?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  let q = sb
    .from("steps")
    .update({
      human_decision: opts.decision,
      decided_at: new Date().toISOString(),
      executed: opts.decision === "approved",
      note:
        opts.decision === "approved"
          ? "Human approved — step marked executed"
          : "Human rejected — step blocked",
    })
    .eq("step_id", opts.stepId)
    .eq("gate_decision", "needs_human")
    .is("human_decision", null);

  if (opts.runId) q = q.eq("run_id", opts.runId);

  const { error } = await q;
  if (error) console.error("[persist] decision", error);
}

export async function listPendingEscalations(limit = 50): Promise<
  {
    id: string;
    run_id: string;
    step_id: string;
    description: string;
    risk_level: string;
    confidence: number;
    note: string;
    created_at: string;
    goal?: string;
  }[]
> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("steps")
    .select("id, run_id, step_id, description, risk_level, confidence, note, created_at, runs(goal)")
    .eq("gate_decision", "needs_human")
    .is("human_decision", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[persist] pending", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const runs = row.runs as { goal?: string } | { goal?: string }[] | null;
    const goal = Array.isArray(runs) ? runs[0]?.goal : runs?.goal;
    return {
      id: String(row.id),
      run_id: String(row.run_id),
      step_id: String(row.step_id),
      description: String(row.description),
      risk_level: String(row.risk_level),
      confidence: Number(row.confidence),
      note: String(row.note || ""),
      created_at: String(row.created_at),
      goal,
    };
  });
}
