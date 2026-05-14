// TODO Phase 2: priority, due_date, and customer_priority populated
// automatically via ERP webhook. Manual entry is the Phase 1 fallback.

import Groq from "groq-sdk";
import { z } from "zod";
import type { AgentContext } from "../compute";

// ── System prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a production planning agent for a manufacturing shop floor.
You receive shift throughput data and work order status from the factory floor — sourced from an MES integration, QR scan events, ERP export, or any other data stream.

Before giving your recommendation, reason through:
- What is the current plan attainment and can the gap close this shift?
- Which work orders are at risk (stalled, low progress, critical customers)?
- How should remaining hours be prioritised to protect the most important deliveries?
- Resequencing priority: 1) customer_priority (critical first) 2) due_date (earliest first) 3) progress_pct (protect nearly-complete orders)

Respond ONLY in JSON matching this schema exactly:
{
  "plan_attainment_pct": number,
  "projected_eod_units": number,
  "planned_units": number,
  "gap_units": number,
  "closeable_this_shift": boolean,
  "at_risk_work_orders": string[],
  "recommended_sequence": [
    {
      "wo_number": string,
      "part_name": string,
      "customer_name": string,
      "customer_priority": "critical" | "high" | "normal",
      "reason": string
    }
  ],
  "recommendation": string
}

For each entry in recommended_sequence, reason field must be ONE specific sentence
referencing actual numbers, customer names, or due dates — never generic.
Example: "Critical Siemens AG delivery due today, currently 55% complete and stalled."

Be direct. Name specific work order numbers. One recommendation sentence.`;

// ── Output schema ─────────────────────────────────────────────

const SequenceEntrySchema = z.object({
  wo_number:         z.string(),
  part_name:         z.string(),
  customer_name:     z.string(),
  customer_priority: z.enum(["critical", "high", "normal"]),
  reason:            z.string(),
});

const PlanningSchema = z.object({
  plan_attainment_pct:    z.number(),
  projected_eod_units:    z.number(),
  planned_units:          z.number(),
  gap_units:              z.number(),
  closeable_this_shift:   z.boolean(),
  at_risk_work_orders:    z.array(z.string()),
  recommended_sequence:   z.array(SequenceEntrySchema),
  recommendation:         z.string(),
});

export type PlanningResult = z.infer<typeof PlanningSchema>;

// ── Agent ─────────────────────────────────────────────────────

export async function runPlanningAgent(context: AgentContext): Promise<PlanningResult> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const payload = {
    shift: {
      hours_elapsed:         context.shift.hours_elapsed,
      hours_remaining:       context.shift.hours_remaining,
      units_completed_total: context.shift.units_completed_total,
      planned_units_total:   context.shift.planned_units_total,
      plan_attainment_pct:   context.shift.plan_attainment_pct,
      throughput_per_hour:   context.shift.throughput_per_hour,
      projected_eod_units:   context.shift.projected_eod_units,
    },
    work_orders: context.work_orders.map((wo) => ({
      wo_number:         wo.wo_number,
      part_name:         wo.part_name,
      customer_name:     wo.customer_name,
      quantity_planned:  wo.quantity_planned,
      units_completed:   wo.units_completed,
      progress_pct:      wo.progress_pct,
      is_stalled:        wo.is_stalled,
      minutes_since_last_scan: wo.minutes_since_last_scan,
      priority:          wo.priority,
      due_date:          wo.due_date,
      customer_priority: wo.customer_priority,
    })),
  };

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Planning data:\n${JSON.stringify(payload, null, 2)}\n\nReturn JSON only.` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return PlanningSchema.parse(JSON.parse(raw));
}

// ── SELF TEST ─────────────────────────────────────────────────
// Run: npx tsx lib/agent/agents/planning.ts
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
    stations: [],
    work_orders: [
      {
        work_order_id: "wo-001", wo_number: "WO-DEMO-001",
        part_name: "PCB Control Unit", customer_name: "Siemens AG",
        quantity_planned: 50, units_completed: 28, progress_pct: 56,
        current_station: "Visual Inspection", last_scan_at: new Date(Date.now() - 22 * 60000).toISOString(),
        is_stalled: true, minutes_since_last_scan: 22,
        priority: 8, due_date: new Date().toISOString(), customer_priority: "critical",
      },
      {
        work_order_id: "wo-002", wo_number: "WO-DEMO-002",
        part_name: "Sensor Array Rev2", customer_name: "ZF Group",
        quantity_planned: 40, units_completed: 12, progress_pct: 30,
        current_station: "Soldering", last_scan_at: new Date(Date.now() - 5 * 60000).toISOString(),
        is_stalled: false, minutes_since_last_scan: 5,
        priority: 5, due_date: null, customer_priority: "high",
      },
      {
        work_order_id: "wo-003", wo_number: "WO-DEMO-003",
        part_name: "Motor Controller", customer_name: "Bosch AG",
        quantity_planned: 60, units_completed: 5, progress_pct: 8.3,
        current_station: "SMT Assembly", last_scan_at: new Date(Date.now() - 3 * 60000).toISOString(),
        is_stalled: false, minutes_since_last_scan: 3,
        priority: 3, due_date: null, customer_priority: "normal",
      },
    ],
  };

  (async () => {
    const result = await runPlanningAgent(mockContext);
    console.log(JSON.stringify(result, null, 2));
  })();
}
