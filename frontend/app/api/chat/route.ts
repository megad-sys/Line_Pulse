// CURRENT SYSTEM - reads from scan_events
import { type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const question: string = body.question ?? "";
  if (!question.trim()) {
    return new Response(JSON.stringify({ error: "question required" }), { status: 400 });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return new Response("Groq API key not configured.", { status: 500 });
  }

  const db = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await db
    .from("scan_events")
    .select("work_order_id, part_id, station_name, scan_type, scanned_at")
    .gte("scanned_at", since24h)
    .limit(500);

  const rows = events ?? [];
  const completedByStation: Record<string, number> = {};
  const defectsByStation: Record<string, number> = {};
  const wipByStation: Record<string, number> = {};
  const inFlight = new Map<string, string>();

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

  const context = {
    wip_by_station:       wipByStation,
    completed_by_station: completedByStation,
    defects_by_station:   defectsByStation,
    total_events_24h:     rows.length,
    total_wip:            inFlight.size,
  };

  const groq = new Groq({ apiKey: groqApiKey });
  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are an AI production engineer embedded in a factory floor management system. Answer questions from production managers using the provided factory data. Be specific with numbers. Under 100 words unless more detail needed. Plain language — no jargon. Direct answer first, explanation second.`,
      },
      {
        role: "user",
        content: `Factory data (last 24h):\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 512,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content ?? "";
          if (content) controller.enqueue(encoder.encode(content));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
