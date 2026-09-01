import os
import psycopg


def get_conn():
    return psycopg.connect(
        dbname=os.getenv("DB_NAME", "kaveri"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "2004"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )
