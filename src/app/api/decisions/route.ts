import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Records human decisions on escalated steps.
 * Edge-safe: no durable store yet — logs and returns confirmation.
 * Swap for Vercel KV / Postgres when auth lands.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, stepId, decision, description } = body as {
      goal?: string;
      stepId?: string;
      decision?: "approved" | "rejected";
      description?: string;
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

    // Structured log for Vercel dashboard / future persistence hook
    console.log("[human-decision]", JSON.stringify(record));

    return NextResponse.json({ ok: true, record });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
