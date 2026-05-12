"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useDemoMode } from "@/lib/demo-context";
import type { UnifiedAlert } from "@/app/api/agent/alerts/route";

type Severity = "critical" | "warning" | "ok";

const SEV_STYLE: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", label: "Critical" },
  warning:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  label: "Warning"  },
  ok:       { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)",  label: "OK"       },
};

const DEMO_STATUS: Record<string, Severity> = {
  production: "critical",
  quality:    "warning",
  planning:   "ok",
};

const AGENT_LABELS: Record<string, string> = {
  production: "Production",
  quality:    "Quality",
  planning:   "Planning",
};

interface Props {
  onViewAgents: () => void;
}

export default function AgentPulseStrip({ onViewAgents }: Props) {
  const { isDemo } = useDemoMode();
  const [status, setStatus] = useState<Record<string, Severity> | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setStatus(DEMO_STATUS);
      setHasData(true);
      return;
    }
    apiFetch("/api/agent/alerts")
      .then((res) => res.json())
      .then((alerts: UnifiedAlert[]) => {
        if (!alerts.length) { setHasData(false); return; }
        const maxSev: Record<string, Severity> = { production: "ok", quality: "ok", planning: "ok" };
        const order: Severity[] = ["critical", "warning", "ok"];
        for (const a of alerts) {
          const src = a.source === "watchdog" ? "production" : a.source;
          const cur = maxSev[src] ?? "ok";
          const incoming = (a.severity === "critical" || a.severity === "warning") ? a.severity : "ok";
          if (order.indexOf(incoming) < order.indexOf(cur)) {
            maxSev[src] = incoming;
          }
        }
        setStatus(maxSev);
        setHasData(true);
      })
      .catch(() => setHasData(false));
  }, [isDemo]);

  if (!hasData && !isDemo) {
    return (
      <div className="rounded-xl border px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Bot size={14} style={{ color: "var(--muted)" }} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>Agents: not yet run</span>
        </div>
        <button onClick={onViewAgents}
          className="text-xs font-semibold"
          style={{ color: "#60a5fa" }}>
          Run first analysis →
        </button>
      </div>
    );
  }

  const agentKeys = ["production", "quality", "planning"];

  return (
    <div className="rounded-xl border px-5 py-3 flex items-center justify-between"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-3">
        <Bot size={14} style={{ color: "#60a5fa" }} />
        <div className="flex items-center gap-2">
          {agentKeys.map((key) => {
            const sev: Severity = status?.[key] ?? "ok";
            const s = SEV_STYLE[sev];
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  {AGENT_LABELS[key]}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                  style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onViewAgents}
        className="text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ color: "#60a5fa" }}>
        View Agents →
      </button>
    </div>
  );
}
