import { runLogIssueTool, type LogIssueInput } from "./level1/log-issue";
import { runEmailTool } from "./level1/email";
import { runSlackTool } from "./level1/slack";

export const LOG_ISSUE_TOOL = {
  type: "function" as const,
  function: {
    name: "log_issue",
    description: "Log an operational issue for tracking — bottleneck, quality spike, stall, or pace risk.",
    parameters: {
      type: "object",
      properties: {
        issue_type: {
          type: "string",
          enum: ["bottleneck", "quality_spike", "stall", "pace_risk", "other"],
        },
        station: { type: "string", description: "Station or area where the issue occurred" },
        summary: { type: "string", description: "One-sentence summary of the issue" },
      },
      required: ["issue_type", "station", "summary"],
    },
  },
} as const;

export const EMAIL_TOOL = {
  type: "function" as const,
  function: {
    name: "send_email",
    description: "Send an email alert to the supervisor. Use for critical issues or when supervisor action is needed.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Short alert subject line including station name and severity",
        },
        body: {
          type: "string",
          description: "2-4 sentences: what happened, why it matters, what was approved",
        },
      },
      required: ["subject", "body"],
    },
  },
} as const;

export interface EnabledIntegration {
  tool_name: string;
  config: Record<string, string>;
}

export interface ToolRunResult {
  tool: string;
  success: boolean;
  message: string;
  error?: string;
  alert_id?: string;
}

export async function dispatchTool(
  name: string,
  args: Record<string, string>,
  integrations: EnabledIntegration[],
  tenantId: string,
  shiftId?: string
): Promise<ToolRunResult> {
  if (name === "log_issue") {
    const result = await runLogIssueTool({
      ...(args as LogIssueInput),
      tenantId,
      shiftId,
    });
    return { tool: name, success: result.success, message: result.message, alert_id: result.alert_id };
  }

  if (name === "send_email") {
    const cfg = integrations.find((i) => i.tool_name === "email")?.config ?? {};
    const result = await runEmailTool({
      supervisor_email: cfg.supervisor_email ?? "",
      subject: args.subject ?? "",
      body: args.body ?? "",
    });
    return { tool: name, ...result };
  }

  if (name === "slack") {
    const cfg = integrations.find((i) => i.tool_name === "slack")?.config ?? {};
    const result = await runSlackTool({
      webhook_url: cfg.webhook_url ?? "",
      message:     args.summary ?? args.body ?? "",
      severity:    args.severity ?? "warning",
      station:     args.station,
      shiftId:     args.shiftId ?? shiftId,
    });
    return { tool: name, ...result };
  }

  return { tool: name, success: false, message: "", error: `Unknown tool: ${name}` };
}
