/**
 * Optional live DeepSeek enrichment.
 * When the user provides their own API key, we replace mock rationales
 * with short model-generated ones. Auth + request shape match the
 * documented Chat Completions API.
 */

export interface LiveOpinion {
  agent: string;
  verdict: "approve" | "revise" | "reject";
  confidence: number;
  rationale: string;
}

const ROLES = [
  "orchestrator_pm",
  "architect",
  "backend_dev",
  "frontend_dev",
  "qa",
  "reviewer_lead",
];

export async function enrichWithDeepSeek(
  apiKey: string,
  goal: string,
  stepDescription: string
): Promise<LiveOpinion[] | null> {
  const prompt = `You are simulating a software team reviewing a single task.
Goal: ${goal}
Task: ${stepDescription}

For each role (${ROLES.join(", ")}), reply with ONE line in this exact format:
role|verdict|confidence|short rationale
verdict must be approve, revise, or reject.
confidence is a number 0.5-0.95.
Keep each rationale under 15 words.
Output exactly ${ROLES.length} lines, nothing else.`;

  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.4,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`DeepSeek HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || "";
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
  } catch (e) {
    console.error("[deepseek]", e);
    return null;
  }
}
