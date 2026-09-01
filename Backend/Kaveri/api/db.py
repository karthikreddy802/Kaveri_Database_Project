import os
import time
import psycopg


def _env(key: str, default: str) -> str:
    val = os.getenv(key)
    if val is None or not str(val).strip():
        return default
    return str(val).strip()


def _in_docker() -> bool:
    return os.path.exists("/.dockerenv")


def _hosts_to_try(configured: str):
    """Inside Docker/EC2, talk to Compose Postgres (service name: db) first."""
    hosts = []
    preferred = ["db", configured, "host.docker.internal", "localhost"]
    if not _in_docker():
        preferred = [configured, "localhost"]
    for host in preferred:
        if host and host not in hosts:
            hosts.append(host)
    return hosts


def get_conn():
    params = dict(
        dbname=_env("DB_NAME", "kaveri"),
        user=_env("DB_USER", "postgres"),
        password=_env("DB_PASSWORD", "2004"),
        port=_env("DB_PORT", "5432"),
        connect_timeout=5,
    )
    last_err = None
    for host in _hosts_to_try(_env("DB_HOST", "localhost")):
        for _ in range(3):
            try:
                return psycopg.connect(host=host, **params)
            except psycopg.OperationalError as exc:
                last_err = exc
                time.sleep(0.4)
    raise last_err
