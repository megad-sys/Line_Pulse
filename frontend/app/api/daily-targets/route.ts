import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ days: [] });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  const [{ data: targets }, { data: scans }] = await Promise.all([
    supabase
      .from("daily_targets")
      .select("date, target_qty")
      .eq("tenant_id", tenantId)
      .gte("date", weekAgo.toISOString().split("T")[0]),
    supabase
      .from("scans")
      .select("part_id, scanned_at")
      .eq("status", "completed")
      .gte("scanned_at", weekAgo.toISOString()),
  ]);

  const targetMap: Record<string, number> = {};
  for (const t of targets ?? []) targetMap[t.date] = t.target_qty;

  const producedMap: Record<string, Set<string>> = {};
  for (const s of scans ?? []) {
    const date = s.scanned_at.split("T")[0];
    if (!producedMap[date]) producedMap[date] = new Set();
    if (s.part_id) producedMap[date].add(s.part_id);
  }

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" });
    days.push({
      date,
      label,
      planned: targetMap[date] ?? 0,
      produced: producedMap[date]?.size ?? 0,
    });
  }

  return NextResponse.json({ days });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { date, target_qty } = body;
  if (!date || typeof target_qty !== "number") {
    return NextResponse.json({ error: "date and target_qty required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { error } = await supabase
    .from("daily_targets")
    .upsert({ tenant_id: tenantId, date, target_qty }, { onConflict: "tenant_id,date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
