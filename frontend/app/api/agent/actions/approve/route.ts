import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runExecutor } from "@agents/executor";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("tenant_id").eq("id", user.id).single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await req.json() as {
    alertId?: string;
    recommendation: string;
    approvedBy: string;
    agentType: "production" | "quality" | "planning";
    shiftId?: string;
    lineId?: string;
    customInstruction?: string;
    agentResult?: Record<string, unknown>;
  };

  if (!body.recommendation || !body.agentType || !body.approvedBy) {
    return NextResponse.json(
      { error: "recommendation, agentType, and approvedBy are required" },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  const context = {
    station:  body.agentResult?.worst_station ?? null,
    severity: body.agentResult?.severity ?? null,
    priority: body.agentResult?.severity === "critical" ? "P1"
            : body.agentResult?.severity === "warning"  ? "P2"
            : body.agentResult?.severity === "ok"       ? "P3"
            : null,
  };

  const { data: action, error: insertErr } = await db
    .from("agent_actions")
    .insert({
      tenant_id:           tenantId,
      agent_alert_id:      body.alertId ?? null,
      agent_type:          body.agentType,
      recommendation_text: body.recommendation,
      custom_instruction:  body.customInstruction ?? null,
      approved_by:         body.approvedBy,
      shift_id:            body.shiftId ?? null,
      line_id:             body.lineId ?? null,
      status:              "executing",
      level:               1,
    })
    .select("id")
    .single();

  if (insertErr || !action) {
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create action" }, { status: 500 });
  }

  let executorResult;
  try {
    executorResult = await runExecutor({
      tenantId,
      recommendation:  body.recommendation,
      agentType:       body.agentType,
      shiftId:         body.shiftId,
      agentResult:     body.agentResult,
      customInstruction: body.customInstruction,
      approvedBy:      body.approvedBy,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from("agent_actions").update({
      status:           "failed",
      execution_result: msg,
      completed_at:     new Date().toISOString(),
    }).eq("id", action.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const baseUpdate = {
    tools_used:       executorResult.tools_used,
    actions_taken:    executorResult.actions_taken,
    execution_result: executorResult.execution_result,
    agent_alert_id:   executorResult.agent_alert_id ?? null,
    completed_at:     new Date().toISOString(),
  };

  // Try the full update with migration-011 fields (new status + context).
  // Fall back to pre-migration fields if the constraint or column doesn't exist yet.
  const { error: updateErr } = await db.from("agent_actions")
    .update({ ...baseUpdate, status: "awaiting_human_action", context })
    .eq("id", action.id);

  if (updateErr) {
    await db.from("agent_actions")
      .update({ ...baseUpdate, status: "completed" })
      .eq("id", action.id);
  }

  return NextResponse.json({
    id:               action.id,
    status:           "awaiting_human_action",
    tools_used:       executorResult.tools_used,
    actions_taken:    executorResult.actions_taken,
    execution_result: executorResult.execution_result,
  });
}
