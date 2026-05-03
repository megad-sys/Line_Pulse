import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel
from supabase import Client, create_client

from auth import AuthContext, get_auth_context

app = FastAPI(title="Line Pulse Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service: Client = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

_SPARSE_INSIGHT = {
    "type": "info",
    "title": "Your AI engineer is watching",
    "detail": (
        "Scan parts through your stations to start receiving production insights. "
        "The more you scan, the smarter the analysis gets."
    ),
    "action": "Go to New Batch to add parts",
}

_MOCK_INSIGHTS = [_SPARSE_INSIGHT]


# ── POST /api/insights ────────────────────────────────────────────

@app.post("/api/insights")
def insights(_ctx: AuthContext = Depends(get_auth_context)):
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        return {"insights": _MOCK_INSIGHTS}

    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    parts = (
        service.table("parts")
        .select("id, batch_ref, current_status, current_station, line_id, created_at")
        .eq("tenant_id", _ctx.tenant_id)
        .limit(100)
        .execute()
    ).data or []

    scans = (
        service.table("scans")
        .select("part_id, station_name, status, scanned_at, operator_name")
        .eq("tenant_id", _ctx.tenant_id)
        .gte("scanned_at", since_24h)
        .limit(200)
        .execute()
    ).data or []

    if not parts and not scans:
        return {"insights": [_SPARSE_INSIGHT]}

    status_counts: dict[str, int] = {}
    for p in parts:
        status_counts[p["current_status"]] = status_counts.get(p["current_status"], 0) + 1

    station_counts: dict[str, int] = {}
    for p in parts:
        if p["current_status"] == "wip":
            station_counts[p["current_station"]] = (
                station_counts.get(p["current_station"], 0) + 1
            )

    production_context = {
        "part_status_counts": status_counts,
        "wip_parts_per_station": station_counts,
        "total_parts": len(parts),
        "scans_last_24h": len(scans),
        "failed_qc_last_24h": sum(1 for s in scans if s["status"] == "failed_qc"),
        "completed_last_24h": sum(1 for s in scans if s["status"] == "completed"),
    }

    system_prompt = (
        'You are an AI production engineer watching a factory floor. Analyse this data and return 3-5 insights '
        'as a JSON object with key "insights" containing an array:\n'
        '{"insights": [{"type": "critical|warning|info|positive", "title": "...", "detail": "...", "action": "..."}]}\n'
        "Focus on: bottleneck stations, parts piling up, high failure rates, throughput issues, positive signals worth noting.\n"
        "Be specific with numbers from the data.\n"
        "Return ONLY valid JSON. No markdown."
    )

    try:
        groq = Groq(api_key=groq_key)
        completion = groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Production data:\n{json.dumps(production_context, indent=2)}\n\nGenerate 3-5 insights.",
                },
            ],
            temperature=0.3,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        insights_list = (
            parsed.get("insights", [_SPARSE_INSIGHT])
            if isinstance(parsed, dict)
            else [_SPARSE_INSIGHT]
        )
        return {"insights": insights_list}
    except Exception:
        return {"insights": _MOCK_INSIGHTS}


# ── POST /api/chat ────────────────────────────────────────────────

class ChatBody(BaseModel):
    question: str


