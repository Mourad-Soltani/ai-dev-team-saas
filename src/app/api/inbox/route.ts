import { NextResponse } from "next/server";
import { listPendingEscalations } from "@/lib/persist";
import { isDbConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({
      pending: [],
      db: false,
      message:
        "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const pending = await listPendingEscalations();
  return NextResponse.json({ pending, db: true });
}
