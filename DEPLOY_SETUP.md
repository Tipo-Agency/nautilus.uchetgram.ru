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

Весь каталог проекта должен принадлежать пользователю `deploy`, иначе сборка (Vite) не сможет перезаписать `dist/`.

```bash
sudo mkdir -p /var/www/nautilus.uchetgram.ru
sudo chown -R deploy:deploy /var/www/nautilus.uchetgram.ru
```

Если деплой уже падал с `EACCES` / "Cannot remove dist/", один раз выполни на сервере:  
`sudo chown -R deploy:deploy /var/www/nautilus.uchetgram.ru`

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

### 3.4. Если деплой писал «dist/ не удаляется» — nginx на dist.live

Скрипт при неудачном удалении `dist/` собирает в **dist.live** (symlink). В nginx укажи корень сайта на него:

```nginx
root /var/www/nautilus.uchetgram.ru/dist.live;
```

(вместо `.../dist`). Либо один раз на сервере: `sudo rm -rf /var/www/nautilus.uchetgram.ru/dist` — тогда дальше будет использоваться `dist`.

### 3.5. Node.js, npm, Python

```bash
# Node 18+ (например через nvm)
# Python 3.9+
```

### 3.6. Один раз: sudoers (чтобы автодеплой проходил без ручных шагов)

В `deploy/sudoers.deploy` **две строки**: (1) `chown` для `.../server` — чтобы скрипт мог пересоздать venv; (2) запуск `run_db_init_as_postgres.sh` от postgres — чтобы инициализация БД (схема `public`, владелец) выполнялась при деплое без пароля.

Сделай **один раз** на сервере:
```bash
sudo cp /var/www/nautilus.uchetgram.ru/deploy/sudoers.deploy /etc/sudoers.d/deploy
# Если SERVER_PATH другой — поправь путь в обеих строках файла:
# sudo sed -i 's|/var/www/nautilus.uchetgram.ru|ТВОЙ_ПУТЬ|g' /etc/sudoers.d/deploy
sudo chmod 440 /etc/sudoers.d/deploy
```
После обновления репозитория при необходимости обнови файл в `/etc/sudoers.d/deploy` (например, заново скопируй `deploy/sudoers.deploy` и поправь путь), чтобы и вторая строка (инициализация БД) работала.

**Без sudoers:** вручную выполни `sudo chown -R deploy:deploy .../server`; инициализацию БД один раз выполни от postgres (см. п. 3.7).

### 3.7. Если деплой падает: БД

- **alembic: "permission denied for schema public"** — при деплое скрипт вызывает `sudo -u postgres .../deploy/run_db_init_as_postgres.sh` (инициализация БД и прав на `public`). Если это не настроено, добавь в sudoers вторую строку из `deploy/sudoers.deploy` и обнови путь при необходимости. Либо один раз выполни от postgres: `sudo -u postgres env PGUSER=... PGHOST=... PGPORT=... PGDATABASE=... bash $SERVER_PATH/deploy/init_postgres_db.sh`.

### 3.8. Systemd-сервис для Python API (опционально)

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

Создай `.env` в `server/` с `DATABASE_URL` (обязательно PostgreSQL: `postgresql+asyncpg://user:pass@host:5432/db`, SQLite запрещён), `SECRET_KEY` и т.д. При деплое `.env` не перезаписывается.

При деплое скрипт запускает `deploy/run_db_init_as_postgres.sh` через sudo (если настроен sudoers, п. 3.6): создаётся БД (если нет), владелец БД и схемы `public`, права (GRANT). Если sudoers не настроен — скрипт выведет предупреждение; тогда создай БД вручную и один раз выполни от postgres: `ALTER DATABASE dbname OWNER TO app_user; ALTER SCHEMA public OWNER TO app_user; GRANT ALL ON SCHEMA public TO app_user;` (или скрипт `deploy/init_postgres_db.sh` с нужными переменными окружения).

### 3.9. Первый ручной деплой (проверка)

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
