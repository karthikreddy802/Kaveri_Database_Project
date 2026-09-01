import logging
import os
import uuid
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import utils as django_db_utils
import psycopg

logger = logging.getLogger("kaveri_stays.exceptions")

def format_error_response(code: str, message: str, detail = None, status_code: int = 500) -> JSONResponse:
    request_id = str(uuid.uuid4())
    content = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id
        }
    }
    if detail is not None:
        content["error"]["detail"] = detail
        
    return JSONResponse(status_code=status_code, content=content)

def pydantic_validation_exception_handler(request: Request, exc: RequestValidationError):
    detail = []
    for err in exc.errors():
        # Get the field name from loc path
        field = str(err["loc"][-1]) if err["loc"] else "body"
        # Simplify the error message
        reason = err["msg"]
        detail.append({
            "field": field,
            "reason": reason
        })
        
    logger.warning(f"Validation failed: {detail}")
    return format_error_response(
        code="validation_failed",
        message="Request validation failed.",
        detail=detail,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
    )

def django_validation_exception_handler(request: Request, exc: DjangoValidationError):
    detail = []
    if hasattr(exc, "message_dict"):
        for field, messages in exc.message_dict.items():
            for msg in messages:
                detail.append({
                    "field": field,
                    "reason": msg
                })
    else:
        for msg in exc.messages:
            detail.append({
                "field": "non_field_errors",
                "reason": msg
            })
            
    logger.warning(f"Django validation failed: {detail}")
    return format_error_response(
        code="validation_failed",
        message="Request validation failed.",
        detail=detail,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
    )

def django_db_integrity_exception_handler(request: Request, exc: django_db_utils.IntegrityError):
    # Extract underlying psycopg exception if present
    cause = exc.__cause__
    sqlstate = getattr(cause, "sqlstate", None)
    err_msg = str(exc)
    
    logger.error(f"Database IntegrityError: {err_msg} | SQLSTATE: {sqlstate}")
    
    if sqlstate == "23505":  # UniqueViolation
        # E.g. guest_email_key, review_booking_id_key
        if "guest_email_key" in err_msg or "unique_guest_email" in err_msg:
            return format_error_response(
                code="email_registered",
                message="This email is already registered.",
                status_code=status.HTTP_409_CONFLICT
            )
        if "review_booking_id_key" in err_msg or "one_review_per_booking" in err_msg:
            return format_error_response(
                code="review_conflict",
                message="This booking already has a review.",
                status_code=status.HTTP_409_CONFLICT
            )
        if "room_property_id_room_number_key" in err_msg or "unique_room_per_property" in err_msg:
            return format_error_response(
                code="room_number_conflict",
                message="A room with this number already exists at this property.",
                status_code=status.HTTP_409_CONFLICT
            )
        return format_error_response(
            code="conflict",
            message="A unique constraint conflict occurred.",
            status_code=status.HTTP_409_CONFLICT
        )
        
    elif sqlstate == "23503":  # ForeignKeyViolation
        # Return 404
        return format_error_response(
            code="not_found",
            message="The referenced resource does not exist.",
            status_code=status.HTTP_404_NOT_FOUND
        )
        
    elif sqlstate == "23514":  # CheckViolation
        # Return 422
        return format_error_response(
            code="validation_failed",
            message=f"Constraint violation: {err_msg}",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        
    elif sqlstate == "23P01":  # ExclusionViolation
        # E.g., no_overlapping_bookings
        if "no_overlapping_bookings" in err_msg:
            return format_error_response(
                code="room_unavailable",
                message="That room is not available for the requested dates.",
                status_code=status.HTTP_409_CONFLICT
            )
        if "no_overlapping_rates" in err_msg:
            return format_error_response(
                code="rate_overlap",
                message="A rate plan already exists for this room type during the requested date range.",
                status_code=status.HTTP_409_CONFLICT
            )
        return format_error_response(
            code="overlap_conflict",
            message="Date overlap conflict.",
            status_code=status.HTTP_409_CONFLICT
        )
        
    elif sqlstate == "P0001":  # RaiseException (Trigger error)
        # Custom message raised by database trigger (e.g. check_guest_capacity)
        # Detail will contain the message from the raise exception
        trigger_message = getattr(cause, "diag", None)
        message_primary = getattr(trigger_message, "message_primary", err_msg)
        
        # Clean up message (strip context details if needed)
        clean_msg = message_primary.split("CONTEXT:")[0].strip()
        
        # Format trigger message nicely
        return format_error_response(
            code="validation_failed",
            message="Request validation failed.",
            detail=[{
                "field": "guests",
                "reason": clean_msg
            }],
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        
    # Generic fallback for unmapped integrity errors
    return format_error_response(
        code="bad_request",
        message="A database integrity constraint was violated.",
        status_code=status.HTTP_400_BAD_REQUEST
    )

def starlette_http_exception_handler(request: Request, exc):
    # Map HTTP status codes cleanly
    code_map = {
        400: "bad_request",
        401: "unauthenticated",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        429: "too_many_requests",
        503: "unavailable",
    }
    code = code_map.get(exc.status_code, "error")
    logger.warning(f"HTTP error {exc.status_code}: {exc.detail}")
    return format_error_response(
        code=code,
        message=exc.detail,
        status_code=exc.status_code
    )

def psycopg_exception_handler(request: Request, exc: Exception):
    logger.error("Database error on %s: %s", request.url.path, exc, exc_info=True)
    name = type(exc).__name__
    sqlstate = getattr(exc, "sqlstate", None)
    if sqlstate == "23505" or name == "UniqueViolation":
        return format_error_response(
            code="conflict",
            message="This email is already registered.",
            status_code=status.HTTP_409_CONFLICT,
        )
    if name == "UndefinedTable" or sqlstate == "42P01":
        return format_error_response(
            code="database_unavailable",
            message="Database schema is missing. Restart the backend container.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if name in {"OperationalError", "InterfaceError"} or isinstance(
        exc, (psycopg.OperationalError, psycopg.InterfaceError)
    ):
        return format_error_response(
            code="database_unavailable",
            message="Database is temporarily unavailable. Check Postgres is running and DB settings in .env.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return format_error_response(
        code="database_error",
        message="A database error occurred.",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


def general_exception_handler(request: Request, exc: Exception):
    logger.critical("Unhandled server error on %s: %s", request.url.path, exc, exc_info=True)
    debug = os.getenv("DEBUG", "true").lower() in ("1", "true", "yes")
    return format_error_response(
        code="internal_server_error",
        message=(
            f"{type(exc).__name__}: {exc}"
            if debug
            else "An unexpected error occurred. Please contact system administrators."
        ),
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
