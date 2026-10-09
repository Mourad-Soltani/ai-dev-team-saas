# Agent Orchestration — Technical Reference

This document describes how multi-agent orchestration works in AI Dev Team SaaS:
roles, consensus, risk scoring, the escalation gate, live model enrichment, and
the per-step pipeline. Implementation lives primarily in:

| File | Role |
|------|------|
| `src/lib/orchestrator.ts` | Risk, consensus, gate, step pipeline |
| `src/lib/deepseek.ts` | Optional live agent rationales |
| `src/app/api/runs/route.ts` | HTTP entry: run + enrich + Slack |
| `src/app/api/decisions/route.ts` | Human approve/reject + Slack |

---

## 1. Pipeline overview

For each step in a run, the system executes the same ordered pipeline:

```
Step description
       │
       ▼
┌──────────────────┐
│ 1. Agent opinions │  Six roles → verdict + confidence + rationale
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Consensus      │  Aggregate verdict + mean confidence
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. Risk assess    │  Keyword/signal score → low | medium | high
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. Escalation gate│  Policy on (confidence, risk) → decision
└────────┬─────────┘
         │
         ├─ auto_approve  → executed = true
         ├─ needs_human   → executed = false → UI Approve/Reject
         └─ blocked       → executed = false
```

Optional branches:

- If a **DeepSeek API key** is supplied on `POST /api/runs`, step (1) opinions
  are replaced by live model output when parsing succeeds.
- If a **Slack webhook** is supplied, escalations (and later human decisions)
  emit notifications.

The **goal** string is stored for display, audit export, and live prompts; gate
logic is driven by each **step description**.

---

## 2. Agent roles

Six fixed roles participate on every step:

| Role ID | Intended responsibility | Model tier (design) |
|---------|-------------------------|---------------------|
| `orchestrator_pm` | Scope, priority, coordination | standard |
| `architect` | Design, boundaries, long-term fit | premium |
| `backend_dev` | APIs, data, services | standard |
| `frontend_dev` | UI, client behavior | standard |
| `qa` | Tests, regressions, edge cases | cheap |
| `reviewer_lead` | Final quality / merge bar | premium |

Tiers mirror the original Python router (`CHEAP` / `STANDARD` / `PREMIUM`) so a
buyer can later map roles to different models or cost classes. In the hosted
TypeScript path, tier is metadata unless live enrichment is enabled.

### Opinion schema

```ts
interface AgentOpinion {
  agent: string;       // role id
  verdict: "approve" | "revise" | "reject";
  confidence: number;  // 0–1
  rationale: string;
}
```

---

## 3. Consensus

**Function:** `reachConsensus(description) → ConsensusResult`

**Mock path (default):**

- Each role emits a deterministic opinion: `verdict = "approve"`,
  `confidence = 0.75`, rationale prefixed with the role name.
- Consensus confidence = arithmetic mean of agent confidences (→ 0.75).
- Consensus verdict = `"approve"` in the mock path (unanimous approve).

**Live path (DeepSeek key present):**

- `enrichWithDeepSeek(apiKey, goal, stepDescription)` calls
  `POST https://api.deepseek.com/chat/completions`.
- The prompt asks for exactly one line per role:

  ```text
  role|verdict|confidence|short rationale
  ```

- Lines are parsed into `AgentOpinion[]`. Confidence is clamped to `[0.5, 0.95]`.
- If fewer than three valid lines are parsed, the system **falls back** to mock
  opinions (fail-open for UX; gate still runs).
- When live opinions are used, step confidence is the mean of live confidences.

Consensus does **not** currently implement majority vote on mixed verdicts in the
mock path (all approve). With live models, mixed verdicts can appear in the
opinion list; the gate still keys primarily off **aggregate confidence + risk**,
not off a formal majority function. A natural extension is weighted voting or
penalty on disagreement (as in the original Python `consensus` module).

---

## 4. Risk assessment

**Function:** `assessRisk(description) → RiskAssessment`

### Scoring model

- Base score: `0.15`
- Each **high-risk** keyword hit: `+0.35`
- Each **medium-risk** keyword hit: `+0.15`
- Cap: `min(score, 1.0)`

### Keyword sets

**High-risk examples:**  
`production`, `prod`, `deploy`, `delete`, `drop`, `migrate`, `billing`,
`payment`, `auth`, `password`, `secret`, `irreversible`, `destroy`,
`remove user`, `gdpr`, `pii`

**Medium-risk examples:**  
`schema`, `database`, `migration`, `api key`, `permission`, `role`, `admin`,
`public`, `exposes`

Matching is case-insensitive substring match on the step description.

### Level thresholds

| Score | Level |
|-------|--------|
| `>= 0.7` | `high` |
| `>= 0.4` | `medium` |
| else | `low` |

Every assessment includes a `reasons: string[]` list (e.g.
`high-risk signal: "deploy"`) for UI and audit export. If nothing matches:
`["no elevated risk signals"]`.

This design is **inspectable and deterministic**—suitable for demos and policy
discussion—not a learned risk model. Buyers can replace the keyword tables or
swap in an ML/LLM risk classifier without changing the gate interface.

---

## 5. Escalation gate

**Function:** `evaluateGate(confidence, risk) → { decision, explanation }`

### Policy (in evaluation order)

