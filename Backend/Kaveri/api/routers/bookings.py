"""
Bookings router — full lifecycle with state machine enforcement.
State machine: confirmed -> checked_in -> checked_out
               confirmed -> cancelled | no_show
"""

from decimal import Decimal
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query

from api.schemas.models import (
    Booking, BookingCreate, BookingPage, PageMeta, BookingStatus, SortBookings
)
from api.dependencies.auth import get_current_account
from api.db import get_conn as _db

router = APIRouter(prefix="/bookings", tags=["bookings"])

SORT_MAP = {
    "check_in":      "b.check_in ASC",
    "-check_in":     "b.check_in DESC",
    "created_at":    "b.booking_id ASC",
    "-created_at":   "b.booking_id DESC",
    "total_amount":  "total_amount ASC",
    "-total_amount": "total_amount DESC",
}


def _resolve_rate(conn, room_id: int, check_in: date, check_out: date) -> Decimal:
    """Sum nightly rates from rate table for the stay period."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(rat.nightly_rate), 0)
            FROM generate_series(%s::date, %s::date - 1, '1 day'::interval) AS d(day)
            JOIN room r ON r.room_id = %s
            JOIN rate rat ON rat.property_id = r.property_id
                         AND rat.room_type_id = r.room_type_id
                         AND rat.start_date <= d.day
                         AND rat.end_date > d.day
            """,
            (check_in.isoformat(), check_out.isoformat(), room_id),
        )
        return Decimal(str(cur.fetchone()[0]))


def _build_booking(row) -> Booking:
    """Map a database row to a Booking schema."""
    (booking_id, property_id, room_id, room_number, guest_id, guest_name,
     check_in, check_out, guest_count, status_val, total_amount, total_paid) = row
    nights = (check_out - check_in).days
    total_amount_d = Decimal(str(total_amount))
    total_paid_d   = Decimal(str(total_paid or 0))
    balance_d      = total_amount_d - total_paid_d
    return Booking(
        id=booking_id, property_id=property_id, room_id=room_id, room_number=room_number,
        guest_id=guest_id, guest_name=guest_name, check_in=check_in, check_out=check_out,
        nights=nights, guests=guest_count, status=status_val,
        total_amount=str(total_amount_d.quantize(Decimal("0.01"))),
        total_paid=str(total_paid_d.quantize(Decimal("0.01"))),
        balance=str(balance_d.quantize(Decimal("0.01"))),
    )


BOOKING_SELECT = """
    SELECT b.booking_id, r.property_id, b.room_id, r.room_number,
           b.guest_id, g.name AS guest_name,
           b.check_in, b.check_out, b.guest_count, b.status,
           COALESCE(
               (SELECT SUM(rat.nightly_rate)
                FROM generate_series(b.check_in, b.check_out - 1, '1 day') AS d
                JOIN rate rat ON rat.property_id = r.property_id
                             AND rat.room_type_id = r.room_type_id
                             AND rat.start_date <= d AND rat.end_date > d), 0
           ) AS total_amount,
           COALESCE((SELECT SUM(amount) FROM payment WHERE booking_id = b.booking_id), 0) AS total_paid
    FROM booking b
    JOIN room r ON r.room_id = b.room_id
    JOIN guest g ON g.guest_id = b.guest_id
"""


def _get_booking_or_404(conn, booking_id: int, account: dict) -> tuple:
    with conn.cursor() as cur:
        cur.execute(BOOKING_SELECT + " WHERE b.booking_id = %s", (booking_id,))
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Not found.")

    # Task 4.3 / Attack 8.1: guest sees 404, not 403, for other guests' bookings
    if account["role"] == "guest" and row[4] != account.get("guest_id"):
        raise HTTPException(status_code=404, detail="Not found.")

    # Staff/manager scoped to their property
    if account["role"] in ("staff", "manager") and row[1] != account.get("property_id"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")

    return row


# ── LEGAL STATE TRANSITIONS ─────────────────────────────────────────────────

LEGAL_TRANSITIONS = {
    "check_in":  {"from": "confirmed",   "to": "checked_in"},
    "check_out": {"from": "checked_in",  "to": "checked_out"},
    "cancel":    {"from": "confirmed",   "to": "cancelled"},
    "no_show":   {"from": "confirmed",   "to": "no_show"},
}


def _do_transition(booking_id: int, action: str, account: dict) -> Booking:
    trans = LEGAL_TRANSITIONS[action]
    with _db() as conn:
        row = _get_booking_or_404(conn, booking_id, account)
        current_status = row[9]

        if current_status != trans["from"]:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": {
                        "code": "illegal_transition",
                        "message": f"A {current_status} booking cannot be {action.replace('_', '-')}ed.",
                        "detail": {"current_status": current_status, "attempted": action},
                    }
                },
            )

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE booking SET status = %s WHERE booking_id = %s",
                (trans["to"], booking_id),
            )
        conn.commit()

        row = _get_booking_or_404(conn, booking_id, account)
    return _build_booking(row)


