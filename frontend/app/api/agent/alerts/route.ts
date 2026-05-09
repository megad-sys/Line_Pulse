import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const db = createServiceClient();

  const { data, error } = await db
    .from("agent_alerts")
    .select(
      `
      *,
      work_orders ( wo_number, part_number )
    `
    )
    .is("resolved_at", null)
    .order("severity", { ascending: true })   // critical < warning alphabetically — use case below
    .order("detected_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort: critical first, then by detected_at ascending
  const sorted = (data ?? []).sort((a, b) => {
    if (a.severity === b.severity) {
      return new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime();
    }
    return a.severity === "critical" ? -1 : 1;
  });

  return NextResponse.json(sorted);
}
