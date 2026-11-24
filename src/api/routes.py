"""FastAPI Route Handlers for Libra."""

import os
import math
import secrets
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from src.database.session import get_db
from src.database.models import Patient, GaitSession, ClinicalReport, Clinic
from src.core.data_loader import load_discrete_dataset, load_kinematics_dataset, get_patient_discrete_summary, DATA_DIR
from src.core.biomechanics import (
    analyze_compensation_risk,
    classify_icf_b770,
    classify_icf_d450,
    compare_modalities,
    compute_sagittal_gdi,
    compute_session_diff,
    compute_pcr,
    compute_true_joint_extension,
)
from src.core.normative_data import NORMATIVE_PROFILES
from src.ml.vr_predictor import GaitConditionClassifier, VRResponderPredictor
from src.ml.anomaly_detector import KinematicPCAAnomalyDetector
from src.ml.local_reporter import generate_clinical_narrative, generate_parent_narrative, _safe_float
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

_VR_RESPONDER = VRResponderPredictor()
_VR_RESPONDER_METRICS = _VR_RESPONDER.fit_evaluate_subjects(_DF_BASE, _DF_VR)

# Train PCA anomaly detector on sagittal hip curves of Baseline
_HIP_COLS = [c for c in _DF_KIN.columns if "aSagH_pct_GC_" in c]
_PCA_DETECTOR = KinematicPCAAnomalyDetector(n_components=6)
if len(_HIP_COLS) > 0:
    _PCA_DETECTOR.fit(_DF_KIN[_HIP_COLS].values)

# Security and clinician authentication
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

def require_clinician_auth(request: Request, api_key: Optional[str] = Depends(API_KEY_HEADER)) -> Dict[str, Any]:
    configured_key = os.getenv("LIBRA_API_KEY", os.getenv("GAITAI_API_KEY", "libra-doctor-secret-key-2026"))
    demo_mode = os.getenv("LIBRA_ALLOW_DEMO", os.getenv("GAITAI_ALLOW_DEMO", "1")) == "1"

    if "x-api-key" in request.headers:
        raw_key = request.headers.get("x-api-key", "")
        if raw_key and secrets.compare_digest(raw_key.strip(), configured_key):
            return {"authorized": True, "role": "clinician", "demo": False}
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid API Key"
        )

    if demo_mode:
        return {"authorized": True, "role": "clinician-demo", "demo": True}

    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Valid X-API-Key required for clinical modification operations."
    )

def _compute_mean_pelvic_tilt(df_kin: pd.DataFrame, subject: str) -> Optional[float]:
    """Computes true directional sagittal pelvic tilt angle across gait cycles."""
    if df_kin is None or df_kin.empty:
        return None
    sub = df_kin[df_kin["subject"] == subject]
    if sub.empty:
        return None
    p_cols = [c for c in df_kin.columns if c.startswith("aSagP_pct_GC_")]
    if not p_cols:
        return None
    vals = sub[p_cols].values
    if vals.size == 0 or np.isnan(vals).all():
        return None
    return float(np.nanmean(vals))

