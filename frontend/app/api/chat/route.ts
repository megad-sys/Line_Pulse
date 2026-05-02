import { type NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const service = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: parts }, { data: scans }, { data: lines }] = await Promise.all([
    service.from("parts").select("batch_ref, current_status, current_station, line_id").limit(100),
    service
      .from("scans")
      .select("station_name, status, scanned_at, operator_name")
      .gte("scanned_at", since24h)
      .limit(200),
    service.from("production_lines").select("id, name").limit(20),
  ]);

  const statusCounts = (parts ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.current_status] = (acc[p.current_status] ?? 0) + 1;
    return acc;
  }, {});

  const stationCounts = (parts ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.current_status === "wip") acc[p.current_station] = (acc[p.current_station] ?? 0) + 1;
    return acc;
  }, {});

  const context = {
    production_lines: (lines ?? []).map((l) => l.name),
    part_status_counts: statusCounts,
    wip_parts_per_station: stationCounts,
    total_parts: parts?.length ?? 0,
    scans_last_24h: scans?.length ?? 0,
    failed_qc_last_24h: (scans ?? []).filter((s) => s.status === "failed_qc").length,
    completed_last_24h: (scans ?? []).filter((s) => s.status === "completed").length,
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
        content: `Factory data:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`,
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
