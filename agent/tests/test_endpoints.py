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
CRON_SECRET = "test-cron-secret"


def _mock_auth_clients(anon_mock: MagicMock, svc_mock: MagicMock, role: str = "admin"):
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


# ── POST /api/insights ────────────────────────────────────────────

def test_insights_no_auth():
    resp = client.post("/api/insights")
    assert resp.status_code == 401


def test_insights_no_groq_key():
    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.dict(os.environ, {}, clear=False),
        patch.object(main, "service"),
    ):
        _mock_auth_clients(anon_mock, svc_mock)
        os.environ.pop("GROQ_API_KEY", None)

        resp = client.post(
            "/api/insights",
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "insights" in body
    assert len(body["insights"]) > 0


def test_insights_no_data_returns_sparse():
    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
        patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
        patch("main.Groq") as mock_groq_cls,
    ):
        _mock_auth_clients(anon_mock, svc_mock)

        # Both parts and scans return empty
        svc.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        svc.table.return_value.select.return_value.eq.return_value.gte.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

        resp = client.post(
            "/api/insights",
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["insights"][0]["title"] == "Your AI engineer is watching"


def test_insights_calls_groq():
    groq_response = MagicMock()
    groq_response.choices[0].message.content = '{"insights": [{"type": "info", "title": "Test insight", "detail": "detail", "action": "none"}]}'

    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
        patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
        patch("main.Groq") as mock_groq_cls,
    ):
        _mock_auth_clients(anon_mock, svc_mock)
        mock_groq_cls.return_value.chat.completions.create.return_value = groq_response

        parts_data = [{"id": "p1", "batch_ref": "B1", "current_status": "wip",
                       "current_station": "SMT", "line_id": "l1", "created_at": "2024-01-01"}]
        scans_data = [{"part_id": "p1", "station_name": "SMT", "status": "completed",
                       "scanned_at": "2024-01-01T10:00:00Z", "operator_name": "Bob"}]

        call_count = 0

        def table_side(_name):
            nonlocal call_count
            m = MagicMock()
            if call_count == 0:
                call_count += 1
                m.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=parts_data)
            else:
                m.select.return_value.eq.return_value.gte.return_value.limit.return_value.execute.return_value = MagicMock(data=scans_data)
            return m

        svc.table.side_effect = table_side

        resp = client.post(
            "/api/insights",
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    assert resp.json()["insights"][0]["title"] == "Test insight"


# ── POST /api/chat ────────────────────────────────────────────────

def test_chat_no_auth():
    resp = client.post("/api/chat", json={"question": "hello"})
    assert resp.status_code == 401


def test_chat_empty_question():
    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service"),
        patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
    ):
        _mock_auth_clients(anon_mock, svc_mock)

        resp = client.post(
            "/api/chat",
            json={"question": "   "},
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 400


def test_chat_streams_response():
    mock_chunk = MagicMock()
    mock_chunk.choices[0].delta.content = "Hello from AI"

    with (
        patch.object(auth, "_anon_client") as anon_mock,
        patch.object(auth, "_service_client") as svc_mock,
        patch.object(main, "service") as svc,
        patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
        patch("main.Groq") as mock_groq_cls,
    ):
        _mock_auth_clients(anon_mock, svc_mock)
        mock_groq_cls.return_value.chat.completions.create.return_value = iter([mock_chunk])

        # All DB calls return empty
        empty = MagicMock(data=[])
        svc.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = empty
        svc.table.return_value.select.return_value.eq.return_value.gte.return_value.limit.return_value.execute.return_value = empty

        resp = client.post(
            "/api/chat",
            json={"question": "What is happening on the floor?"},
            headers={"Authorization": VALID_TOKEN},
        )

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "Hello from AI" in resp.text


# ── GET /api/agent (cron) ─────────────────────────────────────────

def test_agent_cron_wrong_secret():
    with patch.dict(os.environ, {"CRON_SECRET": CRON_SECRET}):
        resp = client.get(
            "/api/agent",
            headers={"Authorization": "Bearer wrong-secret"},
        )
    assert resp.status_code == 401


def test_agent_cron_no_tenants():
    with (
        patch.dict(os.environ, {"CRON_SECRET": CRON_SECRET, "GROQ_API_KEY": "test-key"}),
        patch.object(main, "service") as svc,
    ):
        svc.table.return_value.select.return_value.execute.return_value = MagicMock(data=[])

        resp = client.get(
            "/api/agent",
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["processed"] == 0


def test_agent_cron_no_groq_key():
    with patch.dict(os.environ, {"CRON_SECRET": CRON_SECRET}, clear=False):
        os.environ.pop("GROQ_API_KEY", None)

        resp = client.get(
            "/api/agent",
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
        )

    assert resp.status_code == 200
    assert resp.json().get("skipped") is not None
