"""Payments router — idempotent instalments with Idempotency-Key header."""

import uuid
from decimal import Decimal
from datetime import date
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, status, Depends, Header

from api.schemas.models import PaymentCreate, Payment, PaymentListResponse
from api.dependencies.auth import get_current_account
from api.db import get_conn as _db

router = APIRouter(tags=["payments"])

# In-memory idempotency store: {(booking_id, key): payment_id}
_idempotency: dict[tuple, dict] = {}


def _booking_access(conn, booking_id: int, account: dict):
    """Raise 404 if booking not found/accessible to caller."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT b.booking_id, b.guest_id, r.property_id, b.status
               FROM booking b
               JOIN room r ON r.room_id = b.room_id
               WHERE b.booking_id = %s""",
            (booking_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found.")
    bid, guest_id, prop_id, bstatus = row

    if account["role"] == "guest" and guest_id != account.get("guest_id"):
        raise HTTPException(status_code=404, detail="Not found.")
    if account["role"] in ("staff", "manager") and prop_id != account["property_id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")

    return bid, guest_id, prop_id, bstatus


@router.get("/bookings/{booking_id}/payments", response_model=PaymentListResponse)
def list_payments(booking_id: int, account: dict = Depends(get_current_account)):
    """List all payments for a booking, oldest first."""
    with _db() as conn:
        _booking_access(conn, booking_id, account)

        with conn.cursor() as cur:
            cur.execute(
                """SELECT p.payment_id, p.booking_id, p.amount, p.method, p.payment_date
                   FROM payment p
                   WHERE p.booking_id = %s
                   ORDER BY p.payment_id""",
                (booking_id,),
            )
            rows = cur.fetchall()

            # Calculate total booking amount
            cur.execute(
                """SELECT COALESCE(
                       (SELECT SUM(rat.nightly_rate)
                        FROM generate_series(b.check_in, b.check_out - 1, '1 day') AS d
                        JOIN rate rat ON rat.property_id = r.property_id
                                     AND rat.room_type_id = r.room_type_id
                                     AND rat.start_date <= d AND rat.end_date > d), 0
                   )
                   FROM booking b
                   JOIN room r ON r.room_id = b.room_id
                   WHERE b.booking_id = %s""",
                (booking_id,),
            )
            total_amount = Decimal(str(cur.fetchone()[0]))

    total_paid = sum(Decimal(str(r[2])) for r in rows)
    balance = total_amount - total_paid

    payments = [
        Payment(
            id=r[0], booking_id=r[1], amount=str(Decimal(str(r[2])).quantize(Decimal("0.01"))),
            method=r[3],
            paid_at=r[4].isoformat() + "T00:00:00Z" if hasattr(r[4], 'isoformat') else str(r[4])
        )
        for r in rows
    ]
    return PaymentListResponse(
        items=payments,
        total_paid=str(total_paid.quantize(Decimal("0.01"))),
        balance=str(balance.quantize(Decimal("0.01"))),
    )


@router.post("/bookings/{booking_id}/payments", response_model=Payment)
def record_payment(
    booking_id: int,
    body: PaymentCreate,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    account: dict = Depends(get_current_account),
):
    """
    Record an instalment. Idempotency-Key prevents double-charging on retry (Task 5.6).
    409 if: key reused with different body, or total would exceed booking amount.
    """
    # Validate idempotency key is a UUID
    try:
        uuid.UUID(idempotency_key)
    except ValueError:
        raise HTTPException(status_code=422, detail="Idempotency-Key must be a valid UUID.")

    cache_key = (booking_id, idempotency_key)

    with _db() as conn:
        _, guest_id, prop_id, bstatus = _booking_access(conn, booking_id, account)

        # Idempotency check
        if cache_key in _idempotency:
            stored = _idempotency[cache_key]
            # Replay: same body → return 200
            if stored["amount"] == body.amount and stored["method"] == body.method.value:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT payment_id, booking_id, amount, method, payment_date
                           FROM payment WHERE payment_id = %s""",
                        (stored["payment_id"],),
                    )
                    row = cur.fetchone()
                return Payment(
                    id=row[0], booking_id=row[1],
                    amount=str(Decimal(str(row[2])).quantize(Decimal("0.01"))),
                    method=row[3],
                    paid_at=row[4].isoformat() + "T00:00:00Z",
                )
            else:
                # Same key, different body → 409
                raise HTTPException(
                    status_code=409,
                    detail="Idempotency key reused with a different payment body.",
                )

        # Calculate current totals
        with conn.cursor() as cur:
            cur.execute(
                """SELECT COALESCE(
                       (SELECT SUM(rat.nightly_rate)
                        FROM generate_series(b.check_in, b.check_out - 1, '1 day') AS d
                        JOIN rate rat ON rat.property_id = r.property_id
                                     AND rat.room_type_id = r.room_type_id
                                     AND rat.start_date <= d AND rat.end_date > d), 0
                   )
                   FROM booking b
                   JOIN room r ON r.room_id = b.room_id
                   WHERE b.booking_id = %s""",
                (booking_id,),
            )
            total_amount = Decimal(str(cur.fetchone()[0]))

            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM payment WHERE booking_id = %s",
                (booking_id,),
            )
            total_paid = Decimal(str(cur.fetchone()[0]))

        new_amount = Decimal(body.amount)
        if total_paid + new_amount > total_amount:
            raise HTTPException(
                status_code=409, detail="Payment would exceed the total booking amount."
            )

        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO payment (booking_id, amount, method, payment_date)
                   VALUES (%s, %s, %s, CURRENT_DATE) RETURNING payment_id, payment_date""",
                (booking_id, body.amount, body.method.value),
            )
            payment_id, payment_date = cur.fetchone()
        conn.commit()

    _idempotency[cache_key] = {
        "payment_id": payment_id,
        "amount": body.amount,
        "method": body.method.value,
    }

    return Payment(
        id=payment_id, booking_id=booking_id,
        amount=str(Decimal(body.amount).quantize(Decimal("0.01"))),
        method=body.method,
        paid_at=payment_date.isoformat() + "T00:00:00Z",
    )
