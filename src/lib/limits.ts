import { getSupabase } from "./supabase";
import { getPlan, type PlanId } from "./plans";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Server-side free-tier enforcement when Supabase is configured.
 * userKey = clerk user id, or "anon:" + hash of IP-ish key from client.
 */
export async function checkAndIncrementUsage(
  userKey: string,
  planId: PlanId = "free"
): Promise<{ allowed: boolean; runs: number; limit: number; error?: string }> {
  const plan = getPlan(planId);
  const limit = plan.runsPerDay;

  if (limit < 0) {
    return { allowed: true, runs: 0, limit: -1 };
  }

  const sb = getSupabase();
  if (!sb) {
    // No DB — allow (client still enforces); production should set Supabase
    return { allowed: true, runs: 0, limit };
  }

  const day = today();
  const { data: existing } = await sb
    .from("usage_daily")
    .select("runs")
    .eq("user_key", userKey)
    .eq("day", day)
    .maybeSingle();

  const current = existing?.runs ?? 0;
  if (current >= limit) {
    return {
      allowed: false,
      runs: current,
      limit,
      error: `Free plan limit reached (${limit} runs/day). Upgrade to Pro.`,
    };
  }

  if (existing) {
    await sb
      .from("usage_daily")
      .update({ runs: current + 1 })
      .eq("user_key", userKey)
      .eq("day", day);
  } else {
    await sb.from("usage_daily").insert({
      user_key: userKey,
      day,
      runs: 1,
    });
  }

  return { allowed: true, runs: current + 1, limit };
}
