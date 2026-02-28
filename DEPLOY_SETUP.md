# Первоначальная настройка автодеплоя

## 1. GitHub

### Репозиторий
- Репозиторий: https://github.com/Tipo-Agency/nautilus.uchetgram.ru
- Ветка для деплоя: `main`

### GitHub Actions secrets

Добавь в **Settings → Secrets and variables → Actions**:

| Secret | Описание |
|--------|----------|
| `SERVER_HOST` | IP или хост сервера |
| `SERVER_USER` | Пользователь SSH (обычно `deploy`) |
| `SERVER_SSH_KEY` | Приватный SSH-ключ для доступа под этим пользователем |
| `SERVER_PATH` | Путь к проекту на сервере (по умолчанию `/var/www/nautilus.uchetgram.ru`) |
| `TELEGRAM_BOT_TOKEN` | Токен бота (если используется) |

---

## 2. Первый push

### Локально

```bash
# Переключить remote на nautilus
git remote set-url origin git@github.com:Tipo-Agency/nautilus.uchetgram.ru.git

# Или, если репо новое и пустое:
git remote remove origin
git remote add origin git@github.com:Tipo-Agency/nautilus.uchetgram.ru.git

# Пуш (скрипт делает add, commit, push)
npm run push
```

При первом push GitHub Actions начнёт workflow, но он упадёт, пока сервер не готов — это ожидаемо.

---

## 3. Сервер (под пользователем deploy)

### 3.1. Подготовка директории

```bash
sudo mkdir -p /var/www/nautilus.uchetgram.ru
sudo chown deploy:deploy /var/www/nautilus.uchetgram.ru
```

### 3.2. SSH-ключ deploy → GitHub

У пользователя `deploy` должен быть SSH-ключ, добавленный в GitHub (Deploy Key или в аккаунт).

Проверка:
```bash
sudo -u deploy ssh -T git@github.com
# Ожидается: Hi ... You've successfully authenticated...
```

### 3.3. Клонирование репозитория

```bash
sudo -u deploy git clone git@github.com:Tipo-Agency/nautilus.uchetgram.ru.git /var/www/nautilus.uchetgram.ru
cd /var/www/nautilus.uchetgram.ru
```

### 3.4. Sudoers для deploy

Пользователю `deploy` нужны права без пароля для systemctl и chown:

```bash
sudo visudo
# Добавь:
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx, /usr/bin/systemctl restart telegram-bot.service, /usr/bin/systemctl restart nautilus-api.service, /usr/bin/systemctl restart nautilus-backend.service, /usr/bin/chown *
```

### 3.5. Node.js, npm, Python

```bash
# Node 18+ (например через nvm)
# Python 3.9+
```

### 3.6. Nginx

Пример конфига `/etc/nginx/sites-available/nautilus.uchetgram.ru`:

```nginx
server {
    listen 80;
    server_name nautilus.uchetgram.ru;
    root /var/www/nautilus.uchetgram.ru/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3.7. Systemd-сервис для Python API (опционально)

Файл `/etc/systemd/system/nautilus-api.service`:

```ini
[Unit]
Description=Nautilus FastAPI
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/nautilus.uchetgram.ru/server
EnvironmentFile=/var/www/nautilus.uchetgram.ru/server/.env
ExecStart=/var/www/nautilus.uchetgram.ru/server/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Создай `.env` в `server/` с `DATABASE_URL`, `SECRET_KEY` и т.д.

### 3.8. Первый ручной деплой (проверка)

```bash
cd /var/www/nautilus.uchetgram.ru
chmod +x scripts/deploy.sh
SERVER_PATH=/var/www/nautilus.uchetgram.ru TELEGRAM_BOT_TOKEN=xxx ./scripts/deploy.sh
```

---

## 4. Дальнейший автодеплой

После того как сервер настроен:

- каждый `git push` в `main` запускает GitHub Actions;
- Actions подключается по SSH под пользователем `deploy`, делает `git pull`, запускает `scripts/deploy.sh`.

Команда локально: `npm run push` (add + commit + push).