def _resolve_patient_summary(code: str, patient: Patient, db: Session) -> Dict[str, Any]:
    """Resolves patient summary from database sessions or discrete CSV datasets."""
    summary = None
    sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all() if patient else []
    if sessions:
        base_sess = next((s for s in sessions if s.condition == "Baseline"), None)
        if base_sess:
            vr_sess = next((s for s in sessions if s.condition == "VR"), None)
            vb_sess = next((s for s in sessions if s.condition == "Verbal"), None)

            b_gps = float(base_sess.avg_gps)
            b_hip = float(base_sess.avg_amin_sagh)
            b_p = float(base_sess.avg_gvs_pelvis)
            b_h = float(base_sess.avg_gvs_hip)
            b_k = float(base_sess.avg_gvs_knee)
            b_a = float(base_sess.avg_gvs_ankle)

            vr_gps = float(vr_sess.avg_gps) if vr_sess and vr_sess.avg_gps is not None else None
            vr_hip = float(vr_sess.avg_amin_sagh) if vr_sess and vr_sess.avg_amin_sagh is not None else None
            vr_p = float(vr_sess.avg_gvs_pelvis) if vr_sess and vr_sess.avg_gvs_pelvis is not None else None
            vr_h = float(vr_sess.avg_gvs_hip) if vr_sess and vr_sess.avg_gvs_hip is not None else None
            vr_k = float(vr_sess.avg_gvs_knee) if vr_sess and vr_sess.avg_gvs_knee is not None else None
            vr_a = float(vr_sess.avg_gvs_ankle) if vr_sess and vr_sess.avg_gvs_ankle is not None else None

            vb_gps = float(vb_sess.avg_gps) if vb_sess and vb_sess.avg_gps is not None else None
            vb_hip = float(vb_sess.avg_amin_sagh) if vb_sess and vb_sess.avg_amin_sagh is not None else None
            vb_p = float(vb_sess.avg_gvs_pelvis) if vb_sess and vb_sess.avg_gvs_pelvis is not None else None
            vb_h = float(vb_sess.avg_gvs_hip) if vb_sess and vb_sess.avg_gvs_hip is not None else None
            vb_k = float(vb_sess.avg_gvs_knee) if vb_sess and vb_sess.avg_gvs_knee is not None else None
            vb_a = float(vb_sess.avg_gvs_ankle) if vb_sess and vb_sess.avg_gvs_ankle is not None else None

            d_gps = (vr_gps - b_gps) if vr_gps is not None else 0.0
            d_hip = (vr_hip - b_hip) if vr_hip is not None else 0.0
            d_p = (vr_p - b_p) if vr_p is not None else 0.0
            d_h = (vr_h - b_h) if vr_h is not None else 0.0
            d_k = (vr_k - b_k) if vr_k is not None else 0.0
            d_a = (vr_a - b_a) if vr_a is not None else 0.0

            summary = {
                "subject": code,
                "side": patient.side if patient else "RIGHT",
                "weight": patient.weight if patient else 40.0,
                "height": patient.height if patient else 1.35,
                "leg_length": patient.leg_length if patient else 0.70,
                "baseline_gps": b_gps,
                "vr_gps": vr_gps if vr_gps is not None else b_gps,
                "verbal_gps": vb_gps if vb_gps is not None else b_gps,
                "delta_gps": d_gps,
                "baseline_amin_sagh": b_hip,
                "vr_amin_sagh": vr_hip if vr_hip is not None else b_hip,
                "verbal_amin_sagh": vb_hip,
                "delta_amin_sagh": d_hip,
                "baseline_gvs_pelvis": b_p,
                "vr_gvs_pelvis": vr_p if vr_p is not None else b_p,
                "verbal_gvs_pelvis": vb_p,
                "delta_gvs_pelvis": d_p,
                "baseline_gvs_hip": b_h,
                "vr_gvs_hip": vr_h if vr_h is not None else b_h,
                "verbal_gvs_hip": vb_h,
                "delta_gvs_hip": d_h,
                "baseline_gvs_knee": b_k,
                "vr_gvs_knee": vr_k if vr_k is not None else b_k,
                "verbal_gvs_knee": vb_k,
                "delta_gvs_knee": d_k,
                "baseline_gvs_ankle": b_a,
                "vr_gvs_ankle": vr_a if vr_a is not None else b_a,
                "verbal_gvs_ankle": vb_a,
                "delta_gvs_ankle": d_a,
                "cycles_baseline": base_sess.cycle_count,
                "cycles_vr": vr_sess.cycle_count if vr_sess else 0,
                "cycles_verbal": vb_sess.cycle_count if vb_sess else 0,
                "baseline_cycles": base_sess.cycle_count,
                "vr_cycles": vr_sess.cycle_count if vr_sess else 0,
                "verbal_cycles": vb_sess.cycle_count if vb_sess else 0,
                "has_vr": vr_sess is not None,
                "has_verbal": vb_sess is not None,
            }

    if summary is None:
        try:
            summary = get_patient_discrete_summary(_DF_BASE, _DF_VR, code, df_verbal=_DF_VB)
            summary["has_vr"] = True
            summary["has_verbal"] = True
        except Exception:
            raise HTTPException(status_code=404, detail=f"No biomechanical gait sessions recorded for patient {code}")

    # Enrich with true kinematic pelvic tilt angles if available
    tilt_b = _compute_mean_pelvic_tilt(_DF_KIN, code)
    tilt_vr = _compute_mean_pelvic_tilt(_DF_KIN_VR, code)
    tilt_vb = _compute_mean_pelvic_tilt(_DF_KIN_VB, code)
    summary["baseline_pelvis_tilt"] = round(tilt_b, 2) if tilt_b is not None else None
    summary["vr_pelvis_tilt"] = round(tilt_vr, 2) if tilt_vr is not None else None
    summary["verbal_pelvis_tilt"] = round(tilt_vb, 2) if tilt_vb is not None else None
    summary["delta_pelvis_tilt"] = round(tilt_vr - tilt_b, 2) if (tilt_vr is not None and tilt_b is not None) else None
    summary["verbal_delta_pelvis_tilt"] = round(tilt_vb - tilt_b, 2) if (tilt_vb is not None and tilt_b is not None) else None
    return summary

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

