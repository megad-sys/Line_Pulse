import { NextResponse, type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mockInsights } from "@/lib/mock-data";
import type { AIInsight } from "@/lib/types";

export async function POST(req: NextRequest) {
  // Verify the user is authenticated
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const question: string | undefined = body.question;

  // Fetch production context using service role
  const service = createServiceClient();
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

  const [{ data: workOrders }, { data: scans }] = await Promise.all([
    service
      .from("work_orders")
      .select("wo_number, customer_name, part_number, planned_qty, actual_qty, status, due_date, stations")
      .or(`status.in.(wip,qc,delayed)`)
      .limit(20),
    service
      .from("scans")
      .select("station_name, status, scanned_at, operator_name")
      .gte("scanned_at", eightHoursAgo)
      .limit(200),
  ]);

  const hasData = (workOrders?.length ?? 0) > 0 || (scans?.length ?? 0) > 0;

  if (!hasData && !question) {
    return NextResponse.json({ insights: mockInsights });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return NextResponse.json({ insights: mockInsights });
  }

  const productionContext = {
    active_work_orders: workOrders ?? [],
    recent_scans_last_8h: (scans ?? []).length,
    qc_failures: (scans ?? []).filter((s) => s.status === "failed_qc").length,
    stations_active: Array.from(new Set((scans ?? []).map((s) => s.station_name))),
    question: question ?? null,
  };

  const systemPrompt = `You are a factory operations AI assistant for a manufacturing facility.
Analyze production data and return actionable insights in JSON format.
Be specific, concise, and focus on what managers can act on right now.
Always respond with valid JSON only — no markdown, no explanation outside JSON.`;

  const userPrompt = question
    ? `Answer this question about the production floor based on the data: "${question}"

Production data: ${JSON.stringify(productionContext, null, 2)}

Return a JSON array of 1-3 insights: [{"type": "critical"|"warning"|"info"|"positive", "title": "short title", "body": "detailed finding", "time": "just now"}]`
    : `Analyze this production data and identify the most important issues and opportunities:

${JSON.stringify(productionContext, null, 2)}

Return a JSON array of 3-5 insights: [{"type": "critical"|"warning"|"info"|"positive", "title": "short title under 60 chars", "body": "2-3 sentence finding with specific numbers", "time": "X min ago"}]`;

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
      : mockInsights;

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ insights: mockInsights });
  }
}
