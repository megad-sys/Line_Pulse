"use client";

import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";
import type { AIInsight, InsightType } from "@/lib/types";
import { mockInsights } from "@/lib/mock-data";
import { useDemoMode } from "@/lib/demo-context";
import { apiFetch } from "@/lib/api";

const SEV_CONFIG: Record<InsightType, { icon: React.ReactNode; label: string; color: string; dot: string }> = {
  critical: { icon: <AlertCircle  size={13} />, label: "Critical", color: "#f87171", dot: "bg-[#f87171]" },
  warning:  { icon: <AlertTriangle size={13} />, label: "Warning",  color: "#fbbf24", dot: "bg-[#fbbf24]" },
  info:     { icon: <Info          size={13} />, label: "Info",     color: "#60a5fa", dot: "bg-[#60a5fa]" },
  positive: { icon: <CheckCircle2  size={13} />, label: "Good",     color: "#4ade80", dot: "bg-[#4ade80]" },
};

export default function AIInsightsPanel() {
  const { isDemo } = useDemoMode();
  const [insights, setInsights]   = useState<AIInsight[]>([]);
  const [loading, setLoading]     = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    if (isDemo) {
      setInsights(mockInsights);
      setLoading(false);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      return;
    }
    loadInsights();
  }, [isDemo]);

  async function loadInsights() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("insights failed");
      const data = await res.json();
      setInsights(data.insights ?? []);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setInsights(mockInsights);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-blue-400">✦</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Insights</span>
          {insights.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: "var(--surface2)", color: "var(--muted)" }}>
              {insights.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs font-mono" style={{ color: "var(--subtle)" }}>Updated {updatedAt}</span>}
          <button onClick={loadInsights} disabled={loading}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
            {loading ? <Loader2 size={11} className="animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-3 px-5 py-8" style={{ color: "var(--muted)" }}>
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <span className="text-sm">Generating insights…</span>
        </div>
      ) : insights.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>No insights yet — run the agent to analyse this shift.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {insights.map((insight, i) => {
            const cfg = SEV_CONFIG[insight.type] ?? SEV_CONFIG.info;
            const detail = insight.detail ?? insight.body ?? "";
            return (
              <div key={i} className="flex items-start gap-4 px-5 py-3.5 hover:bg-[var(--surface2)] transition-colors">
                {/* Severity indicator */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5 w-20">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>{insight.title}</p>
                  {detail && (
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>{detail}</p>
                  )}
                  {insight.action && (
                    <p className="text-xs mt-1.5 font-medium" style={{ color: "#60a5fa" }}>→ {insight.action}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
