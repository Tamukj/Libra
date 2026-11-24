"""Database session factory, connection management, and cohort seeding."""

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from src.database.models import Base, Clinic, Patient, GaitSession
from src.core.data_loader import load_discrete_dataset, DATA_DIR

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./gaitai.db")

# SQLite requires check_same_thread=False
connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}

engine = create_engine(DB_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency for FastAPI route handlers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db(seed_cohort: bool = True):
    """Initializes tables and seeds initial clinic and patients if empty."""
    Base.metadata.create_all(bind=engine)

    if not seed_cohort:
        return

    with SessionLocal() as db:
        if db.query(Clinic).count() == 0:
            clinic = Clinic(
                name="Облыстық балаларды оңалту орталығы / Центр реабилитации детей области Абай",
                city="Семей",
                region="Абай облысы"
            )
            db.add(clinic)
            db.commit()
            db.refresh(clinic)

            # Load discrete baseline to seed the 29 subjects
            baseline_file = DATA_DIR / "Discrete_Parameters_Baseline.csv"
            vr_file = DATA_DIR / "Discrete_Parameters_VR.csv"
            verbal_file = DATA_DIR / "Discrete_Parameters_Verbal.csv"

            if baseline_file.exists():
                df_base = load_discrete_dataset(baseline_file)
                df_vr = load_discrete_dataset(vr_file) if vr_file.exists() else None
                df_vb = load_discrete_dataset(verbal_file) if verbal_file.exists() else None

                subjects = df_base["subject"].unique()
                for sub in subjects:
                    sub_b = df_base[df_base["subject"] == sub]
                    p = Patient(
                        code=sub,
                        side=str(sub_b["side"].iloc[0]),
                        weight=float(sub_b["weight"].iloc[0]),
                        height=float(sub_b["height"].iloc[0]),
                        leg_length=float(sub_b["LegLength"].iloc[0]),
                        clinic_id=clinic.id
                    )
                    db.add(p)
                    db.commit()
                    db.refresh(p)

                    # Add baseline session
                    db.add(GaitSession(
                        patient_id=p.id,
                        condition="Baseline",
                        cycle_count=len(sub_b),
                        avg_gps=float(sub_b["GPS_a"].mean()),
                        avg_amin_sagh=float(sub_b["aMinSagH"].mean()),
                        avg_gvs_pelvis=float(sub_b["GVS_aSagP"].mean()),
                        avg_gvs_hip=float(sub_b["GVS_aSagH"].mean()),
                        avg_gvs_knee=float(sub_b["GVS_aSagK"].mean()),
                        avg_gvs_ankle=float(sub_b["GVS_aSagA"].mean())
                    ))

                    # Add VR session if available
                    if df_vr is not None:
                        sub_v = df_vr[df_vr["subject"] == sub]
                        if not sub_v.empty:
                            db.add(GaitSession(
                                patient_id=p.id,
                                condition="VR",
                                cycle_count=len(sub_v),
                                avg_gps=float(sub_v["GPS_a"].mean()),
                                avg_amin_sagh=float(sub_v["aMinSagH"].mean()),
                                avg_gvs_pelvis=float(sub_v["GVS_aSagP"].mean()),
                                avg_gvs_hip=float(sub_v["GVS_aSagH"].mean()),
                                avg_gvs_knee=float(sub_v["GVS_aSagK"].mean()),
                                avg_gvs_ankle=float(sub_v["GVS_aSagA"].mean())
                            ))

                    # Add Verbal session if available
                    if df_vb is not None:
                        sub_vb = df_vb[df_vb["subject"] == sub]
                        if not sub_vb.empty:
                            db.add(GaitSession(
                                patient_id=p.id,
                                condition="Verbal",
                                cycle_count=len(sub_vb),
                                avg_gps=float(sub_vb["GPS_a"].mean()),
                                avg_amin_sagh=float(sub_vb["aMinSagH"].mean()),
                                avg_gvs_pelvis=float(sub_vb["GVS_aSagP"].mean()),
                                avg_gvs_hip=float(sub_vb["GVS_aSagH"].mean()),
                                avg_gvs_knee=float(sub_vb["GVS_aSagK"].mean()),
                                avg_gvs_ankle=float(sub_vb["GVS_aSagA"].mean())
                            ))

                db.commit()
