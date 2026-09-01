"""
FastAPI dependency: get_current_account
Extracts + verifies the Bearer token, checks the account is still active
(catches the fired-manager scenario from Task 2.8), and returns the account dict.

Role guard factories (require_roles, require_property_scope) are here so
authorization logic lives in dependencies, not scattered if-statements in routes.
"""

# pyrefly: ignore [missing-import]
from fastapi import Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from apps.authentication.jwt_utils import decode_access_token, get_account_by_id

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_account(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """Return the verified account dict or raise 401."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        ) from exc

    account_id = int(payload["sub"])
    # Task 2.8: verify account still exists and is not deactivated
    account = get_account_by_id(account_id)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    # Attach fresh role/property from DB (supports Option A + immediate revocation)
    account["email"] = payload["email"]
    return account


def require_roles(*roles: str):
    """Return a dependency that enforces role membership."""

    def _check(account: dict = Depends(get_current_account)) -> dict:
        if account["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource.",
            )
        return account

    return _check


def require_staff_or_above():
    return require_roles("staff", "manager", "owner")


def require_manager_or_owner():
    return require_roles("manager", "owner")


def require_owner():
    return require_roles("owner")


def get_optional_account(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    """Return account or None — for public endpoints that optionally accept a token."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        account_id = int(payload["sub"])
        account = get_account_by_id(account_id)
        if account:
            account["email"] = payload["email"]
        return account
    except Exception:
        return None
