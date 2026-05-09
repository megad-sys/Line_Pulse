import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export interface UnifiedAlert {
  id: string;
  source: "watchdog" | "production" | "quality" | "planning";
  detected_at: string;
  issue: string;
  severity: "critical" | "warning" | "info";
  is_watchdog: boolean;
  agent_alert_id?: string;
}

export async function GET() {
  const db = createServiceClient();

  const [{ data: watchdogAlerts }, { data: latestRun }] = await Promise.all([
    db
      .from("agent_alerts")
      .select("id, detected_at, alert_type, station_name, severity, stall_duration_mins, resolved_at")
      .is("resolved_at", null)
      .order("detected_at", { ascending: false })
      .limit(20),
    db
      .from("agent_runs")
      .select("id, ran_at, result_json")
      .order("ran_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const unified: UnifiedAlert[] = [];

  // ── Watchdog alerts ──────────────────────────────────────────────
  for (const a of watchdogAlerts ?? []) {
    const dur = a.stall_duration_mins ? ` — ${Math.round(a.stall_duration_mins)} min` : "";
    unified.push({
      id: `watchdog-${a.id}`,
      agent_alert_id: a.id,
      source: "watchdog",
      detected_at: a.detected_at,
      issue: a.alert_type === "stall"
        ? `Bottleneck at ${a.station_name}${dur}`
        : `Quality spike at ${a.station_name}`,
      severity: a.severity as "critical" | "warning",
      is_watchdog: true,
    });
  }

  // ── Agent run recommendations ────────────────────────────────────
  if (latestRun?.result_json) {
    const r = latestRun.result_json as Record<string, unknown>;
    const agents = r.agents as Record<string, Record<string, unknown>> | undefined;
    const ran_at = latestRun.ran_at as string;

    const agentEntries: Array<{ key: keyof typeof agentSrcMap; issueField: string; sevField?: string }> = [
      { key: "production", issueField: "recommendation", sevField: "severity" },
      { key: "quality",    issueField: "recommendation", sevField: "severity" },
      { key: "planning",   issueField: "recommendation" },
    ];

    const agentSrcMap = {
      production: "production",
      quality:    "quality",
      planning:   "planning",
    } as const;

    for (const { key, issueField, sevField } of agentEntries) {
      const agent = agents?.[key];
      if (!agent || "error" in agent) continue;
      const issue = agent[issueField] as string | undefined;
      if (!issue) continue;
      const rawSev = sevField ? (agent[sevField] as string | undefined) : undefined;
      const severity: UnifiedAlert["severity"] =
        rawSev === "critical" ? "critical" : rawSev === "warning" ? "warning" : "info";

      unified.push({
        id: `run-${latestRun.id}-${key}`,
        source: agentSrcMap[key],
        detected_at: ran_at,
        issue,
        severity,
        is_watchdog: false,
      });
    }
  }

  // Sort: critical first, then by time desc
  unified.sort((a, b) => {
    if (a.severity !== b.severity) {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });

  return NextResponse.json(unified);
}
