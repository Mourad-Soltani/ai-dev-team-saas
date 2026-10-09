import { NextRequest, NextResponse } from "next/server";
import { notifySlack } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, stepId, decision, description, slackWebhook } = body as {
      goal?: string;
      stepId?: string;
      decision?: "approved" | "rejected";
      description?: string;
      slackWebhook?: string;
    };

    if (!stepId || !decision || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "stepId and decision (approved|rejected) required" },
        { status: 400 }
      );
    }

    const record = {
      goal: goal || null,
      stepId,
      description: description || null,
      decision,
      decidedAt: new Date().toISOString(),
    };

    console.log("[human-decision]", JSON.stringify(record));

    if (slackWebhook) {
      const emoji = decision === "approved" ? "✅" : "🛑";
      await notifySlack(
        slackWebhook,
        `${emoji} *Human ${decision}* — ${description || stepId}\nGoal: ${goal || "—"}`
      );
    }

    return NextResponse.json({ ok: true, record });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
