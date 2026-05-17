export type SlackToolInput = {
  webhook_url: string;
  message: string;
  severity: string;
  station?: string;
  shiftId?: string;
  agentResult?: Record<string, unknown>;
  approvedBy?: string;
};

export type SlackToolResult = {
  success: boolean;
  message: string;
  error?: string;
};

function buildBlocks(input: SlackToolInput): object[] {
  const emoji =
    input.severity === "critical" ? "🔴"
    : input.severity === "warning" ? "🟡"
    : "🟢";

  const r = input.agentResult ?? {};
  const station   = (r.worst_station  as string) ?? input.station ?? "Unknown";
  const checked   = r.checked   as string | undefined;
  const found     = r.found     as string | undefined;
  const why       = r.why       as string | undefined;
  const handover  = r.handover_notes as string | undefined;
  const recommendation = (r.recommendation as string) ?? input.message;
  const approvedBy = input.approvedBy ?? "operator";

  const blocks: object[] = [
    // Header
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${input.severity.toUpperCase()}  ·  ${station}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*LinePulse Production Agent*  ·  Shift: ${input.shiftId ?? "N/A"}`,
        },
      ],
    },
    { type: "divider" },
  ];

  // What I checked
  if (checked) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*What I checked*\n${checked}`,
      },
    });
  }

  // What I found
  if (found) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*What I found*\n${found}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Recommendation
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Recommendation*\n${recommendation}`,
    },
  });

  // Why
  if (why) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Why*\n${why}`,
      },
    });
  }

  // Handover
  if (handover) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Shift handover*\n${handover}`,
      },
    });
  }

  // Footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Approved by: ${approvedBy}`,
      },
    ],
  });

  return blocks;
}

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

  const station = (input.agentResult?.worst_station as string) ?? input.station ?? "shop floor";

  try {
    const res = await fetch(input.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${emoji} LinePulse · ${input.severity.toUpperCase()} · ${station}`,
        blocks: buildBlocks(input),
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
