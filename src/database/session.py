"""Database session factory, cross-platform connection management, and cohort seeding."""

import math
import os
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
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
    """Applies additive and table-rebuild migrations for pre-existing local SQLite databases."""
    if engine.dialect.name != "sqlite":
        return

    raw_conn = engine.raw_connection()
    try:
        raw_conn.rollback()
        cur = raw_conn.cursor()
        cur.execute("PRAGMA foreign_keys = OFF;")
        cur.execute("PRAGMA journal_mode = WAL;")

        # 1. Patients table: nullable anthropometry + estimation flags
        p_info = cur.execute("PRAGMA table_info(patients)").fetchall()
        if p_info:
            p_cols = {row[1]: row for row in p_info}
            needs_patient_rebuild = (
                "anthropometry_estimated" not in p_cols
                or "side_estimated" not in p_cols
                or p_cols.get("weight", (None, None, None, 0))[3] == 1
                or p_cols.get("height", (None, None, None, 0))[3] == 1
                or p_cols.get("leg_length", (None, None, None, 0))[3] == 1
            )
            if needs_patient_rebuild:
                anthro_expr = (
                    "COALESCE(anthropometry_estimated, CASE WHEN weight IS NULL OR height IS NULL OR leg_length IS NULL THEN 1 ELSE 0 END)"
                    if "anthropometry_estimated" in p_cols
                    else "CASE WHEN weight IS NULL OR height IS NULL OR leg_length IS NULL THEN 1 ELSE 0 END"
                )
                side_est_expr = (
                    "COALESCE(side_estimated, CASE WHEN side IS NULL OR TRIM(side) = '' OR UPPER(TRIM(side)) = 'UNSPECIFIED' THEN 1 ELSE 0 END)"
                    if "side_estimated" in p_cols
                    else "CASE WHEN side IS NULL OR TRIM(side) = '' OR UPPER(TRIM(side)) = 'UNSPECIFIED' THEN 1 ELSE 0 END"
                )
                cur.execute("""
                    CREATE TABLE patients_migrated (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        code VARCHAR(64) NOT NULL,
                        side VARCHAR(16) NOT NULL,
                        weight FLOAT,
                        height FLOAT,
                        leg_length FLOAT,
                        anthropometry_estimated BOOLEAN NOT NULL DEFAULT 0,
                        side_estimated BOOLEAN NOT NULL DEFAULT 0,
                        clinic_id INTEGER REFERENCES clinics (id),
                        created_at DATETIME
                    )
                """)
                cur.execute(f"""
                    INSERT INTO patients_migrated (
                        id, code, side, weight, height, leg_length,
                        anthropometry_estimated, side_estimated, clinic_id, created_at
                    )
                    SELECT
                        id,
                        code,
                        COALESCE(NULLIF(TRIM(side), ''), 'UNSPECIFIED'),
                        weight,
                        height,
                        leg_length,
                        {anthro_expr},
                        {side_est_expr},
                        clinic_id,
                        created_at
                    FROM patients
                """)
                cur.execute("DROP TABLE patients")
                cur.execute("ALTER TABLE patients_migrated RENAME TO patients")
                cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_code ON patients (code)")
                cur.execute("CREATE INDEX IF NOT EXISTS ix_patients_clinic_id ON patients (clinic_id)")

        # 2. GaitSession table: visit_key/visit_label/visit_date & uq_patient_visit_condition
        gs_info = cur.execute("PRAGMA table_info(gait_sessions)").fetchall()
        if gs_info:
            gs_cols = {row[1] for row in gs_info}
            gs_sql_row = cur.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='gait_sessions'"
            ).fetchone()
            gs_sql = gs_sql_row[0] if gs_sql_row and gs_sql_row[0] else ""
            needs_gs_rebuild = (
                "visit_key" not in gs_cols
                or "visit_label" not in gs_cols
                or "visit_date" not in gs_cols
                or "uq_patient_condition" in gs_sql
                or "uq_patient_visit_condition" not in gs_sql
            )
            if needs_gs_rebuild:
                source_expr = "COALESCE(NULLIF(source, ''), 'seeded')" if "source" in gs_cols else "'seeded'"
                vk_expr = "COALESCE(NULLIF(visit_key, ''), 'visit-1')" if "visit_key" in gs_cols else "'visit-1'"
                vl_default = f"CASE WHEN {source_expr} = 'seeded' THEN 'Базовый курс (KU Leuven)' ELSE 'Визит 1' END"
                vl_expr = f"COALESCE(NULLIF(visit_label, ''), {vl_default})" if "visit_label" in gs_cols else vl_default
                vd_expr = "COALESCE(visit_date, '')" if "visit_date" in gs_cols else "''"
                pctm_expr = "avg_pctm_zero" if "avg_pctm_zero" in gs_cols else "NULL"
                tilt_expr = "avg_pelvis_tilt" if "avg_pelvis_tilt" in gs_cols else "NULL"
                kin_expr = "kinematics_json" if "kinematics_json" in gs_cols else "NULL"

                cur.execute("""
                    CREATE TABLE gait_sessions_migrated (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        patient_id INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
                        visit_key VARCHAR(64) NOT NULL DEFAULT 'visit-1',
                        visit_label VARCHAR(128) NOT NULL DEFAULT '',
                        visit_date VARCHAR(32) NOT NULL DEFAULT '',
                        condition VARCHAR(32) NOT NULL,
                        cycle_count INTEGER NOT NULL DEFAULT 0,
                        avg_gps FLOAT,
                        avg_amin_sagh FLOAT,
                        avg_gvs_pelvis FLOAT,
                        avg_gvs_hip FLOAT,
                        avg_gvs_knee FLOAT,
                        avg_gvs_ankle FLOAT,
                        avg_pctm_zero FLOAT,
                        avg_pelvis_tilt FLOAT,
                        kinematics_json TEXT,
                        source VARCHAR(32) NOT NULL DEFAULT 'seeded',
                        recorded_at DATETIME,
                        CONSTRAINT uq_patient_visit_condition UNIQUE (patient_id, visit_key, condition)
                    )
                """)
                cur.execute(f"""
                    INSERT INTO gait_sessions_migrated (
                        id, patient_id, visit_key, visit_label, visit_date, condition,
                        cycle_count, avg_gps, avg_amin_sagh, avg_gvs_pelvis, avg_gvs_hip,
                        avg_gvs_knee, avg_gvs_ankle, avg_pctm_zero, avg_pelvis_tilt,
                        kinematics_json, source, recorded_at
                    )
                    SELECT
                        id,
                        patient_id,
                        {vk_expr},
                        {vl_expr},
                        {vd_expr},
                        condition,
                        COALESCE(cycle_count, 0),
                        avg_gps,
                        avg_amin_sagh,
                        avg_gvs_pelvis,
                        avg_gvs_hip,
                        avg_gvs_knee,
                        avg_gvs_ankle,
                        {pctm_expr},
                        {tilt_expr},
                        {kin_expr},
                        {source_expr},
                        recorded_at
                    FROM gait_sessions
                """)
                cur.execute("DROP TABLE gait_sessions")
                cur.execute("ALTER TABLE gait_sessions_migrated RENAME TO gait_sessions")
                cur.execute("CREATE INDEX IF NOT EXISTS ix_gait_sessions_patient_id ON gait_sessions (patient_id)")
            else:
                migrations = {
                    "avg_pctm_zero": "FLOAT",
                    "avg_pelvis_tilt": "FLOAT",
                    "kinematics_json": "TEXT",
                    "source": "VARCHAR(32) DEFAULT 'seeded'",
                }
                for col_name, col_type in migrations.items():
                    if col_name not in gs_cols:
                        cur.execute(f"ALTER TABLE gait_sessions ADD COLUMN {col_name} {col_type}")

        # 3. ClinicalReport table: visit_key, narrative_en, nullable tje/pcr
        cr_info = cur.execute("PRAGMA table_info(clinical_reports)").fetchall()
        if cr_info:
            cr_cols = {row[1]: row for row in cr_info}
            needs_cr_rebuild = (
                "visit_key" not in cr_cols
                or "narrative_en" not in cr_cols
                or cr_cols.get("tje", (None, None, None, 0))[3] == 1
                or cr_cols.get("pcr", (None, None, None, 0))[3] == 1
            )
            if needs_cr_rebuild:
                vk_expr = "COALESCE(NULLIF(visit_key, ''), 'visit-1')" if "visit_key" in cr_cols else "'visit-1'"
                en_expr = "COALESCE(narrative_en, '')" if "narrative_en" in cr_cols else "''"
                cur.execute("""
                    CREATE TABLE clinical_reports_migrated (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        patient_id INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
                        visit_key VARCHAR(64) NOT NULL DEFAULT 'visit-1',
                        icf_b770 VARCHAR(16) NOT NULL,
                        icf_d450 VARCHAR(16) NOT NULL,
                        tje FLOAT,
                        pcr FLOAT,
                        status VARCHAR(16) NOT NULL DEFAULT 'green',
                        narrative_ru TEXT NOT NULL,
                        narrative_kz TEXT NOT NULL,
                        narrative_en TEXT NOT NULL DEFAULT '',
                        audience VARCHAR(16) NOT NULL DEFAULT 'doctor',
                        created_at DATETIME
                    )
                """)
                cur.execute(f"""
                    INSERT INTO clinical_reports_migrated (
                        id, patient_id, visit_key, icf_b770, icf_d450, tje, pcr,
                        status, narrative_ru, narrative_kz, narrative_en, audience, created_at
                    )
                    SELECT
                        id, patient_id, {vk_expr}, icf_b770, icf_d450, tje, pcr,
                        COALESCE(status, 'green'), narrative_ru, narrative_kz, {en_expr},
                        COALESCE(audience, 'doctor'), created_at
                    FROM clinical_reports
                """)
                cur.execute("DROP TABLE clinical_reports")
                cur.execute("ALTER TABLE clinical_reports_migrated RENAME TO clinical_reports")
                cur.execute("CREATE INDEX IF NOT EXISTS ix_clinical_reports_patient_id ON clinical_reports (patient_id)")

        raw_conn.commit()
        cur.execute("PRAGMA foreign_keys = ON;")
        fk_violations = cur.execute("PRAGMA foreign_key_check;").fetchall()
        if fk_violations:
            raise RuntimeError(f"SQLite migration foreign key check failed: {fk_violations}")
        cur.close()
    except Exception:
        raw_conn.rollback()
        raise
    finally:
        raw_conn.close()


