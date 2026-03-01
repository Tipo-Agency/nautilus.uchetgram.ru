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

### 3.6. Один раз: sudoers + инициализация БД (обязательно перед первым автодеплоем)

Без этого автодеплой упадёт на шаге БД: «sudo: a password is required» и «permission denied for schema public». Выполни **один раз на сервере** (под root или пользователем с sudo), подставь свой путь если не `/var/www/nautilus.uchetgram.ru`:

```bash
# Путь проекта (поменяй, если другой)
P="/var/www/nautilus.uchetgram.ru"

# 1) Sudoers: chown всего проекта + запуск run_db_init_as_postgres без пароля
sudo cp "$P/deploy/sudoers.deploy" /etc/sudoers.d/deploy
sudo sed -i "s|/var/www/nautilus.uchetgram.ru|$P|g" /etc/sudoers.d/deploy
sudo chmod 440 /etc/sudoers.d/deploy

# 2) Инициализация БД: владелец БД и schema public (значения — как в server/.env из DATABASE_URL)
sudo -u postgres env PGUSER=nautilus_user PGHOST=localhost PGPORT=5432 PGDATABASE=nautilus_db bash "$P/deploy/init_postgres_db.sh"
```

После этого запушь в `main` или перезапусти workflow — деплой должен пройти до конца (фронт, venv, миграции, перезапуск API).

### 3.7. Если деплой снова падает на БД

Сделай п. 3.6 ещё раз (скопировать актуальный `deploy/sudoers.deploy`, поправить путь в нём, затем `init_postgres_db.sh` от postgres). Убедись, что в `server/.env` в DATABASE_URL указаны те же PGUSER и PGDATABASE, что в команде env выше.

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

### 3.10. HTTPS (SSL)

В эталонном конфиге nginx только **порт 80** (HTTP). Поэтому `https://...` даёт ошибку соединения (000), пока не настроен SSL.

- **Проверка по HTTP:** открой в браузере **http://nautilus.uchetgram.ru** (без s) — сайт должен открываться.
- **Включить HTTPS (один раз):** на сервере (домен должен указывать на сервер):
  ```bash
  sudo apt install certbot python3-certbot-nginx -y
  sudo certbot --nginx -d nautilus.uchetgram.ru
  ```
  Certbot добавит в конфиг nginx блок `listen 443 ssl` и редирект HTTP→HTTPS.
- **После деплоя:** скрипт деплоя перезаписывает конфиг nginx (блок 443 пропадает), затем **сам запускает certbot** (`certbot --nginx -d nautilus.uchetgram.ru --non-interactive`), если certbot установлен. Certbot заново добавляет HTTPS в конфиг, так что после автодеплоя HTTPS остаётся рабочим. Домен по умолчанию — `nautilus.uchetgram.ru`; другой можно задать через переменную `NAUTILUS_DOMAIN` при запуске `deploy.sh`.

---

## 4. Дальнейший автодеплой

После того как сервер настроен:

- каждый `git push` в `main` запускает GitHub Actions;
- Actions подключается по SSH под пользователем `deploy`, делает `git pull`, запускает `scripts/deploy.sh`.

Команда локально: `npm run push` (add + commit + push).

---

## 5. Проверка на сервере

После деплоя проверь:

1. **Сайт открывается:** https://nautilus.uchetgram.ru (или твой домен) — нет 502.
2. **API отвечает:** открой в браузере или `curl`:
   - `https://твой-домен/api/v1/health` → `{"status":"ok"}`
   - `https://твой-домен/api/v1/auth/users` → JSON (список пользователей или `[]`).
3. **Данные сохраняются:** зайди в приложение → например, «Финансы» → «Справка о доходах» → добавь выписку или подразделение → сохрани. Обнови страницу — данные должны остаться (источник истины — БД).
4. **Логи API при ошибках:** на сервере `journalctl -u nautilus-api -n 50 -f` или логи в GitHub Actions.

**Если все запросы к `/api/v1/*` отдают 404:** фронт ждёт префикс `/api/v1`, бэкенд должен его использовать. В `server/.env` должно быть `API_PREFIX=/api/v1`. Деплой-скрипт при каждом запуске выставляет это сам. Если правили .env вручную — проверь и перезапусти API: `sudo systemctl restart nautilus-api.service`.

