#!/usr/bin/env bash
# Инициализация БД PostgreSQL: создание БД (если нет), владелец, права на public.
# Вызывать от имени суперпользователя (sudo -u postgres) или с правами на создание БД.
# Ожидает в окружении: PGUSER, PGDATABASE, PGHOST, PGPORT (опционально PGPASSWORD).
set -e
if [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
  echo "ERROR: PGUSER and PGDATABASE must be set (e.g. from deploy/parse_db_url.py)" >&2
  exit 1
fi
APP_USER="$PGUSER"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
# Все подключения — только как postgres, чтобы не спрашивало пароль приложения
export PGUSER=postgres
export PGPASSWORD=""
PSQL_CMD="psql -h $PGHOST -p $PGPORT -d postgres -v ON_ERROR_STOP=1"
# Проверяем существование базы
EXISTS=$($PSQL_CMD -tAc "SELECT 1 FROM pg_database WHERE datname = '$PGDATABASE';" 2>/dev/null || echo "")
if [ "$EXISTS" != "1" ]; then
  echo "Creating database $PGDATABASE and setting owner to $APP_USER..."
  $PSQL_CMD -c "CREATE DATABASE \"$PGDATABASE\" OWNER \"$APP_USER\";"
fi
# ALTER DATABASE — только будучи подключённым к postgres
$PSQL_CMD -c "ALTER DATABASE \"$PGDATABASE\" OWNER TO \"$APP_USER\";"
# Дальше — в целевой БД: схема и права
$PSQL_CMD -d "$PGDATABASE" -c "ALTER SCHEMA public OWNER TO \"$APP_USER\";"
$PSQL_CMD -d "$PGDATABASE" -c "GRANT ALL ON SCHEMA public TO \"$APP_USER\";"
$PSQL_CMD -d "$PGDATABASE" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$APP_USER\";"
$PSQL_CMD -d "$PGDATABASE" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$APP_USER\";"
$PSQL_CMD -d "$PGDATABASE" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$APP_USER\";"
$PSQL_CMD -d "$PGDATABASE" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$APP_USER\";"
echo "Database $PGDATABASE and schema public ownership/grants OK."
