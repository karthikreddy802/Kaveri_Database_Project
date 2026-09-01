"""Reviews and guests routers."""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional

from api.schemas.models import (
    ReviewCreate, Review, ReviewPage,
    Guest, GuestPage, PageMeta
)
from api.dependencies.auth import get_current_account, require_staff_or_above
from api.db import get_conn as _db

reviews_router = APIRouter(tags=["reviews"])
guests_router  = APIRouter(prefix="/guests", tags=["guests"])


# ── REVIEWS ────────────────────────────────────────────────────────────────────

@reviews_router.post("/bookings/{booking_id}/review", status_code=status.HTTP_201_CREATED, response_model=Review)
def create_review(booking_id: int, body: ReviewCreate, account: dict = Depends(get_current_account)):
    """
    Post-stay review. Guest-only. Three distinct failures (Task 5.8):
    - Booking belongs to another guest → 404
    - Booking not checked_out yet → 403
    - Review already exists → 409
    - Rating outside 1-5 → 422 (Pydantic)
    """
    if account["role"] != "guest":
        raise HTTPException(status_code=403, detail="Only guests may post reviews.")

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT guest_id, status FROM booking WHERE booking_id = %s",
                (booking_id,),
            )
            row = cur.fetchone()

        # 404 for another guest's booking (Attack 8.1 — consistent with GET /bookings)
        if not row or row[0] != account.get("guest_id"):
            raise HTTPException(status_code=404, detail="Not found.")

        if row[1] != "checked_out":
            raise HTTPException(status_code=403, detail="The stay is not checked out yet.")

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO review (booking_id, rating, comment, review_date)
                       VALUES (%s, %s, %s, CURRENT_DATE) RETURNING review_id, review_date""",
                    (booking_id, body.rating, body.comment),
                )
                review_id, review_date = cur.fetchone()

                # Get guest name for response (shortened — first name only)
                cur.execute("SELECT name FROM guest WHERE guest_id = %s", (account.get("guest_id"),))
                full_name = cur.fetchone()[0]
                guest_name_short = full_name.split()[0] + " " + full_name.split()[-1][0] + "." if full_name else ""

            conn.commit()
        except psycopg.errors.UniqueViolation:
            conn.rollback()
            raise HTTPException(status_code=409, detail="This booking already has a review.")

    return Review(
        id=review_id, booking_id=booking_id, rating=body.rating, comment=body.comment,
        guest_name=guest_name_short,
        created_at=datetime.combine(review_date, datetime.min.time(), tzinfo=timezone.utc),
    )


@reviews_router.get("/properties/{property_id}/reviews", response_model=ReviewPage)
def list_property_reviews(
    property_id: int,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Public: reviews for a property. Guest names are shortened, emails never exposed."""
    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM property WHERE property_id = %s", (property_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Not found.")

            cur.execute(
                """SELECT COUNT(*) FROM review rv
                   JOIN booking b ON b.booking_id = rv.booking_id
                   JOIN room r ON r.room_id = b.room_id
                   WHERE r.property_id = %s""",
                (property_id,),
            )
            total = cur.fetchone()[0]

            cur.execute(
                """SELECT rv.review_id, rv.booking_id, rv.rating, rv.comment,
                          rv.review_date, g.name
                   FROM review rv
                   JOIN booking b ON b.booking_id = rv.booking_id
                   JOIN room r ON r.room_id = b.room_id
                   JOIN guest g ON g.guest_id = b.guest_id
                   WHERE r.property_id = %s
                   ORDER BY rv.review_date DESC
                   LIMIT %s OFFSET %s""",
                (property_id, limit, offset),
            )
            rows = cur.fetchall()

    items = [
        Review(
            id=r[0], booking_id=r[1], rating=r[2], comment=r[3],
            guest_name=(r[5].split()[0] + " " + r[5].split()[-1][0] + ".") if r[5] else "",
            created_at=datetime.combine(r[4], datetime.min.time(), tzinfo=timezone.utc) if r[4] else datetime.now(timezone.utc),
        )
        for r in rows
    ]
    return ReviewPage(items=items, meta=PageMeta(limit=limit, offset=offset, total=total))


# ── GUESTS ─────────────────────────────────────────────────────────────────────

@guests_router.get("", response_model=GuestPage)
def list_guests(
    email: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    account: dict = Depends(require_staff_or_above()),
):
    """Staff+: list guest records. No guest-to-guest enumeration (Task 4.8)."""
    filters = ["1=1"]
    params = []

    if email:
        filters.append("LOWER(g.email) = LOWER(%s)")
        params.append(email)

    where = " AND ".join(filters)

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM guest g WHERE {where}", params)
            total = cur.fetchone()[0]

            cur.execute(
                f"""SELECT g.guest_id, g.email, g.name, g.phone,
                           (SELECT COUNT(*) FROM booking b WHERE b.guest_id = g.guest_id) AS stay_count
                    FROM guest g
                    WHERE {where}
                    ORDER BY g.guest_id
                    LIMIT %s OFFSET %s""",
                params + [limit, offset],
            )
            rows = cur.fetchall()

    items = [
        Guest(id=r[0], email=r[1], full_name=r[2], phone=r[3], stay_count=r[4])
        for r in rows
    ]
    return GuestPage(items=items, meta=PageMeta(limit=limit, offset=offset, total=total))


@guests_router.get("/{guest_id}", response_model=Guest)
def get_guest(guest_id: int, account: dict = Depends(require_staff_or_above())):
    """Staff+: get one guest record."""
    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT g.guest_id, g.email, g.name, g.phone,
                          (SELECT COUNT(*) FROM booking b WHERE b.guest_id = g.guest_id) AS stay_count
                   FROM guest g WHERE g.guest_id = %s""",
                (guest_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Not found.")
    return Guest(id=row[0], email=row[1], full_name=row[2], phone=row[3], stay_count=row[4])
