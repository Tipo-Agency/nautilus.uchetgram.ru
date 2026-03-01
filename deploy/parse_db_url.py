#!/usr/bin/env python3
"""
Парсит DATABASE_URL из окружения, проверяет postgresql+asyncpg, выводит
export PGHOST=... PGUSER=... для использования в shell. SQLite запрещён.
"""
import os
import sys
from urllib.parse import urlparse, unquote

def main():
    url = (os.environ.get("DATABASE_URL") or "").strip()
    if not url:
        print("ERROR: DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)
    if "sqlite" in url.lower():
        print("ERROR: DATABASE_URL must not be SQLite. Use postgresql+asyncpg://...", file=sys.stderr)
        sys.exit(1)
    if "postgresql+asyncpg" not in url and "postgresql" not in url:
        print("ERROR: DATABASE_URL must be postgresql+asyncpg://... (PostgreSQL only)", file=sys.stderr)
        sys.exit(1)
    # нормализуем для urlparse
    normalized = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    try:
        u = urlparse(normalized)
    except Exception as e:
        print(f"ERROR: Invalid DATABASE_URL: {e}", file=sys.stderr)
        sys.exit(1)
    user = (u.username or "")
    password = (u.password or "")
    host = (u.hostname or "localhost")
    port = (u.port or "5432")
    db = (u.path or "/").strip("/") or ""
    if not user or not db:
        print("ERROR: DATABASE_URL must contain user and database name", file=sys.stderr)
        sys.exit(1)
    # для shell: экранируем одинарные кавычки в значениях
    def sh_quote(s):
        return "'" + str(s).replace("'", "'\"'\"'") + "'"
    print(f"export PGUSER={sh_quote(user)}")
    print(f"export PGHOST={sh_quote(host)}")
    print(f"export PGPORT={sh_quote(port)}")
    print(f"export PGDATABASE={sh_quote(db)}")
    if password:
        print(f"export PGPASSWORD={sh_quote(password)}")

if __name__ == "__main__":
    main()
