import Groq from "groq-sdk";
import { z } from "zod";
import type { AgentContext } from "../compute";

// ── System prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a quality monitoring agent for a manufacturing shop floor.
You receive defect data computed from QR scan events.

Before giving your recommendation, reason through:
- Which station has the highest defect rate and by how much?
- Is the overall defect rate acceptable (under 5%) or a problem?
- What is the likely cause of defects at that station?
- What one action would most reduce defects in the remaining shift hours?

Respond ONLY in JSON matching this schema exactly:
{
  "worst_station": string,
  "worst_station_defect_rate_pct": number,
  "total_defects": number,
  "overall_defect_rate_pct": number,
  "severity": "critical" | "warning" | "ok",
  "trend": "rising" | "stable" | "improving",
  "recommendation": string
}

Severity rules:
- worst_station_defect_rate_pct > 15 → "critical"
- worst_station_defect_rate_pct > 8  → "warning"
- otherwise → "ok"

Be specific and actionable. Name the exact station and the defect rate.
One concrete recommendation, max 1 sentence.`;

// TODO Phase 2: pass last 5 shifts defect history so trend is data-driven not inferred.

// ── Output schema ─────────────────────────────────────────────

const QualitySchema = z.object({
  worst_station:                 z.string(),
  worst_station_defect_rate_pct: z.number(),
  total_defects:                 z.number(),
  overall_defect_rate_pct:       z.number(),
  severity:                      z.enum(["critical", "warning", "ok"]),
  trend:                         z.enum(["rising", "stable", "improving"]),
  recommendation:                z.string(),
});

export type QualityResult = z.infer<typeof QualitySchema>;

// ── Agent ─────────────────────────────────────────────────────

export async function runQualityAgent(context: AgentContext): Promise<QualityResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const stationQuality = context.stations.map((s) => ({
    station_name:     s.station_name,
    units_completed:  s.units_completed,
    defect_count:     s.defect_count,
    defect_rate_pct:  s.defect_rate_pct,
  }));

  const payload = {
    stations: stationQuality,
    shift_totals: {
      total_defects:           context.shift.total_defects,
      overall_defect_rate_pct: context.shift.overall_defect_rate_pct,
      units_completed_total:   context.shift.units_completed_total,
    },
  };

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Quality data:\n${JSON.stringify(payload, null, 2)}\n\nReturn JSON only.` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return QualitySchema.parse(JSON.parse(raw));
}

// ── SELF TEST ─────────────────────────────────────────────────
// Run: npx tsx lib/agent/agents/quality.ts
// Requires: GROQ_API_KEY in environment

import { fileURLToPath } from "url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mockContext: AgentContext = {
    shift_id: "demo-shift-001",
    computed_at: new Date().toISOString(),
    shift: {
      hours_elapsed: 4,
      hours_remaining: 4,
      units_completed_total: 45,
      planned_units_total: 150,
      plan_attainment_pct: 30,
      throughput_per_hour: 11.25,
      projected_eod_units: 90,
      total_defects: 8,
      overall_defect_rate_pct: 17.8,
      total_downtime_mins: 18,
      availability_pct: 92.5,
    },
    stations: [
      { station_name: "SMT Assembly",      target_cycle_mins: 5.5, avg_cycle_mins: 5.8,  units_completed: 60, queue_depth: 1, stall_detected: false, stall_duration_mins: null, defect_count: 1, defect_rate_pct: 1.7,  bottleneck_score: 105, downtime_mins: 0  },
      { station_name: "Soldering",         target_cycle_mins: 6.0, avg_cycle_mins: 6.2,  units_completed: 58, queue_depth: 2, stall_detected: false, stall_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 103, downtime_mins: 0  },
      { station_name: "Visual Inspection", target_cycle_mins: 6.4, avg_cycle_mins: 14.8, units_completed: 30, queue_depth: 5, stall_detected: true,  stall_duration_mins: 22,   defect_count: 8, defect_rate_pct: 26.7, bottleneck_score: 231, downtime_mins: 18 },
      { station_name: "Functional Test",   target_cycle_mins: 6.4, avg_cycle_mins: 6.9,  units_completed: 45, queue_depth: 1, stall_detected: false, stall_duration_mins: null, defect_count: 1, defect_rate_pct: 2.2,  bottleneck_score: 108, downtime_mins: 0  },
      { station_name: "Packaging",         target_cycle_mins: 4.5, avg_cycle_mins: 4.6,  units_completed: 45, queue_depth: 0, stall_detected: false, stall_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 102, downtime_mins: 0  },
    ],
    work_orders: [],
  };

  (async () => {
    const result = await runQualityAgent(mockContext);
    console.log(JSON.stringify(result, null, 2));
  })();
}
