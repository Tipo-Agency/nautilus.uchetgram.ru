#!/usr/bin/env bash
# Инициализация БД PostgreSQL: создание БД (если нет), владелец, права на public.
# Вызывать от имени суперпользователя (sudo -u postgres) или с правами на создание БД.
# Ожидает в окружении: PGUSER, PGDATABASE, PGHOST, PGPORT (опционально PGPASSWORD).
set -e
if [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
  echo "ERROR: PGUSER and PGDATABASE must be set (e.g. from deploy/parse_db_url.py)" >&2
  exit 1
fi
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
# Подключение к служебной БД postgres для создания целевой БД
PSQL_CMD="psql -h $PGHOST -p $PGPORT -d postgres -v ON_ERROR_STOP=1"
# Проверяем существование базы
EXISTS=$($PSQL_CMD -tAc "SELECT 1 FROM pg_database WHERE datname = '$PGDATABASE';" 2>/dev/null || echo "")
if [ "$EXISTS" != "1" ]; then
  echo "Creating database $PGDATABASE and setting owner to $PGUSER..."
  $PSQL_CMD -c "CREATE DATABASE \"$PGDATABASE\" OWNER \"$PGUSER\";"
fi
# ALTER DATABASE — только будучи подключённым к postgres
$PSQL_CMD -c "ALTER DATABASE \"$PGDATABASE\" OWNER TO \"$PGUSER\";"
# Дальше — в целевой БД: схема и права
$PSQL_CMD -d "$PGDATABASE" -c "ALTER SCHEMA public OWNER TO \"$PGUSER\";"
$PSQL_CMD -d "$PGDATABASE" -c "GRANT ALL ON SCHEMA public TO \"$PGUSER\";"
$PSQL_CMD -d "$PGDATABASE" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$PGUSER\";"
$PSQL_CMD -d "$PGDATABASE" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$PGUSER\";"
$PSQL_CMD -d "$PGDATABASE" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$PGUSER\";"
$PSQL_CMD -d "$PGDATABASE" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$PGUSER\";"
echo "Database $PGDATABASE and schema public ownership/grants OK."