# ── ROUTES ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=BookingPage)
def list_bookings(
    property_id: Optional[int] = None,
    status: Optional[BookingStatus] = None,
    guest_id: Optional[int] = None,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = None,
    sort: SortBookings = SortBookings.check_in_desc,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    account: dict = Depends(get_current_account),
):
    """Bookings visible to the caller. Attack 8.11: sort from whitelist only."""
    filters = ["1=1"]
    params = []

    # Role-based scoping
    if account["role"] == "guest":
        filters.append("b.guest_id = %s")
        params.append(account.get("guest_id"))
    elif account["role"] in ("staff", "manager"):
        filters.append("r.property_id = %s")
        params.append(account["property_id"])
    else:  # owner
        if property_id:
            filters.append("r.property_id = %s")
            params.append(property_id)
        if guest_id:
            filters.append("b.guest_id = %s")
            params.append(guest_id)

    if status:
        filters.append("b.status = %s")
        params.append(status.value)
    if from_:
        filters.append("b.check_in >= %s")
        params.append(from_)
    if to:
        filters.append("b.check_out <= %s")
        params.append(to)

    where = " AND ".join(filters)
    order_by = SORT_MAP.get(sort.value, "b.check_in DESC")

    with _db() as conn:
        with conn.cursor() as cur:
            count_sql = f"""
                SELECT COUNT(*)
                FROM booking b
                JOIN room r ON r.room_id = b.room_id
                JOIN guest g ON g.guest_id = b.guest_id
                WHERE {where}
            """
            cur.execute(count_sql, params)
            total = cur.fetchone()[0]

            data_sql = (
                BOOKING_SELECT
                + f" WHERE {where} ORDER BY {order_by} LIMIT %s OFFSET %s"
            )
            cur.execute(data_sql, params + [limit, offset])
            rows = cur.fetchall()

    return BookingPage(
        items=[_build_booking(r) for r in rows],
        meta=PageMeta(limit=limit, offset=offset, total=total),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Booking)
def create_booking(body: BookingCreate, account: dict = Depends(get_current_account)):
    """
    Create booking + optional deposit in one transaction (Task 5.1).
    Rate resolved server-side (Attack 8.8). 
    Guest can only book for themselves.
    """
    # Resolve guest_id
    if account["role"] == "guest":
        guest_id = account.get("guest_id")
    else:
        guest_id = body.guest_id or account.get("guest_id")

    if not guest_id:
        raise HTTPException(status_code=422, detail="guest_id is required for staff bookings.")

    with _db() as conn:
        # Validate room exists and get its property
        with conn.cursor() as cur:
            cur.execute(
                "SELECT property_id FROM room WHERE room_id = %s", (body.room_id,)
            )
            room_row = cur.fetchone()
        if not room_row:
            raise HTTPException(status_code=404, detail="Room not found.")

        # Resolve total amount from rate plans (server-side, Task 5.9)
        total_amount = _resolve_rate(conn, body.room_id, body.check_in, body.check_out)

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO booking (guest_id, room_id, check_in, check_out, guest_count, status)
                       VALUES (%s, %s, %s, %s, %s, 'confirmed') RETURNING booking_id""",
                    (guest_id, body.room_id, body.check_in, body.check_out, body.guests),
                )
                booking_id = cur.fetchone()[0]

                # Record deposit payment if provided (Task 5.1)
                if body.deposit:
                    from datetime import date as date_cls
                    cur.execute(
                        """INSERT INTO payment (booking_id, amount, method, payment_date)
                           VALUES (%s, %s, %s, %s)""",
                        (booking_id, body.deposit.amount, body.deposit.method.value, date_cls.today()),
                    )

            conn.commit()
        except psycopg.errors.ExclusionViolation:
            conn.rollback()
            raise HTTPException(status_code=409, detail="That room is not available for the requested dates.")
        except psycopg.errors.RaiseException as e:
            conn.rollback()
            raise HTTPException(status_code=422, detail=str(e).split("\n")[0])

        row = _get_booking_or_404(conn, booking_id, account)

    return _build_booking(row)


@router.get("/{booking_id}", response_model=Booking)
def get_booking(booking_id: int, account: dict = Depends(get_current_account)):
    with _db() as conn:
        row = _get_booking_or_404(conn, booking_id, account)
    return _build_booking(row)


@router.post("/{booking_id}/check-in", response_model=Booking)
def check_in(booking_id: int, account: dict = Depends(get_current_account)):
    """Staff only. Legal from `confirmed` only."""
    if account["role"] not in ("staff", "manager", "owner"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")
    return _do_transition(booking_id, "check_in", account)


@router.post("/{booking_id}/check-out", response_model=Booking)
def check_out(booking_id: int, account: dict = Depends(get_current_account)):
    """Staff only. Legal from `checked_in` only."""
    if account["role"] not in ("staff", "manager", "owner"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")
    return _do_transition(booking_id, "check_out", account)


@router.post("/{booking_id}/cancel", response_model=Booking)
def cancel_booking(booking_id: int, account: dict = Depends(get_current_account)):
    """Guest can cancel own. Staff can cancel any at their property. `confirmed` only."""
    return _do_transition(booking_id, "cancel", account)


@router.post("/{booking_id}/no-show", response_model=Booking)
def no_show(booking_id: int, account: dict = Depends(get_current_account)):
    """Staff only. Legal from `confirmed` only."""
    if account["role"] not in ("staff", "manager", "owner"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")
    return _do_transition(booking_id, "no_show", account)
