#!/usr/bin/env bash
# Wrapper to run init_postgres_db.sh as postgres. Reads PGUSER, PGHOST, PGPORT, PGDATABASE from .pg_env.
# Invoke: sudo -u postgres SERVER_PATH/deploy/run_db_init_as_postgres.sh
# .pg_env is written by deploy.sh (no password, only connection params for init).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$DIR/.pg_env" ]; then
  set -a
  source "$DIR/.pg_env"
  set +a
fi
exec "$DIR/init_postgres_db.sh"
