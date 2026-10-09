import { NextRequest, NextResponse } from "next/server";
import { notifySlack } from "@/lib/notify";
import { saveDecision } from "@/lib/persist";
import { createGitHubIssue } from "@/lib/github";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      goal,
      stepId,
      decision,
      description,
      slackWebhook,
      runId,
      githubToken,
      githubRepo,
    } = body as {
      goal?: string;
      stepId?: string;
      decision?: "approved" | "rejected";
      description?: string;
      slackWebhook?: string;
      runId?: string;
      githubToken?: string;
      githubRepo?: string; // "owner/repo"
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
    await saveDecision({
      runId,
      stepId,
      decision,
      description,
    });

    if (slackWebhook) {
      const emoji = decision === "approved" ? "✅" : "🛑";
      await notifySlack(
        slackWebhook,
        `${emoji} *Human ${decision}* — ${description || stepId}\nGoal: ${goal || "—"}`
      );
    }

    let githubIssue: { html_url: string; number: number } | null = null;
    if (
      decision === "approved" &&
      githubToken &&
      githubRepo &&
      githubRepo.includes("/")
    ) {
      const [owner, repo] = githubRepo.split("/");
      githubIssue = await createGitHubIssue({
        token: githubToken,
        owner,
        repo,
        title: `[AI Dev Team] Approved: ${description || stepId}`,
        body: [
          `**Goal:** ${goal || "—"}`,
          `**Step:** ${description || stepId}`,
          `**Decision:** approved`,
          `**At:** ${record.decidedAt}`,
          "",
          "_Created automatically when an escalated step was human-approved._",
        ].join("\n"),
      });
    }

    return NextResponse.json({ ok: true, record, githubIssue });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
