/**
 * Reset all demo data for tenant demo-tenant-001.
 * Run: npx tsx scripts/reset-demo.ts
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

async function main() {
  console.log("Resetting demo data for tenant demo-tenant-001...\n");

  const steps: [string, () => Promise<unknown>][] = [
    ["scan_events",   () => db.from("scan_events").delete().eq("tenant_id", TENANT_ID)],
    ["agent_alerts",  () => db.from("agent_alerts").delete().eq("tenant_id", TENANT_ID)],
    ["agent_runs",    () => db.from("agent_runs").delete().eq("tenant_id", TENANT_ID)],
    ["work_orders",   () => db.from("work_orders").delete().eq("tenant_id", TENANT_ID)],
    ["shifts",        () => db.from("shifts").delete().eq("tenant_id", TENANT_ID)],
    ["station_config",() => db.from("station_config").delete().eq("tenant_id", TENANT_ID)],
    ["tenants",       () => db.from("tenants").delete().eq("id", TENANT_ID)],
  ];

  for (const [table, fn] of steps) {
    const { error } = await fn() as { error: { message: string } | null };
    if (error) {
      console.error(`✗ Failed to clear ${table}:`, error.message);
    } else {
      console.log(`✓ Cleared ${table}`);
    }
  }

  console.log("\n✓ Demo data cleared. Ready to re-seed.");
  console.log("  Run: npx tsx scripts/seed-demo.ts");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
