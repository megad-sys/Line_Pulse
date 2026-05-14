"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useDemoMode } from "@/lib/demo-context";
import AgentActionCard from "@/components/agent-action-card";
import ActionTrackerTable from "@/components/action-tracker-table";
import type { AgentAction, OrchestratorResult, ProductionResult, QualityResult, PlanningResult } from "@/lib/types";
import type { UnifiedAlert } from "@/app/api/agent/alerts/route";

// ── helpers ───────────────────────────────────────────────────────────

function isError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function orchToActions(result: OrchestratorResult): Record<string, AgentAction[]> {
  const prod = !isError(result.agents.production) ? (result.agents.production as ProductionResult) : null;
  const qual = !isError(result.agents.quality)    ? (result.agents.quality    as QualityResult)    : null;
  const plan = !isError(result.agents.planning)   ? (result.agents.planning   as PlanningResult)   : null;
  const summary = result.context_summary;

  return {
    production: prod ? [{
      id: `prod-${result.computed_at}`,
      shiftId:           result.shift_id,
      severity:          prod.severity,
      worstStation:      prod.worst_station,
      bottleneckScore:   prod.bottleneck_score,
      actionRequired:    prod.action_required,
      recommendedAction: prod.recommended_action,
      timestamp: timeAgo(result.computed_at),
      dataSource: `${summary.stations_count} stations · ${summary.units_completed} units completed · ${summary.hours_remaining.toFixed(1)}h remaining`,
      analysis: prod.one_line_summary + (prod.handover_notes ? " " + prod.handover_notes : ""),
      recommendations: [
        {
          id: "r1",
          option: prod.recommendation,
          predictedImpact: `Severity: ${prod.severity}`,
          details: `Worst station: ${prod.worst_station}, avg ${prod.avg_cycle_mins.toFixed(1)}min vs target ${prod.target_cycle_mins}min`,
        },
        {
          id: "r2",
          option: "Escalate to floor manager for manual assessment",
          predictedImpact: "Human oversight applied",
          details: "Recommended when automated reallocation is not possible",
        },
      ],
      status: prod.action_required ? "pending-approval" : "completed",
      actualResult: prod.action_required ? undefined : "No immediate action required this shift.",
    }] : [],

    quality: qual ? [{
      id: `qual-${result.computed_at}`,
      shiftId:        result.shift_id,
      severity:       qual.severity,
      worstStation:   qual.worst_station,
      actionRequired: qual.severity !== "ok",
      timestamp: timeAgo(result.computed_at),
      dataSource: `${summary.stations_count} stations monitored`,
      analysis: `Worst station: ${qual.worst_station} at ${qual.worst_station_defect_rate_pct.toFixed(1)}% defect rate. ${qual.total_defects} total defects. Overall: ${qual.overall_defect_rate_pct.toFixed(1)}%. Trend: ${qual.trend}.`,
      recommendations: [
        {
          id: "r1",
          option: qual.recommendation,
          predictedImpact: `Severity: ${qual.severity}`,
          details: `Defect trend is ${qual.trend}`,
        },
        {
          id: "r2",
          option: "Flag for quality review at next shift handover",
          predictedImpact: "Audit trail created",
          details: "No immediate production interruption",
        },
      ],
      status: qual.severity === "ok" ? "completed" : "pending-approval",
      actualResult: qual.severity === "ok" ? "Quality within acceptable range." : undefined,
    }] : [],

    planning: plan ? [{
      id: `plan-${result.computed_at}`,
      shiftId:        result.shift_id,
      actionRequired: plan.gap_units > 0,
      timestamp: timeAgo(result.computed_at),
      dataSource: `${plan.at_risk_work_orders.length} work orders at risk`,
      analysis: `Plan attainment: ${plan.plan_attainment_pct.toFixed(0)}%. Projected ${plan.projected_eod_units} vs ${plan.planned_units} planned. Gap: ${plan.gap_units} units. Closeable this shift: ${plan.closeable_this_shift ? "Yes" : "No"}.`,
      recommendations: plan.recommended_sequence.slice(0, 3).map((wo, i) => ({
        id: `r${i + 1}`,
        option: `Prioritise ${wo.wo_number} — ${wo.customer_name} (${wo.customer_priority})`,
        predictedImpact: wo.reason,
        details: `Customer priority: ${wo.customer_priority}`,
      })),
      status: plan.gap_units > 0 ? "pending-approval" : "completed",
      actualResult: plan.gap_units === 0 ? "Plan on track. No resequencing needed." : undefined,
    }] : [],
  };
}

function alertsToActions(alerts: UnifiedAlert[]): AgentAction[] {
  return alerts
    .filter((a) => a.is_watchdog)
    .map((a) => ({
      id: `watchdog-${a.id}`,
      timestamp: timeAgo(a.detected_at),
      dataSource: "Watchdog monitor — real-time scan event stream",
      analysis: a.issue,
      recommendations: [
        {
          id: "r1",
          option: "Acknowledge and resolve this alert",
          predictedImpact: "Alert cleared from active list",
          details: `Alert ID: ${a.agent_alert_id ?? a.id}`,
        },
      ],
      status: "pending-approval" as const,
    }));
}

