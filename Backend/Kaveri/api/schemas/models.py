"""
Pydantic v2 schemas — every request and response model for the Kaveri Stays API.
All money fields are Decimal strings (never floats). Dates are ISO 8601 YYYY-MM-DD.
additionalProperties: false is expressed via model_config = ConfigDict(extra="forbid").
"""

from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict


# ─────────────────────────── enums ─────────────────────────────────────────────

class BookingStatus(str, Enum):
    confirmed    = "confirmed"
    checked_in   = "checked_in"
    checked_out  = "checked_out"
    cancelled    = "cancelled"
    no_show      = "no_show"


class PaymentMethod(str, Enum):
    card          = "card"
    upi           = "upi"
    bank_transfer = "bank_transfer"
    cash          = "cash"


class Role(str, Enum):
    guest   = "guest"
    staff   = "staff"
    manager = "manager"
    owner   = "owner"


class SortBookings(str, Enum):
    check_in_asc        = "check_in"
    check_in_desc       = "-check_in"
    created_at_asc      = "created_at"
    created_at_desc     = "-created_at"
    total_amount_asc    = "total_amount"
    total_amount_desc   = "-total_amount"


# ─────────────────────────── common ────────────────────────────────────────────

class PageMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit:  int
    offset: int
    total:  int


class ErrorDetail(BaseModel):
    code:       str
    message:    str
    detail:     Optional[object] = None
    request_id: Optional[str]    = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


# ─────────────────────────── auth ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")   # Attack 8.2: no role field accepted
    email:     EmailStr
    password:  str = Field(min_length=10, json_schema_extra={"writeOnly": True})
    full_name: str = Field(min_length=1, max_length=120)
    phone:     Optional[str] = None


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email:    EmailStr
    password: str = Field(json_schema_extra={"writeOnly": True})


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str


class TokenPair(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    expires_in:    int = Field(description="Access token lifetime in seconds.")


class Me(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:          int
    email:       EmailStr
    full_name:   str
    role:        Role
    property_id: Optional[int] = None


# ─────────────────────────── properties ────────────────────────────────────────

class Property(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:    int
    name:  str
    city:  str
    stars: Optional[int] = Field(None, ge=1, le=5)


class PropertyListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[Property]


# ─────────────────────────── room types ────────────────────────────────────────

class RoomType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name:          str
    max_occupancy: int = Field(ge=1)


# ─────────────────────────── rooms ─────────────────────────────────────────────

class Room(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:          int
    property_id: int
    room_number: str
    room_type:   RoomType


class RoomPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[Room]
    meta:  PageMeta


# ─────────────────────────── availability ──────────────────────────────────────

class AvailableRoom(BaseModel):
    model_config = ConfigDict(extra="forbid")
    room_id:     int
    room_number: str
    room_type:   RoomType
    nights:      int
    total_rate:  str   # Decimal string


class AvailabilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    property_id: int
    from_:       date = Field(alias="from")
    to:          date
    items:       List[AvailableRoom]

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


# ─────────────────────────── bookings ──────────────────────────────────────────

class PaymentCreateInline(BaseModel):
    """Deposit payment embedded in BookingCreate."""
    model_config = ConfigDict(extra="forbid")
    amount: str = Field(description="Decimal string. Positive.")
    method: PaymentMethod

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        try:
            d = Decimal(v)
        except Exception:
            raise ValueError("Amount must be a valid decimal string.")
        if d <= 0:
            raise ValueError("Amount must be positive.")
        return v


class BookingCreate(BaseModel):
    """Attack 8.8: no nightly_rate or total_amount field — resolved server-side."""
    model_config = ConfigDict(extra="forbid")
    room_id:   int
    check_in:  date
    check_out: date = Field(description="Exclusive. Must be strictly after check_in.")
    guests:    int  = Field(ge=1)
    guest_id:  Optional[int] = None
    deposit:   Optional[PaymentCreateInline] = None

    @field_validator("check_out")
    @classmethod
    def checkout_after_checkin(cls, v: date, info) -> date:
        check_in = info.data.get("check_in")
        if check_in and v <= check_in:
            raise ValueError("check_out must be strictly after check_in.")
        return v


class Booking(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:           int
    property_id:  int
    room_id:      int
    room_number:  Optional[str] = None
    guest_id:     int
    guest_name:   Optional[str] = None
    check_in:     date
    check_out:    date
    nights:       int
    guests:       int
    status:       BookingStatus
    total_amount: str
    total_paid:   str
    balance:      str
    created_at:   Optional[datetime] = None


class BookingPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[Booking]
    meta:  PageMeta


# ─────────────────────────── payments ──────────────────────────────────────────

class PaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount:    str  = Field(description="Decimal string. Positive.")
    method:    PaymentMethod
    reference: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        try:
            d = Decimal(v)
        except Exception:
            raise ValueError("Amount must be a valid decimal string.")
        if d <= 0:
            raise ValueError("Amount must be positive.")
        return v


class Payment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:         int
    booking_id: int
    amount:     str
    method:     PaymentMethod
    reference:  Optional[str] = None
    paid_at:    datetime


class PaymentListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items:      List[Payment]
    total_paid: str
    balance:    str


# ─────────────────────────── reviews ───────────────────────────────────────────

class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating:  int = Field(ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class Review(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:         int
    booking_id: int
    rating:     int = Field(ge=1, le=5)
    comment:    Optional[str] = None
    guest_name: Optional[str] = None   # Shortened — never full record, never email
    created_at: datetime


class ReviewPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[Review]
    meta:  PageMeta


# ─────────────────────────── guests ────────────────────────────────────────────

class Guest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id:         int
    email:      EmailStr
    full_name:  str
    phone:      Optional[str] = None
    stay_count: Optional[int] = None


class GuestPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[Guest]
    meta:  PageMeta


# ─────────────────────────── reports ───────────────────────────────────────────

class OccupancyRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    property_id:           int
    property_name:         Optional[str] = None
    month:                 str
    room_nights_available: int
    room_nights_sold:      int
    occupancy_pct:         str


class RateMetricRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    property_id:   int
    property_name: Optional[str] = None
    month:         str
    value:         str


class RevenueRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    property_id:   int
    property_name: Optional[str] = None
    month:         str
    revenue:       str


class OccupancyReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[OccupancyRow]


class RateMetricReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[RateMetricRow]


class RevenueReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items:       List[RevenueRow]
    grand_total: str
