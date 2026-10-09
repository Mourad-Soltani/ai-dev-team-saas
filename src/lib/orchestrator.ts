/**
 * Port of the AI Dev Team core decision logic for the SaaS frontend/API.
 * Mirrors risk scoring, escalation gate, and multi-agent consensus behavior
 * from the Python prototype so the hosted product feels identical.
 */

export type RiskLevel = "low" | "medium" | "high";
export type GateDecision = "auto_approve" | "needs_human" | "blocked";

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export interface AgentOpinion {
  agent: string;
  verdict: "approve" | "revise" | "reject";
  confidence: number;
  rationale: string;
}

export interface ConsensusResult {
  verdict: string;
  confidence: number;
  opinions: AgentOpinion[];
}

export interface StepOutcome {
  stepId: string;
  description: string;
  gateDecision: GateDecision;
  confidence: number;
  riskLevel: RiskLevel;
  riskScore: number;
  executed: boolean;
  note: string;
  agents: AgentOpinion[];
}

const HIGH_RISK_KEYWORDS = [
  "production", "prod", "deploy", "delete", "drop", "migrate",
  "billing", "payment", "auth", "password", "secret", "irreversible",
  "destroy", "remove user", "gdpr", "pii",
];

const MEDIUM_RISK_KEYWORDS = [
  "schema", "database", "migration", "api key", "permission",
  "role", "admin", "public", "exposes",
];

const ROLES = [
  { role: "orchestrator_pm", tier: "standard" },
  { role: "architect", tier: "premium" },
  { role: "backend_dev", tier: "standard" },
  { role: "frontend_dev", tier: "standard" },
  { role: "qa", tier: "cheap" },
  { role: "reviewer_lead", tier: "premium" },
];

export function assessRisk(description: string): RiskAssessment {
  const lower = description.toLowerCase();
  const reasons: string[] = [];
  let score = 0.15;

  for (const kw of HIGH_RISK_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.35;
      reasons.push(`high-risk signal: "${kw}"`);
    }
  }
  for (const kw of MEDIUM_RISK_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.15;
      reasons.push(`medium-risk signal: "${kw}"`);
    }
  }

  score = Math.min(1, score);
  let level: RiskLevel = "low";
  if (score >= 0.7) level = "high";
  else if (score >= 0.4) level = "medium";

  if (reasons.length === 0) reasons.push("no elevated risk signals");

  return { score, level, reasons };
}

function mockAgentOpinion(role: string, description: string): AgentOpinion {
  // Deterministic stand-in matching the Python prototype's fixed 0.75 confidence
  return {
    agent: role,
    verdict: "approve",
    confidence: 0.75,
    rationale: `[${role}] reviewed: ${description.slice(0, 80)}`,
  };
}

export function reachConsensus(description: string): ConsensusResult {
  const opinions = ROLES.map((r) => mockAgentOpinion(r.role, description));
  const avg =
    opinions.reduce((s, o) => s + o.confidence, 0) / opinions.length;
  return {
    verdict: "approve",
    confidence: avg,
    opinions,
  };
}

export function evaluateGate(
  confidence: number,
  risk: RiskAssessment
): { decision: GateDecision; explanation: string } {
  if (risk.level === "high") {
    return {
      decision: "needs_human",
      explanation: "high-risk action always requires human sign-off",
    };
  }
  if (confidence < 0.5) {
    return {
      decision: "needs_human",
      explanation: "confidence below threshold",
    };
  }
  if (risk.level === "medium" && confidence < 0.8) {
    return {
      decision: "needs_human",
      explanation: "medium risk with moderate confidence needs human review",
    };
  }
  return {
    decision: "auto_approve",
    explanation: "risk and confidence within autonomous bounds",
  };
}

export function runOrchestration(
  goal: string,
  steps: { id: string; description: string }[]
): StepOutcome[] {
  return steps.map((step) => {
    const consensus = reachConsensus(step.description);
    const risk = assessRisk(step.description);
    const gate = evaluateGate(consensus.confidence, risk);
    const executed = gate.decision === "auto_approve";

    return {
      stepId: step.id,
      description: step.description,
      gateDecision: gate.decision,
      confidence: consensus.confidence,
      riskLevel: risk.level,
      riskScore: risk.score,
      executed,
      note: gate.explanation,
      agents: consensus.opinions,
    };
  });
}
