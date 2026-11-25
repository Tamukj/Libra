"""Database package exports with dynamic session bindings for test isolation."""

import src.database.session as _session
from src.database.models import Base, Clinic, Patient, GaitSession, ClinicalReport
from src.database.session import get_db, init_db

__all__ = [
    "Base",
    "Clinic",
    "Patient",
    "GaitSession",
    "ClinicalReport",
    "SessionLocal",
    "get_db",
    "init_db",
    "engine",
]


def __getattr__(name: str):
    if name in ("engine", "SessionLocal", "DB_URL"):
        return getattr(_session, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
