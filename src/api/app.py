"""FastAPI Main Application Entrypoint for GaitAI Platform."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
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
    title="GaitAI: Clinical Biomechanics & AI Decision Support API",
    description="Backend service for pediatric cerebral palsy gait analysis, compensation risk detection, and WHO ICF reporting.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for Next.js web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def healthcheck():
    """Health check endpoint verifying application and database connectivity."""
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "GaitAI Clinical Engine",
        "version": "1.0.0",
        "database": db_status
    }
