"""FastAPI application entry point."""
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, Base, AsyncSessionLocal
from app.routers import (
    auth,
    tasks,
    projects,
    tables,
    activity,
    messages,
    statuses,
    priorities,
    notification_prefs,
    automation,
    clients,
    deals,
    employees,
    accounts_receivable,
    docs,
    folders,
    meetings,
    content_posts,
    departments,
    finance,
    bpm,
    inventory,
    funnels,
    sites,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run migrations on startup."""
    from alembic.config import Config
    from alembic import command

    server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_cfg = Config(os.path.join(server_dir, "alembic.ini"))
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        print(f"Migration warning: {e}", file=sys.stderr)
    yield


app = FastAPI(
    title="Taska API",
    description="Backend API for Taska CRM/Task Manager",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers (prefix already in router)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX, tags=["projects"])
app.include_router(tables.router, prefix=settings.API_PREFIX, tags=["tables"])
app.include_router(activity.router, prefix=settings.API_PREFIX, tags=["activity"])
app.include_router(messages.router, prefix=settings.API_PREFIX, tags=["messages"])
app.include_router(statuses.router, prefix=settings.API_PREFIX, tags=["statuses"])
app.include_router(priorities.router, prefix=settings.API_PREFIX, tags=["priorities"])
app.include_router(notification_prefs.router, prefix=settings.API_PREFIX, tags=["notification-prefs"])
app.include_router(automation.router, prefix=settings.API_PREFIX, tags=["automation"])
app.include_router(clients.router, prefix=settings.API_PREFIX, tags=["clients"])
app.include_router(deals.router, prefix=settings.API_PREFIX, tags=["deals"])
app.include_router(employees.router, prefix=settings.API_PREFIX, tags=["employees"])
app.include_router(accounts_receivable.router, prefix=settings.API_PREFIX, tags=["accounts-receivable"])
app.include_router(docs.router, prefix=settings.API_PREFIX, tags=["docs"])
app.include_router(folders.router, prefix=settings.API_PREFIX, tags=["folders"])
app.include_router(meetings.router, prefix=settings.API_PREFIX, tags=["meetings"])
app.include_router(content_posts.router, prefix=settings.API_PREFIX, tags=["content-posts"])
app.include_router(departments.router, prefix=settings.API_PREFIX, tags=["departments"])
app.include_router(finance.router, prefix=settings.API_PREFIX, tags=["finance"])
app.include_router(bpm.router, prefix=settings.API_PREFIX, tags=["bpm"])
app.include_router(inventory.router, prefix=settings.API_PREFIX, tags=["inventory"])
app.include_router(funnels.router, prefix=settings.API_PREFIX, tags=["funnels"])
app.include_router(sites.router, prefix=settings.API_PREFIX, tags=["sites"])


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
