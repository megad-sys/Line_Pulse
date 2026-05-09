import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStationMetrics } from "@/lib/agent/compute";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: activeShifts } = await db
    .from("shifts")
    .select("id, tenant_id")
    .gt("end_time", new Date().toISOString());

  if (!activeShifts?.length) {
    return NextResponse.json({ alerts_created: 0, alerts_updated: 0, shifts_checked: 0 });
  }

  let alerts_created = 0;
  let alerts_updated = 0;

  for (const shift of activeShifts) {
    const stations = await getStationMetrics(shift.id);

    for (const station of stations) {
      // ── Stall detection ──────────────────────────────────────
      if (station.stall_detected && station.stall_duration_mins !== null) {
        const severity =
          station.stall_duration_mins > station.target_cycle_mins * 2
            ? "critical"
            : "warning";

        const { data: existing } = await db
          .from("agent_alerts")
          .select("id")
          .eq("shift_id", shift.id)
          .eq("station_name", station.station_name)
          .eq("alert_type", "stall")
          .is("resolved_at", null)
          .maybeSingle();

        if (existing) {
          await db
            .from("agent_alerts")
            .update({ stall_duration_mins: station.stall_duration_mins, severity })
            .eq("id", existing.id);
          alerts_updated++;
        } else {
          await db.from("agent_alerts").insert({
            tenant_id: shift.tenant_id,
            shift_id: shift.id,
            alert_type: "stall",
            station_name: station.station_name,
            severity,
            stall_duration_mins: station.stall_duration_mins,
          });
          alerts_created++;
        }
      }

      // ── Quality spike detection ──────────────────────────────
      if (station.defect_rate_pct > 10) {
        const severity = station.defect_rate_pct > 15 ? "critical" : "warning";

        const { data: existing } = await db
          .from("agent_alerts")
          .select("id")
          .eq("shift_id", shift.id)
          .eq("station_name", station.station_name)
          .eq("alert_type", "quality_spike")
          .is("resolved_at", null)
          .maybeSingle();

        if (existing) {
          await db
            .from("agent_alerts")
            .update({ severity })
            .eq("id", existing.id);
          alerts_updated++;
        } else {
          await db.from("agent_alerts").insert({
            tenant_id: shift.tenant_id,
            shift_id: shift.id,
            alert_type: "quality_spike",
            station_name: station.station_name,
            severity,
          });
          alerts_created++;
        }
      }
    }
  }

  return NextResponse.json({
    alerts_created,
    alerts_updated,
    shifts_checked: activeShifts.length,
  });
}