1. If `risk.level === "high"` → **`needs_human`**  
   *Explanation:* `high-risk action always requires human sign-off`  
   **Rationale:** Confidence cannot override production/auth/billing-class risk.

2. If `confidence < 0.5` → **`needs_human`**  
   *Explanation:* `confidence below threshold`

3. If `risk.level === "medium"` **and** `confidence < 0.8` → **`needs_human`**  
   *Explanation:* `medium risk with moderate confidence needs human review`

4. Else → **`auto_approve`**  
   *Explanation:* `risk and confidence within autonomous bounds`

### Decision → execution flag

| Gate decision | `executed` | UI |
|---------------|------------|-----|
| `auto_approve` | `true` | AUTO-EXECUTED |
| `needs_human` | `false` until human acts | AWAITING YOUR DECISION → Approve / Reject |
| `blocked` | `false` | BLOCKED (reserved) |

Human **Approve** sets `executed = true` and records `humanDecision` + timestamp.  
Human **Reject** keeps the step non-executed and marks `rejected`.

---

## 6. Run orchestration

**Function:** `runOrchestration(goal, steps) → StepOutcome[]`

For each step `{ id, description }`:

1. `consensus = reachConsensus(description)`  
2. `risk = assessRisk(description)`  
3. `gate = evaluateGate(consensus.confidence, risk)`  
4. Emit `StepOutcome` with gate fields, risk fields, `agents`, and `executed`.

Steps are independent: failure or escalation on step *n* does not currently
halt step *n+1* in the SaaS API (all steps are scored in one request). A stricter
sequential planner (stop on first escalation) is a straightforward policy change
in `runOrchestration` or in the API layer.

### StepOutcome (API / UI)

```ts
interface StepOutcome {
  stepId: string;
  description: string;
  gateDecision: GateDecision;
  confidence: number;
  riskLevel: RiskLevel;
  riskScore: number;
  executed: boolean;
  note: string;              // gate explanation
  agents: AgentOpinion[];
  // UI / decision layer (client may add):
  humanDecision?: "approved" | "rejected" | null;
  decidedAt?: string;
}
```

---

## 7. Live DeepSeek enrichment

**Module:** `src/lib/deepseek.ts`  
**Triggered from:** `POST /api/runs` when `body.deepseekKey` starts with `sk-`

### Request

- Endpoint: `https://api.deepseek.com/chat/completions`
- Auth: `Authorization: Bearer <key>`
- Model: `deepseek-chat`
- Non-streaming; bounded `max_tokens`

### Prompt contract

The model must return one line per role:

```text
orchestrator_pm|approve|0.82|Tests look proportionate to scope
architect|approve|0.78|No boundary change implied
...
```

### Failure behavior

- HTTP errors or unparseable content → log, return `null`, **keep mock opinions**
- Partial parse (≥3 roles) → use parsed subset  
- Successful enrichment sets response flag `liveModel: true`

### Security note

Keys are provided per request from the browser Settings (localStorage). They are
not stored in a server DB in this build. Production multi-tenant deployments
should encrypt BYO keys at rest and never log full secrets.

---

## 8. Human-in-the-loop and notifications

### Decisions API

`POST /api/decisions` accepts:

- `stepId`, `decision` (`approved` | `rejected`)
- optional `goal`, `description`, `slackWebhook`

Logs a structured record and optionally notifies Slack.

### Slack

`notifySlack(webhookUrl, text)` posts JSON `{ text }` to Slack incoming webhooks
only if the URL starts with `https://hooks.slack.com/`.

Emitted when:

- A run produces escalations (from `/api/runs`)
- A human approves or rejects (from `/api/decisions`)

---

## 9. Relation to the original Python system

The SaaS TypeScript engine is a **behavioral port** of the Python prototype:

| Python | TypeScript SaaS |
|--------|------------------|
| `src/agents/roles.py` | `ROLES` in `orchestrator.ts` |
| `src/agents/consensus.py` | `reachConsensus` |
| `src/core/risk.py` | `assessRisk` |
| `src/core/gate.py` | `evaluateGate` |
| `src/core/orchestration.py` | `runOrchestration` + `/api/runs` |
| `src/core/router.py` (DeepSeekClient) | `deepseek.ts` enrichment |

Python still holds the fuller **model router** (tiers, circuit breaker, multi-client
fallback). The SaaS path prioritizes a single optional live provider (DeepSeek)
plus deterministic offline demos on Vercel.

---

## 10. Extension points for buyers

1. **Disagreement-aware consensus** — Penalize confidence when verdicts split.  
2. **Sequential halt** — Stop the run at the first `needs_human` if desired.  
3. **Real execution adapters** — On Approve, create a GitHub issue, open a PR,
   or call an internal runbook API.  
4. **Learned risk** — Replace keyword tables with a classifier; keep the same
   `RiskAssessment` shape.  
5. **Per-role models** — Map `tier` to different providers (align with Python router).  
6. **Server-side plan limits** — Enforce Free/Pro using auth + DB, not only
   `localStorage`.

---

## 11. Invariants (useful for tests and diligence)

- High risk **never** auto-approves, regardless of confidence.  
- Every step returns a full `agents[]` array (mock or live).  
- Gate explanations are human-readable strings suitable for audit logs.  
- Live enrichment failure does not fail the run; mock path remains available.  
- `executed === true` means either auto-approve **or** human approve.

These invariants are what make the product demo-stable and the risk story
credible to technical buyers.
