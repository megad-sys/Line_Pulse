import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@agents/orchestrator";

export async function POST(req: NextRequest) {
  const { shiftId } = await req.json();

  if (!shiftId) {
    return NextResponse.json({ error: "shiftId is required" }, { status: 400 });
  }

  const db = createServiceClient();

  let resolvedShiftId = shiftId;
  if (shiftId === "latest") {
    const { data } = await db
      .from("shifts")
      .select("id")
      .order("start_time", { ascending: false })
      .limit(1)
      .single();
    if (!data) return NextResponse.json({ error: "No shifts found" }, { status: 404 });
    resolvedShiftId = data.id;
  }

  const start = Date.now();

  const result = await runOrchestrator(resolvedShiftId);

  const duration_ms = Date.now() - start;

  await db.from("agent_runs").insert({
    shift_id: resolvedShiftId,
    ran_at: new Date().toISOString(),
    result_json: result,
    duration_ms,
  });

  return NextResponse.json({ ...result, duration_ms });
}
