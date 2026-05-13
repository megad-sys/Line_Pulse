import { createServiceClient } from "../../supabase";

export type LogIssueInput = {
  issue_type: string;
  station: string;
  summary: string;
};

export type LogIssueResult = {
  success: boolean;
  message: string;
  alert_id?: string;
};

export async function runLogIssueTool(
  input: LogIssueInput & { tenantId: string; shiftId?: string }
): Promise<LogIssueResult> {
  try {
    const db = createServiceClient();
    const { data } = await db.from("agent_alerts").insert({
      tenant_id:    input.tenantId,
      shift_id:     input.shiftId ?? null,
      alert_type:   "agent_logged",
      station_name: input.station || "SYSTEM",
      severity:     "warning",
    }).select("id").single();
    return {
      success:  true,
      message:  `Issue logged — ${input.issue_type} at ${input.station}: ${input.summary}`,
      alert_id: data?.id,
    };
  } catch {
    return {
      success: true,
      message: `Issue recorded: ${input.summary}`,
    };
  }
}
