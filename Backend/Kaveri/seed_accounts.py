"""
Seed the `account` table from existing guests (for development login).
Each guest gets an account with:
  - email from guest.email
  - default password: Kaveri@2025 (bcrypt hashed)
  - role: guest
  - property_id: NULL
Run once from the Backend/Kaveri directory.
"""
import bcrypt
from api.db import get_conn

DEFAULT_PASSWORD = "Kaveri@2025"

def seed():
    hashed = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode()

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT guest_id, email FROM guest ORDER BY guest_id")
            guests = cur.fetchall()

        seeded = 0
        for guest_id, email in guests:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM account WHERE email = %s", (email,))
                if cur.fetchone():
                    print(f"  SKIP (exists): {email}")
                    continue
                cur.execute(
                    """INSERT INTO account (email, password_hash, role, guest_id)
                       VALUES (%s, %s, 'guest', %s)""",
                    (email, hashed, guest_id)
                )
                seeded += 1

        conn.commit()
        print(f"\nSeeded {seeded} guest accounts.")
        print(f"Default password: {DEFAULT_PASSWORD}")
        print("\nLogin with any guest email from the guest table.")

        # Also create one owner account
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM account WHERE email = 'owner@kaveri.com'")
            if not cur.fetchone():
                owner_hash = bcrypt.hashpw("KaveriOwner@2025".encode(), bcrypt.gensalt(rounds=12)).decode()
                cur.execute(
                    """INSERT INTO account (email, password_hash, role, property_id)
                       VALUES ('owner@kaveri.com', %s, 'owner', NULL)""",
                    (owner_hash,)
                )
                print("\nCreated OWNER account:")
                print("  email: owner@kaveri.com")
                print("  password: KaveriOwner@2025")

        # Manager for each property
        for prop_id, prop_name in [(1, 'Hilltop'), (2, 'Backwater'), (3, 'Riverside')]:
            email = f"manager{prop_id}@kaveri.com"
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM account WHERE email = %s", (email,))
                if not cur.fetchone():
                    mgr_hash = bcrypt.hashpw(f"Manager{prop_id}@2025".encode(), bcrypt.gensalt(rounds=12)).decode()
                    cur.execute(
                        """INSERT INTO account (email, password_hash, role, property_id)
                           VALUES (%s, %s, 'manager', %s)""",
                        (email, mgr_hash, prop_id)
                    )
                    print(f"  Manager: {email} / Manager{prop_id}@2025")

        # Staff for property 1
        staff_email = "staff@kaveri.com"
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM account WHERE email = %s", (staff_email,))
            if not cur.fetchone():
                st_hash = bcrypt.hashpw("Staff@2025".encode(), bcrypt.gensalt(rounds=12)).decode()
                cur.execute(
                    """INSERT INTO account (email, password_hash, role, property_id)
                       VALUES (%s, %s, 'staff', 1)""",
                    (staff_email, st_hash)
                )
                print(f"  Staff: {staff_email} / Staff@2025")

        conn.commit()
        print("\nAll accounts ready.")

if __name__ == '__main__':
    seed()
