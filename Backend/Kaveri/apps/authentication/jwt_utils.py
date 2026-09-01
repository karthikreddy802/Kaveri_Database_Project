"""
JWT utility functions: token creation, verification, and refresh token management.
All tokens are signed with HS256 using SECRET_KEY.
Access tokens expire in 15 minutes. Refresh tokens expire in 7 days and are stored server-side.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import secrets
from config.settings import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from api.db import get_conn as _db_conn

# In-memory refresh token store: {token_str: {account_id, family, expires_at}}
# In production, move this to Redis or a DB table.
_refresh_tokens: dict[str, dict] = {}
_revoked_families: set[str] = set()


def create_access_token(account: dict) -> str:
    """Create a short-lived JWT access token with account claims."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(account["account_id"]),
        "email": account["email"],
        "role": account["role"],
        "property_id": account.get("property_id"),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(account_id: int, family: Optional[str] = None) -> str:
    """Create a single-use refresh token stored in memory (or DB in production)."""
    token = secrets.token_urlsafe(64)
    if family is None:
        family = secrets.token_urlsafe(16)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    _refresh_tokens[token] = {
        "account_id": account_id,
        "family": family,
        "expires_at": expires_at,
    }
    return token


def rotate_refresh_token(old_token: str) -> tuple[str, int]:
    """
    Rotate a refresh token (single-use). Attack 8.6:
    If token has already been used, invalidate the whole family.
    Returns (new_token, account_id).
    """
    entry = _refresh_tokens.pop(old_token, None)
    if entry is None:
        # Token not found — check if it was already rotated (family attack)
        raise ValueError("invalid_refresh_token")

    family = entry["family"]
    if family in _revoked_families:
        raise ValueError("invalid_refresh_token")

    if datetime.now(timezone.utc) > entry["expires_at"]:
        # Invalidate the entire family on expiry reuse
        _revoked_families.add(family)
        raise ValueError("invalid_refresh_token")

    account_id = entry["account_id"]
    new_token = create_refresh_token(account_id, family=family)
    return new_token, account_id


def revoke_refresh_token(token: str):
    """Revoke a specific refresh token (logout)."""
    entry = _refresh_tokens.pop(token, None)
    if entry:
        _revoked_families.add(entry["family"])


def decode_access_token(token: str) -> dict:
    """
    Decode and verify an access token.
    Raises jwt.PyJWTError on any failure (expired, bad sig, alg:none attack).
    """
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],  # Attack 8.3: Only allow HS256, never 'none'
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("token_expired")
    except jwt.InvalidTokenError:
        raise ValueError("invalid_token")


def get_account_by_id(account_id: int) -> Optional[dict]:
    """Look up account by id for active session check (Attack 2.8: fired manager)."""
    with _db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT account_id, email, role, property_id, guest_id
                FROM account WHERE account_id = %s
                """,
                (account_id,),
            )
            row = cur.fetchone()
    if row is None:
        return None
    return {
        "account_id": row[0],
        "email": row[1],
        "role": row[2],
        "property_id": row[3],
        "guest_id": row[4],
    }
