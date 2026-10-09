import { NextRequest, NextResponse } from "next/server";
import { runOrchestration } from "@/lib/orchestrator";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = (body.goal as string) || "Untitled goal";
    const rawSteps = (body.steps as { id?: string; description: string }[]) || [];

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

    const outcomes = runOrchestration(goal, steps);

    return NextResponse.json({
      goal,
      outcomes,
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
