import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

from auth import AuthContext, get_auth_context

app = FastAPI(title="FactoryOS Backend")

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


# ── POST /api/signup ──────────────────────────────────────────────

class SignupBody(BaseModel):
    userId: str
    factoryName: str
    fullName: str


@app.post("/api/signup")
def signup(body: SignupBody):
    try:
        user_resp = service.auth.admin.get_user_by_id(body.userId)
        if not user_resp.user:
            raise HTTPException(status_code=404, detail="User not found.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="User not found.")

    base = re.sub(r"[^a-z0-9]+", "-", body.factoryName.lower()).strip("-")
    slug = f"{base}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"

    tenant_resp = (
        service.table("tenants")
        .insert({"name": body.factoryName, "slug": slug})
        .execute()
    )
    if not tenant_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create tenant.")

    tenant = tenant_resp.data[0]

    profile_resp = (
        service.table("profiles")
        .upsert(
            {
                "id": body.userId,
                "tenant_id": tenant["id"],
                "full_name": body.fullName,
                "role": "admin",
            }
        )
        .execute()
    )
    if not profile_resp.data:
        service.table("tenants").delete().eq("id", tenant["id"]).execute()
        raise HTTPException(status_code=500, detail="Failed to create profile.")

    return {"ok": True}


# ── GET /api/scan/{item_id} ───────────────────────────────────────

@app.get("/api/scan/{item_id}")
def get_scan(item_id: str):
    part_resp = (
        service.table("parts")
        .select("*, production_lines(name)")
        .eq("id", item_id)
        .execute()
    )
    part = part_resp.data[0] if part_resp.data else None

    if part:
        stations_resp = (
            service.table("line_stations")
            .select("station_name, sequence_order")
            .eq("line_id", part["line_id"])
            .order("sequence_order")
            .execute()
        )
        stations = [s["station_name"] for s in (stations_resp.data or [])]
        line = part.get("production_lines") or {}
        return {
            "type": "part",
            "part": {
                "id": part["id"],
                "qr_code": part["qr_code"],
                "batch_ref": part["batch_ref"],
                "current_station": part["current_station"],
                "current_status": part["current_status"],
                "line_name": line.get("name", "") if isinstance(line, dict) else "",
            },
            "stations": stations,
        }

    wo_resp = (
        service.table("work_orders").select("*").eq("id", item_id).execute()
    )
    wo = wo_resp.data[0] if wo_resp.data else None

    if not wo:
        raise HTTPException(status_code=404, detail="Not found.")

    return {"type": "work_order", "workOrder": wo}


# ── POST /api/scan/{item_id} ──────────────────────────────────────

def _shift_from_time() -> str:
    hour = datetime.now().hour
    if 6 <= hour < 14:
        return "morning"
    if 14 <= hour < 22:
        return "afternoon"
    return "night"


class ScanAction(BaseModel):
    station_name: str
    action: str
    operator_name: Optional[str] = None
    worker_note: Optional[str] = None


@app.post("/api/scan/{item_id}")
def post_scan(item_id: str, body: ScanAction):
    if not body.station_name or not body.action:
        raise HTTPException(
            status_code=400, detail="station_name and action are required."
        )

    part_resp = (
        service.table("parts")
        .select("id, tenant_id, line_id, current_station, current_status")
        .eq("id", item_id)
        .execute()
    )
    part = part_resp.data[0] if part_resp.data else None

    if part:
        scan_status = (
            "completed"
            if body.action == "completed"
            else "failed_qc"
            if body.action == "failed_qc"
            else "started"
        )
        service.table("scans").insert(
            {
                "tenant_id": part["tenant_id"],
                "part_id": part["id"],
                "station_name": body.station_name,
                "status": scan_status,
                "operator_name": body.operator_name,
                "worker_note": body.worker_note,
                "scanned_at": datetime.now(timezone.utc).isoformat(),
                "shift": _shift_from_time(),
            }
        ).execute()

        if body.action in ("completed", "failed_qc", "scrapped"):
            new_status = part["current_status"]
            new_station = part["current_station"]

            if body.action == "failed_qc":
                new_status = "failed_qc"
            elif body.action == "scrapped":
                new_status = "scrapped"
            else:
                stations_resp = (
                    service.table("line_stations")
                    .select("station_name, sequence_order")
                    .eq("line_id", part["line_id"])
                    .order("sequence_order")
                    .execute()
                )
                all_stations = stations_resp.data or []
                idx = next(
                    (
                        i
                        for i, s in enumerate(all_stations)
                        if s["station_name"] == body.station_name
                    ),
                    -1,
                )
                nxt = (
                    all_stations[idx + 1]
                    if idx >= 0 and idx + 1 < len(all_stations)
                    else None
                )
                if nxt:
                    new_station = nxt["station_name"]
                    new_status = "wip"
                else:
                    new_status = "done"

            service.table("parts").update(
                {"current_station": new_station, "current_status": new_status}
            ).eq("id", part["id"]).execute()
            return {"ok": True, "newStatus": new_status, "newStation": new_station}

        return {"ok": True}

    wo_resp = (
        service.table("work_orders").select("tenant_id").eq("id", item_id).execute()
    )
    wo = wo_resp.data[0] if wo_resp.data else None

    if not wo:
        raise HTTPException(status_code=404, detail="Not found.")

    service.table("scans").insert(
        {
            "tenant_id": wo["tenant_id"],
            "work_order_id": item_id,
            "station_name": body.station_name,
            "status": body.action,
            "operator_name": body.operator_name,
            "worker_note": body.worker_note,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "shift": _shift_from_time(),
        }
    ).execute()

    return {"ok": True}


# ── GET /api/dashboard/station-status ────────────────────────────

_MOCK_LINES = [
    {
        "line_id": "mock-line-1",
        "line_name": "Assembly Line A",
        "total_wip": 48,
        "stations": [
            {"station_name": "SMT",              "sequence_order": 0, "target_mins": 5,   "parts_here": 12, "rework_parts": 0, "completed_today": 45, "avg_cycle_mins": 5.2},
            {"station_name": "Soldering",         "sequence_order": 1, "target_mins": 5.5, "parts_here": 8,  "rework_parts": 2, "completed_today": 38, "avg_cycle_mins": 6.1},
            {"station_name": "Visual Inspection", "sequence_order": 2, "target_mins": 6.4, "parts_here": 23, "rework_parts": 0, "completed_today": 31, "avg_cycle_mins": 14.8},
            {"station_name": "Functional Test",   "sequence_order": 3, "target_mins": 7,   "parts_here": 5,  "rework_parts": 0, "completed_today": 42, "avg_cycle_mins": 7.3},
            {"station_name": "Packaging",         "sequence_order": 4, "target_mins": 4.5, "parts_here": 0,  "rework_parts": 0, "completed_today": 40, "avg_cycle_mins": 4.4},
        ],
    },
    {
        "line_id": "mock-line-2",
        "line_name": "Assembly Line B",
        "total_wip": 17,
        "stations": [
            {"station_name": "Machining", "sequence_order": 0, "target_mins": 10, "parts_here": 6,  "rework_parts": 0, "completed_today": 28, "avg_cycle_mins": 9.1},
            {"station_name": "Grinding",  "sequence_order": 1, "target_mins": 7,  "parts_here": 11, "rework_parts": 1, "completed_today": 22, "avg_cycle_mins": 8.2},
            {"station_name": "Assembly",  "sequence_order": 2, "target_mins": 8,  "parts_here": 0,  "rework_parts": 0, "completed_today": 19, "avg_cycle_mins": 8.0},
        ],
    },
]


@app.get("/api/dashboard/station-status")
def station_status(ctx: AuthContext = Depends(get_auth_context)):
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    lines_resp = (
        service.table("production_lines")
        .select("id, name")
        .eq("tenant_id", ctx.tenant_id)
        .order("created_at")
        .execute()
    )
    lines = lines_resp.data or []

    if not lines:
        return {"lines": _MOCK_LINES, "isDemo": True}

    all_stations_resp = (
        service.table("line_stations")
        .select("id, line_id, station_name, sequence_order, target_mins")
        .eq("tenant_id", ctx.tenant_id)
        .order("sequence_order")
        .execute()
    )
    all_stations = all_stations_resp.data or []

    wip_parts = (
        service.table("parts")
        .select("line_id, current_station")
        .eq("tenant_id", ctx.tenant_id)
        .eq("current_status", "wip")
        .execute()
    ).data or []

    rework_parts = (
        service.table("parts")
        .select("line_id, current_station")
        .eq("tenant_id", ctx.tenant_id)
        .eq("current_status", "failed_qc")
        .execute()
    ).data or []

    today_scans = (
        service.table("scans")
        .select("part_id, work_order_id, station_name, status, scanned_at")
        .eq("tenant_id", ctx.tenant_id)
        .gte("scanned_at", today_start.isoformat())
        .in_("status", ["started", "completed"])
        .execute()
    ).data or []

    cycle_map: dict[str, list[float]] = {}
    completed_today: dict[str, int] = {}
    started: dict[str, datetime] = {}

    for scan in today_scans:
        key = f"{scan.get('part_id') or scan.get('work_order_id')}-{scan['station_name']}"
        if scan["status"] == "started":
            started[key] = datetime.fromisoformat(
                scan["scanned_at"].replace("Z", "+00:00")
            )
        elif scan["status"] == "completed":
            completed_today[scan["station_name"]] = (
                completed_today.get(scan["station_name"], 0) + 1
            )
            if key in started:
                scanned_dt = datetime.fromisoformat(
                    scan["scanned_at"].replace("Z", "+00:00")
                )
                mins = (scanned_dt - started[key]).total_seconds() / 60
                cycle_map.setdefault(scan["station_name"], []).append(mins)
                del started[key]

    wip_at: dict[str, dict[str, int]] = {}
    for p in wip_parts:
        wip_at.setdefault(p["line_id"], {})[p["current_station"]] = (
            wip_at.get(p["line_id"], {}).get(p["current_station"], 0) + 1
        )

    rework_at: dict[str, dict[str, int]] = {}
    for p in rework_parts:
        rework_at.setdefault(p["line_id"], {})[p["current_station"]] = (
            rework_at.get(p["line_id"], {}).get(p["current_station"], 0) + 1
        )

    result = []
    for line in lines:
        station_rows = []
        for s in [x for x in all_stations if x["line_id"] == line["id"]]:
            times = cycle_map.get(s["station_name"], [])
            avg = round(sum(times) / len(times) * 10) / 10 if times else None
            station_rows.append(
                {
                    "station_name": s["station_name"],
                    "sequence_order": s["sequence_order"],
                    "target_mins": s["target_mins"],
                    "parts_here": wip_at.get(line["id"], {}).get(s["station_name"], 0),
                    "rework_parts": rework_at.get(line["id"], {}).get(s["station_name"], 0),
                    "completed_today": completed_today.get(s["station_name"], 0),
                    "avg_cycle_mins": avg,
                }
            )
        total_wip = sum(s["parts_here"] for s in station_rows)
        result.append(
            {
                "line_id": line["id"],
                "line_name": line["name"],
                "stations": station_rows,
                "total_wip": total_wip,
            }
        )

    return {"lines": result, "isDemo": False}


# ── GET /api/daily-targets ────────────────────────────────────────

@app.get("/api/daily-targets")
def get_daily_targets(ctx: AuthContext = Depends(get_auth_context)):
    week_ago = (datetime.now(timezone.utc) - timedelta(days=6)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    targets = (
        service.table("daily_targets")
        .select("date, target_qty")
        .eq("tenant_id", ctx.tenant_id)
        .gte("date", week_ago.strftime("%Y-%m-%d"))
        .execute()
    ).data or []

    scans = (
        service.table("scans")
        .select("part_id, scanned_at")
        .eq("tenant_id", ctx.tenant_id)
        .eq("status", "completed")
        .gte("scanned_at", week_ago.isoformat())
        .execute()
    ).data or []

    target_map = {t["date"]: t["target_qty"] for t in targets}

    produced_map: dict[str, set] = {}
    for s in scans:
        date = s["scanned_at"][:10]
        if s.get("part_id"):
            produced_map.setdefault(date, set()).add(s["part_id"])

    days = []
    for i in range(6, -1, -1):
        d = datetime.now(timezone.utc) - timedelta(days=i)
        date = d.strftime("%Y-%m-%d")
        label = "Today" if i == 0 else d.strftime("%a")
        days.append(
            {
                "date": date,
                "label": label,
                "planned": target_map.get(date, 0),
                "produced": len(produced_map.get(date, set())),
            }
        )

    return {"days": days}


# ── POST /api/daily-targets ───────────────────────────────────────

class DailyTargetBody(BaseModel):
    date: str
    target_qty: int


@app.post("/api/daily-targets")
def post_daily_targets(body: DailyTargetBody, ctx: AuthContext = Depends(get_auth_context)):
    service.table("daily_targets").upsert(
        {"tenant_id": ctx.tenant_id, "date": body.date, "target_qty": body.target_qty},
        on_conflict="tenant_id,date",
    ).execute()

    return {"ok": True}
