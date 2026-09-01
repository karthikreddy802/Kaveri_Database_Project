
"""
Reports router — occupancy, ADR, RevPAR, revenue.
All arithmetic stays in SQL (Task 4.4). No Python loops summing revenue.
Attack 8.7: Manager requesting another property's data → 403, not empty result.
"""

from decimal import Decimal
from datetime import date
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional

from api.schemas.models import (
    OccupancyReport, OccupancyRow,
    RateMetricReport, RateMetricRow,
    RevenueReport, RevenueRow
)
from api.dependencies.auth import get_current_account
from api.db import get_conn as _db

router = APIRouter(prefix="/reports", tags=["reports"])


def _resolve_property(account: dict, property_id: Optional[int]) -> int:
    """
    Attack 8.7: Manager omitting property_id gets their own.
    Manager naming a different property → 403.
    """
    if account["role"] == "manager":
        if property_id is None:
            return account["property_id"]
        if property_id != account["property_id"]:
            raise HTTPException(status_code=403, detail="You do not have access to this resource.")
        return property_id
    # owner
    if property_id is None:
        raise HTTPException(status_code=422, detail="property_id is required for owner reports.")
    return property_id


@router.get("/occupancy", response_model=OccupancyReport)
def report_occupancy(
    from_: date = Query(alias="from"),
    to: date = Query(),
    property_id: Optional[int] = Query(None),
    account: dict = Depends(get_current_account),
):
    """Occupancy % per property per month (manager or owner only)."""
    if account["role"] not in ("manager", "owner"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")

    prop_id = _resolve_property(account, property_id)

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.property_id,
                    p.name AS property_name,
                    TO_CHAR(m.month, 'YYYY-MM') AS month,
                    (SELECT COUNT(*) FROM room r WHERE r.property_id = p.property_id)
                        * DATE_PART('days', m.month + INTERVAL '1 month' - m.month) AS room_nights_available,
                    COALESCE(SUM(
                        DATE_PART('day', LEAST(b.check_out, m.month + INTERVAL '1 month')
                        - GREATEST(b.check_in, m.month))
                    ), 0) AS room_nights_sold
                FROM property p
                CROSS JOIN generate_series(%s::date, %s::date, '1 month'::interval) AS m(month)
                LEFT JOIN room r2 ON r2.property_id = p.property_id
                LEFT JOIN booking b ON b.room_id = r2.room_id
                    AND b.status IN ('checked_in', 'checked_out', 'confirmed')
                    AND b.check_in < m.month + INTERVAL '1 month'
                    AND b.check_out > m.month
                WHERE p.property_id = %s
                GROUP BY p.property_id, p.name, m.month
                ORDER BY m.month
                """,
                (from_.isoformat(), to.isoformat(), prop_id),
            )
            rows = cur.fetchall()

    items = [
        OccupancyRow(
            property_id=r[0],
            property_name=r[1],
            month=r[2],
            room_nights_available=int(r[3] or 0),
            room_nights_sold=int(r[4] or 0),
            occupancy_pct=str(
                (Decimal(str(r[4] or 0)) / Decimal(str(r[3] or 1)) * 100).quantize(Decimal("0.01"))
            ) if r[3] else "0.00",
        )
        for r in rows
    ]
    return OccupancyReport(items=items)


@router.get("/adr", response_model=RateMetricReport)
def report_adr(
    from_: date = Query(alias="from"),
    to: date = Query(),
    property_id: Optional[int] = Query(None),
    account: dict = Depends(get_current_account),
):
    """Average Daily Rate per property per month."""
    if account["role"] not in ("manager", "owner"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")

    prop_id = _resolve_property(account, property_id)

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.property_id,
                    p.name,
                    TO_CHAR(m.month, 'YYYY-MM') AS month,
                    COALESCE(
                        SUM(pay.amount) FILTER (WHERE b.status NOT IN ('cancelled','no_show'))
                        / NULLIF(SUM(
                            DATE_PART('day', LEAST(b.check_out, m.month + INTERVAL '1 month')
                            - GREATEST(b.check_in, m.month))
                        ) FILTER (WHERE b.status NOT IN ('cancelled','no_show')), 0),
                    0) AS adr
                FROM property p
                CROSS JOIN generate_series(%s::date, %s::date, '1 month'::interval) AS m(month)
                LEFT JOIN room r ON r.property_id = p.property_id
                LEFT JOIN booking b ON b.room_id = r.room_id
                    AND b.check_in < m.month + INTERVAL '1 month'
                    AND b.check_out > m.month
                LEFT JOIN payment pay ON pay.booking_id = b.booking_id
                WHERE p.property_id = %s
                GROUP BY p.property_id, p.name, m.month
                ORDER BY m.month
                """,
                (from_.isoformat(), to.isoformat(), prop_id),
            )
            rows = cur.fetchall()

    items = [
        RateMetricRow(
            property_id=r[0], property_name=r[1], month=r[2],
            value=str(Decimal(str(r[3] or 0)).quantize(Decimal("0.01")))
        )
        for r in rows
    ]
    return RateMetricReport(items=items)


