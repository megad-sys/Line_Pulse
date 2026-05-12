// CURRENT SYSTEM - reads from work_orders, writes to scan_events
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function actionToScanType(action: string): string {
  switch (action) {
    case "completed":      return "exit";
    case "failed_qc":      return "defect";
    case "scrapped":       return "defect";
    case "downtime_start": return "downtime_start";
    case "downtime_end":   return "downtime_end";
    default:               return "entry";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = createServiceClient();

  const [{ data: workOrder }, { data: stationConfigs }] = await Promise.all([
    db.from("work_orders").select("*").eq("id", params.id).single(),
    db.from("station_config").select("station_name").order("station_name"),
  ]);

  if (!workOrder) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    type: "work_order",
    workOrder,
    stations: (stationConfigs ?? []).map((s) => s.station_name),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = createServiceClient();
  const body = await req.json();
  const { station_name, action, operator_name } = body;

  if (!station_name || !action) {
    return NextResponse.json(
      { error: "station_name and action are required." },
      { status: 400 }
    );
  }

  const { data: workOrder } = await db
    .from("work_orders")
    .select("id, tenant_id")
    .eq("id", params.id)
    .single();

  if (!workOrder) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const scanned_at = new Date().toISOString();

  const { data: activeShift } = await db
    .from("shifts")
    .select("id")
    .eq("tenant_id", workOrder.tenant_id)
    .gt("end_time", scanned_at)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("scan_events").insert({
    tenant_id:     workOrder.tenant_id,
    shift_id:      activeShift?.id ?? null,
    work_order_id: params.id,
    station_name,
    scan_type:     actionToScanType(action),
    scanned_at,
    operator_id:   operator_name ?? null,
    source:        "qr",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