**Если 502 Bad Gateway** (сайт не открывается или API не отвечает):

   **Частая причина после деплоя по HTTPS:** в конфиге nginx для nautilus не было блока `listen 443 ssl`. Запросы к https://nautilus.uchetgram.ru попадали в другой server block (например admin-amiscus.tipa.uz), который проксирует на порт 3021 — там ничего не слушает → 502. Решение: добавить HTTPS-блок с сертификатом Let's Encrypt (один раз: `sudo certbot --nginx -d nautilus.uchetgram.ru`). При каждом деплое скрипт теперь сам запускает certbot после записи конфига, так что HTTPS сохраняется.

   1. **Быстрый фикс** (на сервере, под root или с sudo):
      ```bash
      cd /var/www/nautilus.uchetgram.ru
      sudo bash deploy/fix_502.sh
      ```
      Скрипт выставит `API_PREFIX=/api/v1` в `server/.env`, обновит unit, перезапустит `nautilus-api` и проверит `curl .../api/v1/health`. Если после этого сайт всё ещё 502 — переходи к п. 2.

   2. **Диагностика** (пришли вывод):
      ```bash
      cd /var/www/nautilus.uchetgram.ru
      bash deploy/diagnose_502.sh
      ```
      В выводе будет: статус сервиса, ответ health, наличие `dist/`, конфиг nginx, последние логи API, наличие venv. По ним можно понять причину (сервис не стартует, нет venv, неверный root в nginx и т.д.).

   - Если **API не active** — смотри логи: `sudo journalctl -u nautilus-api.service -n 80 --no-pager` (часто: нет `DATABASE_URL`, ошибка импорта, нет venv).
   - Если **root** в nginx указывает на несуществующую папку — проверь `ls $P/dist` и что в конфиге `root $P/dist` или `$P/dist.live`.

2. **Исправить API_PREFIX в .env** (разделитель в sed — вертикальная черта `|`, не слэш):
   ```bash
   grep -q '^API_PREFIX=' /var/www/nautilus.uchetgram.ru/server/.env && \
     sudo sed -i 's|^API_PREFIX=.*|API_PREFIX=/api/v1|' /var/www/nautilus.uchetgram.ru/server/.env || \
     echo 'API_PREFIX=/api/v1' | sudo tee -a /var/www/nautilus.uchetgram.ru/server/.env
   sudo systemctl restart nautilus-api.service
   ```

3. **Частые причины падения сервиса:** нет или неверный `DATABASE_URL` в `server/.env`, нет прав на каталог/venv у пользователя `deploy`, ошибка при импорте (нет зависимостей). В логах будет traceback.

4. **500 на `/api/v1/finance/bank-statements`** (выписки не загружаются или «Save failed»):
   - **«value too long for type character varying(36)»** — ID выписок/строк длиннее 36 символов. Нужна миграция 005 (увеличивает длину id до 64). Выполни на сервере: `cd /var/www/nautilus.uchetgram.ru/server && . venv/bin/activate && alembic upgrade head && sudo systemctl restart nautilus-api.service`.
   - **«column department_id does not exist»** — не применена миграция 004. Та же команда: `alembic upgrade head` и перезапуск API.
   В ответе API при ошибке приходит текст в `detail` — по нему можно понять причину.

**Если status=203/EXEC** — systemd не может выполнить бинарник из venv (нет файла, битый shebang или путь). Запуск через `bash -c` и `source venv/bin/activate` обходит это. На сервере (подставь свой путь, если не `/var/www/nautilus.uchetgram.ru`):
   ```bash
   S="/var/www/nautilus.uchetgram.ru"
   sudo sed -i "s|^ExecStart=.*|ExecStart=/bin/bash -c 'cd $S/server \&\& . venv/bin/activate \&\& exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000'|" /etc/systemd/system/nautilus-api.service
   sudo systemctl daemon-reload
   sudo systemctl restart nautilus-api.service
   ```
   Если **venv вообще нет** (No such file or directory) — его создаёт только деплой. Не дублируй изменения вручную: запусти полный деплой на сервере (под пользователем `deploy`):
   ```bash
   cd /var/www/nautilus.uchetgram.ru
   SERVER_PATH=/var/www/nautilus.uchetgram.ru ./scripts/deploy.sh
   ```
   Скрипт подтянет код, создаст venv, поставит зависимости, при необходимости инициализирует БД, обновит unit и перезапустит `nautilus-api`. Если деплой падает на шаге БД (alembic) — сначала настрой sudoers и инициализацию БД (п. 3.6–3.7).