@router.get("/revpar", response_model=RateMetricReport)
def report_revpar(
    from_: date = Query(alias="from"),
    to: date = Query(),
    property_id: Optional[int] = Query(None),
    account: dict = Depends(get_current_account),
):
    """Revenue Per Available Room per property per month."""
    if account["role"] not in ("manager", "owner"):
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")

    prop_id = _resolve_property(account, property_id)

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.property_id,
                    p.name,
                    TO_CHAR(m.month, 'YYYY-MM') AS month,
                    COALESCE(SUM(pay.amount) FILTER (WHERE b.status NOT IN ('cancelled','no_show')), 0)
                        / NULLIF(
                            (SELECT COUNT(*) FROM room r2 WHERE r2.property_id = p.property_id)
                            * DATE_PART('days', m.month + INTERVAL '1 month' - m.month),
                        0) AS revpar
                FROM property p
                CROSS JOIN generate_series(%s::date, %s::date, '1 month'::interval) AS m(month)
                LEFT JOIN room r ON r.property_id = p.property_id
                LEFT JOIN booking b ON b.room_id = r.room_id
                    AND b.check_in < m.month + INTERVAL '1 month'
                    AND b.check_out > m.month
                LEFT JOIN payment pay ON pay.booking_id = b.booking_id
                WHERE p.property_id = %s
                GROUP BY p.property_id, p.name, m.month
                ORDER BY m.month
                """,
                (from_.isoformat(), to.isoformat(), prop_id),
            )
            rows = cur.fetchall()

    items = [
        RateMetricRow(
            property_id=r[0], property_name=r[1], month=r[2],
            value=str(Decimal(str(r[3] or 0)).quantize(Decimal("0.01")))
        )
        for r in rows
    ]
    return RateMetricReport(items=items)


@router.get("/revenue", response_model=RevenueReport)
def report_revenue(
    from_: date = Query(alias="from"),
    to: date = Query(),
    account: dict = Depends(get_current_account),
):
    """Cross-property revenue. Owner only — managers receive 403 even for own property."""
    if account["role"] != "owner":
        raise HTTPException(status_code=403, detail="You do not have access to this resource.")

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.property_id,
                    p.name,
                    TO_CHAR(m.month, 'YYYY-MM') AS month,
                    COALESCE(SUM(pay.amount) FILTER (WHERE b.status NOT IN ('cancelled','no_show')), 0) AS revenue
                FROM property p
                CROSS JOIN generate_series(%s::date, %s::date, '1 month'::interval) AS m(month)
                LEFT JOIN room r ON r.property_id = p.property_id
                LEFT JOIN booking b ON b.room_id = r.room_id
                    AND b.check_in < m.month + INTERVAL '1 month'
                    AND b.check_out > m.month
                LEFT JOIN payment pay ON pay.booking_id = b.booking_id
                GROUP BY p.property_id, p.name, m.month
                ORDER BY p.property_id, m.month
                """,
                (from_.isoformat(), to.isoformat()),
            )
            rows = cur.fetchall()

    items = [
        RevenueRow(
            property_id=r[0], property_name=r[1], month=r[2],
            revenue=str(Decimal(str(r[3] or 0)).quantize(Decimal("0.01")))
        )
        for r in rows
    ]
    grand_total = str(sum(Decimal(i.revenue) for i in items).quantize(Decimal("0.01")))
    return RevenueReport(items=items, grand_total=grand_total)
