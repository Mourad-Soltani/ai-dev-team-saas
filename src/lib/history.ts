/**
 * Browser-persisted run history for the free/pro demo.
 * Pro/Team will later move this to a real DB keyed by userId.
 */

const HISTORY_KEY = "ai-dev-team-history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  goal: string;
  createdAt: string;
  summary: { total: number; executed: number; escalated: number };
  outcomes: {
    stepId: string;
    description: string;
    gateDecision: string;
    riskLevel: string;
    executed: boolean;
    humanDecision?: string | null;
  }[];
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(entry: HistoryEntry): void {
  const list = loadHistory();
  list.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
}
