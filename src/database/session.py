"""Database session factory, cross-platform connection management, and cohort seeding."""

import math
import os
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from src.database.models import Base, Clinic, Patient, GaitSession
from src.core.data_loader import load_discrete_dataset, load_kinematics_dataset, DATA_DIR

try:
    import fcntl
except ImportError:
    fcntl = None  # Windows fallback uses msvcrt/threading

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./libra.db")

connect_args = {"check_same_thread": False, "timeout": 30} if DB_URL.startswith("sqlite") else {}
engine = create_engine(DB_URL, connect_args=connect_args, echo=False)


@event.listens_for(engine, "connect")
def configure_sqlite(dbapi_connection, connection_record):
    """Enforces SQLite relational invariants on each connection."""
    if DB_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA synchronous = NORMAL;")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
_init_lock = threading.Lock()


def get_db():
    """Dependency for FastAPI route handlers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def _cross_platform_init_lock():
    """Serializes DB initialization across threads and POSIX/Windows processes."""
    lock_file_path = Path(tempfile.gettempdir()) / "libra_db_init.lock"
    with _init_lock:
        if fcntl is not None:
            with open(lock_file_path, "w") as lock_file:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        else:
            yield


def _optional_mean(df, col: str) -> Optional[float]:
    if df is None or col not in df.columns:
        return None
    clean = df[col].dropna()
    if clean.empty:
        return None
    val = float(clean.mean())
    return None if (math.isnan(val) or not math.isfinite(val)) else val


def _pelvic_tilt_mean(df_kin, sub: str) -> Optional[float]:
    if df_kin is None or df_kin.empty:
        return None
    sub_df = df_kin[df_kin["subject"] == sub]
    if sub_df.empty:
        return None
    p_cols = [c for c in df_kin.columns if c.startswith("aSagP_pct_GC_")]
    if not p_cols:
        return None
    vals = sub_df[p_cols].to_numpy(dtype=float)
    valid = vals[np.isfinite(vals)] if vals.size > 0 else vals
    return float(valid.mean()) if valid.size > 0 else None


import numpy as np  # noqa: E402


def _migrate_sqlite_columns():
    """Applies additive column migrations for pre-existing local SQLite databases."""
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        conn.execute(text("PRAGMA journal_mode = WAL;"))
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(gait_sessions)")).fetchall()]
        migrations = {
            "avg_pctm_zero": "FLOAT",
            "avg_pelvis_tilt": "FLOAT",
            "kinematics_json": "TEXT",
            "source": "VARCHAR(32) DEFAULT 'seeded'",
        }
        for col_name, col_type in migrations.items():
            if col_name not in cols:
                conn.execute(text(f"ALTER TABLE gait_sessions ADD COLUMN {col_name} {col_type}"))


def init_db(seed_cohort: bool = True):
    """Initializes tables and seeds initial clinic and patients atomically if empty."""
    with _cross_platform_init_lock():
        Base.metadata.create_all(bind=engine, checkfirst=True)
        _migrate_sqlite_columns()

        if not seed_cohort:
            return

        with SessionLocal() as db:
            if db.query(Patient).count() > 0:
                return

            clinic = db.query(Clinic).first()
            if not clinic:
                clinic = Clinic(
                    name="Клиническая когорта ДЦП (KU Leuven) / БЦП клиникалық когортасы",
                    city="",
                    region="",
                )
                db.add(clinic)
                db.flush()

            baseline_file = DATA_DIR / "Discrete_Parameters_Baseline.csv"
            vr_file = DATA_DIR / "Discrete_Parameters_VR.csv"
            verbal_file = DATA_DIR / "Discrete_Parameters_Verbal.csv"
            kin_b_file = DATA_DIR / "Kinematics_Kinetics_Baseline.csv"
            kin_vr_file = DATA_DIR / "Kinematics_Kinetics_VR.csv"
            kin_vb_file = DATA_DIR / "Kinematics_Kinetics_Verbal.csv"

            if not baseline_file.exists():
                db.commit()
                return

            df_base = load_discrete_dataset(baseline_file)
            df_vr = load_discrete_dataset(vr_file) if vr_file.exists() else None
            df_vb = load_discrete_dataset(verbal_file) if verbal_file.exists() else None
            df_kin_b = load_kinematics_dataset(kin_b_file) if kin_b_file.exists() else None
            df_kin_vr = load_kinematics_dataset(kin_vr_file) if kin_vr_file.exists() else None
            df_kin_vb = load_kinematics_dataset(kin_vb_file) if kin_vb_file.exists() else None

            for sub in df_base["subject"].dropna().unique():
                sub_b = df_base[df_base["subject"] == sub]
                p = Patient(
                    code=sub,
                    side=str(sub_b["side"].iloc[0]),
                    weight=float(sub_b["weight"].iloc[0]),
                    height=float(sub_b["height"].iloc[0]),
                    leg_length=float(sub_b["LegLength"].iloc[0]),
                    clinic_id=clinic.id,
                )
                db.add(p)
                db.flush()

                condition_specs = [
                    ("Baseline", sub_b, df_kin_b),
                    ("VR", df_vr[df_vr["subject"] == sub] if df_vr is not None else None, df_kin_vr),
                    ("Verbal", df_vb[df_vb["subject"] == sub] if df_vb is not None else None, df_kin_vb),
                ]
                for cond_name, sub_df, kin_df in condition_specs:
                    if sub_df is None or sub_df.empty:
                        continue
                    db.add(GaitSession(
                        patient_id=p.id,
                        condition=cond_name,
                        cycle_count=len(sub_df),
                        avg_gps=_optional_mean(sub_df, "GPS_a"),
                        avg_amin_sagh=_optional_mean(sub_df, "aMinSagH"),
                        avg_gvs_pelvis=_optional_mean(sub_df, "GVS_aSagP"),
                        avg_gvs_hip=_optional_mean(sub_df, "GVS_aSagH"),
                        avg_gvs_knee=_optional_mean(sub_df, "GVS_aSagK"),
                        avg_gvs_ankle=_optional_mean(sub_df, "GVS_aSagA"),
                        avg_pctm_zero=_optional_mean(sub_df, "pctmZeroStSagH"),
                        avg_pelvis_tilt=_pelvic_tilt_mean(kin_df, sub),
                        source="seeded",
                    ))

            db.commit()
