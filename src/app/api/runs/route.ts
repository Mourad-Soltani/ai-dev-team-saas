import { NextRequest, NextResponse } from "next/server";
import { runOrchestration } from "@/lib/orchestrator";
import { enrichWithDeepSeek } from "@/lib/deepseek";
import { notifySlack } from "@/lib/notify";

export const runtime = "nodejs"; // need Node for longer DeepSeek calls
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = (body.goal as string) || "Untitled goal";
    const rawSteps =
      (body.steps as { id?: string; description: string }[]) || [];
    const deepseekKey = (body.deepseekKey as string) || "";
    const slackWebhook = (body.slackWebhook as string) || "";

    if (!rawSteps.length) {
      return NextResponse.json(
        { error: "Provide at least one step" },
        { status: 400 }
      );
    }

    const steps = rawSteps.map((s, i) => ({
      id: s.id || `s${i + 1}`,
      description: s.description,
    }));

    let outcomes = runOrchestration(goal, steps);
    let liveModel = false;

    // Optional: enrich agent rationales with live DeepSeek
    if (deepseekKey.startsWith("sk-")) {
      const enriched = [];
      for (const o of outcomes) {
        const live = await enrichWithDeepSeek(
          deepseekKey,
          goal,
          o.description
        );
        if (live && live.length) {
          liveModel = true;
          const avg =
            live.reduce((s, x) => s + x.confidence, 0) / live.length;
          enriched.push({
            ...o,
            agents: live,
            confidence: avg,
          });
        } else {
          enriched.push(o);
        }
      }
      outcomes = enriched;
    }

    // Slack: notify on escalations
    const escalated = outcomes.filter((o) => !o.executed);
    if (slackWebhook && escalated.length) {
      const lines = escalated
        .map((o) => `• ${o.description} (${o.riskLevel} risk)`)
        .join("\n");
      await notifySlack(
        slackWebhook,
        `⚠️ *AI Dev Team* — ${escalated.length} step(s) need human sign-off\n*Goal:* ${goal}\n${lines}`
      );
    }

    return NextResponse.json({
      goal,
      outcomes,
      liveModel,
      summary: {
        total: outcomes.length,
        autoExecuted: outcomes.filter((o) => o.executed).length,
        escalated: outcomes.filter((o) => !o.executed).length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
