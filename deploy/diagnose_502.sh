#!/usr/bin/env bash
# Диагностика 502 Bad Gateway. Запуск на сервере: bash deploy/diagnose_502.sh
# Путь к проекту можно задать: SERVER_PATH=/var/www/nautilus.uchetgram.ru bash deploy/diagnose_502.sh

set -e
P="${SERVER_PATH:-/var/www/nautilus.uchetgram.ru}"
cd "$P" || { echo "❌ cd $P failed"; exit 1; }

echo "=== 1. nautilus-api.service status ==="
sudo systemctl status nautilus-api.service --no-pager 2>/dev/null || true

echo ""
echo "=== 2. Health (127.0.0.1:8000) ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8000/api/v1/health 2>/dev/null || echo "curl failed (connection refused?)"
curl -s http://127.0.0.1:8000/api/v1/health 2>/dev/null || true
echo ""

echo "=== 3. Static root (dist) ==="
ls -la dist dist.live 2>/dev/null || true
readlink dist 2>/dev/null || true
[ -f "dist/index.html" ] && echo "dist/index.html exists" || echo "dist/index.html MISSING"

echo ""
echo "=== 4. Nginx site config ==="
cfg="/etc/nginx/sites-enabled/nautilus.uchetgram.ru"
if [ -f "$cfg" ]; then
  grep -E "root|location|proxy_pass|server_name" "$cfg" 2>/dev/null || cat "$cfg"
else
  echo "Config not found: $cfg"
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
fi

echo ""
echo "=== 5. Last 50 lines of nautilus-api logs ==="
sudo journalctl -u nautilus-api.service -n 50 --no-pager 2>/dev/null || true

echo ""
echo "=== 6. server/.env (only keys, no secrets) ==="
grep -E '^(DATABASE_URL|API_PREFIX|SECRET_KEY)=' server/.env 2>/dev/null | sed 's/=.*/=***/' || echo "server/.env not found or empty"

echo ""
echo "=== 7. Unit file ExecStart / WorkingDirectory ==="
grep -E "ExecStart|WorkingDirectory|EnvironmentFile" /etc/systemd/system/nautilus-api.service 2>/dev/null || true

echo ""
echo "=== 8. venv and uvicorn ==="
ls -la server/venv/bin/python server/venv/bin/activate 2>/dev/null || echo "venv missing or path wrong"
