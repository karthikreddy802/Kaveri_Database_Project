import os
import django

# Initialize Django ORM before any models are imported
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Kaveri.settings")
django.setup()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import utils as django_db_utils
from starlette.exceptions import HTTPException as StarletteHTTPException

from api.middleware.exceptions import (
    pydantic_validation_exception_handler,
    django_validation_exception_handler,
    django_db_integrity_exception_handler,
    starlette_http_exception_handler,
    general_exception_handler,
)
from config.settings import SECRET_KEY  # Raises RuntimeError if missing

# Import all routers
from api.routers.auth import router as auth_router
from api.routers.properties import router as properties_router
from api.routers.bookings import router as bookings_router
from api.routers.payments import router as payments_router
from api.routers.reviews_and_guests import reviews_router, guests_router
from api.routers.reports import router as reports_router

app = FastAPI(
    title="Kaveri Stays API",
    version="1.0.0",
    description=(
        "Enterprise REST API backend for Kaveri Stays Hotel Management System.\n\n"
        "**Authentication:** Use `POST /auth/login` to obtain a Bearer token, "
        "then click the **Authorize** button and paste it."
    ),
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# ── CORS ────────────────────────────────────────────────────────────────────────
_cors = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://frontend",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── EXCEPTION HANDLERS ──────────────────────────────────────────────────────────
app.add_exception_handler(RequestValidationError, pydantic_validation_exception_handler)
app.add_exception_handler(DjangoValidationError, django_validation_exception_handler)
app.add_exception_handler(django_db_utils.IntegrityError, django_db_integrity_exception_handler)
app.add_exception_handler(StarletteHTTPException, starlette_http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# ── ROUTERS ─────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(properties_router)
app.include_router(bookings_router)
app.include_router(payments_router)
app.include_router(reviews_router)
app.include_router(guests_router)
app.include_router(reports_router)

# /me lives outside /auth prefix per spec
from api.routers.auth import get_me
from fastapi import APIRouter
me_router = APIRouter(tags=["auth"])
me_router.add_api_route("/me", get_me, methods=["GET"])
app.include_router(me_router)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "message": "Kaveri Stays API is running."}