// ── Demo data ─────────────────────────────────────────────────────────

const DEMO_ACTIONS: Record<string, AgentAction[]> = {
  production: [{
    id: "demo-prod-1",
    shiftId: "demo-shift-1",
    timestamp: "2 min ago",
    dataSource: "5 stations · 45 units completed · 4.0h remaining",
    analysis: "Visual Inspection is running at 14.8min avg vs 6.4min target — 131% over cycle. 5 units queued, machine down for 18min this shift. Throughput loss estimated at ~6 units.",
    recommendations: [
      { id: "r1", option: "Redeploy operator from Packaging (idle) to Visual Inspection to clear 5-unit queue", predictedImpact: "Severity: critical", details: "Packaging WIP is 0 — operator can be spared for this shift segment" },
      { id: "r2", option: "Reduce batch size entering Visual Inspection to 1 unit at a time", predictedImpact: "Prevents further queue growth", details: "Buffer control reduces downstream pressure on Functional Test" },
      { id: "r3", option: "Escalate to floor manager for downtime root cause investigation", predictedImpact: "Human oversight — downtime prevented", details: "18min downtime this shift warrants engineering review" },
    ],
    status: "pending-approval",
    severity:          "critical",
    worstStation:      "Visual Inspection",
    bottleneckScore:   231,
    actionRequired:    true,
    recommendedAction: "escalate",
  }],
  quality: [{
    id: "demo-qual-1",
    timestamp: "2 min ago",
    dataSource: "5 stations monitored",
    analysis: "Visual Inspection has 26.7% defect rate (8 defects / 30 exits). Operator B scanning Part A4829 accounts for 6 of the 8 flags. Pattern suggests operator skill gap or bad material lot.",
    recommendations: [
      { id: "r1", option: "Isolate Part A4829 lot — hold remaining units for material verification before continuing", predictedImpact: "Prevents ~12 further defects if bad lot confirmed", details: "6 of 8 defects correlate with this part number" },
      { id: "r2", option: "Pair Operator B with senior operator for remainder of shift", predictedImpact: "Reduces skill-gap defects by ~70%", details: "Last 3 shifts show pattern on Operator B only" },
      { id: "r3", option: "Flag for quality review at next shift handover", predictedImpact: "Audit trail created, no production interruption", details: "Low-impact option if rate stays below 30%" },
    ],
    status: "pending-approval",
  }],
  planning: [{
    id: "demo-plan-1",
    timestamp: "2 min ago",
    dataSource: "3 work orders at risk",
    analysis: "Plan attainment 30%. Projected 90 vs 150 planned. Gap: 60 units. WO-0048 (Acme Corp — critical customer) is 3 days late with 45 units remaining. Closeable this shift with resequencing.",
    recommendations: [
      { id: "r1", option: "Prioritise WO-0048 Acme Corp — move to front of Visual Inspection queue immediately", predictedImpact: "Recovers 2-day lateness by EOD", details: "Critical customer — SLA penalty risk if not shipped today" },
      { id: "r2", option: "Split WO-0048 remainder across 2 operators in parallel", predictedImpact: "Cuts remaining cycle by 40%", details: "Requires temporary redeployment from WO-0051" },
      { id: "r3", option: "Notify customer of 1-day delay and replan for next shift", predictedImpact: "Manages expectation, avoids quality rushing", details: "Use only if Visual Inspection bottleneck cannot be resolved" },
    ],
    status: "pending-approval",
  }],
};

// ── Agent definitions ─────────────────────────────────────────────────

const AGENTS = [
  {
    id: "production",
    label: "Production",
    description: "Bottleneck detection and resource reallocation",
    monitoring: ["Cycle times across stations", "Operator utilisation", "WIP levels", "Queue depths"],
  },
  {
    id: "quality",
    label: "Quality",
    description: "Defect pattern learning and preventive intervention",
    monitoring: ["Defect rates by shift/operator/part", "Environmental conditions", "Material lot performance"],
  },
  {
    id: "planning",
    label: "Planning",
    description: "Dynamic work order sequencing and priority optimisation",
    monitoring: ["Customer due dates", "Bottleneck forecasts", "WO completion rates", "Resource availability"],
  },
];

// ── Component ─────────────────────────────────────────────────────────

