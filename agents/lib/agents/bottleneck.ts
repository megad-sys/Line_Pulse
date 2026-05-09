import Groq from "groq-sdk";
import { z } from "zod";
import type { AgentContext } from "../compute";

// ── System prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a bottleneck detection agent for a manufacturing shop floor.
You receive station metrics computed from QR scan timestamps.

Before giving your recommendation, reason through:
- What is the magnitude of the problem (bottleneck_score, stall duration)?
- What is likely causing it (cycle time vs target, queue depth)?
- What options exist to address it this shift?
- Which option best fits the current shift context?

Respond ONLY in JSON matching this schema exactly:
{
  "worst_station": string,
  "avg_cycle_mins": number,
  "target_cycle_mins": number,
  "bottleneck_score": number,
  "severity": "critical" | "warning" | "ok",
  "stall_detected": boolean,
  "stall_duration_mins": number | null,
  "queue_depth": number,
  "recommendation": string
}

Severity rules:
- bottleneck_score > 200 → "critical"
- bottleneck_score > 150 → "warning"
- otherwise → "ok"

Be specific and actionable. Never give generic advice.
Name the exact station. Give one concrete recommendation only.
Max 1 sentence for recommendation.`;

// ── Output schema ─────────────────────────────────────────────

const BottleneckSchema = z
  .object({
    worst_station:      z.string(),
    avg_cycle_mins:     z.number(),
    target_cycle_mins:  z.number(),
    bottleneck_score:   z.number(),
    severity:           z.enum(["critical", "warning", "ok"]),
    stall_detected:     z.boolean(),
    stall_duration_mins: z.number().nullable(),
    queue_depth:        z.number(),
    recommendation:     z.string(),
  })
  .refine(
    (d) => {
      if (d.bottleneck_score > 200) return d.severity === "critical";
      if (d.bottleneck_score > 150) return d.severity === "warning";
      return d.severity === "ok";
    },
    { message: "severity does not match bottleneck_score" }
  );

export type BottleneckResult = z.infer<typeof BottleneckSchema>;

// ── Agent ─────────────────────────────────────────────────────

export async function runBottleneckAgent(context: AgentContext): Promise<BottleneckResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const payload = context.stations.map((s) => ({
    station_name:        s.station_name,
    target_cycle_mins:   s.target_cycle_mins,
    avg_cycle_mins:      s.avg_cycle_mins,
    bottleneck_score:    s.bottleneck_score,
    units_completed:     s.units_completed,
    queue_depth:         s.queue_depth,
    stall_detected:      s.stall_detected,
    stall_duration_mins: s.stall_duration_mins,
  }));

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Station data:\n${JSON.stringify(payload, null, 2)}\n\nReturn JSON only.` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return BottleneckSchema.parse(JSON.parse(raw));
}

// ── SELF TEST ─────────────────────────────────────────────────
// Run: npx tsx lib/agent/agents/bottleneck.ts
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
    },
    stations: [
      { station_name: "SMT Assembly",      target_cycle_mins: 5.5, avg_cycle_mins: 5.8,  units_completed: 60, queue_depth: 1, stall_detected: false, stall_duration_mins: null, defect_count: 1, defect_rate_pct: 1.7,  bottleneck_score: 105 },
      { station_name: "Soldering",         target_cycle_mins: 6.0, avg_cycle_mins: 6.2,  units_completed: 58, queue_depth: 2, stall_detected: false, stall_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 103 },
      { station_name: "Visual Inspection", target_cycle_mins: 6.4, avg_cycle_mins: 14.8, units_completed: 30, queue_depth: 5, stall_detected: true,  stall_duration_mins: 22,   defect_count: 8, defect_rate_pct: 26.7, bottleneck_score: 231 },
      { station_name: "Functional Test",   target_cycle_mins: 6.4, avg_cycle_mins: 6.9,  units_completed: 45, queue_depth: 1, stall_detected: false, stall_duration_mins: null, defect_count: 1, defect_rate_pct: 2.2,  bottleneck_score: 108 },
      { station_name: "Packaging",         target_cycle_mins: 4.5, avg_cycle_mins: 4.6,  units_completed: 45, queue_depth: 0, stall_detected: false, stall_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 102 },
    ],
    work_orders: [],
  };

  (async () => {
    const result = await runBottleneckAgent(mockContext);
    console.log(JSON.stringify(result, null, 2));
  })();
}
