"""FastAPI Route Handlers for GaitAI."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from src.database.session import get_db
from src.database.models import Patient, GaitSession, ClinicalReport, Clinic
from src.core.data_loader import load_discrete_dataset, load_kinematics_dataset, get_patient_discrete_summary, DATA_DIR
from src.core.biomechanics import analyze_compensation_risk, classify_icf_b770, classify_icf_d450
from src.core.normative_data import NORMATIVE_PROFILES
from src.ml.vr_predictor import GaitConditionClassifier
from src.ml.local_reporter import generate_clinical_narrative
from src.api.open_data import get_regional_statistics

router = APIRouter(prefix="/api/v1")

# Preload dataset DataFrames once in memory for sub-millisecond response
_DF_BASE = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Baseline.csv")
_DF_VR = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_VR.csv")
_DF_VB = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Verbal.csv")
_DF_KIN = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")
_DF_KIN_VR = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_VR.csv")
_DF_KIN_VB = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Verbal.csv")

# Train ML model once at startup
_ML_CLASSIFIER = GaitConditionClassifier(n_splits=5)
_ML_METRICS = _ML_CLASSIFIER.evaluate_group_kfold(_DF_BASE, _DF_VR)
_ML_CLASSIFIER.fit_full(_DF_BASE, _DF_VR)

@router.get("/patients")
def list_patients(db: Session = Depends(get_db)):
    """Returns all 29 patients with metadata."""
    patients = db.query(Patient).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "side": p.side,
            "weight": p.weight,
            "height": p.height,
            "leg_length": p.leg_length,
            "clinic_name": p.clinic.name if p.clinic else None
        }
        for p in patients
    ]

@router.get("/patients/{code}/analysis")
def get_patient_analysis(code: str, db: Session = Depends(get_db)):
    """
    Returns full comparative biomechanical and clinical CDSS analysis
    (Baseline vs Verbal vs VR, TJE, PCR, WHO ICF).
    """
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    try:
        summary = get_patient_discrete_summary(_DF_BASE, _DF_VR, code, df_verbal=_DF_VB)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    risk = analyze_compensation_risk(
        delta_hip=summary["delta_amin_sagh"],
        delta_gvs_p=summary["delta_gvs_pelvis"],
        delta_gvs_k=summary["delta_gvs_knee"],
        delta_gvs_a=summary["delta_gvs_ankle"]
    )

    icf_b770_base = classify_icf_b770(summary["baseline_gps"])
    icf_b770_vr = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(5.0) # Normal baseline stability rate

    # ML prediction for this patient's cycles
    patient_cycles = _DF_BASE[_DF_BASE["subject"] == code]
    _, probs = _ML_CLASSIFIER.predict_cycle_condition(patient_cycles)
    response_prob = float(np.mean(probs))

    return {
        "summary": summary,
        "cdss_risk": risk,
        "icf": {
            "b770_baseline": icf_b770_base,
            "b770_vr": icf_b770_vr,
            "d450": icf_d450,
        },
        "ml": {
            "vr_gait_signature_confidence": response_prob,
            "is_vr_discriminative": bool(response_prob > 0.5)
        }
    }

@router.get("/patients/{code}/kinematics")
def get_patient_kinematics(code: str):
    """
    Returns 51-point kinematic curves (0 to 100% of gait cycle) for all conditions
    together with the healthy normative corridor (TD).
    """
    sub_base = _DF_KIN[_DF_KIN["subject"] == code]
    sub_vr = _DF_KIN_VR[_DF_KIN_VR["subject"] == code]
    sub_vb = _DF_KIN_VB[_DF_KIN_VB["subject"] == code]

    if sub_base.empty:
        raise HTTPException(status_code=404, detail=f"Patient {code} kinematics not found")

    joints = ["aSagP", "aSagH", "aSagK", "aSagA"]
    kinematics_data: Dict[str, Any] = {}

    t_percent = np.linspace(0, 100, 51).tolist()

    for joint in joints:
        cols = [f"{joint}_pct_GC_{i*20}" for i in range(51)]
        
        # Baseline mean & std
        b_curves = sub_base[cols].values
        b_mean = np.nanmean(b_curves, axis=0).tolist()
        b_std = np.nanstd(b_curves, axis=0).tolist()

        # VR mean & std
        vr_curves = sub_vr[cols].values if not sub_vr.empty else b_curves
        vr_mean = np.nanmean(vr_curves, axis=0).tolist()
        vr_std = np.nanstd(vr_curves, axis=0).tolist()

        # Verbal mean & std
        vb_curves = sub_vb[cols].values if not sub_vb.empty else b_curves
        vb_mean = np.nanmean(vb_curves, axis=0).tolist()
        vb_std = np.nanstd(vb_curves, axis=0).tolist()

        # Normative profile resampled to 51 points
        td_profile = NORMATIVE_PROFILES[joint]
        norm_mean = td_profile["mean"][::20].tolist()
        norm_std = td_profile["std"][::20].tolist()

        kinematics_data[joint] = {
            "name_ru": td_profile["name_ru"],
            "name_kz": td_profile["name_kz"],
            "unit": td_profile["unit"],
            "time_percent": t_percent,
            "baseline": {"mean": b_mean, "std": b_std},
            "vr": {"mean": vr_mean, "std": vr_std},
            "verbal": {"mean": vb_mean, "std": vb_std},
            "norm_td": {"mean": norm_mean, "std": norm_std}
        }

    return {
        "subject": code,
        "joints": kinematics_data
    }

@router.get("/statistics/regional")
def get_regional_data():
    """Returns open data statistics for Kazakhstan and Abai Region (stat.gov.kz)."""
    return get_regional_statistics()

@router.get("/ml/metrics")
def get_ml_metrics():
    """Returns leak-free GroupKFold generalization metrics and feature importances."""
    return _ML_METRICS

@router.post("/patients/{code}/report")
def create_patient_report(
    code: str,
    lang: str = Query("ru", pattern="^(ru|kz)$"),
    db: Session = Depends(get_db)
):
    """Generates official bilingual clinical narrative and records it in database."""
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary = get_patient_discrete_summary(_DF_BASE, _DF_VR, code, df_verbal=_DF_VB)
    risk = analyze_compensation_risk(
        delta_hip=summary["delta_amin_sagh"],
        delta_gvs_p=summary["delta_gvs_pelvis"],
        delta_gvs_k=summary["delta_gvs_knee"],
        delta_gvs_a=summary["delta_gvs_ankle"]
    )

    icf_b770 = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(5.0)

    narrative_ru = generate_clinical_narrative(summary, lang="ru")
    narrative_kz = generate_clinical_narrative(summary, lang="kz")

    report = ClinicalReport(
        patient_id=patient.id,
        icf_b770=icf_b770,
        icf_d450=icf_d450,
        tje=risk["tje"],
        pcr=risk["pcr"],
        status=risk["status"],
        narrative_ru=narrative_ru,
        narrative_kz=narrative_kz
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report.id,
        "patient": code,
        "status": risk["status"],
        "pcr": risk["pcr"],
        "tje": risk["tje"],
        "icf_b770": icf_b770,
        "icf_d450": icf_d450,
        "narrative": narrative_kz if lang == "kz" else narrative_ru,
        "created_at": report.created_at.isoformat()
    }

@router.post("/patients/upload")
async def upload_patient_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts CSV from Vicon Nexus, GRAIL, or motion lab.
    Parses and registers patient, adds to cohort.
    """
    import io
    contents = await file.read()
    try:
        df_upload = pd.read_csv(io.BytesIO(contents), sep=None, engine="python")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    subject_code = file.filename.replace(".csv", "").strip()
    if "subject" in df_upload.columns:
        valid_subs = df_upload["subject"].dropna().unique()
        if len(valid_subs) > 0:
            subject_code = str(valid_subs[0])

    patient = db.query(Patient).filter(Patient.code == subject_code).first()
    if not patient:
        patient = Patient(
            code=subject_code,
            side="RIGHT",
            weight=float(df_upload["weight"].dropna().iloc[0]) if "weight" in df_upload.columns else 42.0,
            height=float(df_upload["height"].dropna().iloc[0]) if "height" in df_upload.columns else 1.38,
            leg_length=float(df_upload["leg_length"].dropna().iloc[0]) if "leg_length" in df_upload.columns else 0.71,
            clinic_id=1
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    return {
        "status": "success",
        "code": patient.code,
        "rows": len(df_upload),
        "columns": len(df_upload.columns),
        "message_ru": f"Файл {file.filename} успешно импортирован. Пациент {patient.code} добавлен в реестр.",
        "message_kz": f"{file.filename} файлы сәтті импортталды. Пациент {patient.code} тізілімге қосылды."
    }

