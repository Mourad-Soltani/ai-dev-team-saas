/**
 * Client-side usage tracking for free tier.
 * Keyed by day so limits reset daily.
 * Logged-in Pro/Team users skip these limits (enforced server-side via plan).
 */

const STORAGE_KEY = "ai-dev-team-usage";

export interface UsageState {
  date: string; // YYYY-MM-DD
  runs: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getUsage(): UsageState {
  if (typeof window === "undefined") return { date: today(), runs: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), runs: 0 };
    const parsed = JSON.parse(raw) as UsageState;
    if (parsed.date !== today()) return { date: today(), runs: 0 };
    return parsed;
  } catch {
    return { date: today(), runs: 0 };
  }
}

export function incrementUsage(): UsageState {
  const current = getUsage();
  const next = { date: today(), runs: current.runs + 1 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function canRun(runsPerDay: number): boolean {
  if (runsPerDay < 0) return true; // unlimited
  return getUsage().runs < runsPerDay;
}
