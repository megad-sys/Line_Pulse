import os

# Must set env vars before importing main/auth (module-level create_client calls)
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

with patch("supabase.create_client", return_value=MagicMock()):
    import auth
    import main
    from main import app

client = TestClient(app)

VALID_TOKEN = "Bearer valid-test-token"
MOCK_TENANT_ID = "tenant-abc"
MOCK_USER_ID = "user-123"


def _mock_auth_clients(anon_mock: MagicMock, svc_mock: MagicMock, role: str = "admin"):
    """Wire up anon + service mocks so get_auth_context succeeds."""
    user = MagicMock()
    user.id = MOCK_USER_ID
    anon_mock.auth.get_user.return_value = MagicMock(user=user)
    profile_resp = MagicMock()
    profile_resp.data = [{"tenant_id": MOCK_TENANT_ID, "role": role}]
    (
        svc_mock.table.return_value
        .select.return_value
        .eq.return_value
        .execute.return_value
    ) = profile_resp


# ── Auth protection ───────────────────────────────────────────────

@pytest.mark.parametrize("method,path,body", [
    ("GET",  "/api/dashboard/station-status", None),
    ("GET",  "/api/daily-targets",            None),
    ("POST", "/api/daily-targets",            {"date": "2024-01-01", "target_qty": 10}),
])
def test_protected_routes_require_auth(method, path, body):
    if method == "GET":
        resp = client.get(path)
    else:
        resp = client.post(path, json=body)
    assert resp.status_code == 401


# ── POST /api/signup ──────────────────────────────────────────────

def test_signup_missing_fields():
    resp = client.post("/api/signup", json={"userId": "u1"})
    assert resp.status_code == 422


def test_signup_user_not_found():
    with patch.object(main.service.auth.admin, "get_user_by_id", side_effect=Exception("not found")):
        resp = client.post("/api/signup", json={
            "userId": "u1",
            "factoryName": "ACME",
            "fullName": "Alice",
        })
    assert resp.status_code == 404


def test_signup_success():
    mock_admin = MagicMock()
    mock_admin.get_user_by_id.return_value = MagicMock(user=MagicMock(id="u1"))

    tenant_resp = MagicMock(data=[{"id": "t1", "name": "ACME"}])
    profile_resp = MagicMock(data=[{"id": "u1"}])

    with (
        patch.object(main.service.auth, "admin", mock_admin),
        patch.object(
            main.service, "table",
            side_effect=lambda t: _table_mock(t, {
                "tenants":  {"insert": tenant_resp},
                "profiles": {"upsert": profile_resp},
            }),
        ),
    ):
        resp = client.post("/api/signup", json={
            "userId": "u1",
            "factoryName": "ACME",
            "fullName": "Alice",
        })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# ── GET /api/scan/{id} ────────────────────────────────────────────

def test_scan_get_not_found():
    with patch.object(main.service, "table") as tbl:
        tbl.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        resp = client.get("/api/scan/nonexistent")
    assert resp.status_code == 404


def test_scan_get_part_found():
    part_data = [{
        "id": "p1", "qr_code": "QR1", "batch_ref": "B1",
        "current_station": "SMT", "current_status": "wip",
        "line_id": "l1", "production_lines": {"name": "Line A"},
    }]
    stations_data = [
        {"station_name": "SMT", "sequence_order": 0},
        {"station_name": "Soldering", "sequence_order": 1},
    ]

    call_count = 0

    def table_side(name):
        nonlocal call_count
        m = MagicMock()
        if call_count == 0:
            call_count += 1
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=part_data)
        else:
            m.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=stations_data)
        return m

    with patch.object(main.service, "table", side_effect=table_side):
        resp = client.get("/api/scan/p1")

    assert resp.status_code == 200
    body = resp.json()
    assert body["type"] == "part"
    assert body["part"]["id"] == "p1"
    assert body["stations"] == ["SMT", "Soldering"]


def test_scan_get_work_order_fallback():
    wo_data = [{"id": "wo1", "tenant_id": "t1", "status": "open"}]
    call_count = 0

    def table_side(_name):
        nonlocal call_count
        m = MagicMock()
        if call_count == 0:
            call_count += 1
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        else:
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=wo_data)
        return m

    with patch.object(main.service, "table", side_effect=table_side):
        resp = client.get("/api/scan/wo1")

    assert resp.status_code == 200
    assert resp.json()["type"] == "work_order"


# ── POST /api/scan/{id} ───────────────────────────────────────────

def test_scan_post_missing_station():
    resp = client.post("/api/scan/p1", json={"action": "started"})
    assert resp.status_code == 422


