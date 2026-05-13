export type SlackToolInput = {
  webhook_url: string;
  message: string;
  severity: string;
  station?: string;
  shiftId?: string;
};

export type SlackToolResult = {
  success: boolean;
  message: string;
  error?: string;
};

export async function runSlackTool(input: SlackToolInput): Promise<SlackToolResult> {
  if (!input.webhook_url) {
    return {
      success: false,
      message: "",
      error: "Slack webhook URL not configured. Go to Settings → Integrations.",
    };
  }

  const emoji =
    input.severity === "critical" ? "🔴"
    : input.severity === "warning" ? "🟡"
    : "🟢";

  try {
    const res = await fetch(input.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${emoji} *LinePulse Alert*`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${input.severity.toUpperCase()}*\n${input.message}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Station: ${input.station ?? "N/A"} | Shift: ${input.shiftId ?? "N/A"}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        message: "",
        error: `Slack webhook failed: HTTP ${res.status}`,
      };
    }

    return { success: true, message: "Slack alert sent to production channel" };
  } catch (err) {
    return {
      success: false,
      message: "",
      error: err instanceof Error ? err.message : "Slack request failed",
    };
  }
}
