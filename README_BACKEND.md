# Taska Backend (Python FastAPI)

## Быстрый старт (два терминала)

**Терминал 1 — бэкенд:**
```bash
cd server && cp .env.example .env   # если .env ещё нет
cd server && alembic upgrade head   # один раз: миграции
npm run dev:server
```

**Терминал 2 — фронт:**
```bash
npm run dev
```

Фронт: http://localhost:3000, API: http://localhost:8000. Vite проксирует `/api` на бэкенд.

---

## Локальный запуск (подробно)

### 1. PostgreSQL

PostgreSQL обязателен (SQLite запрещён). Docker:

```bash
docker run -d --name taska-db -e POSTGRES_USER=taska -e POSTGRES_PASSWORD=taska -e POSTGRES_DB=taska -p 5432:5432 postgres:16-alpine
```

### 2. Backend

```bash
cd server
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Создайте `.env` (скопируй из `.env.example`):
```
DATABASE_URL=postgresql+asyncpg://taska:taska@localhost:5432/taska
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
API_PREFIX=/api/v1
```

Миграции и запуск:

```bash
alembic upgrade head
python seed.py          # опционально: демо-данные
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Или из корня: `npm run dev:server`.

### 3. Frontend

```bash
npm install
npm run dev
```

## Docker Compose (полный стек)

```bash
docker-compose up -d
```

- Backend: http://localhost:8000
- PostgreSQL: localhost:5432
- Демо-данные: `docker-compose exec backend python seed.py`

## Telegram Bot

Бот использует Backend API. Добавьте в `.env`:

```
BACKEND_URL=http://localhost:8000
TELEGRAM_BOT_TOKEN=your-token
```

Firebase полностью удалён — единственный источник данных: Python backend.

## Деплой

При деплое миграции выполняются автоматически при старте контейнера (`alembic upgrade head` в CMD).