@app.post("/api/chat")
def chat(body: ChatBody, _ctx: AuthContext = Depends(get_auth_context)):
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")

    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question required")

    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    parts = (
        service.table("parts")
        .select("batch_ref, current_status, current_station, line_id")
        .eq("tenant_id", _ctx.tenant_id)
        .limit(100)
        .execute()
    ).data or []

    scans = (
        service.table("scans")
        .select("station_name, status, scanned_at, operator_name")
        .eq("tenant_id", _ctx.tenant_id)
        .gte("scanned_at", since_24h)
        .limit(200)
        .execute()
    ).data or []

    lines = (
        service.table("production_lines")
        .select("id, name")
        .eq("tenant_id", _ctx.tenant_id)
        .limit(20)
        .execute()
    ).data or []

    status_counts: dict[str, int] = {}
    for p in parts:
        status_counts[p["current_status"]] = status_counts.get(p["current_status"], 0) + 1

    station_counts: dict[str, int] = {}
    for p in parts:
        if p["current_status"] == "wip":
            station_counts[p["current_station"]] = (
                station_counts.get(p["current_station"], 0) + 1
            )

    context = {
        "production_lines": [l["name"] for l in lines],
        "part_status_counts": status_counts,
        "wip_parts_per_station": station_counts,
        "total_parts": len(parts),
        "scans_last_24h": len(scans),
        "failed_qc_last_24h": sum(1 for s in scans if s["status"] == "failed_qc"),
        "completed_last_24h": sum(1 for s in scans if s["status"] == "completed"),
    }

    groq = Groq(api_key=groq_key)

    def generate():
        stream = groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an AI production engineer embedded in a factory floor management system. "
                        "Answer questions from production managers using the provided factory data. "
                        "Be specific with numbers. Under 100 words unless more detail needed. "
                        "Plain language — no jargon. Direct answer first, explanation second."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Factory data:\n{json.dumps(context, indent=2)}\n\nQuestion: {body.question}",
                },
            ],
            temperature=0.4,
            max_tokens=512,
            stream=True,
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content or ""
            if content:
                yield content

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


# ── GET /api/agent (Vercel cron) ──────────────────────────────────

@app.get("/api/agent")
def agent_cron(authorization: Optional[str] = Header(None)):
    cron_secret = os.environ.get("CRON_SECRET", "")
    if not cron_secret or authorization != f"Bearer {cron_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        return {"ok": True, "skipped": "no groq key"}

    since_1h = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    tenants = service.table("tenants").select("id, name").execute().data or []
    if not tenants:
        return {"ok": True, "processed": 0}

    groq = Groq(api_key=groq_key)
    alerts_created = 0

    for tenant in tenants:
        scans = (
            service.table("scans")
            .select("station_name, status, scanned_at")
            .eq("tenant_id", tenant["id"])
            .gte("scanned_at", since_1h)
            .limit(200)
            .execute()
        ).data or []

        parts = (
            service.table("parts")
            .select("current_status, current_station")
            .eq("tenant_id", tenant["id"])
            .eq("current_status", "wip")
            .limit(200)
            .execute()
        ).data or []

        if not scans:
            continue

        failed_count = sum(1 for s in scans if s["status"] == "failed_qc")
        failure_rate = failed_count / len(scans) if scans else 0

        if failure_rate < 0.1 and len(scans) < 3:
            continue

        station_counts: dict[str, int] = {}
        for p in parts:
            station_counts[p["current_station"]] = (
                station_counts.get(p["current_station"], 0) + 1
            )

        payload = {
            "tenant": tenant["name"],
            "scans_last_hour": len(scans),
            "failed_qc": failed_count,
            "failure_rate_pct": round(failure_rate * 100),
            "wip_per_station": station_counts,
        }

        try:
            completion = groq.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an AI production engineer monitoring a factory floor in real-time. "
                            "Analyze the data and return ONLY a JSON object:\n"
                            '{"alerts": [{"type": "critical|warning|info", "title": "string under 8 words", '
                            '"detail": "string under 25 words", "station": "string or null"}]}\n'
                            "Flag only real problems that need immediate attention. "
                            'Return {"alerts": []} if everything looks normal.'
                        ),
                    },
                    {"role": "user", "content": json.dumps(payload)},
                ],
                temperature=0.2,
                max_tokens=512,
                response_format={"type": "json_object"},
            )
            raw = completion.choices[0].message.content or "{}"
            parsed = json.loads(raw)
            alert_list = parsed.get("alerts", []) if isinstance(parsed, dict) else []

            if alert_list:
                service.table("ai_alerts").insert(
                    [
                        {
                            "tenant_id": tenant["id"],
                            "type": a.get("type", "info"),
                            "title": a["title"],
                            "detail": a["detail"],
                            "station": a.get("station"),
                        }
                        for a in alert_list
                    ]
                ).execute()
                alerts_created += len(alert_list)
        except Exception:
            continue

    return {"ok": True, "alerts_created": alerts_created}