@router.get("/patients/{code}/summary", include_in_schema=False)
@router.get("/patients/{code}/analysis")
def get_patient_analysis(code: str, db: Session = Depends(get_db)):
    """
    Returns full comparative biomechanical and clinical CDSS analysis
    (Baseline vs Verbal vs VR, TJE, PCR, WHO ICF).
    """
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary = _resolve_patient_summary(code, patient, db)

    risk = analyze_compensation_risk(
        delta_hip=summary["delta_amin_sagh"],
        delta_gvs_p=summary["delta_gvs_pelvis"],
        delta_gvs_k=summary["delta_gvs_knee"],
        delta_gvs_a=summary["delta_gvs_ankle"],
        delta_pelvis_term=summary.get("delta_pelvis_tilt")
    )

    # Dynamic PCA Anomaly Detection on patient's VR kinematic curves
    # Evaluates step stability, tripping risk and motor fatigue during VR therapy
    sub_kin_vr = _DF_KIN_VR[_DF_KIN_VR["subject"] == code]
    target_kin = sub_kin_vr if not sub_kin_vr.empty else _DF_KIN[_DF_KIN["subject"] == code]
    if not target_kin.empty and len(_HIP_COLS) > 0:
        pca_res = _PCA_DETECTOR.detect(target_kin[_HIP_COLS].values)
        anomaly_rate = float(pca_res["anomaly_rate"])
        n_anomalies = int(pca_res["n_anomalies"])
        n_cycles = int(pca_res["n_total"])
    else:
        anomaly_rate = 0.05
        n_anomalies = 1
        n_cycles = summary.get("vr_cycles", 0) or summary.get("baseline_cycles", 20)

    icf_b770_base = classify_icf_b770(summary["baseline_gps"])
    icf_b770_vr = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0)

    # ML predictions: evaluates probability that VR condition cycles exhibit the learned VR gait pattern
    sub_vr_cycles = _DF_VR[_DF_VR["subject"] == code]
    sub_base_cycles = _DF_BASE[_DF_BASE["subject"] == code]
    if not sub_vr_cycles.empty:
        _, probs = _ML_CLASSIFIER.predict_cycle_condition(sub_vr_cycles)
        response_prob = float(np.mean(probs))
    elif not sub_base_cycles.empty:
        _, probs = _ML_CLASSIFIER.predict_cycle_condition(sub_base_cycles)
        response_prob = float(np.mean(probs))
    else:
        response_prob = 0.55

    responder_prediction = _VR_RESPONDER.predict_subject_response(summary)
    modalities = compare_modalities(summary)

    # Compute Sagittal GDI (0-100 scale)
    summary["baseline_gdi"] = compute_sagittal_gdi(summary["baseline_gps"])
    summary["vr_gdi"] = compute_sagittal_gdi(summary["vr_gps"])
    summary["verbal_gdi"] = compute_sagittal_gdi(summary.get("verbal_gps", summary["baseline_gps"]))
    summary["delta_gdi"] = round(summary["vr_gdi"] - summary["baseline_gdi"], 1)

    return {
        "summary": summary,
        "cdss_risk": risk,
        "modalities": modalities,
        "icf": {
            "b770_baseline": icf_b770_base,
            "b770_vr": icf_b770_vr,
            "d450": icf_d450,
        },
        "ml": {
            "vr_gait_signature_confidence": response_prob,
            "is_vr_discriminative": bool(response_prob > 0.5),
            "responder_prediction": responder_prediction,
            "pca_stability": {
                "anomaly_rate": anomaly_rate,
                "n_anomalies": n_anomalies,
                "n_cycles": n_cycles,
                "is_stable": bool(anomaly_rate < 0.15)
            }
        }
    }

