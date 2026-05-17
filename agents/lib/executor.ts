import Groq from "groq-sdk";
import { createServiceClient } from "./supabase";
import { dispatchTool, type EnabledIntegration } from "./tools/index";
import { routeAction, type RecommendedAction } from "./router";

export interface ExecutorInput {
  tenantId: string;
  recommendation: string;
  agentType: "production" | "quality" | "planning";
  shiftId?: string;
  agentResult?: Record<string, unknown>;
  customInstruction?: string;
  approvedBy?: string;
}

export interface ExecutorResult {
  tools_used: string[];
  actions_taken: string[];
  execution_result: string;
  agent_alert_id?: string;
}

export async function runExecutor(input: ExecutorInput): Promise<ExecutorResult> {
  const db = createServiceClient();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // 1. Fetch enabled integrations for this tenant
  const { data: rows } = await db
    .from("tenant_integrations")
    .select("tool_name, config")
    .eq("tenant_id", input.tenantId)
    .eq("enabled", true);

  const integrations: EnabledIntegration[] = (rows ?? []).map((r) => ({
    tool_name: r.tool_name as string,
    config: r.config as Record<string, string>,
  }));

  // 2. Derive recommended action from agent result — default to log_issue
  const recommendedAction =
    (input.agentResult?.recommended_action as RecommendedAction) ?? "log_issue";

  // 3. Route deterministically — no LLM
  const routed = routeAction(recommendedAction, integrations);

  // 4. Build shared args for all tool calls
  const toolArgs = {
    issue_type: input.agentType,
    station:    String(input.agentResult?.worst_station ?? "unknown"),
    summary:    input.recommendation,
    body:       input.recommendation,
    subject:    `[LinePulse] ${input.agentType} alert — ${String(input.agentResult?.worst_station ?? "shop floor")}`,
    severity:   String(input.agentResult?.severity ?? "warning"),
    shiftId:    input.shiftId ?? "N/A",
  };

  // 5. Execute each routed tool
  const results = await Promise.all(
    routed.tools.map((toolName) =>
      dispatchTool(toolName, toolArgs, integrations, input.tenantId, input.shiftId, input.agentResult, input.approvedBy)
    )
  );

  // Fallback: always log at minimum
  if (results.length === 0) {
    results.push(
      await dispatchTool(
        "log_issue",
        { issue_type: "other", station: "unknown", summary: input.recommendation },
        integrations,
        input.tenantId,
        input.shiftId
      )
    );
  }

  const tools_used      = results.map((r) => r.tool);
  const actions_taken   = results.filter((r) => r.success).map((r) => r.message);
  const errors          = results.filter((r) => !r.success).map((r) => r.error ?? "unknown");
  const agent_alert_id  = results.find((r) => r.alert_id)?.alert_id;

  // 6. LLM call — summary sentence only (reasoning, not execution)
  const summaryRes = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Write one past-tense sentence describing only the automated system actions that completed " +
          "(e.g. notifications sent, issues logged, records created). " +
          "Do NOT mention or paraphrase the operator recommendation. " +
          "Do NOT imply that any physical or human action was carried out. " +
          "Describe tool results only. Be specific. No filler.",
      },
      {
        role: "user",
        content: `System actions completed: ${actions_taken.join("; ")}${
          errors.length ? `\nErrors: ${errors.join("; ")}` : ""
        }`,
      },
    ],
    max_tokens: 100,
    temperature: 0.2,
  });

  const execution_result =
    summaryRes.choices[0]?.message?.content?.trim() ??
    (actions_taken[0] ?? "No actions executed.");

  return { tools_used, actions_taken, execution_result, agent_alert_id };
}
