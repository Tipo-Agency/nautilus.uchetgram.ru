#!/usr/bin/env bash
# Быстрый фикс 502: .env (API_PREFIX), перезапуск API, проверка health.
# Запуск на сервере: sudo bash deploy/fix_502.sh
# Путь: SERVER_PATH=/var/www/nautilus.uchetgram.ru (по умолчанию)

P="${SERVER_PATH:-/var/www/nautilus.uchetgram.ru}"
ENV_FILE="$P/server/.env"

set -e
echo "Fix 502: path=$P"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found. Create it with DATABASE_URL and SECRET_KEY."
  exit 1
fi

# API_PREFIX для /api/v1/health
if grep -q '^API_PREFIX=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^API_PREFIX=.*|API_PREFIX=/api/v1|" "$ENV_FILE"
else
  echo "API_PREFIX=/api/v1" >> "$ENV_FILE"
fi
echo "✅ API_PREFIX=/api/v1 in .env"

# Обновить unit (подставить путь)
if [ -f "$P/deploy/nautilus-api.service" ]; then
  sed "s|__SERVER_PATH__|$P|g" "$P/deploy/nautilus-api.service" | tee /etc/systemd/system/nautilus-api.service > /dev/null
  systemctl daemon-reload
  echo "✅ systemd unit updated"
fi

systemctl restart nautilus-api.service
echo "✅ nautilus-api restarted"
sleep 3

if ! systemctl is-active --quiet nautilus-api.service; then
  echo "❌ nautilus-api still not active. Logs:"
  journalctl -u nautilus-api.service -n 40 --no-pager
  exit 1
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/health 2>/dev/null || echo "000")
if [ "$CODE" = "200" ]; then
  echo "✅ Health OK: http://127.0.0.1:8000/api/v1/health → 200"
else
  echo "❌ Health returned HTTP $CODE. Run: bash $P/deploy/diagnose_502.sh"
  exit 1
fi