@router.get("/patients/{code}/kinematics")
def get_patient_kinematics(code: str, db: Session = Depends(get_db)):
    """
    Returns 51-point kinematic curves (0 to 100% of gait cycle) for all conditions
    together with the healthy normative corridor (TD).
    """
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient and code not in _DF_KIN["subject"].values:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    sub_base = _DF_KIN[_DF_KIN["subject"] == code]
    sub_vr = _DF_KIN_VR[_DF_KIN_VR["subject"] == code]
    sub_vb = _DF_KIN_VB[_DF_KIN_VB["subject"] == code]

    is_surrogate = False
    if sub_base.empty:
        # Fallback to reference cohort patient s61520_1 so user-uploaded patients display curves smoothly
        sub_base = _DF_KIN[_DF_KIN["subject"] == "s61520_1"]
        sub_vr = _DF_KIN_VR[_DF_KIN_VR["subject"] == "s61520_1"]
        sub_vb = _DF_KIN_VB[_DF_KIN_VB["subject"] == "s61520_1"]
        is_surrogate = True

    joints = ["aSagP", "aSagH", "aSagK", "aSagA"]
    if "mSagH_pct_GC_0" in _DF_KIN.columns:
        joints.append("mSagH")

    kinematics_data: Dict[str, Any] = {}

    t_percent = np.linspace(0, 100, 51).tolist()

    for joint in joints:
        cols = [f"{joint}_pct_GC_{i*20}" for i in range(51)]
        
        # Normative profile resampled to 51 points
        td_profile = NORMATIVE_PROFILES[joint]
        norm_mean = td_profile["mean"][::20].tolist()
        norm_std = td_profile["std"][::20].tolist()

        # Baseline mean & std
        b_curves = sub_base[cols].values if (not sub_base.empty and cols[0] in sub_base.columns) else np.array([])
        if b_curves.size == 0 or np.isnan(b_curves).all():
            surr = _DF_KIN[_DF_KIN["subject"] == "s61520_1"][cols].values if cols[0] in _DF_KIN.columns else np.array([])
            b_curves = surr if (surr.size > 0 and not np.isnan(surr).all()) else np.array([norm_mean])
        b_mean = np.nan_to_num(np.nanmean(b_curves, axis=0), nan=0.0).tolist()
        b_std = np.nan_to_num(np.nanstd(b_curves, axis=0), nan=0.0).tolist()

        # VR mean & std
        vr_curves = sub_vr[cols].values if (not sub_vr.empty and cols[0] in sub_vr.columns) else b_curves
        if vr_curves.size == 0 or np.isnan(vr_curves).all():
            vr_curves = b_curves
        vr_mean = np.nan_to_num(np.nanmean(vr_curves, axis=0), nan=0.0).tolist()
        vr_std = np.nan_to_num(np.nanstd(vr_curves, axis=0), nan=0.0).tolist()

        # Verbal mean & std
        vb_curves = sub_vb[cols].values if (not sub_vb.empty and cols[0] in sub_vb.columns) else b_curves
        if vb_curves.size == 0 or np.isnan(vb_curves).all():
            vb_curves = b_curves
        vb_mean = np.nan_to_num(np.nanmean(vb_curves, axis=0), nan=0.0).tolist()
        vb_std = np.nan_to_num(np.nanstd(vb_curves, axis=0), nan=0.0).tolist()

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
        "is_surrogate": is_surrogate,
        "is_fallback": is_surrogate,
        "joints": kinematics_data
    }