def test_scan_post_completed_advances_station():
    part_data = [{"id": "p1", "tenant_id": "t1", "line_id": "l1",
                  "current_station": "SMT", "current_status": "wip"}]
    stations_data = [
        {"station_name": "SMT",      "sequence_order": 0},
        {"station_name": "Soldering","sequence_order": 1},
    ]

    call_count = 0

    def table_side(name):
        nonlocal call_count
        m = MagicMock()
        if call_count == 0:  # parts select
            call_count += 1
            m.select.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=part_data)
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=part_data)
        elif call_count == 1:  # scans insert
            call_count += 1
            m.insert.return_value.execute.return_value = MagicMock()
        elif call_count == 2:  # line_stations
            call_count += 1
            m.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=stations_data)
        else:  # parts update
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        return m

    with patch.object(main.service, "table", side_effect=table_side):
        resp = client.post("/api/scan/p1", json={
            "station_name": "SMT",
            "action": "completed",
        })

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["newStation"] == "Soldering"
    assert body["newStatus"] == "wip"


def test_scan_post_completed_last_station():
    part_data = [{"id": "p1", "tenant_id": "t1", "line_id": "l1",
                  "current_station": "Packaging", "current_status": "wip"}]
    stations_data = [
        {"station_name": "SMT",       "sequence_order": 0},
        {"station_name": "Packaging", "sequence_order": 1},
    ]

    call_count = 0

    def table_side(name):
        nonlocal call_count
        m = MagicMock()
        if call_count == 0:
            call_count += 1
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=part_data)
        elif call_count == 1:
            call_count += 1
            m.insert.return_value.execute.return_value = MagicMock()
        elif call_count == 2:
            call_count += 1
            m.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=stations_data)
        else:
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        return m

    with patch.object(main.service, "table", side_effect=table_side):
        resp = client.post("/api/scan/p1", json={
            "station_name": "Packaging",
            "action": "completed",
        })

    assert resp.status_code == 200
    assert resp.json()["newStatus"] == "done"


def test_scan_post_failed_qc():
    part_data = [{"id": "p1", "tenant_id": "t1", "line_id": "l1",
                  "current_station": "SMT", "current_status": "wip"}]

    call_count = 0

    def table_side(name):
        nonlocal call_count
        m = MagicMock()
        if call_count == 0:
            call_count += 1
            m.select.return_value.eq.return_value.execute.return_value = MagicMock(data=part_data)
        elif call_count == 1:
            call_count += 1
            m.insert.return_value.execute.return_value = MagicMock()
        else:
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        return m

    with patch.object(main.service, "table", side_effect=table_side):
        resp = client.post("/api/scan/p1", json={
            "station_name": "SMT",
            "action": "failed_qc",
        })

    assert resp.status_code == 200
    assert resp.json()["newStatus"] == "failed_qc"


# ── GET /api/dashboard/station-status ────────────────────────────

def test_station_status_demo_when_no_lines():
    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
    ):
        _mock_auth_clients(anon_mock, svc_mock)
        lines_resp = MagicMock(data=[])
        svc.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = lines_resp

        resp = client.get(
            "/api/dashboard/station-status",
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["isDemo"] is True
    assert len(body["lines"]) > 0


def test_station_status_real_data():
    lines_data = [{"id": "l1", "name": "Line A"}]
    stations_data = [{"id": "s1", "line_id": "l1", "station_name": "SMT",
                      "sequence_order": 0, "target_mins": 5}]

    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
    ):
        _mock_auth_clients(anon_mock, svc_mock)

        call_count = 0

        def table_side(_name):
            nonlocal call_count
            m = MagicMock()
            if call_count == 0:   # production_lines
                call_count += 1
                m.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=lines_data)
            elif call_count == 1:  # line_stations
                call_count += 1
                m.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=stations_data)
            elif call_count in (2, 3):  # wip + rework parts
                call_count += 1
                m.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            else:  # scans
                m.select.return_value.eq.return_value.gte.return_value.in_.return_value.execute.return_value = MagicMock(data=[])
            return m

        svc.table.side_effect = table_side

        resp = client.get(
            "/api/dashboard/station-status",
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["isDemo"] is False
    assert body["lines"][0]["line_name"] == "Line A"


# ── GET /api/daily-targets ────────────────────────────────────────

def test_daily_targets_get():
    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
    ):
        _mock_auth_clients(anon_mock, svc_mock)

        call_count = 0

        def table_side(_name):
            nonlocal call_count
            m = MagicMock()
            if call_count == 0:  # daily_targets
                call_count += 1
                m.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(data=[])
            else:  # scans
                m.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(data=[])
            return m

        svc.table.side_effect = table_side

        resp = client.get(
            "/api/daily-targets",
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "days" in body
    assert len(body["days"]) == 7


# ── POST /api/daily-targets ───────────────────────────────────────

def test_daily_targets_post():
    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
    ):
        _mock_auth_clients(anon_mock, svc_mock)
        svc.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        resp = client.post(
            "/api/daily-targets",
            json={"date": "2024-01-15", "target_qty": 100},
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# ── helpers ───────────────────────────────────────────────────────

def _table_mock(table_name: str, overrides: dict) -> MagicMock:
    m = MagicMock()
    cfg = overrides.get(table_name, {})
    for method, ret in cfg.items():
        getattr(m, method).return_value.execute.return_value = ret
    return m
