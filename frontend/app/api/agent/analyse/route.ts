import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@/lib/agent/orchestrator";

export async function POST(req: NextRequest) {
  const { shiftId } = await req.json();

  if (!shiftId) {
    return NextResponse.json({ error: "shiftId is required" }, { status: 400 });
  }

  const start = Date.now();

  const result = await runOrchestrator(shiftId);

  const duration_ms = Date.now() - start;

  const db = createServiceClient();
  await db.from("agent_runs").insert({
    shift_id: shiftId,
    ran_at: new Date().toISOString(),
    result_json: result,
    duration_ms,
  });

  return NextResponse.json({ ...result, duration_ms });
}