export default function AiAgentPanel() {
  const { isDemo } = useDemoMode();
  const [activeAgent, setActiveAgent] = useState("production");
  const [actions, setActions] = useState<Record<string, AgentAction[]>>({
    production: [], quality: [], planning: [],
  });
  const [contextPill, setContextPill] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRan, setLastRan] = useState<string | null>(null);
  const [trackerRefresh, setTrackerRefresh] = useState(0);

  const runAnalysis = useCallback(async () => {
    if (isDemo) {
      setActions(DEMO_ACTIONS);
      setContextPill("Demo · 5 stations · 45 units");
      return;
    }
    setLoading(true);
    try {
      const [analyseRes, alertsRes] = await Promise.all([
        apiFetch("/api/agent/analyse", { method: "POST", body: JSON.stringify({ shiftId: "latest" }) }),
        apiFetch("/api/agent/alerts"),
      ]);
      if (analyseRes.ok) {
        const result: OrchestratorResult = await analyseRes.json();
        const mapped = orchToActions(result);
        if (alertsRes.ok) {
          const alerts: UnifiedAlert[] = await alertsRes.json();
          const watchdogActions = alertsToActions(alerts);
          mapped.production = [...watchdogActions, ...mapped.production];
        }
        setActions(mapped);
        const s = result.context_summary;
        setContextPill(`${s.units_completed} units · ${s.stations_count} stations · ${s.hours_remaining.toFixed(1)}h left`);
        setLastRan(result.computed_at);
      }
    } catch { /* keep stale */ } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  function handleApprove(actionId: string, recId: string, customInstruction?: string) {
    setTrackerRefresh((n) => n + 1);
    setActions((prev) => {
      const next = { ...prev };
      for (const agentId of Object.keys(next)) {
        next[agentId] = next[agentId].map((a) => {
          if (a.id !== actionId) return a;
          const rec = recId === "custom" && customInstruction
            ? { id: "custom", option: customInstruction, predictedImpact: "Custom instruction", details: "" }
            : a.recommendations.find((r) => r.id === recId);
          return { ...a, status: "executing" as const, selectedRecommendation: rec };
        });
      }
      return next;
    });
    setTimeout(() => {
      setActions((prev) => {
        const next = { ...prev };
        for (const agentId of Object.keys(next)) {
          next[agentId] = next[agentId].map((a) => {
            if (a.id !== actionId) return a;
            return {
              ...a,
              status: "completed" as const,
              actualResult: a.selectedRecommendation
                ? `Approved: "${a.selectedRecommendation.option}"`
                : "Action completed.",
            };
          });
        }
        return next;
      });
    }, 2000);
  }

  const agent = AGENTS.find((a) => a.id === activeAgent)!;
  const agentActions = actions[activeAgent] ?? [];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <Bot size={16} style={{ color: "#60a5fa" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>AI Agents</h2>
          {contextPill && (
            <span className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: "var(--muted)", borderColor: "var(--border)", backgroundColor: "var(--surface2)" }}>
              {contextPill}
            </span>
          )}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Analysing…" : lastRan ? `Re-run · ${timeAgo(lastRan)}` : "Run Analysis"}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {AGENTS.map((a) => {
          const isActive = activeAgent === a.id;
          const pending = (actions[a.id] ?? []).filter((x) => x.status === "pending-approval").length;
          return (
            <button
              key={a.id}
              onClick={() => setActiveAgent(a.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors relative"
              style={{
                color: isActive ? "#60a5fa" : "var(--muted)",
                borderBottom: isActive ? "2px solid #60a5fa" : "2px solid transparent",
                backgroundColor: "transparent",
              }}>
              {a.label}
              {pending > 0 && (
                <span className="text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#fbbf24", color: "#000" }}>
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-4">

        {/* Description + monitoring chips */}
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: "var(--muted)" }}>{agent.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Monitoring:
            </span>
            {agent.monitoring.map((chip) => (
              <span key={chip}
                className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{ color: "var(--muted)", borderColor: "var(--border)", backgroundColor: "var(--surface2)" }}>
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* Execution layer notice for non-production agents */}
        {(activeAgent === "quality" || activeAgent === "planning") && (
          <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
            style={{ borderColor: "#854d0e", backgroundColor: "#1c1003" }}>
            <span className="text-xs mt-px">⚠️</span>
            <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
              <span className="font-semibold">Execution layer not connected.</span>{" "}
              This agent can surface recommendations but cannot act on them automatically.
              The Production agent is the only agent currently wired to an execution layer (Slack notifications).
              Slack integration for this agent is coming soon.
            </p>
          </div>
        )}

        {/* Agent Activity */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Agent Activity</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
              Data → Analysis → Recommendations → Approval
            </p>
          </div>

          {agentActions.length === 0 ? (
            <div className="rounded-xl border py-10 flex flex-col items-center gap-2"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface2)" }}>
              <Bot size={24} style={{ color: "var(--muted)" }} />
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {loading ? "Analysing shift data…" : "No activity yet — run analysis to start."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {agentActions.map((action) => (
                <AgentActionCard
                  key={action.id}
                  action={action}
                  agentId={activeAgent}
                  onApprove={handleApprove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Operational Action Log — DB source of truth */}
        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <ActionTrackerTable
            agentType={activeAgent}
            refreshTrigger={trackerRefresh}
          />
        </div>
      </div>
    </div>
  );
}
