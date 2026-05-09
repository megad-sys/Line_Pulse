import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { resolved_by } = await req.json();

  if (!resolved_by) {
    return NextResponse.json({ error: "resolved_by is required" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data, error } = await db
    .from("agent_alerts")
    .update({ resolved_at: new Date().toISOString(), resolved_by })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
