import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException
from supabase import Client, create_client

# Module-level — one client per process, not per request
_anon_client: Client = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
)
_service_client: Client = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)


@dataclass
class AuthContext:
    user_id: str
    tenant_id: str
    role: str  # "admin" | "worker"


def get_auth_context(authorization: Optional[str] = Header(None)) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ", 1)[1]
    try:
        resp = _anon_client.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not resp or not resp.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = resp.user.id
    row = _service_client.table("profiles").select("tenant_id, role").eq("id", user_id).execute()
    profile = row.data[0] if row.data else None
    if not profile or not profile.get("tenant_id"):
        raise HTTPException(status_code=403, detail="No tenant associated with user.")

    return AuthContext(
        user_id=user_id,
        tenant_id=profile["tenant_id"],
        role=profile.get("role", "worker"),
    )


def require_admin(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if ctx.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")
    return ctx
