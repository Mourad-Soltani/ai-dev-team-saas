/**
 * Shared live-agent enrichment via OpenAI-compatible Chat Completions APIs.
 * Supports DeepSeek (direct) and OpenRouter (multi-model gateway).
 */

export interface LiveOpinion {
  agent: string;
  verdict: "approve" | "revise" | "reject";
  confidence: number;
  rationale: string;
}

export type LiveProvider = "deepseek" | "openrouter" | "none";

const ROLES = [
  "orchestrator_pm",
  "architect",
  "backend_dev",
  "frontend_dev",
  "qa",
  "reviewer_lead",
];

export const OPENROUTER_MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat (via OR)" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
] as const;

function buildPrompt(goal: string, stepDescription: string): string {
  return `You are simulating a software team reviewing a single task.
Goal: ${goal}
Task: ${stepDescription}

For each role (${ROLES.join(", ")}), reply with ONE line in this exact format:
role|verdict|confidence|short rationale
verdict must be approve, revise, or reject.
confidence is a number 0.5-0.95.
Keep each rationale under 15 words.
Output exactly ${ROLES.length} lines, nothing else.`;
}

function parseOpinions(content: string): LiveOpinion[] | null {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const opinions: LiveOpinion[] = [];
  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 4) continue;
    const [agent, verdictRaw, confRaw, ...rest] = parts;
    const verdict = ["approve", "revise", "reject"].includes(verdictRaw)
      ? (verdictRaw as LiveOpinion["verdict"])
      : "approve";
    const confidence = Math.min(
      0.95,
      Math.max(0.5, parseFloat(confRaw) || 0.75)
    );
    opinions.push({
      agent: agent.replace(/^\d+\.\s*/, ""),
      verdict,
      confidence,
      rationale: rest.join("|").slice(0, 120),
    });
  }
  if (opinions.length < 3) return null;
  return opinions;
}

async function chatCompletions(opts: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  extraHeaders?: Record<string, string>;
}): Promise<LiveOpinion[] | null> {
  try {
    const resp = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        ...opts.extraHeaders,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "user", content: opts.prompt }],
        max_tokens: 600,
        temperature: 0.4,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[live-agents] HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return null;
    }

    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || "";
    return parseOpinions(content);
  } catch (e) {
    console.error("[live-agents]", e);
    return null;
  }
}

export async function enrichWithDeepSeek(
  apiKey: string,
  goal: string,
  stepDescription: string
): Promise<LiveOpinion[] | null> {
  return chatCompletions({
    url: "https://api.deepseek.com/chat/completions",
    apiKey,
    model: "deepseek-chat",
    prompt: buildPrompt(goal, stepDescription),
  });
}

export async function enrichWithOpenRouter(
  apiKey: string,
  goal: string,
  stepDescription: string,
  model = "openai/gpt-4o-mini"
): Promise<LiveOpinion[] | null> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://ai-dev-team-saas.vercel.app";
  return chatCompletions({
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    model,
    prompt: buildPrompt(goal, stepDescription),
    extraHeaders: {
      "HTTP-Referer": appUrl,
      "X-Title": "AI Dev Team SaaS",
    },
  });
}

/**
 * Prefer OpenRouter if key present, else DeepSeek.
 * Returns opinions + which provider succeeded.
 */
export async function enrichLiveAgents(opts: {
  goal: string;
  stepDescription: string;
  openrouterKey?: string;
  openrouterModel?: string;
  deepseekKey?: string;
}): Promise<{ opinions: LiveOpinion[]; provider: LiveProvider } | null> {
  if (opts.openrouterKey && opts.openrouterKey.startsWith("sk-")) {
    const opinions = await enrichWithOpenRouter(
      opts.openrouterKey,
      opts.goal,
      opts.stepDescription,
      opts.openrouterModel || "openai/gpt-4o-mini"
    );
    if (opinions) return { opinions, provider: "openrouter" };
  }

  if (opts.deepseekKey && opts.deepseekKey.startsWith("sk-")) {
    const opinions = await enrichWithDeepSeek(
      opts.deepseekKey,
      opts.goal,
      opts.stepDescription
    );
    if (opinions) return { opinions, provider: "deepseek" };
  }

  return null;
}
