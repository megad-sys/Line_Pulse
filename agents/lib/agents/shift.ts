import Groq from "groq-sdk";
import { z } from "zod";
import type { AgentContext } from "../compute";

// ── System prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a shift intelligence agent. You write concise, action-oriented
shift briefings for factory production managers.

Before writing, reason through:
- What is the single most important thing happening on this floor right now?
- What action, if taken in the next 30 minutes, would have the biggest positive impact?
- What does the incoming shift need to know to avoid repeating today's problems?

Respond ONLY in JSON matching this schema exactly:
{
  "one_line_summary": string,
  "top_priority": string,
  "action_required": boolean,
  "handover_notes": string
}

Rules:
- one_line_summary: the entire shift in one sentence — include actual numbers
- top_priority: the single most important action right now — name the station or work order
- action_required: true if any station is stalled, plan attainment < 80%, or defect rate > 10%
- handover_notes: max 3 sentences for the incoming shift — direct, no padding

Write like a senior floor manager. Direct, no jargon, no filler.
Name the exact station, work order, and operator where relevant.`;

// ── Output schema ─────────────────────────────────────────────

const ShiftSchema = z.object({
  one_line_summary: z.string(),
  top_priority:     z.string(),
  action_required:  z.boolean(),
  handover_notes:   z.string(),
});

export type ShiftResult = z.infer<typeof ShiftSchema>;

// ── Agent ─────────────────────────────────────────────────────

export async function runShiftAgent(context: AgentContext): Promise<ShiftResult> {
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
    max_tokens: 500,
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return ShiftSchema.parse(JSON.parse(raw));
}

// ── SELF TEST ─────────────────────────────────────────────────
// Run: npx tsx lib/agent/agents/shift.ts
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
      { station_name: "Visual Inspection", target_cycle_mins: 6.4, avg_cycle_mins: 14.8, units_completed: 30, wip_count: 5, bottleneck_detected: true,  bottleneck_duration_mins: 22,   defect_count: 8, defect_rate_pct: 26.7, bottleneck_score: 231, downtime_mins: 18 },
      { station_name: "Packaging",         target_cycle_mins: 4.5, avg_cycle_mins: 4.6,  units_completed: 45, wip_count: 0, bottleneck_detected: false, bottleneck_duration_mins: null, defect_count: 0, defect_rate_pct: 0,    bottleneck_score: 102, downtime_mins: 0  },
    ],
    work_orders: [
      {
        work_order_id: "wo-001", wo_number: "WO-DEMO-001",
        part_name: "PCB Control Unit", customer_name: "Siemens AG",
        quantity_planned: 50, units_completed: 28, progress_pct: 56,
        current_station: "Visual Inspection", last_scan_at: new Date(Date.now() - 22 * 60000).toISOString(),
        is_stalled: true, minutes_since_last_scan: 22,
        priority: 8, due_date: new Date().toISOString(), customer_priority: "critical",
      },
    ],
  };

  (async () => {
    const result = await runShiftAgent(mockContext);
    console.log(JSON.stringify(result, null, 2));
  })();
}
