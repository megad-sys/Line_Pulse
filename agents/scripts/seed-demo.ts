/**
 * Seed demo data for LinePulse agent system.
 * Run: npx tsx scripts/seed-demo.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import * as dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TENANT_SLUG = "demo-tenant-001";

const STATIONS = [
  { name: "SMT Assembly",      target: 5.5 },
  { name: "Soldering",         target: 6.0 },
  { name: "Visual Inspection", target: 6.4 },
  { name: "Functional Test",   target: 6.4 },
  { name: "Packaging",         target: 4.5 },
];

const WORK_ORDERS = [
  { wo_number: "WO-DEMO-001", part_number: "PCB Control Unit",   qty: 50, customer: "Customer A", priority: "urgent", cp: "critical" },
  { wo_number: "WO-DEMO-002", part_number: "Sensor Array Rev2", qty: 40, customer: "Customer A", priority: "high",   cp: "high"     },
  { wo_number: "WO-DEMO-003", part_number: "Motor Controller",  qty: 60, customer: "Customer A", priority: "medium", cp: "normal"   },
] as const;

const OPERATORS = ["OP-001", "OP-002", "OP-003"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function addMins(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60000);
}

async function main() {
  console.log("LinePulse Demo Seed — 1 shift\n");

  // ── Upsert tenant ──────────────────────────────────────────
  await db.from("tenants").upsert(
    { id: TENANT_ID, name: "Demo Factory", slug: TENANT_SLUG },
    { onConflict: "id" }
  );
  console.log("✓ Tenant upserted");

  // ── Upsert station config ──────────────────────────────────
  for (const s of STATIONS) {
    await db.from("station_config").upsert(
      { tenant_id: TENANT_ID, station_name: s.name, target_cycle_mins: s.target },
      { onConflict: "tenant_id,station_name" }
    );
  }
  console.log("✓ 5 stations configured");

  // ── Create shift (today, 06:00–23:59) ─────────────────────
  const today = new Date();
  const shiftStart = new Date(today);
  shiftStart.setHours(6, 0, 0, 0);
  const shiftEnd = new Date(today);
  shiftEnd.setHours(23, 59, 0, 0);

  const { data: shift, error: shiftErr } = await db
    .from("shifts")
    .insert({
      tenant_id: TENANT_ID,
      date: today.toISOString().split("T")[0],
      shift_name: "Morning",
      start_time: shiftStart.toISOString(),
      end_time: shiftEnd.toISOString(),
    })
    .select("id")
    .single();

  if (shiftErr || !shift) {
    console.error("✗ Failed to create shift:", shiftErr?.message);
    process.exit(1);
  }
  const shiftId = shift.id;
  console.log(`✓ Shift created: ${shiftId}`);

  // ── Create work orders ─────────────────────────────────────
  const due = new Date(today);
  due.setHours(14, 0, 0, 0);

  const woIds: Record<string, string> = {};
  for (const wo of WORK_ORDERS) {
    const { data: woRow, error: woErr } = await db
      .from("work_orders")
      .upsert({
        tenant_id: TENANT_ID,
        agent_shift_id: shiftId,
        wo_number: wo.wo_number,
        customer_name: wo.customer,
        part_number: wo.part_number,
        planned_qty: wo.qty,
        status: "wip",
        priority: wo.priority,
        due_date: due.toISOString(),
        customer_priority: wo.cp,
      }, { onConflict: "tenant_id,wo_number" })
      .select("id")
      .single();

    if (woErr || !woRow) {
      console.error(`✗ Failed to create WO ${wo.wo_number}:`, woErr?.message);
      process.exit(1);
    }
    woIds[wo.wo_number] = woRow.id;
  }
  console.log("✓ 3 work orders created");

  // ── Generate scan events ───────────────────────────────────
  // Pattern: Visual Inspection is the bottleneck
  //   - SMT Assembly, Soldering, Functional Test, Packaging: normal (±15% jitter)
  //   - Visual Inspection: 2.3× target, 15% defect rate, 2 stalls (no exit scan)

  const scanBatch: object[] = [];
  let rowCount = 0;

  const STALL_PARTS = new Set(["WO-DEMO-002-PART-007", "WO-DEMO-001-PART-012"]);

  for (const wo of WORK_ORDERS) {
    const woId = woIds[wo.wo_number];
    let cursor = new Date(shiftStart);

    for (let unit = 1; unit <= wo.qty; unit++) {
      const partId = `${wo.wo_number}-PART-${String(unit).padStart(3, "0")}`;
      const isStallUnit = STALL_PARTS.has(partId);

      for (let si = 0; si < STATIONS.length; si++) {
        const station = STATIONS[si];
        const isVI = station.name === "Visual Inspection";

        let multiplier = isVI ? 2.3 : 1.0;
        const jitter = rand(0.85, 1.15);
        const cycleMins = station.target * multiplier * jitter;

        const entryTime = new Date(cursor);
        const exitTime = addMins(entryTime, cycleMins);

        // Entry scan
        scanBatch.push({
          tenant_id: TENANT_ID,
          work_order_id: woId,
          part_id: partId,
          station_name: station.name,
          scan_type: "entry",
          scanned_at: entryTime.toISOString(),
          operator_id: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
          shift_id: shiftId,
          source: "qr",
        });

        // Defect scan (VI only, 15% rate; others 2%)
        const defectRate = isVI ? 0.15 : 0.02;
        if (Math.random() < defectRate) {
          scanBatch.push({
            tenant_id: TENANT_ID,
            work_order_id: woId,
            part_id: partId,
            station_name: station.name,
            scan_type: "defect",
            scanned_at: addMins(entryTime, cycleMins * 0.7).toISOString(),
            operator_id: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
            shift_id: shiftId,
            source: "qr",
          });
        }

        // Stall: skip exit scan for designated stall parts at VI
        const isStall = isVI && isStallUnit;
        if (!isStall) {
          scanBatch.push({
            tenant_id: TENANT_ID,
            work_order_id: woId,
            part_id: partId,
            station_name: station.name,
            scan_type: "exit",
            scanned_at: exitTime.toISOString(),
            operator_id: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
            shift_id: shiftId,
            source: "qr",
          });
          cursor = exitTime;
        }
        // Stalled parts stay at VI — no further stations

        if (isStall) break;

        rowCount += isStall ? 1 : 2;

        if (rowCount % 100 === 0) process.stdout.write(`  ${rowCount} rows...\r`);
      }
    }
  }

  // Flush in batches of 500
  const BATCH = 500;
  for (let i = 0; i < scanBatch.length; i += BATCH) {
    const { error } = await db.from("scan_events").insert(scanBatch.slice(i, i + BATCH));
    if (error) {
      console.error("\n✗ Insert error:", error.message);
      process.exit(1);
    }
    process.stdout.write(`  ${Math.min(i + BATCH, scanBatch.length)}/${scanBatch.length} scan events inserted...\r`);
  }

  // ── Seed tenant integrations ───────────────────────────────
  await db.from("tenant_integrations").upsert([
    { tenant_id: TENANT_ID, tool_name: "email",                     level: 1, enabled: true,  config: { from: "alerts@linepulse.io", supervisor_email: "gadmenna97@gmail.com" } },
    { tenant_id: TENANT_ID, tool_name: "log_issue",                 level: 1, enabled: true,  config: {} },
    { tenant_id: TENANT_ID, tool_name: "change_order_priority",     level: 2, enabled: true,  config: {} },
    { tenant_id: TENANT_ID, tool_name: "create_maintenance_ticket", level: 2, enabled: true,  config: {} },
    { tenant_id: TENANT_ID, tool_name: "slack",                     level: 1, enabled: true,  config: { webhook_url: process.env.SLACK_WEBHOOK_URL ?? "" } },
  ], { onConflict: "tenant_id,tool_name" });
  console.log("✓ 5 tenant integrations seeded (email ✓, log_issue ✓, change_order_priority ✓, create_maintenance_ticket ✓, slack ✗)");

  console.log(`\n\n✓ Seeded:`);
  console.log(`  1 shift  (today, 06:00–14:00)`);
  console.log(`  3 work orders`);
  console.log(`  ${scanBatch.length} scan events`);
  console.log(`  5 tenant integrations (4 enabled, 1 disabled)`);
  console.log(`  Visual Inspection: 2.3× target, 15% defect rate, 2 stalls`);
  console.log(`  Shift ID: ${shiftId}`);
  console.log(`\nTo run agents against this shift:`);
  console.log(`  POST /api/agent/analyse  { "shiftId": "${shiftId}" }`);
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
