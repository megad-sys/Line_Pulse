"use client";

import { useState } from "react";
import { Database, TrendingUp, ThumbsUp, CheckCircle2, Loader2, PenLine, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AgentAction, AgentActionState, Recommendation } from "@/lib/types";

interface AgentActionCardProps {
  action: AgentAction;
  agentId: string;
  onApprove: (actionId: string, recommendationId: string, customInstruction?: string) => void;
}

function StatusPill({ status }: { status: AgentActionState }) {
  if (status === "pending-approval") {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
        style={{ color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)" }}>
        ⚠ Awaiting Approval
      </span>
    );
  }
  if (status === "executing") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border"
        style={{ color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.3)" }}>
        <Loader2 size={10} className="animate-spin" /> Executing…
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: "#4ade80", backgroundColor: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)" }}>
      ✓ Completed
    </span>
  );
}

export default function AgentActionCard({ action, agentId, onApprove }: AgentActionCardProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    execution_result: string;
    actions_taken: string[];
    tools_used: string[];
  } | null>(null);

  async function handleApproveRec(rec: Recommendation) {
    setApprovingId(rec.id);
    setApproveError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch("/api/agent/actions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: rec.option,
          approvedBy: user?.email ?? "operator",
          agentType: agentId,
          shiftId: action.shiftId ?? null,
          agentResult: {
            severity:           action.severity,
            worst_station:      action.worstStation,
            bottleneck_score:   action.bottleneckScore,
            action_required:    action.actionRequired,
            recommended_action: action.recommendedAction,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error("Approve failed:", err);
        setApproveError(err.error ?? "Approval failed — please try again.");
        setApprovingId(null);
        return;
      }

      const data = await res.json() as {
        execution_result: string;
        actions_taken: string[];
        tools_used: string[];
      };
      setExecutionResult(data);
      onApprove(action.id, rec.id);
    } catch (err) {
      console.error("Approve failed:", err);
      setApproveError("Network error — please try again.");
    }
    setApprovingId(null);
  }

  async function handleSubmitCustom() {
    if (!customText.trim()) return;
    setApprovingId("custom");
    setApproveError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch("/api/agent/actions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: customText.trim(),
          approvedBy: user?.email ?? "operator",
          agentType: agentId,
          customInstruction: customText.trim(),
          shiftId: action.shiftId ?? null,
          agentResult: {
            severity:           action.severity,
            worst_station:      action.worstStation,
            bottleneck_score:   action.bottleneckScore,
            action_required:    action.actionRequired,
            recommended_action: action.recommendedAction,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error("Approve failed:", err);
        setApproveError(err.error ?? "Approval failed — please try again.");
        setApprovingId(null);
        return;
      }

      const data = await res.json() as {
        execution_result: string;
        actions_taken: string[];
        tools_used: string[];
      };
      setExecutionResult(data);
      onApprove(action.id, "custom", customText.trim());
      setCustomText("");
      setShowCustom(false);
    } catch (err) {
      console.error("Approve failed:", err);
      setApproveError("Network error — please try again.");
    }
    setApprovingId(null);
  }

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={action.status} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>{action.timestamp}</span>
      </div>

      {/* Data Collected */}
      <div className="flex items-start gap-2">
        <Database size={14} className="shrink-0 mt-0.5" style={{ color: "#60a5fa" }} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>
            Data Collected
          </p>
          <p className="text-xs" style={{ color: "var(--text)" }}>{action.dataSource}</p>
        </div>
      </div>

      {/* Analysis */}
      <div className="flex items-start gap-2">
        <TrendingUp size={14} className="shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>
            Analysis
          </p>
          <p className="text-xs" style={{ color: "var(--text)" }}>{action.analysis}</p>
        </div>
      </div>

      {/* Recommendations — only when pending */}
      {action.status === "pending-approval" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <ThumbsUp size={13} style={{ color: "#fbbf24" }} />
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Recommendations
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {action.recommendations.map((rec, i) => (
              <div key={rec.id} className="rounded-lg border p-3 flex flex-col gap-1.5"
                style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded self-start"
                      style={{ color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)" }}>
                      Option {i + 1}
                    </span>
                    <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{rec.option}</p>
                    <p className="text-[11px]" style={{ color: "#4ade80" }}>{rec.predictedImpact}</p>
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>{rec.details}</p>
                  </div>
                  <button
                    onClick={() => handleApproveRec(rec)}
                    disabled={approvingId !== null}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: "#1d4ed8" }}>
                    {approvingId === rec.id ? "…" : "Approve →"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Custom instruction */}
          <div className="mt-1">
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--muted)" }}>
                <PenLine size={11} /> Enter custom instruction instead
              </button>
            ) : (
              <div className="rounded-lg border p-3 flex flex-col gap-2"
                style={{ backgroundColor: "var(--surface2)", borderColor: "rgba(96,165,250,0.25)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#60a5fa" }}>
                  Custom Instruction
                </p>
                <textarea
                  rows={3}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Describe the action you want the agent to take…"
                  className="w-full text-xs rounded-md border px-3 py-2 resize-none outline-none"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitCustom();
                    if (e.key === "Escape") { setShowCustom(false); setCustomText(""); }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>⌘↵ to submit · Esc to cancel</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowCustom(false); setCustomText(""); }}
                      className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ color: "var(--muted)", border: "1px solid var(--border)" }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitCustom}
                      disabled={!customText.trim() || approvingId !== null}
                      className="text-xs font-semibold px-3 py-1 rounded-lg text-white transition-opacity disabled:opacity-40"
                      style={{ backgroundColor: "#1d4ed8" }}>
                      {approvingId === "custom" ? "…" : "Submit →"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Approve error */}
          {approveError && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ backgroundColor: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.25)" }}>
              <AlertCircle size={13} style={{ color: "#f87171" }} />
              <p className="text-xs" style={{ color: "#f87171" }}>{approveError}</p>
            </div>
          )}
        </div>
      )}

      {/* AI Recommendation — shown when executing or completed */}
      {(action.status === "executing" || action.status === "completed") && action.selectedRecommendation && (
        <div className="rounded-lg border p-3 flex flex-col gap-1"
          style={{ backgroundColor: "rgba(74,222,128,0.07)", borderColor: "rgba(74,222,128,0.25)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#4ade80" }}>
            AI Recommendation
          </p>
          <p className="text-xs" style={{ color: "var(--text)" }}>{action.selectedRecommendation.option}</p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>
            Pending human follow-through — the system cannot carry this out automatically.
          </p>
        </div>
      )}

      {/* Executing spinner */}
      {action.status === "executing" && (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ backgroundColor: "rgba(96,165,250,0.07)", borderColor: "rgba(96,165,250,0.2)" }}>
          <Loader2 size={13} className="animate-spin" style={{ color: "#60a5fa" }} />
          <p className="text-xs" style={{ color: "#60a5fa" }}>Executing action on shop floor…</p>
        </div>
      )}

      {/* System Actions Executed — only when completed */}
      {action.status === "completed" && (
        <div className="flex flex-col gap-1.5">
          {executionResult && executionResult.actions_taken.length > 0 ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                System Actions Executed
              </p>
              <div className="flex flex-col gap-1">
                {executionResult.actions_taken.map((a, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 size={12} className="shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                    <p className="text-xs" style={{ color: "var(--text)" }}>{a}</p>
                  </div>
                ))}
              </div>
              {executionResult.tools_used.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {executionResult.tools_used.map((t) => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : action.actualResult ? (
            /* Pre-completed cards (e.g. no action required) — no executor ran */
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
              <p className="text-xs" style={{ color: "var(--text)" }}>{action.actualResult}</p>
            </div>
          ) : null}

          {action.savings && (
            <div className="rounded-lg border px-3 py-2"
              style={{ backgroundColor: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.25)" }}>
              <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Savings: {action.savings}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