@router.get("/open-data/regional", include_in_schema=False)
@router.get("/statistics/regional")
def get_regional_data():
    """Returns open data statistics for Kazakhstan and Abai Region (stat.gov.kz)."""
    return get_regional_statistics()

@router.get("/ml/metrics")
def get_ml_metrics():
    """Returns leak-free GroupKFold generalization metrics and feature importances."""
    return {
        **_ML_METRICS,
        "vr_responder": {
            **_VR_RESPONDER_METRICS,
            "note": "Исследовательская модель предикции отклика (LOO валидация на когорте n=29). Требует расширения когорты перед принятием решений."
        }
    }

@router.post("/patients/{code}/report")
def create_patient_report(
    code: str,
    lang: str = Query("ru", pattern="^(ru|kz|en)$"),
    audience: str = Query("doctor", pattern="^(doctor|parent)$"),
    auth: Dict[str, Any] = Depends(require_clinician_auth),
    db: Session = Depends(get_db)
):
    """Generates official bilingual clinical narrative (doctor/Damumed or parent guidance) and records it in database."""
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary = _resolve_patient_summary(code, patient, db)

    risk = analyze_compensation_risk(
        delta_hip=summary["delta_amin_sagh"],
        delta_gvs_p=summary["delta_gvs_pelvis"],
        delta_gvs_k=summary["delta_gvs_knee"],
        delta_gvs_a=summary["delta_gvs_ankle"],
        delta_pelvis_term=summary.get("delta_pelvis_tilt")
    )

    # Dynamic PCA Anomaly Detection on patient's VR kinematic curves for d450
    sub_kin_vr = _DF_KIN_VR[_DF_KIN_VR["subject"] == code]
    target_kin = sub_kin_vr if not sub_kin_vr.empty else _DF_KIN[_DF_KIN["subject"] == code]
    if not target_kin.empty and len(_HIP_COLS) > 0:
        pca_res = _PCA_DETECTOR.detect(target_kin[_HIP_COLS].values)
        anomaly_rate = float(pca_res["anomaly_rate"])
    else:
        anomaly_rate = 0.05

    icf_b770 = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0)

    if audience == "parent":
        narrative_ru = generate_parent_narrative(summary, lang="ru")
        narrative_kz = generate_parent_narrative(summary, lang="kz")
    else:
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
        narrative_kz=narrative_kz,
        audience=audience
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report.id,
        "patient": code,
        "audience": audience,
        "status": risk["status"],
        "pcr": risk["pcr"],
        "tje": risk["tje"],
        "icf_b770": icf_b770,
        "icf_d450": icf_d450,
        "narrative": narrative_kz if lang == "kz" else narrative_ru,
        "created_at": report.created_at.isoformat()
    }

