import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId, factoryName, fullName } = await req.json();

  if (!userId || !factoryName || !fullName) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the user actually exists in auth.users before creating tenant/profile
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Derive a unique slug from factory name
  const base = factoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${base}-${Date.now()}`;

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: factoryName, slug })
    .select()
    .single();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, tenant_id: tenant.id, full_name: fullName, role: "admin" });

  if (profileError) {
    // Best-effort rollback of tenant if profile creation fails
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
