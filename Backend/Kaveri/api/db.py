import os
import time
import psycopg


def _env(key: str, default: str) -> str:
    val = os.getenv(key)
    if val is None or not str(val).strip():
        return default
    return str(val).strip()


def get_conn():
    params = dict(
        dbname=_env("DB_NAME", "kaveri"),
        user=_env("DB_USER", "postgres"),
        password=_env("DB_PASSWORD", "2004"),
        host=_env("DB_HOST", "localhost"),
        port=_env("DB_PORT", "5432"),
        connect_timeout=5,
    )
    last_err = None
    in_docker = os.path.exists("/.dockerenv")
    for attempt in range(8):
        try:
            return psycopg.connect(**params)
        except psycopg.OperationalError as exc:
            last_err = exc
            if not in_docker and params["host"] in {"db", "postgres", "database"}:
                params["host"] = "localhost"
                continue
            time.sleep(1)
    raise last_err