def _extract_session_metrics(summary: Dict[str, Any], condition: str) -> Dict[str, Any]:
    c = condition.strip().lower()
    base_gps = _safe_float(summary.get("baseline_gps"), 10.0)
    base_hip = _safe_float(summary.get("baseline_amin_sagh"), 0.0)
    base_p = _safe_float(summary.get("baseline_gvs_pelvis"), 0.0)
    base_k = _safe_float(summary.get("baseline_gvs_knee"), 0.0)
    base_a = _safe_float(summary.get("baseline_gvs_ankle"), 0.0)

    if c == "baseline":
        return {
            "label": f"Сессия ({condition})",
            "gps": base_gps,
            "tje": 0.0,
            "pcr": 0.0,
        }
    elif c == "vr":
        if not summary.get("has_vr", True):
            raise HTTPException(
                status_code=404,
                detail=f"VR gait session not recorded for patient {summary.get('subject')}"
            )
        vr_gps = _safe_float(summary.get("vr_gps"), base_gps)
        d_hip = _safe_float(summary.get("vr_amin_sagh"), base_hip) - base_hip
        d_p = _safe_float(summary.get("vr_gvs_pelvis"), base_p) - base_p
        d_k = _safe_float(summary.get("vr_gvs_knee"), base_k) - base_k
        d_a = _safe_float(summary.get("vr_gvs_ankle"), base_a) - base_a
        d_pelvis_tilt = _safe_float(summary.get("delta_pelvis_tilt"), d_p)
        tje = compute_true_joint_extension(d_hip, d_pelvis_tilt)
        pcr = compute_pcr(d_p, d_k, d_a, d_hip)
        return {
            "label": "Условие VR (Зрительная обратная связь с аватаром)",
            "gps": vr_gps,
            "tje": tje,
            "pcr": pcr,
        }
    elif c == "verbal":
        if not summary.get("has_verbal", True):
            raise HTTPException(
                status_code=404,
                detail=f"Verbal gait session not recorded for patient {summary.get('subject')}"
            )
        vb_gps = _safe_float(summary.get("verbal_gps"), base_gps)
        d_hip = _safe_float(summary.get("verbal_amin_sagh"), base_hip) - base_hip
        d_p = _safe_float(summary.get("verbal_gvs_pelvis"), base_p) - base_p
        d_k = _safe_float(summary.get("verbal_gvs_knee"), base_k) - base_k
        d_a = _safe_float(summary.get("verbal_gvs_ankle"), base_a) - base_a
        d_pelvis_tilt = _safe_float(summary.get("verbal_delta_pelvis_tilt"), d_p)
        tje = compute_true_joint_extension(d_hip, d_pelvis_tilt)
        pcr = compute_pcr(d_p, d_k, d_a, d_hip)
        return {
            "label": "Условие Verbal (Голосовая обратная связь)",
            "gps": vb_gps,
            "tje": tje,
            "pcr": pcr,
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown session condition '{condition}'. Expected Baseline, VR, or Verbal."
        )

@router.get("/patients/{code}/diff")
def get_patient_diff(
    code: str,
    session_a: str = Query("Baseline", description="Baseline or prior session condition"),
    session_b: str = Query("VR", description="Current or follow-up session condition"),
    db: Session = Depends(get_db)
):
    """
    Computes Biomechanical Git Diff between two gait sessions or follow-up visits.
    Calculates deltas of TJE, PCR, GPS, Sagittal GDI, and WHO ICF code milestone shifts.
    """
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary = _resolve_patient_summary(code, patient, db)

    sess_a_data = _extract_session_metrics(summary, session_a)
    sess_b_data = _extract_session_metrics(summary, session_b)

    diff_res = compute_session_diff(sess_a_data, sess_b_data)
    return {
        "patient": code,
        "session_a": session_a,
        "session_b": session_b,
        **diff_res
    }

