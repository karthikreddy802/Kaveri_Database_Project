"""
Bootstrap demo logins so they work on local, Docker, and EC2.
Owner is always upserted to the known password.
"""
import bcrypt
from api.db import get_conn

OWNER_EMAIL = "owner@kaveri.com"
OWNER_PASSWORD = "KaveriOwner@2025"

STAFF = [
    ("manager1@kaveri.com", "Manager1@2025", "manager", 1),
    ("manager2@kaveri.com", "Manager2@2025", "manager", 2),
    ("manager3@kaveri.com", "Manager3@2025", "manager", 3),
    ("staff@kaveri.com", "Staff@2025", "staff", 1),
]

GUEST_PASSWORD = "Kaveri@2025"


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _property_exists(cur, property_id):
    cur.execute("SELECT 1 FROM property WHERE property_id = %s", (property_id,))
    return cur.fetchone() is not None


def upsert_account(cur, email, password, role, property_id=None, guest_id=None):
    hashed = _hash(password)
    cur.execute(
        "SELECT account_id FROM account WHERE LOWER(email) = LOWER(%s)",
        (email,),
    )
    row = cur.fetchone()
    if row:
        cur.execute(
            """UPDATE account
               SET password_hash = %s, role = %s, property_id = %s, guest_id = %s
               WHERE account_id = %s""",
            (hashed, role, property_id, guest_id, row[0]),
        )
        print(f"  updated {email} ({role})")
        return
    cur.execute(
        """INSERT INTO account (email, password_hash, role, property_id, guest_id)
           VALUES (%s, %s, %s, %s, %s)""",
        (email, hashed, role, property_id, guest_id),
    )
    print(f"  created {email} ({role})")


def ensure_owner():
    """Create/reset the global owner login on whatever database this API is using."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            upsert_account(cur, OWNER_EMAIL, OWNER_PASSWORD, "owner", None, None)
        conn.commit()
    finally:
        conn.close()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            upsert_account(cur, OWNER_EMAIL, OWNER_PASSWORD, "owner", None, None)
        conn.commit()
        print(f"OWNER ready: {OWNER_EMAIL} / {OWNER_PASSWORD}")

        with conn.cursor() as cur:
            for email, password, role, prop_id in STAFF:
                pid = prop_id if _property_exists(cur, prop_id) else None
                if role in ("staff", "manager") and pid is None:
                    print(f"  skip {email}: property {prop_id} not found")
                    continue
                try:
                    upsert_account(cur, email, password, role, pid, None)
                except Exception as exc:
                    conn.rollback()
                    print(f"  skip {email}: {exc}")
                    continue
        conn.commit()

        with conn.cursor() as cur:
            try:
                cur.execute("SELECT guest_id, email FROM guest ORDER BY guest_id")
                guests = cur.fetchall()
            except Exception as exc:
                print(f"  guest seed skipped: {exc}")
                guests = []

            guest_hash = _hash(GUEST_PASSWORD)
            for guest_id, email in guests:
                if not email:
                    continue
                cur.execute(
                    "SELECT account_id FROM account WHERE LOWER(email) = LOWER(%s)",
                    (email,),
                )
                if cur.fetchone():
                    continue
                try:
                    cur.execute(
                        """INSERT INTO account (email, password_hash, role, guest_id)
                           VALUES (%s, %s, 'guest', %s)""",
                        (email, guest_hash, guest_id),
                    )
                except Exception as exc:
                    conn.rollback()
                    print(f"  skip guest {email}: {exc}")
                    continue
        conn.commit()
        print("Demo accounts ready.")
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"seed_accounts failed: {type(exc).__name__}: {exc}")
    finally:
        conn.close()


if __name__ == "__main__":
    seed()
