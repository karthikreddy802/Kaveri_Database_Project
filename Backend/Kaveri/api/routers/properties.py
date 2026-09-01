"""Properties and availability routers."""
from decimal import Decimal
from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query

from api.schemas.models import (
    PropertyListResponse, Property, RoomPage, Room, RoomType,
    AvailabilityResponse, AvailableRoom, PageMeta
)
from api.dependencies.auth import get_current_account, require_staff_or_above
from api.db import get_conn as _db

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("", response_model=PropertyListResponse)
def list_properties():
    """Public: list all properties."""
    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT property_id, name, city, stars FROM property ORDER BY property_id")
            rows = cur.fetchall()
    return PropertyListResponse(
        items=[Property(id=r[0], name=r[1], city=r[2], stars=r[3]) for r in rows]
    )


@router.get("/{property_id}", response_model=Property)
def get_property(property_id: int):
    """Public: get one property."""
    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT property_id, name, city, stars FROM property WHERE property_id = %s",
                (property_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found.")
    return Property(id=row[0], name=row[1], city=row[2], stars=row[3])


@router.get("/{property_id}/rooms", response_model=RoomPage)
def list_rooms(
    property_id: int,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    account: dict = Depends(require_staff_or_above()),
):
    """Staff+: Full room inventory, including never-booked rooms (Task 4.7)."""
    with _db() as conn:
        with conn.cursor() as cur:
            # Verify property exists
            cur.execute("SELECT 1 FROM property WHERE property_id = %s", (property_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Not found.")

            cur.execute(
                """SELECT COUNT(*) FROM room WHERE property_id = %s""",
                (property_id,),
            )
            total = cur.fetchone()[0]

            cur.execute(
                """SELECT r.room_id, r.property_id, r.room_number,
                          rt.type_name, rt.max_occupancy
                   FROM room r
                   JOIN room_type rt ON rt.room_type_id = r.room_type_id
                   WHERE r.property_id = %s
                   ORDER BY r.room_number
                   LIMIT %s OFFSET %s""",
                (property_id, limit, offset),
            )
            rows = cur.fetchall()

    items = [
        Room(
            id=r[0], property_id=r[1], room_number=r[2],
            room_type=RoomType(name=r[3], max_occupancy=r[4])
        )
        for r in rows
    ]
    return RoomPage(items=items, meta=PageMeta(limit=limit, offset=offset, total=total))


@router.get("/{property_id}/availability", response_model=AvailabilityResponse)
def get_availability(
    property_id: int,
    from_: date = Query(alias="from"),
    to: date = Query(),
    room_type: Optional[str] = Query(None),
):
    """
    Public: rooms free for a whole date range.
    Half-open [from, to) — a room checking out on 'from' IS available.
    Cancelled and no-show bookings don't occupy a room.
    """
    if to <= from_:
        raise HTTPException(status_code=422, detail="'to' must be strictly after 'from'.")

    with _db() as conn:
        with conn.cursor() as cur:
            # Verify property
            cur.execute("SELECT 1 FROM property WHERE property_id = %s", (property_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Not found.")

            nights = (to - from_).days

            # Availability query — joins through rate table for price calculation
            # Rooms are available if no active booking overlaps [from_, to)
            room_type_filter = "AND rt.type_name = %s" if room_type else ""
            params = [property_id, from_, to]
            if room_type:
                params.append(room_type)
            params += [property_id, from_.isoformat(), to.isoformat()]

            cur.execute(
                f"""
                WITH booked AS (
                    SELECT b.room_id
                    FROM booking b
                    WHERE b.status NOT IN ('cancelled', 'no_show')
                      AND daterange(b.check_in, b.check_out, '[)') &&
                          daterange(%s::date, %s::date, '[)')
                ),
                day_rates AS (
                    SELECT
                        r.room_id,
                        SUM(rat.nightly_rate) AS total_rate
                    FROM room r
                    JOIN room_type rt ON rt.room_type_id = r.room_type_id
                    JOIN rate rat ON rat.property_id = r.property_id
                               AND rat.room_type_id = r.room_type_id
                    CROSS JOIN generate_series(%s::date, %s::date - 1, '1 day'::interval) AS d(day)
                    WHERE rat.start_date <= d.day AND rat.end_date > d.day
                      AND r.property_id = %s
                    GROUP BY r.room_id
                )
                SELECT r.room_id, r.room_number, rt.type_name, rt.max_occupancy,
                       COALESCE(dr.total_rate, 0)
                FROM room r
                JOIN room_type rt ON rt.room_type_id = r.room_type_id
                LEFT JOIN day_rates dr ON dr.room_id = r.room_id
                WHERE r.property_id = %s
                  {room_type_filter}
                  AND r.room_id NOT IN (SELECT room_id FROM booked)
                ORDER BY rt.type_name, r.room_number
                """,
                [from_, to, from_.isoformat(), to.isoformat(), property_id, property_id]
                + ([room_type] if room_type else []),
            )
            rows = cur.fetchall()

    items = [
        AvailableRoom(
            room_id=r[0],
            room_number=r[1],
            room_type=RoomType(name=r[2], max_occupancy=r[3]),
            nights=nights,
            total_rate=str(Decimal(str(r[4])).quantize(Decimal("0.01"))),
        )
        for r in rows
    ]
    return AvailabilityResponse(
        property_id=property_id, **{"from": from_}, to=to, items=items
    )
