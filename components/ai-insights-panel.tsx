"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Send,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { AIInsight, InsightType } from "@/lib/types";
import { mockInsights } from "@/lib/mock-data";

const config: Record<
  InsightType,
  { border: string; bg: string; icon: React.ReactNode; label: string; labelColor: string }
> = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-50/60",
    icon: <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />,
    label: "Critical",
    labelColor: "text-red-600",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-50/60",
    icon: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />,
    label: "Warning",
    labelColor: "text-amber-600",
  },
  info: {
    border: "border-l-blue-500",
    bg: "bg-blue-50/60",
    icon: <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />,
    label: "Info",
    labelColor: "text-blue-600",
  },
  positive: {
    border: "border-l-green-500",
    bg: "bg-green-50/60",
    icon: <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />,
    label: "Good",
    labelColor: "text-green-600",
  },
};

export default function AIInsightsPanel() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    fetchInsights();
  }, []);

  async function fetchInsights(q?: string) {
    if (q) setAsking(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) throw new Error("insights failed");
      const data = await res.json();
      setInsights(data.insights ?? []);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      if (insights.length === 0) setInsights(mockInsights);
    } finally {
      setLoading(false);
      setAsking(false);
      setQuestion("");
    }
  }

  function handleAsk() {
    const q = question.trim();
    if (!q || asking) return;
    fetchInsights(q);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={15} className="text-indigo-500" />
        <h2 className="font-semibold text-gray-900 text-sm">AI Insights</h2>
        {updatedAt && (
          <span className="ml-auto text-xs text-gray-400 font-mono">
            Live · {updatedAt}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
            <Loader2 size={20} className="animate-spin text-indigo-400" />
            <p className="text-xs">Generating insights...</p>
          </div>
        ) : (
          insights.map((insight, i) => {
            const { border, bg, icon, label, labelColor } = config[insight.type];
            return (
              <div
                key={i}
                className={`border-l-4 ${border} ${bg} rounded-r-lg p-3 border border-gray-100`}
              >
                <div className="flex items-start gap-2">
                  {icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-400 font-mono ml-auto">
                        {insight.time}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-1 leading-snug">
                      {insight.title}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">{insight.body}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask AI about your production floor..."
            className="flex-1 text-sm bg-transparent outline-none text-gray-600 placeholder:text-gray-400"
            disabled={asking}
          />
          <button
            onClick={handleAsk}
            disabled={asking || !question.trim()}
            className="text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
          >
            {asking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
