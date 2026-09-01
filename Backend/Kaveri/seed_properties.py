"""Insert demo properties when the table is empty (safe to run on every boot)."""
from api.db import get_conn

DEMO = [
    ("Kaveri Grand Palace", "Mysore", 5),
    ("Kaveri City Suites", "Bangalore", 4),
    ("Kaveri River Retreat", "Coorg", 5),
]


def seed():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM property")
                count = cur.fetchone()[0]
                if count:
                    print(f"property table already has {count} row(s); skip seed.")
                    return
                cur.executemany(
                    "INSERT INTO property (name, city, stars) VALUES (%s, %s, %s)",
                    DEMO,
                )
            conn.commit()
            print("Seeded 3 demo properties.")
    except Exception as exc:
        print(f"seed_properties skipped: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    seed()
