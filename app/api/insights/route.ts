import { NextResponse, type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mockInsights } from "@/lib/mock-data";
import type { AIInsight } from "@/lib/types";

const SPARSE_INSIGHT: AIInsight = {
  type: "info",
  title: "Your AI engineer is watching",
  detail:
    "Scan parts through your stations to start receiving production insights. The more you scan, the smarter the analysis gets.",
  action: "Go to New Batch to add parts",
};

export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: parts }, { data: scans }] = await Promise.all([
    service
      .from("parts")
      .select("id, batch_ref, current_status, current_station, line_id, created_at")
      .limit(100),
    service
      .from("scans")
      .select("part_id, station_name, status, scanned_at, operator_name")
      .gte("scanned_at", since24h)
      .limit(200),
  ]);

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return NextResponse.json({ insights: mockInsights });

  const hasParts = (parts?.length ?? 0) > 0;
  const hasScans = (scans?.length ?? 0) > 0;

  if (!hasParts && !hasScans) {
    return NextResponse.json({ insights: [SPARSE_INSIGHT] });
  }

  const statusCounts = (parts ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.current_status] = (acc[p.current_status] ?? 0) + 1;
    return acc;
  }, {});

  const stationCounts = (parts ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.current_status === "wip") acc[p.current_station] = (acc[p.current_station] ?? 0) + 1;
    return acc;
  }, {});

  const failedScansToday = (scans ?? []).filter((s) => s.status === "failed_qc").length;
  const completedScansToday = (scans ?? []).filter((s) => s.status === "completed").length;

  const productionContext = {
    part_status_counts: statusCounts,
    wip_parts_per_station: stationCounts,
    total_parts: parts?.length ?? 0,
    scans_last_24h: scans?.length ?? 0,
    failed_qc_last_24h: failedScansToday,
    completed_last_24h: completedScansToday,
  };

  const systemPrompt = `You are an AI production engineer watching a factory floor. Analyse this data and return 3-5 insights as a JSON object with key "insights" containing an array:
{"insights": [{type, title, detail, action}]}
type: critical|warning|info|positive
Focus on: bottleneck stations, parts piling up, high failure rates, throughput issues, positive signals worth noting.
Be specific with numbers from the data.
Return ONLY valid JSON. No markdown.`;

  const userPrompt = `Production data:\n${JSON.stringify(productionContext, null, 2)}\n\nGenerate 3-5 insights.`;

  try {
    const groq = new Groq({ apiKey: groqApiKey });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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