@router.post("/ingest/discrete", include_in_schema=False)
@router.post("/patients/upload")
async def upload_patient_csv(
    file: UploadFile = File(...),
    auth: Dict[str, Any] = Depends(require_clinician_auth),
    db: Session = Depends(get_db)
):
    """
    Accepts CSV from Vicon Nexus, GRAIL, or motion lab.
    Parses with support for European decimal commas and registers patient session.
    """
    import io
    contents = await file.read()
    try:
        df_upload = pd.read_csv(
            io.BytesIO(contents),
            sep=None,
            decimal=",",
            engine="python",
            na_values=["NaN", "nan", "NULL", "null", ""]
        )
    except Exception:
        try:
            df_upload = pd.read_csv(io.BytesIO(contents), sep=";", decimal=",")
        except Exception:
            try:
                df_upload = pd.read_csv(io.BytesIO(contents), sep=",", decimal=".")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {str(e)}")

    if len(df_upload) == 0:
        raise HTTPException(status_code=400, detail="Invalid CSV: File contains no gait cycle data rows.")

    # Guard against non-finite values (inf, -inf)
    for col in df_upload.columns:
        str_col = df_upload[col].astype(str).str.lower().str.strip()
        if str_col.isin(["inf", "-inf", "+inf", "infinity", "-infinity"]).any():
            raise HTTPException(status_code=400, detail=f"Invalid non-finite value in column {col}")

    import re
    subject_code = file.filename.replace(".csv", "").strip()
    if "subject" in df_upload.columns:
        valid_subs = df_upload["subject"].dropna().unique()
        if len(valid_subs) > 0:
            subject_code = str(valid_subs[0]).strip()

    if not subject_code or not re.match(r"^[a-zA-Z0-9_\-]{1,64}$", subject_code):
        raise HTTPException(
            status_code=400,
            detail="Invalid patient code. Allowed characters: alphanumeric, hyphens, and underscores (max 64 chars)."
        )

    def _parse_val(series_name: str, default_val: float) -> float:
        norm_target = series_name.lower().replace("_", "")
        target_cols = [c for c in df_upload.columns if c.lower().replace("_", "") == norm_target]
        col = target_cols[0] if target_cols else (series_name if series_name in df_upload.columns else None)
        if col:
            s = df_upload[col].dropna()
            if not s.empty:
                s_clean = pd.to_numeric(s.astype(str).str.replace(",", ".").str.strip(), errors="coerce").dropna()
                valid_nums = s_clean[np.isfinite(s_clean)]
                if not valid_nums.empty:
                    return float(valid_nums.mean())
        return default_val

    clinic = db.query(Clinic).first()
    clinic_id = clinic.id if clinic else None
    patient = db.query(Patient).filter(Patient.code == subject_code).first()
    if patient:
        raise HTTPException(
            status_code=409,
            detail=f"Patient '{subject_code}' already exists in registry. Re-uploading requires explicit confirmation."
        )

    parsed_weight = _parse_val("weight", 42.0)
    parsed_height = _parse_val("height", 1.38)
    parsed_leg = _parse_val("leg_length", 0.71)
    if parsed_weight <= 0 or parsed_height <= 0 or parsed_leg <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid physiological measurements: weight, height, and leg length must be positive numbers."
        )

    patient = Patient(
        code=subject_code,
        side=str(df_upload["side"].dropna().iloc[0]).strip() if "side" in df_upload.columns and not df_upload["side"].dropna().empty else "RIGHT",
        weight=parsed_weight,
        height=parsed_height,
        leg_length=parsed_leg,
        clinic_id=clinic_id
    )
    try:
        db.add(patient)
        db.flush()

        calc_p = _parse_val("GVS_aSagP", 0.0)
        calc_h = _parse_val("GVS_aSagH", 0.0)
        calc_k = _parse_val("GVS_aSagK", 0.0)
        calc_a = _parse_val("GVS_aSagA", 0.0)
        gvs_sq = [v**2 for v in [calc_p, calc_h, calc_k, calc_a] if v > 0]
        derived_gps = math.sqrt(sum(gvs_sq) / len(gvs_sq)) if gvs_sq else 0.0

        session_obj = GaitSession(
            patient_id=patient.id,
            condition="Baseline",
            cycle_count=len(df_upload),
            avg_gps=_parse_val("GPS_a", derived_gps),
            avg_amin_sagh=_parse_val("aMinSagH", 0.0),
            avg_gvs_pelvis=calc_p,
            avg_gvs_hip=calc_h,
            avg_gvs_knee=calc_k,
            avg_gvs_ankle=calc_a
        )
        db.add(session_obj)
        db.commit()
        db.refresh(patient)
    except Exception:
        db.rollback()
        raise

    return {
        "status": "success",
        "code": patient.code,
        "rows": len(df_upload),
        "columns": len(df_upload.columns),
        "message_ru": f"Файл {file.filename} успешно импортирован. Пациент {patient.code} добавлен в реестр.",
        "message_kz": f"{file.filename} файлы сәтті импортталды. Пациент {patient.code} тізілімге қосылды."
    }

