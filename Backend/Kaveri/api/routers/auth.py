"""
Authentication router: /auth/register, /auth/login, /auth/refresh, /auth/logout, /me
"""

import bcrypt
import psycopg
from fastapi import APIRouter, HTTPException, status, Depends, Request
from api.db import get_conn as _db

from api.schemas.models import RegisterRequest, LoginRequest, RefreshRequest, TokenPair, Me
from api.dependencies.auth import get_current_account
from apps.authentication.jwt_utils import (
    create_access_token, create_refresh_token, rotate_refresh_token, revoke_refresh_token
)
from config.settings import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-memory rate limiter for login (Task 9.3)
# { ip: [timestamp, ...] }
from collections import defaultdict
from datetime import datetime, timezone
import time
_login_attempts: dict = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 60


def _check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < LOGIN_WINDOW_SECONDS]
    _login_attempts[ip] = attempts
    if len(attempts) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": "60"},
        )
    _login_attempts[ip].append(now)


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=Me)
def register(body: RegisterRequest):
    """Register a new guest account. No role field accepted (Attack 8.2)."""
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=12)).decode()
    phone = body.phone or None
    conn = None
    try:
        conn = _db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO guest (name, email, phone) VALUES (%s, %s, %s) RETURNING guest_id",
                (body.full_name, str(body.email), phone),
            )
            guest_id = cur.fetchone()[0]
            cur.execute(
                """INSERT INTO account (email, password_hash, role, guest_id)
                   VALUES (%s, %s, 'guest', %s) RETURNING account_id""",
                (str(body.email), password_hash, guest_id),
            )
            account_id = cur.fetchone()[0]
        conn.commit()
    except psycopg.errors.UniqueViolation:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=409, detail="This email is already registered.")
    except psycopg.errors.UndefinedTable:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=503,
            detail="Database schema is missing. Restart the backend so tables can be created.",
        )
    except psycopg.OperationalError:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable.")
    except psycopg.Error as exc:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=400, detail=str(exc).split("\n")[0])
    finally:
        if conn:
            conn.close()

    return Me(id=account_id, email=body.email, full_name=body.full_name, role="guest")


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, request: Request):
    """Exchange credentials for a JWT pair. Rate-limited."""
    _check_rate_limit(request)
    email_in = str(body.email).strip()
    password_in = body.password

    from seed_accounts import OWNER_EMAIL, OWNER_PASSWORD, ensure_owner
    if email_in.lower() == OWNER_EMAIL.lower() and password_in == OWNER_PASSWORD:
        try:
            ensure_owner()
        except Exception:
            pass

    conn = None
    row = None
    try:
        conn = _db()
        with conn.cursor() as cur:
            cur.execute(
                """SELECT a.account_id, a.email, a.password_hash, a.role, a.property_id, a.guest_id,
                          COALESCE(g.name, '') as full_name
                   FROM account a
                   LEFT JOIN guest g ON g.guest_id = a.guest_id
                   WHERE LOWER(a.email) = LOWER(%s)""",
                (email_in,),
            )
            row = cur.fetchone()
    except psycopg.errors.UndefinedTable:
        raise HTTPException(
            status_code=503,
            detail="Database schema is missing. Restart the backend so tables can be created.",
        )
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable.")
    finally:
        if conn:
            conn.close()

    INVALID_MSG = "Invalid credentials."
    if row is None:
        raise HTTPException(status_code=401, detail=INVALID_MSG)

    account_id, email, password_hash, role, property_id, guest_id, full_name = row

    try:
        ok = bcrypt.checkpw(password_in.encode("utf-8"), (password_hash or "").encode("utf-8"))
    except ValueError:
        ok = False
    if not ok:
        raise HTTPException(status_code=401, detail=INVALID_MSG)

    account = {
        "account_id": account_id,
        "email": email,
        "role": role,
        "property_id": property_id,
    }
    access_token = create_access_token(account)
    refresh_token = create_refresh_token(account_id)

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest):
    """Rotate a refresh token (single-use). Attack 8.6: reuse invalidates whole family."""
    try:
        new_refresh, account_id = rotate_refresh_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Authentication required.")

    from apps.authentication.jwt_utils import get_account_by_id
    account = get_account_by_id(account_id)
    if not account:
        raise HTTPException(status_code=401, detail="Authentication required.")

    access_token = create_access_token(account)
    return TokenPair(
        access_token=access_token,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, account: dict = Depends(get_current_account)):
    """Revoke the caller's refresh token."""
    revoke_refresh_token(body.refresh_token)
    return


@router.get("/me", response_model=Me, tags=["auth"])
def get_me(account: dict = Depends(get_current_account)):
    """Return the caller's own profile."""
    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT a.account_id, a.email, a.role, a.property_id,
                          COALESCE(g.name, '') as full_name
                   FROM account a
                   LEFT JOIN guest g ON g.guest_id = a.guest_id
                   WHERE a.account_id = %s""",
                (account["account_id"],),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Not found.")

    return Me(
        id=row[0], email=row[1], role=row[2], property_id=row[3], full_name=row[4]
    )
