#!/bin/bash
# Скрипт автоматического деплоя для GitHub Actions
# Использование: ./scripts/deploy.sh

set +e  # Не падаем на ошибках, обрабатываем их вручную

SERVER_PATH="${SERVER_PATH:-/var/www/nautilus.uchetgram.ru}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

echo "🚀 Starting deployment..."
echo "👤 Deploy user: $USER"
echo "📁 Server path: $SERVER_PATH"

# Переходим в директорию проекта
cd "$SERVER_PATH" || { echo "❌ Failed to cd to $SERVER_PATH"; exit 1; }

git config --global --add safe.directory "$SERVER_PATH" 2>/dev/null || true

# 1. Обновляем код
echo ""
echo "📥 Step 1: Updating code..."
# Убираем server/venv с диска до reset, чтобы git не падал с Permission denied (venv не должен быть в репо)
rm -rf server/venv 2>/dev/null || true
git fetch origin || { echo "⚠️ git fetch failed"; exit 1; }
git reset --hard origin/main || { echo "⚠️ git reset failed"; exit 1; }
echo "✅ Code updated"

# 2. Деплой фронтенда (сборка в новую папку + symlink; если dist не удаляется — используем dist.live)
echo ""
echo "🚀 Step 2: Deploying frontend..."
DIST_LINK="dist"
if [ -e "dist" ] && [ ! -L "dist" ]; then
  if ! rm -rf dist 2>/dev/null; then
    echo "⚠️ dist/ не удаляется (права) — собираем в dist.live, nginx должен отдавать root $SERVER_PATH/dist.live"
    DIST_LINK="dist.live"
  fi
fi
npm ci || { echo "❌ npm ci failed"; exit 1; }
BUILD_DIR="${DIST_LINK}.$(date +%s)"
PREV_LINK=
[ -L "$DIST_LINK" ] && PREV_LINK=$(readlink "$DIST_LINK")
export VITE_OUT_DIR="$BUILD_DIR"
# Чтобы серверный .env не перебивал outDir — явно пишем в .env.production.local
echo "VITE_OUT_DIR=$BUILD_DIR" > .env.production.local
npm run build || { echo "❌ npm build failed"; exit 1; }
rm -f .env.production.local 2>/dev/null || true
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "❌ Build broken: no index.html in $BUILD_DIR (only: $(ls -la "$BUILD_DIR" 2>/dev/null | head -20))"
  exit 1
fi
chmod -R a+rX "$BUILD_DIR"
chmod o+x "$SERVER_PATH" 2>/dev/null || true
ln -sfn "$BUILD_DIR" "$DIST_LINK"
[ -n "$PREV_LINK" ] && [ -d "$PREV_LINK" ] && rm -rf "$PREV_LINK"
echo "✅ Frontend deployed → $DIST_LINK"

# 3. Деплой Python API: venv никогда из git — всегда пересоздаём на сервере
if [ -d "server" ] && [ -f "server/requirements.txt" ]; then
  echo ""
  echo "🐍 Step 3: Deploying Python API (fresh venv)..."
  (cd "$SERVER_PATH/server" && {
    rm -rf venv
    python3 -m venv venv
    . venv/bin/activate && pip install -q -r requirements.txt
  }) || { echo "⚠️ Python API venv/pip failed"; exit 1; }
  # Обновляем systemd unit из репо (путь к uvicorn из venv на сервере)
  if [ -f "deploy/nautilus-api.service" ]; then
    sed "s|__SERVER_PATH__|$SERVER_PATH|g" deploy/nautilus-api.service | sudo tee /etc/systemd/system/nautilus-api.service > /dev/null 2>&1
    sudo systemctl daemon-reload 2>/dev/null || true
  fi
  sudo systemctl restart nautilus-api.service 2>/dev/null || echo "⚠️ sudo systemctl restart nautilus-api failed (service may not exist yet)"
  echo "✅ Python API updated (venv recreated, nautilus-api restarted)"
fi

