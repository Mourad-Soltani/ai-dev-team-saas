import { NextRequest, NextResponse } from "next/server";
import { runOrchestration } from "@/lib/orchestrator";
import { enrichLiveAgents } from "@/lib/liveAgents";
import { notifySlack } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = (body.goal as string) || "Untitled goal";
    const rawSteps =
      (body.steps as { id?: string; description: string }[]) || [];
    const deepseekKey = (body.deepseekKey as string) || "";
    const openrouterKey = (body.openrouterKey as string) || "";
    const openrouterModel =
      (body.openrouterModel as string) || "openai/gpt-4o-mini";
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
    let liveProvider: string = "none";

    const hasLiveKey =
      (openrouterKey && openrouterKey.startsWith("sk-")) ||
      (deepseekKey && deepseekKey.startsWith("sk-"));

    if (hasLiveKey) {
      const enriched = [];
      for (const o of outcomes) {
        const live = await enrichLiveAgents({
          goal,
          stepDescription: o.description,
          openrouterKey,
          openrouterModel,
          deepseekKey,
        });
        if (live) {
          liveModel = true;
          liveProvider = live.provider;
          const avg =
            live.opinions.reduce((s, x) => s + x.confidence, 0) /
            live.opinions.length;
          enriched.push({
            ...o,
            agents: live.opinions,
            confidence: avg,
          });
        } else {
          enriched.push(o);
        }
      }
      outcomes = enriched;
    }

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
      liveProvider,
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
