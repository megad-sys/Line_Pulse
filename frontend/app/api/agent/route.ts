import { NextResponse, type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return NextResponse.json({ ok: true, skipped: "no groq key" });

  const service = createServiceClient();
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: tenants } = await service.from("tenants").select("id, name");
  if (!tenants?.length) return NextResponse.json({ ok: true, processed: 0 });

  const groq = new Groq({ apiKey: groqApiKey });
  let alertsCreated = 0;

  for (const tenant of tenants) {
    const [{ data: scans }, { data: parts }] = await Promise.all([
      service
        .from("scans")
        .select("station_name, status, scanned_at")
        .eq("tenant_id", tenant.id)
        .gte("scanned_at", since1h)
        .limit(200),
      service
        .from("parts")
        .select("current_status, current_station")
        .eq("tenant_id", tenant.id)
        .eq("current_status", "wip")
        .limit(200),
    ]);

    if (!scans?.length) continue;

    const failedCount = scans.filter((s) => s.status === "failed_qc").length;
    const failureRate = scans.length > 0 ? failedCount / scans.length : 0;

    if (failureRate < 0.1 && scans.length < 3) continue;

    const stationCounts = (parts ?? []).reduce<Record<string, number>>((acc, p) => {
      acc[p.current_station] = (acc[p.current_station] ?? 0) + 1;
      return acc;
    }, {});

    const payload = {
      tenant: tenant.name,
      scans_last_hour: scans.length,
      failed_qc: failedCount,
      failure_rate_pct: Math.round(failureRate * 100),
      wip_per_station: stationCounts,
    };

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an AI production engineer monitoring a factory floor in real-time. Analyze the data and return ONLY a JSON object:
{"alerts": [{"type": "critical|warning|info", "title": "string under 8 words", "detail": "string under 25 words", "station": "string or null"}]}
Flag only real problems that need immediate attention. Return {"alerts": []} if everything looks normal.`,
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        temperature: 0.2,
        max_tokens: 512,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      const alerts: Array<{ type: string; title: string; detail: string; station?: string }> =
        Array.isArray(parsed.alerts) ? parsed.alerts : [];

      if (alerts.length > 0) {
        await service.from("ai_alerts").insert(
          alerts.map((a) => ({
            tenant_id: tenant.id,
            type: a.type ?? "info",
            title: a.title,
            detail: a.detail,
            station: a.station ?? null,
          }))
        );
        alertsCreated += alerts.length;
      }
    } catch {
      // continue to next tenant
    }
  }

  return NextResponse.json({ ok: true, alerts_created: alertsCreated });
}
