"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, RefreshCw, AlertCircle, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type {
  OrchestratorResult,
  ProductionResult,
  QualityResult,
  PlanningResult,
} from "@/lib/types";

// ── helpers ────────────────────────────────────────────────────────

function isError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

function SeverityBadge({ severity }: { severity: "critical" | "warning" | "ok" }) {
  const map = {
    critical: { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "Critical" },
    warning:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  label: "Warning"  },
    ok:       { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  label: "OK"       },
  };
  const s = map[severity] ?? map.ok;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: `${s.color}30` }}>
      {s.label}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "rising" | "stable" | "improving" }) {
  if (trend === "rising")    return <TrendingUp   size={13} className="text-[#f87171]" />;
  if (trend === "improving") return <TrendingDown  size={13} className="text-[#4ade80]" />;
  return                            <Minus         size={13} className="text-[#fbbf24]" />;
}

function PriorityDot({ priority }: { priority: "critical" | "high" | "normal" }) {
  const c = priority === "critical" ? "#f87171" : priority === "high" ? "#fbbf24" : "var(--muted)";
  return <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 inline-block" style={{ backgroundColor: c }} />;
}

// ── per-agent mini chat ─────────────────────────────────────────────

function AgentChat({ agentLabel, contextSummary }: { agentLabel: string; contextSummary: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer]     = useState("");
  const [streaming, setStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask() {
    const q = question.trim();
    if (!q || streaming) return;
    setQuestion("");
    setAnswer("");
    setStreaming(true);
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `[${agentLabel} context: ${contextSummary}]\n\nQuestion: ${q}`,
        }),
      });
      if (!res.ok || !res.body) {
        setAnswer(res.status === 401 ? "Sign in to use the chat." : "Could not get an answer right now.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch {
      setAnswer("Could not get an answer right now.");
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
      {answer && (
        <p className="text-xs mb-2 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
          {answer}
          {streaming && <Loader2 size={10} className="inline animate-spin ml-1 text-blue-400" />}
        </p>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder={`Ask about ${agentLabel.toLowerCase()}…`}
          disabled={streaming}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none transition-colors disabled:opacity-40"
          style={{
            backgroundColor: "var(--surface2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
        <button onClick={ask} disabled={streaming || !question.trim()}
          className="px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
          style={{ backgroundColor: "#1d4ed8", color: "white" }}>
          {streaming ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
        </button>
      </div>
    </div>
  );
}

// ── row wrapper ─────────────────────────────────────────────────────

function AgentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5 px-5 py-4 border-b last:border-b-0 hover:bg-[var(--surface2)] transition-colors"
      style={{ borderColor: "var(--border)" }}>
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-widest pt-0.5"
        style={{ color: "var(--subtle)" }}>
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── main component ──────────────────────────────────────────────────

export default function ShiftAnalysisPanel() {
  const [result, setResult]       = useState<OrchestratorResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError]         = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/agent/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: "latest" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: OrchestratorResult = await res.json();
      setResult(data);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const prod = result && !isError(result.agents.production) ? result.agents.production as ProductionResult : null;
  const q    = result && !isError(result.agents.quality)    ? result.agents.quality    as QualityResult    : null;
  const p    = result && !isError(result.agents.planning)   ? result.agents.planning   as PlanningResult   : null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-blue-400">✦</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Shift Analysis</span>
          {result?.context_summary && (
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface2)", color: "var(--muted)" }}>
              {result.context_summary.units_completed} units · {result.context_summary.hours_remaining.toFixed(1)}h remaining · {result.context_summary.stations_count} stations
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {updatedAt && <span className="text-xs font-mono" style={{ color: "var(--subtle)" }}>Updated {updatedAt}</span>}
          <button onClick={runAnalysis} disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
            style={{ color: "var(--muted)", borderColor: "var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {loading ? "Running…" : result ? "Re-run" : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* ── States ─────────────────────────────────────────────── */}
      {!result && !loading && !error && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Click <strong>Run Analysis</strong> to analyse the current shift with all 3 agents.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--subtle)" }}>
            Production · Quality · Planning — runs in parallel (~5 sec)
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 px-5 py-10" style={{ color: "var(--muted)" }}>
          <Loader2 size={20} className="animate-spin text-blue-400" />
          <p className="text-sm">Running 3 agents in parallel…</p>
          <p className="text-xs" style={{ color: "var(--subtle)" }}>Production · Quality · Planning</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-5 py-6" style={{ color: "#f87171" }}>
          <AlertCircle size={14} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>

          {/* PRODUCTION (shift summary + bottleneck) */}
          {prod && (
            <AgentRow label="Production">
              {/* Shift summary */}
              <p className="text-sm font-medium leading-snug" style={{ color: "var(--text)" }}>{prod.one_line_summary}</p>
              {prod.top_priority && (
                <p className="text-xs mt-1.5 font-medium" style={{ color: "#60a5fa" }}>→ {prod.top_priority}</p>
              )}
              {prod.handover_notes && (
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{prod.handover_notes}</p>
              )}

              {/* Bottleneck details */}
              <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--subtle)" }}>Bottleneck</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{prod.worst_station}</span>
                <SeverityBadge severity={prod.severity} />
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>score {prod.bottleneck_score}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {prod.avg_cycle_mins.toFixed(1)} min avg · target {prod.target_cycle_mins} min
                {prod.queue_depth > 0 && ` · ${prod.queue_depth} in queue`}
                {prod.stall_detected && prod.stall_duration_mins != null && ` · stalled ${prod.stall_duration_mins.toFixed(0)} min`}
              </p>
              <p className="text-xs mt-1.5 font-medium" style={{ color: "#60a5fa" }}>→ {prod.recommendation}</p>

              <AgentChat agentLabel="Production" contextSummary={
                `${prod.one_line_summary}. Bottleneck: ${prod.worst_station} at ${prod.avg_cycle_mins.toFixed(1)} min vs target ${prod.target_cycle_mins} min. Score: ${prod.bottleneck_score}. Severity: ${prod.severity}. Queue: ${prod.queue_depth}. Recommendation: ${prod.recommendation}`
              } />
            </AgentRow>
          )}

          {/* QUALITY */}
          {q && (
            <AgentRow label="Quality">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{q.worst_station}</span>
                <SeverityBadge severity={q.severity} />
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
                  <TrendIcon trend={q.trend} /> {q.trend}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {q.worst_station_defect_rate_pct.toFixed(1)}% defect rate at worst station · {q.total_defects} total defects · {q.overall_defect_rate_pct.toFixed(1)}% overall
              </p>
              <p className="text-xs mt-1.5 font-medium" style={{ color: "#60a5fa" }}>→ {q.recommendation}</p>
              <AgentChat agentLabel="Quality" contextSummary={
                `Worst station: ${q.worst_station} at ${q.worst_station_defect_rate_pct.toFixed(1)}% defect rate. Total defects: ${q.total_defects}. Overall: ${q.overall_defect_rate_pct.toFixed(1)}%. Trend: ${q.trend}. Recommendation: ${q.recommendation}`
              } />
            </AgentRow>
          )}

          {/* PLANNING */}
          {p && (
            <AgentRow label="Planning">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {p.plan_attainment_pct.toFixed(0)}% attainment
                </span>
                {p.at_risk_work_orders.length > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "#fbbf24" }}>
                    <AlertTriangle size={11} /> {p.at_risk_work_orders.join(", ")} at risk
                  </span>
                )}
                {p.closeable_this_shift && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "#4ade80" }}>
                    <CheckCircle2 size={11} /> gap closeable
                  </span>
                )}
              </div>
              <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                {p.projected_eod_units} projected · {p.planned_units} planned · {p.gap_units > 0 ? `${p.gap_units} unit gap` : "on track"}
              </p>
              {p.recommended_sequence.length > 0 && (
                <div className="flex flex-col gap-1 mb-2">
                  {p.recommended_sequence.map((wo, i) => (
                    <div key={wo.wo_number} className="flex items-start gap-2 text-xs">
                      <span className="font-mono shrink-0" style={{ color: "var(--subtle)" }}>{i + 1}.</span>
                      <PriorityDot priority={wo.customer_priority} />
                      <span className="font-semibold shrink-0" style={{ color: "var(--text)" }}>{wo.wo_number}</span>
                      <span style={{ color: "var(--muted)" }}>{wo.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs font-medium" style={{ color: "#60a5fa" }}>→ {p.recommendation}</p>
              <AgentChat agentLabel="Planning" contextSummary={
                `Plan attainment: ${p.plan_attainment_pct.toFixed(0)}%. Projected EOD: ${p.projected_eod_units} vs ${p.planned_units} planned. Gap: ${p.gap_units} units. At risk: ${p.at_risk_work_orders.join(", ")}. Recommendation: ${p.recommendation}`
              } />
            </AgentRow>
          )}
        </div>
      )}
    </div>
  );
}
