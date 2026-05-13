import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const FULL_SELECT = `
  id,
  agent_type,
  recommendation_text,
  status,
  actions_taken,
  tools_used,
  execution_result,
  approved_by,
  approved_at,
  completed_at,
  context,
  agent_alerts (
    id,
    station_name,
    severity,
    alert_type,
    detected_at
  )
`;

const COMPAT_SELECT = `
  id,
  agent_type,
  recommendation_text,
  status,
  actions_taken,
  tools_used,
  execution_result,
  approved_by,
  approved_at,
  completed_at,
  agent_alerts (
    id,
    station_name,
    severity,
    alert_type,
    detected_at
  )
`;

function shapeRows(data: Record<string, unknown>[]) {
  return data.map((row) => {
    const alert = Array.isArray(row.agent_alerts)
      ? (row.agent_alerts as Record<string, string | null>[])[0]
      : row.agent_alerts as Record<string, string | null> | null;
    const ctx = (row.context ?? {}) as Record<string, string | null>;
    return {
      id:           row.id,
      agent_type:   row.agent_type,
      recommendation: row.recommendation_text,
      status:       row.status,
      actions_taken: row.actions_taken ?? [],
      tools_used:   row.tools_used ?? [],
      approved_by:  row.approved_by,
      approved_at:  row.approved_at,
      completed_at: row.completed_at,
      station:      alert?.station_name ?? ctx.station ?? null,
      severity:     alert?.severity    ?? ctx.severity ?? null,
      priority:     ctx.priority ?? null,
    };
  });
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("tenant_id").eq("id", user.id).single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const agentType = searchParams.get("agent_type");

  const db = createServiceClient();

  function buildQuery(select: string) {
    let q = db
      .from("agent_actions")
      .select(select)
      .eq("tenant_id", tenantId)
      .order("approved_at", { ascending: false })
      .limit(100);
    if (agentType) q = q.eq("agent_type", agentType);
    return q;
  }

  // Try with context column (migration 011). Fall back if column doesn't exist yet.
  let { data, error } = await buildQuery(FULL_SELECT);
  if (error?.message?.includes("context")) {
    ({ data, error } = await buildQuery(COMPAT_SELECT));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(shapeRows((data ?? []) as unknown as Record<string, unknown>[]));
}
