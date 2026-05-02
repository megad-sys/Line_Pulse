import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { shiftFromTime } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  // Try parts table first
  const { data: part } = await supabase
    .from("parts")
    .select("*, production_lines(name)")
    .eq("id", params.id)
    .single();

  if (part) {
    const { data: stations } = await supabase
      .from("line_stations")
      .select("station_name, sequence_order")
      .eq("line_id", part.line_id)
      .order("sequence_order", { ascending: true });

    return NextResponse.json({
      type: "part",
      part: {
        id: part.id,
        qr_code: part.qr_code,
        batch_ref: part.batch_ref,
        current_station: part.current_station,
        current_status: part.current_status,
        line_name: (part.production_lines as { name: string } | null)?.name ?? "",
      },
      stations: (stations ?? []).map((s: { station_name: string }) => s.station_name),
    });
  }

  // Fall back to work order
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !workOrder) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ type: "work_order", workOrder });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();
  const body = await req.json();
  const { station_name, action, operator_name, worker_note } = body;

  if (!station_name || !action) {
    return NextResponse.json(
      { error: "station_name and action are required." },
      { status: 400 }
    );
  }

  // Try part
  const { data: part } = await supabase
    .from("parts")
    .select("id, tenant_id, line_id, current_station, current_status")
    .eq("id", params.id)
    .single();

  if (part) {
    const scanStatus =
      action === "completed" ? "completed"
      : action === "failed_qc" ? "failed_qc"
      : "started";

    const { error: scanError } = await supabase.from("scans").insert({
      tenant_id: part.tenant_id,
      part_id: part.id,
      station_name,
      status: scanStatus,
      operator_name: operator_name ?? null,
      worker_note: worker_note ?? null,
      scanned_at: new Date().toISOString(),
      shift: shiftFromTime(),
    });

    if (scanError) {
      return NextResponse.json({ error: scanError.message }, { status: 500 });
    }

    // Update part state for terminal actions
    if (action === "completed" || action === "failed_qc" || action === "scrapped") {
      let newStatus: string = part.current_status;
      let newStation: string = part.current_station;

      if (action === "failed_qc") {
        newStatus = "failed_qc";
      } else if (action === "scrapped") {
        newStatus = "scrapped";
      } else {
        // Advance to next station or mark done
        const { data: allStations } = await supabase
          .from("line_stations")
          .select("station_name, sequence_order")
          .eq("line_id", part.line_id)
          .order("sequence_order", { ascending: true });

        const idx = (allStations ?? []).findIndex(
          (s: { station_name: string }) => s.station_name === station_name
        );
        const next = (allStations ?? [])[idx + 1];

        if (next) {
          newStation = next.station_name;
          newStatus = "wip";
        } else {
          newStatus = "done";
        }
      }

      const { error: updateError } = await supabase
        .from("parts")
        .update({ current_station: newStation, current_status: newStatus })
        .eq("id", part.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, newStatus, newStation });
    }

    return NextResponse.json({ ok: true });
  }

  // Fall back to work order scan
  const { data: workOrder, error: woError } = await supabase
    .from("work_orders")
    .select("tenant_id")
    .eq("id", params.id)
    .single();

  if (woError || !workOrder) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("scans").insert({
    tenant_id: workOrder.tenant_id,
    work_order_id: params.id,
    station_name,
    status: action,
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
