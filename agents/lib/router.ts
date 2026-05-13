import type { EnabledIntegration } from "./tools/index";

export type RecommendedAction =
  | "notify_supervisor"
  | "log_issue"
  | "escalate"
  | "no_action";

export type RoutedTools = {
  tools: string[];
  reason: string;
};

export function routeAction(
  recommendedAction: RecommendedAction,
  enabledIntegrations: EnabledIntegration[]
): RoutedTools {
  const has = (tool: string) =>
    enabledIntegrations.some((i) => i.tool_name === tool);

  // Always log internally
  const tools = ["log_issue"];

  // Add slack if available and action needs notification
  if (
    recommendedAction !== "no_action" &&
    recommendedAction !== "log_issue" &&
    has("slack")
  ) {
    tools.push("slack");
  }

  return { tools, reason: tools.join(" + ") };
}
