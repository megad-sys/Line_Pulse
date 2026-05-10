import Groq from "groq-sdk";
import { z } from "zod";
import type { AgentContext } from "../compute";

// ── System prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a production intelligence agent for a manufacturing shop floor.
You are responsible for two things: (1) identifying the worst bottleneck on the floor, and (2) writing a concise shift briefing.

Before responding, reason through:
- Which station has the highest bottleneck_score or the longest active stall?
- What is the single most important action your team can take in the next 30 minutes?
- What does the incoming shift need to know to avoid repeating today's problems?

Respond ONLY in JSON matching this schema exactly:
{
  "one_line_summary": string,
  "top_priority": string,
  "action_required": boolean,
  "handover_notes": string,
  "worst_station": string,
  "avg_cycle_mins": number,
  "target_cycle_mins": number,
  "bottleneck_score": number,
  "severity": "critical" | "warning" | "ok",
  "bottleneck_detected": boolean,
  "bottleneck_duration_mins": number | null,
  "wip_count": number,
  "recommendation": string
}

Rules:
- one_line_summary: entire shift in one sentence — include actual numbers (units, rate, defects)
- top_priority: the single most important action right now — name the exact station or work order
- action_required: true if any station is stalled, plan attainment < 80%, or defect rate > 10%
- handover_notes: max 3 sentences for the incoming shift — direct, no padding
- worst_station: station with the highest bottleneck_score
- bottleneck_score > 200 → severity "critical", > 150 → "warning", else "ok"
- recommendation: one concrete sentence — name the exact station and what to do

Write like a senior floor manager. Direct, no jargon, no filler.
Name exact stations, work orders, and operators where relevant.`;

// ── Output schema ─────────────────────────────────────────────

const ProductionSchema = z
  .object({
    one_line_summary:        z.string(),
    top_priority:            z.string(),
    action_required:         z.boolean(),
    handover_notes:          z.string(),
    worst_station:           z.string(),
    avg_cycle_mins:          z.number(),
    target_cycle_mins:       z.number(),
    bottleneck_score:        z.number(),
    severity:                z.enum(["critical", "warning", "ok"]),
    bottleneck_detected:     z.boolean(),
    bottleneck_duration_mins: z.number().nullable(),
    wip_count:               z.number(),
    recommendation:          z.string(),
  })
  .refine(
    (d) => {
      if (d.bottleneck_score > 200) return d.severity === "critical";
      if (d.bottleneck_score > 150) return d.severity === "warning";
      return d.severity === "ok";
    },
    { message: "severity does not match bottleneck_score" }
  );

export type ProductionResult = z.infer<typeof ProductionSchema>;

// ── Agent ─────────────────────────────────────────────────────

export async function runProductionAgent(context: AgentContext): Promise<ProductionResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Full shift context:\n${JSON.stringify(context, null, 2)}\n\nReturn JSON only.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 700,
    temperature: 0.25,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return ProductionSchema.parse(JSON.parse(raw));
}

// ── SELF TEST ─────────────────────────────────────────────────
// Run: npx tsx lib/agent/agents/production.ts
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
      { station_name: "SMT Assembly",      target_cycle_mins: 5.5, avg_cycle_mins: 5.8,  units_completed: 60, wip_count: 1, bottleneck_detected: false, bottleneck_duration_mins: null, defect_count: 1, defect_rate_pct: 1.7,  bottleneck_score: 105, downtime_mins: 0  },
      { station_name: "Soldering",         target_cycle_mins: 6.0, avg_cycle_mins: 6.2,  units_completed: 58, wip_count: 2, bottleneck_detected: false, bottleneck_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 103, downtime_mins: 0  },
      { station_name: "Visual Inspection", target_cycle_mins: 6.4, avg_cycle_mins: 14.8, units_completed: 30, wip_count: 5, bottleneck_detected: true,  bottleneck_duration_mins: 22,   defect_count: 8, defect_rate_pct: 26.7, bottleneck_score: 231, downtime_mins: 18 },
      { station_name: "Functional Test",   target_cycle_mins: 6.4, avg_cycle_mins: 6.9,  units_completed: 45, wip_count: 1, bottleneck_detected: false, bottleneck_duration_mins: null, defect_count: 1, defect_rate_pct: 2.2,  bottleneck_score: 108, downtime_mins: 0  },
      { station_name: "Packaging",         target_cycle_mins: 4.5, avg_cycle_mins: 4.6,  units_completed: 45, wip_count: 0, bottleneck_detected: false, bottleneck_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 102, downtime_mins: 0  },
    ],
    work_orders: [],
  };

  (async () => {
    const result = await runProductionAgent(mockContext);
    console.log(JSON.stringify(result, null, 2));
  })();
}
