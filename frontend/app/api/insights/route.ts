// CURRENT SYSTEM - reads from scan_events
import { NextResponse, type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mockInsights } from "@/lib/mock-data";
import type { AIInsight } from "@/lib/types";

const SPARSE_INSIGHT: AIInsight = {
  type: "info",
  title: "Your AI engineer is watching",
  detail:
    "Scan work orders through your stations to start receiving production insights. The more you scan, the smarter the analysis gets.",
  action: "Import a CSV or use the QR scanner to add scan data",
};

export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await db
    .from("scan_events")
    .select("work_order_id, part_id, station_name, scan_type, scanned_at")
    .gte("scanned_at", since24h)
    .limit(500);

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return NextResponse.json({ insights: mockInsights });

  const rows = events ?? [];
  if (rows.length === 0) return NextResponse.json({ insights: [SPARSE_INSIGHT] });

  const exits = rows.filter((r) => r.scan_type === "exit");
  const defects = rows.filter((r) => r.scan_type === "defect");

  const completedByStation: Record<string, number> = {};
  const defectsByStation: Record<string, number> = {};
  const wipByStation: Record<string, number> = {};
  const inFlight = new Map<string, string>(); // id → station

  for (const row of rows) {
    const id = row.part_id ?? row.work_order_id;
    if (row.scan_type === "entry" && id) inFlight.set(id, row.station_name);
    if (row.scan_type === "exit"  && id) inFlight.delete(id);
    if (row.scan_type === "exit")    completedByStation[row.station_name] = (completedByStation[row.station_name] ?? 0) + 1;
    if (row.scan_type === "defect") defectsByStation[row.station_name]   = (defectsByStation[row.station_name]   ?? 0) + 1;
  }
  for (const station of inFlight.values()) {
    wipByStation[station] = (wipByStation[station] ?? 0) + 1;
  }

  const productionContext = {
    wip_by_station:       wipByStation,
    completed_by_station: completedByStation,
    defects_by_station:   defectsByStation,
    total_events_24h:     rows.length,
    total_exits_24h:      exits.length,
    total_defects_24h:    defects.length,
    total_wip:            inFlight.size,
  };

  const systemPrompt = `You are an AI production engineer watching a factory floor. Analyse this data and return 3-5 insights as a JSON object with key "insights" containing an array:
{"insights": [{type, title, detail, action}]}
type: critical|warning|info|positive
Focus on: bottleneck stations, WIP pile-ups, high defect rates, throughput issues, positive signals worth noting.
Be specific with numbers from the data.
Return ONLY valid JSON. No markdown.`;

  const userPrompt = `Production data (last 24h):\n${JSON.stringify(productionContext, null, 2)}\n\nGenerate 3-5 insights.`;

  try {
    const groq = new Groq({ apiKey: groqApiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const insights: AIInsight[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.insights)
      ? parsed.insights
      : [SPARSE_INSIGHT];

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ insights: mockInsights });
  }
}
