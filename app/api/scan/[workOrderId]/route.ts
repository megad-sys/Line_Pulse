import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { shiftFromTime } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { workOrderId: string } }
) {
  const supabase = createServiceClient();

  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", params.workOrderId)
    .single();

  if (error || !workOrder) {
    return NextResponse.json({ error: "Work order not found." }, { status: 404 });
  }

  return NextResponse.json({ workOrder });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workOrderId: string } }
) {
  const supabase = createServiceClient();

  const { data: workOrder, error: woError } = await supabase
    .from("work_orders")
    .select("tenant_id")
    .eq("id", params.workOrderId)
    .single();

  if (woError || !workOrder) {
    return NextResponse.json({ error: "Work order not found." }, { status: 404 });
  }

  const body = await req.json();
  const { station_name, status, operator_name, worker_note } = body;

  if (!station_name || !status) {
    return NextResponse.json({ error: "station_name and status are required." }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("scans").insert({
    tenant_id: workOrder.tenant_id,
    work_order_id: params.workOrderId,
    station_name,
    status,
    operator_name: operator_name ?? null,
    worker_note: worker_note ?? null,
    scanned_at: new Date().toISOString(),
    shift: shiftFromTime(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
