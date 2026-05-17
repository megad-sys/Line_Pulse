import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("tenant_id").eq("id", user.id).single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const db = createServiceClient();

  const { error } = await db
    .from("agent_actions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