def init_db(seed_cohort: bool = True):
    """Initializes tables and seeds initial clinic and patients atomically if empty."""
    with _cross_platform_init_lock():
        for attempt in range(5):
            try:
                try:
                    Base.metadata.create_all(bind=engine, checkfirst=True)
                except (OperationalError, ProgrammingError) as exc:
                    if "already exists" not in str(exc).lower():
                        raise
                _migrate_sqlite_columns()

                if not seed_cohort:
                    return

                with SessionLocal() as db:
                    if db.query(Patient).count() > 0:
                        return

                    try:
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
                            raw_side = str(sub_b["side"].iloc[0]).strip().upper() if "side" in sub_b.columns else ""
                            side_val = raw_side if raw_side in ("LEFT", "RIGHT") else "UNSPECIFIED"
                            w_val = _optional_mean(sub_b, "weight")
                            h_val = _optional_mean(sub_b, "height")
                            l_val = _optional_mean(sub_b, "LegLength")
                            p = Patient(
                                code=sub,
                                side=side_val,
                                weight=w_val,
                                height=h_val,
                                leg_length=l_val,
                                anthropometry_estimated=(w_val is None or h_val is None or l_val is None),
                                side_estimated=(side_val == "UNSPECIFIED"),
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
                                    visit_key="visit-1",
                                    visit_label="Базовый курс (KU Leuven)",
                                    visit_date="2024-04-30",
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
                    except IntegrityError:
                        db.rollback()
                return
            except OperationalError as exc:
                msg = str(exc).lower()
                if ("locked" in msg or "busy" in msg) and attempt < 4:
                    time.sleep(0.05 * (attempt + 1))
                    continue
                raise
