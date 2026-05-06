import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://finance_user:finance_pass@localhost:5432/finance_db",
)

# Connection pool: min 2, max 10 connections
_pool: pool.ThreadedConnectionPool | None = None


def get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = pool.ThreadedConnectionPool(2, 10, DATABASE_URL)
    return _pool


@contextmanager
def get_db():
    """Yield a psycopg2 connection from the pool, auto-commit or rollback."""
    conn = get_pool().getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        get_pool().putconn(conn)


@contextmanager
def get_cursor(conn):
    """Yield a RealDictCursor so rows come back as dicts."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        yield cur