# 4. Деплой Telegram бота
echo ""
echo "🤖 Step 4: Deploying Telegram bot..."
if [ -d "telegram-bot" ]; then
  cd telegram-bot || { echo "❌ Failed to cd to telegram-bot"; exit 1; }
  
  # Обновляем .env с токеном
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo "🔐 Updating .env file..."
    if [ ! -f ".env" ]; then
      touch .env
    fi
    if grep -q "^TELEGRAM_BOT_TOKEN=" .env; then
      sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN|" .env
    else
      echo "TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN" >> .env
    fi
    chmod 600 .env 2>/dev/null || true
    echo "✅ .env updated"
  fi
  
  # Обновляем systemd сервис
  echo "🔧 Updating systemd service..."
  if [ -f "telegram-bot.service" ]; then
    sudo cp telegram-bot.service /etc/systemd/system/telegram-bot.service
    sudo chmod 644 /etc/systemd/system/telegram-bot.service
    sudo systemctl daemon-reload
    echo "✅ Systemd service updated"
  else
    echo "⚠️ telegram-bot.service not found, skipping..."
  fi
  
  # Запускаем deploy.sh бота
  if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    echo "📝 Running bot deploy.sh..."
    DEPLOY_USER="$USER" sudo -E ./deploy.sh || {
      echo "⚠️ Bot deploy.sh exited with error, but checking status..."
      if systemctl is-active --quiet telegram-bot 2>/dev/null; then
        echo "✅ Bot is actually running"
      else
        echo "❌ Bot is NOT running"
      fi
    }
  fi
  
  # Перезапускаем сервис
  echo "🔄 Restarting bot service..."
  sudo systemctl restart telegram-bot.service || echo "⚠️ Failed to restart service"
  sleep 3
  
  # Проверяем статус
  if systemctl is-active --quiet telegram-bot 2>/dev/null; then
    echo "✅ Telegram bot is running"
    # Проверяем на ошибки 409
    if sudo journalctl -u telegram-bot -n 20 --no-pager 2>/dev/null | grep -qi "409\|conflict"; then
      echo "   ⚠️ Found 409/Conflict errors in logs!"
    else
      echo "   ✅ No 409/Conflict errors"
    fi
  else
    echo "❌ Telegram bot is NOT running!"
    echo "📋 Recent logs:"
    sudo journalctl -u telegram-bot -n 10 --no-pager 2>/dev/null || true
  fi
  
  cd .. || true
else
  echo "⚠️ telegram-bot directory not found, skipping..."
fi

# 5. Деплой конфига nginx и перезагрузка (чтобы root и favicon всегда актуальны)
echo ""
echo "🔄 Step 5: Nginx config and reload..."
if [ -f "deploy/nautilus.nginx.conf" ]; then
  NGINX_DEST="/etc/nginx/sites-available/nautilus.uchetgram.ru"
  sed -e "s|__SERVER_PATH__|$SERVER_PATH|g" -e "s|__DIST_LINK__|$DIST_LINK|g" deploy/nautilus.nginx.conf | sudo tee "$NGINX_DEST" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    sudo ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/nautilus.uchetgram.ru 2>/dev/null || true
    if sudo nginx -t 2>/dev/null; then
      sudo systemctl reload nginx 2>/dev/null && echo "✅ Nginx config updated and reloaded" || echo "⚠️ nginx reload failed (sudo?)"
    else
      echo "⚠️ nginx -t failed, config not reloaded"
    fi
  else
    echo "⚠️ Could not write nginx config (sudo?). Add sudoers rule — see DEPLOY_SETUP.md"
    nginx -t 2>/dev/null || true
    systemctl reload nginx 2>/dev/null || true
  fi
else
  nginx -t || echo "⚠️ nginx config test failed"
  systemctl reload nginx || echo "⚠️ nginx reload failed"
fi

# Финальный статус
echo ""
echo "✅ Deployment completed!"
echo "📋 Final status:"
echo "   Frontend: ✅ Built"
if systemctl is-active --quiet telegram-bot 2>/dev/null; then
  echo "   Telegram bot: ✅ Running"
else
  echo "   Telegram bot: ⚠️ Not running"
fi
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "   Nginx: ✅ Running"
else
  echo "   Nginx: ⚠️ Not running"
fi

exit 0
