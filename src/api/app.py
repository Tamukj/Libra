"""FastAPI Main Application Entrypoint for Libra Platform."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from src.database.session import init_db, engine
from src.api.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database tables exist and seed cohort
    init_db(seed_cohort=True)
    yield
    # Shutdown
    engine.dispose()

app = FastAPI(
    title="Libra: Clinical Biomechanics & AI Decision Support API",
    description="Backend service for pediatric cerebral palsy CSV gait analysis, compensation risk detection, and WHO ICF reporting.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for Next.js web client
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def healthcheck(response: Response):
    """Health check endpoint verifying application and database connectivity."""
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "Libra Clinical Engine",
        "version": "1.0.0",
        "database": db_status
    }
