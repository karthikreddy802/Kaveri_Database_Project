"""Create core tables if Django migrate did not (typical on a fresh EC2 Postgres)."""
from api.db import get_conn

DDL = [
    """
    CREATE TABLE IF NOT EXISTS property (
        property_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        city VARCHAR(50) NOT NULL,
        stars SMALLINT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS room_type (
        room_type_id SERIAL PRIMARY KEY,
        type_name VARCHAR(20) NOT NULL UNIQUE,
        max_occupancy SMALLINT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS room (
        room_id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES property(property_id),
        room_number VARCHAR(10) NOT NULL,
        room_type_id INTEGER NOT NULL REFERENCES room_type(room_type_id),
        UNIQUE (property_id, room_number)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS guest (
        guest_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20) NULL,
        city VARCHAR(50) NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS account (
        account_id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        property_id INTEGER NULL REFERENCES property(property_id) ON DELETE SET NULL,
        guest_id INTEGER NULL REFERENCES guest(guest_id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS booking (
        booking_id SERIAL PRIMARY KEY,
        guest_id INTEGER NOT NULL REFERENCES guest(guest_id),
        room_id INTEGER NOT NULL REFERENCES room(room_id),
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        guest_count INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS payment (
        payment_id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES booking(booking_id),
        amount NUMERIC(10, 2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        payment_date DATE NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS review (
        review_id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL UNIQUE REFERENCES booking(booking_id),
        rating INTEGER NULL,
        comment TEXT NULL,
        review_date DATE NULL
    )
    """,
]


def ensure():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for stmt in DDL:
                cur.execute(stmt)
            cur.execute("ALTER TABLE account ALTER COLUMN created_at SET DEFAULT NOW();")
        conn.commit()
        print("ensure_schema: tables ready.")
    finally:
        conn.close()


if __name__ == "__main__":
    ensure()
