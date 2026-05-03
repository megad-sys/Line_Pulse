"use client";

import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";
import type { AIInsight, InsightType } from "@/lib/types";
import { mockInsights } from "@/lib/mock-data";
import { useDemoMode } from "@/lib/demo-context";
import { apiFetch } from "@/lib/api";

const CARD_CONFIG: Record<InsightType, { border: string; bg: string; icon: React.ReactNode; label: string; labelColor: string }> = {
  critical: { border: "border-l-red-500",   bg: "bg-red-50/40",   icon: <AlertCircle   size={14} className="text-red-500   shrink-0 mt-0.5" />, label: "Critical", labelColor: "text-red-600"   },
  warning:  { border: "border-l-amber-500", bg: "bg-amber-50/40", icon: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />, label: "Warning",  labelColor: "text-amber-600" },
  info:     { border: "border-l-blue-500",  bg: "bg-blue-50/40",  icon: <Info          size={14} className="text-blue-500  shrink-0 mt-0.5" />, label: "Info",     labelColor: "text-blue-600"  },
  positive: { border: "border-l-green-500", bg: "bg-green-50/40", icon: <CheckCircle2  size={14} className="text-green-500 shrink-0 mt-0.5" />, label: "Good",     labelColor: "text-green-600" },
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
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--surface)", color: "var(--text)" }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-400 text-lg">✦</span>
            <h2 className="text-lg font-bold tracking-tight">Johnny on the Spot</h2>
          </div>
          <p className="text-sm text-gray-400">Analysing your floor in real time</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {updatedAt && <span className="text-xs text-gray-500 font-mono">Updated {updatedAt}</span>}
          <button onClick={loadInsights} disabled={loading}
            className="text-xs transition-colors px-2 py-1 rounded border"
            style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-6 text-gray-500">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <p className="text-sm">Generating insights…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {insights.map((insight, i) => {
            const { border, bg, icon, label, labelColor } = CARD_CONFIG[insight.type] ?? CARD_CONFIG.info;
            const detail = insight.detail ?? insight.body ?? "";
            return (
              <div key={i} className={`border-l-4 ${border} ${bg} rounded-r-lg p-3.5 bg-white/5 border border-white/5`}>
                <div className="flex items-start gap-2">
                  {icon}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</span>
                    <p className="text-sm font-semibold text-white mt-1 mb-1.5 leading-snug">{insight.title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{detail}</p>
                    {insight.action && <p className="text-xs text-blue-400 mt-2 font-medium">→ {insight.action}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
