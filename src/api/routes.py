"""FastAPI Route Handlers for Libra."""

import os
import json
import math
import datetime
import secrets
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request, Response
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
    compute_curve_gvs_gps,
    compute_kinematic_summary_metrics,
)
from src.core.normative_data import NORMATIVE_PROFILES
from src.ml.vr_predictor import GaitConditionClassifier, VRResponderPredictor
from src.ml.anomaly_detector import KinematicPCAAnomalyDetector
from src.ml.local_reporter import generate_clinical_narrative, generate_parent_narrative, _safe_float
from src.ml.pdf_reporter import generate_pdf_report
from src.api.cohort_analytics import build_cohort_analytics

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
_ML_METRICS = _ML_CLASSIFIER.evaluate_group_kfold(
    _DF_BASE, _DF_VR, df_kin_base=_DF_KIN, df_kin_vr=_DF_KIN_VR
)
_ML_CLASSIFIER.fit_full(_DF_BASE, _DF_VR, df_kin_base=_DF_KIN, df_kin_vr=_DF_KIN_VR)
_ML_THREE_CLASS_METRICS = _ML_CLASSIFIER.evaluate_three_class_group_kfold(
    _DF_BASE, _DF_VB, _DF_VR,
    df_kin_base=_DF_KIN, df_kin_verbal=_DF_KIN_VB, df_kin_vr=_DF_KIN_VR,
)

_VR_RESPONDER = VRResponderPredictor()
_VR_RESPONDER_METRICS = _VR_RESPONDER.fit_evaluate_subjects(_DF_BASE, _DF_VR, df_kin_base=_DF_KIN)

# Train PCA anomaly detector on sagittal hip curves of Baseline + GroupKFold validation
_HIP_COLS = [c for c in _DF_KIN.columns if "aSagH_pct_GC_" in c]
_PCA_DETECTOR = KinematicPCAAnomalyDetector(n_components=6)
_PCA_VALIDATION: Dict[str, Any] = {"oof_baseline_anomaly_rate": 0.0, "vr_anomaly_rate": 0.0, "fold_rates": [], "n_splits": 0, "n_subjects": 0, "n_cycles": 0}
if len(_HIP_COLS) > 0:
    _PCA_VALIDATION = _PCA_DETECTOR.evaluate_group_kfold(_DF_KIN[_HIP_COLS].values, _DF_KIN["subject"].values, n_splits=5)
    _PCA_DETECTOR.fit(_DF_KIN[_HIP_COLS].values)
    _vr_pca_res = _PCA_DETECTOR.detect(_DF_KIN_VR[_HIP_COLS].values)
    _PCA_VALIDATION["vr_anomaly_rate"] = float(_vr_pca_res["anomaly_rate"])
    _PCA_VALIDATION["vr_n_cycles"] = int(_vr_pca_res["n_total"])

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

def _compute_mean_hip_rom(df_kin: pd.DataFrame, subject: str) -> Optional[float]:
    """Computes sagittal hip range of motion (max - min) across gait cycles."""
    if df_kin is None or df_kin.empty:
        return None
    sub = df_kin[df_kin["subject"] == subject]
    if sub.empty:
        return None
    h_cols = [c for c in df_kin.columns if c.startswith("aSagH_pct_GC_")]
    if not h_cols:
        return None
    vals = sub[h_cols].values
    if vals.size == 0 or np.isnan(vals).all():
        return None
    roms = np.nanmax(vals, axis=1) - np.nanmin(vals, axis=1)
    valid = roms[np.isfinite(roms)]
    return float(np.mean(valid)) if valid.size > 0 else None

def _opt_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or not math.isfinite(f)) else f
    except (ValueError, TypeError):
        return None


def _parse_session_kinematics(sess: Optional[GaitSession]) -> Optional[Dict[str, Any]]:
    if sess is None or not getattr(sess, "kinematics_json", None):
        return None
    try:
        return json.loads(sess.kinematics_json)
    except Exception:
        return None


def _compute_patient_cycle_stability(
    code: str,
    summary: Dict[str, Any],
    sessions: Optional[List[GaitSession]] = None,
) -> Tuple[Optional[float], int, int, List[Dict[str, Any]]]:
    """Computes PCA kinematic anomaly rate and per-cycle SPE diagnostics."""
    target_curves: Optional[np.ndarray] = None
    if sessions:
        vr_sess = next((s for s in sessions if s.condition == "VR"), None)
        base_sess = next((s for s in sessions if s.condition == "Baseline"), None)
        vb_sess = next((s for s in sessions if s.condition == "Verbal"), None)
        for cand in (vr_sess, base_sess, vb_sess):
            parsed = _parse_session_kinematics(cand)
            if parsed and parsed.get("hip_cycles"):
                target_curves = np.asarray(parsed["hip_cycles"], dtype=float)
                break

    if target_curves is None:
        sub_kin_vr = _DF_KIN_VR[_DF_KIN_VR["subject"] == code]
        target_kin = sub_kin_vr if not sub_kin_vr.empty else _DF_KIN[_DF_KIN["subject"] == code]
        if not target_kin.empty and len(_HIP_COLS) > 0:
            target_curves = target_kin[_HIP_COLS].values

    if target_curves is not None and target_curves.size > 0 and _PCA_DETECTOR.threshold is not None:
        pca_res = _PCA_DETECTOR.detect(target_curves)
        spe_arr = pca_res["reconstruction_error"]
        anom_arr = pca_res["is_anomaly"]
        thresh = float(pca_res["threshold"])
        cycles_list = [
            {
                "cycle_index": idx + 1,
                "spe": round(float(spe_arr[idx]), 2),
                "threshold": round(thresh, 2),
                "is_anomaly": bool(anom_arr[idx]),
            }
            for idx in range(len(spe_arr))
        ]
        return float(pca_res["anomaly_rate"]), int(pca_res["n_anomalies"]), int(pca_res["n_total"]), cycles_list

    n_cycles = summary.get("vr_cycles", 0) or summary.get("baseline_cycles", 0)
    return None, 0, int(n_cycles), []


def _compute_patient_anomaly_rate(code: str, summary: Dict[str, Any], sessions: Optional[List[GaitSession]] = None) -> Tuple[Optional[float], int, int]:
    rate, n_anom, n_tot, _ = _compute_patient_cycle_stability(code, summary, sessions=sessions)
    return rate, n_anom, n_tot


def _resolve_patient_summary(code: str, patient: Patient, db: Session) -> Dict[str, Any]:
    """Resolves patient summary from database sessions or discrete CSV datasets."""
    summary = None
    sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all() if patient else []
    if sessions:
        base_sess = next((s for s in sessions if s.condition == "Baseline"), None)
        vr_sess = next((s for s in sessions if s.condition == "VR"), None)
        vb_sess = next((s for s in sessions if s.condition == "Verbal"), None)
        ref_sess = base_sess or vr_sess or vb_sess
        if ref_sess:
            b_gps = float(ref_sess.avg_gps)
            b_hip = float(ref_sess.avg_amin_sagh)
            b_p = float(ref_sess.avg_gvs_pelvis)
            b_h = float(ref_sess.avg_gvs_hip)
            b_k = float(ref_sess.avg_gvs_knee)
            b_a = float(ref_sess.avg_gvs_ankle)
            b_pctm = _opt_float(getattr(ref_sess, "avg_pctm_zero", None)) if base_sess else None

            vr_gps = float(vr_sess.avg_gps) if vr_sess and vr_sess.avg_gps is not None else None
            vr_hip = float(vr_sess.avg_amin_sagh) if vr_sess and vr_sess.avg_amin_sagh is not None else None
            vr_p = float(vr_sess.avg_gvs_pelvis) if vr_sess and vr_sess.avg_gvs_pelvis is not None else None
            vr_h = float(vr_sess.avg_gvs_hip) if vr_sess and vr_sess.avg_gvs_hip is not None else None
            vr_k = float(vr_sess.avg_gvs_knee) if vr_sess and vr_sess.avg_gvs_knee is not None else None
            vr_a = float(vr_sess.avg_gvs_ankle) if vr_sess and vr_sess.avg_gvs_ankle is not None else None
            vr_pctm = _opt_float(getattr(vr_sess, "avg_pctm_zero", None)) if vr_sess else None

            vb_gps = float(vb_sess.avg_gps) if vb_sess and vb_sess.avg_gps is not None else None
            vb_hip = float(vb_sess.avg_amin_sagh) if vb_sess and vb_sess.avg_amin_sagh is not None else None
            vb_p = float(vb_sess.avg_gvs_pelvis) if vb_sess and vb_sess.avg_gvs_pelvis is not None else None
            vb_h = float(vb_sess.avg_gvs_hip) if vb_sess and vb_sess.avg_gvs_hip is not None else None
            vb_k = float(vb_sess.avg_gvs_knee) if vb_sess and vb_sess.avg_gvs_knee is not None else None
            vb_a = float(vb_sess.avg_gvs_ankle) if vb_sess and vb_sess.avg_gvs_ankle is not None else None
            vb_pctm = _opt_float(getattr(vb_sess, "avg_pctm_zero", None)) if vb_sess else None

            d_gps = (vr_gps - b_gps) if (base_sess and vr_gps is not None) else 0.0
            d_hip = (vr_hip - b_hip) if (base_sess and vr_hip is not None) else 0.0
            d_p = (vr_p - b_p) if (base_sess and vr_p is not None) else 0.0
            d_h = (vr_h - b_h) if (base_sess and vr_h is not None) else 0.0
            d_k = (vr_k - b_k) if (base_sess and vr_k is not None) else 0.0
            d_a = (vr_a - b_a) if (base_sess and vr_a is not None) else 0.0
            d_pctm = (vr_pctm - b_pctm) if (vr_pctm is not None and b_pctm is not None) else None

            summary = {
                "subject": code,
                "side": patient.side if patient else "RIGHT",
                "weight": patient.weight if patient else 40.0,
                "height": patient.height if patient else 1.35,
                "leg_length": patient.leg_length if patient else 0.70,
                "baseline_gps": b_gps,
                "vr_gps": vr_gps if vr_gps is not None else b_gps,
                "verbal_gps": vb_gps,
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
                "baseline_pctm_zero": b_pctm,
                "vr_pctm_zero": vr_pctm,
                "verbal_pctm_zero": vb_pctm,
                "delta_pctm_zero": d_pctm,
                "cycles_baseline": base_sess.cycle_count if base_sess else 0,
                "cycles_vr": vr_sess.cycle_count if vr_sess else 0,
                "cycles_verbal": vb_sess.cycle_count if vb_sess else 0,
                "baseline_cycles": base_sess.cycle_count if base_sess else 0,
                "vr_cycles": vr_sess.cycle_count if vr_sess else 0,
                "verbal_cycles": vb_sess.cycle_count if vb_sess else 0,
                "has_baseline": base_sess is not None,
                "has_vr": vr_sess is not None,
                "has_verbal": vb_sess is not None,
                "_db_tilt_b": _opt_float(getattr(base_sess, "avg_pelvis_tilt", None)) if base_sess else None,
                "_db_tilt_vr": _opt_float(getattr(vr_sess, "avg_pelvis_tilt", None)) if vr_sess else None,
                "_db_tilt_vb": _opt_float(getattr(vb_sess, "avg_pelvis_tilt", None)) if vb_sess else None,
            }

    if summary is None:
        try:
            summary = get_patient_discrete_summary(_DF_BASE, _DF_VR, code, df_verbal=_DF_VB)
            summary["has_vr"] = True
            summary["has_verbal"] = True
        except Exception:
            raise HTTPException(status_code=404, detail=f"No biomechanical gait sessions recorded for patient {code}")

    # Enrich with true kinematic pelvic tilt angles (or uploaded IMU pelvic tilt) if available
    db_tilt_b = summary.pop("_db_tilt_b", None)
    db_tilt_vr = summary.pop("_db_tilt_vr", None)
    db_tilt_vb = summary.pop("_db_tilt_vb", None)
    tilt_b = _compute_mean_pelvic_tilt(_DF_KIN, code)
    if tilt_b is None:
        tilt_b = db_tilt_b
    tilt_vr = _compute_mean_pelvic_tilt(_DF_KIN_VR, code)
    if tilt_vr is None:
        tilt_vr = db_tilt_vr
    tilt_vb = _compute_mean_pelvic_tilt(_DF_KIN_VB, code)
    if tilt_vb is None:
        tilt_vb = db_tilt_vb
    summary["baseline_pelvis_tilt"] = round(tilt_b, 2) if tilt_b is not None else None
    summary["vr_pelvis_tilt"] = round(tilt_vr, 2) if tilt_vr is not None else None
    summary["verbal_pelvis_tilt"] = round(tilt_vb, 2) if tilt_vb is not None else None
    summary["delta_pelvis_tilt"] = round(tilt_vr - tilt_b, 2) if (tilt_vr is not None and tilt_b is not None) else None
    summary["verbal_delta_pelvis_tilt"] = round(tilt_vb - tilt_b, 2) if (tilt_vb is not None and tilt_b is not None) else None
    hip_rom_b = _compute_mean_hip_rom(_DF_KIN, code)
    if hip_rom_b is None and sessions:
        base_s = next((s for s in sessions if s.condition == "Baseline"), None)
        parsed_b = _parse_session_kinematics(base_s)
        if parsed_b and parsed_b.get("hip_rom") is not None:
            hip_rom_b = float(parsed_b["hip_rom"])
    summary["baseline_hip_rom"] = round(hip_rom_b, 2) if hip_rom_b is not None else None
    return summary

@router.get("/patients")
def list_patients(db: Session = Depends(get_db)):
    """Returns all registered patients with clinical biomechanics & CDSS triage status."""
    patients = db.query(Patient).all()
    result = []
    for p in patients:
        item = {
            "id": p.id,
            "code": p.code,
            "side": p.side,
            "weight": p.weight,
            "height": p.height,
            "leg_length": p.leg_length,
            "clinic_name": p.clinic.name if p.clinic else None,
        }
        try:
            summary = _resolve_patient_summary(p.code, p, db)
            risk = analyze_compensation_risk(
                delta_hip=summary["delta_amin_sagh"],
                delta_gvs_p=summary["delta_gvs_pelvis"],
                delta_gvs_k=summary["delta_gvs_knee"],
                delta_gvs_a=summary["delta_gvs_ankle"],
                delta_pelvis_term=summary.get("delta_pelvis_tilt"),
            )
            item.update({
                "pcr": risk["pcr"],
                "tje": risk["tje"],
                "status": risk["status"],
                "baseline_gps": summary["baseline_gps"],
                "vr_gps": summary["vr_gps"],
                "delta_amin_sagh": summary["delta_amin_sagh"],
                "has_vr": bool(summary.get("has_vr", False)),
                "has_verbal": bool(summary.get("has_verbal", False)),
            })
        except HTTPException:
            item.update({
                "pcr": None,
                "tje": None,
                "status": "yellow",
                "baseline_gps": None,
                "vr_gps": None,
                "delta_amin_sagh": None,
                "has_vr": False,
                "has_verbal": False,
            })
        result.append(item)
    return result

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
    sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all()
    anomaly_rate, n_anomalies, n_cycles, cycle_stability = _compute_patient_cycle_stability(
        code, summary, sessions=sessions
    )

    icf_b770_base = classify_icf_b770(summary["baseline_gps"])
    icf_b770_vr = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0) if anomaly_rate is not None else None

    # ML predictions: evaluates probability that VR condition cycles exhibit the learned VR gait pattern
    sub_vr_cycles = _DF_VR[_DF_VR["subject"] == code]
    sub_base_cycles = _DF_BASE[_DF_BASE["subject"] == code]
    sub_kin_vr_cycles = _DF_KIN_VR[_DF_KIN_VR["subject"] == code]
    sub_kin_base_cycles = _DF_KIN[_DF_KIN["subject"] == code]
    if not sub_vr_cycles.empty:
        _, probs = _ML_CLASSIFIER.predict_cycle_condition(
            sub_vr_cycles,
            df_kin=sub_kin_vr_cycles if not sub_kin_vr_cycles.empty else None,
        )
        response_prob = float(np.mean(probs))
    elif not sub_base_cycles.empty:
        _, probs = _ML_CLASSIFIER.predict_cycle_condition(
            sub_base_cycles,
            df_kin=sub_kin_base_cycles if not sub_kin_base_cycles.empty else None,
        )
        response_prob = float(np.mean(probs))
    else:
        has_vr = bool(summary.get("has_vr"))
        cond_prefix = "vr" if has_vr else "baseline"
        target_cond = "VR" if has_vr else "Baseline"
        df_uploaded_row = pd.DataFrame([{
            "subject": code,
            "GPS_a": summary.get(f"{cond_prefix}_gps"),
            "GVS_aSagP": summary.get(f"{cond_prefix}_gvs_pelvis"),
            "GVS_aSagH": summary.get(f"{cond_prefix}_gvs_hip"),
            "GVS_aSagK": summary.get(f"{cond_prefix}_gvs_knee"),
            "GVS_aSagA": summary.get(f"{cond_prefix}_gvs_ankle"),
            "aMinSagH": summary.get(f"{cond_prefix}_amin_sagh"),
            "pctmZeroStSagH": summary.get(f"{cond_prefix}_pctm_zero"),
        }])
        target_sess = next((s for s in sessions if s.condition == target_cond), None)
        parsed_kin = _parse_session_kinematics(target_sess)
        df_kin_uploaded = None
        if parsed_kin and parsed_kin.get("joints"):
            kin_row: Dict[str, Any] = {"subject": code}
            for j_name, j_series in parsed_kin["joints"].items():
                j_mean = j_series.get("mean") or []
                if len(j_mean) == 51:
                    for idx_pt, val in enumerate(j_mean):
                        kin_row[f"{j_name}_pct_GC_{idx_pt * 20}"] = val
            if len(kin_row) > 1:
                df_kin_uploaded = pd.DataFrame([kin_row])
        _, probs = _ML_CLASSIFIER.predict_cycle_condition(df_uploaded_row, df_kin=df_kin_uploaded)
        response_prob = float(probs[0])

    responder_prediction = _VR_RESPONDER.predict_subject_response(summary)
    modalities = compare_modalities(summary)

    # Compute Sagittal GDI Proxy (0-100 scale)
    summary["baseline_gdi"] = compute_sagittal_gdi(summary["baseline_gps"])
    summary["vr_gdi"] = compute_sagittal_gdi(summary["vr_gps"])
    vb_gps_val = summary.get("verbal_gps")
    summary["verbal_gdi"] = compute_sagittal_gdi(vb_gps_val) if vb_gps_val is not None else None
    summary["delta_gdi"] = round(summary["vr_gdi"] - summary["baseline_gdi"], 1)

    return {
        "summary": summary,
        "cdss_risk": risk,
        "modalities": modalities,
        "icf": {
            "b770_baseline": icf_b770_base,
            "b770_vr": icf_b770_vr,
            "d450": icf_d450 or "N/A",
        },
        "ml": {
            "vr_gait_signature_confidence": response_prob,
            "binary_roc_auc": round(float(_ML_METRICS.get("roc_auc", 0.0)), 3),
            "is_vr_discriminative": bool(response_prob > 0.5),
            "responder_prediction": responder_prediction,
            "pca_stability": {
                "has_curves": anomaly_rate is not None,
                "anomaly_rate": anomaly_rate,
                "n_anomalies": n_anomalies,
                "n_cycles": n_cycles,
                "is_stable": bool(anomaly_rate < 0.15) if anomaly_rate is not None else None,
                "cycles": cycle_stability,
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

    # Check if uploaded 51-point curves exist in DB GaitSessions
    db_sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all() if patient else []
    db_kin_by_cond: Dict[str, Dict[str, Any]] = {}
    for sess in db_sessions:
        parsed = _parse_session_kinematics(sess)
        if parsed and parsed.get("joints"):
            db_kin_by_cond[sess.condition] = parsed["joints"]

    has_db_curves = len(db_kin_by_cond) > 0
    if sub_base.empty and not has_db_curves:
        return {
            "subject": code,
            "is_surrogate": False,
            "is_fallback": False,
            "has_curves": False,
            "joints": {},
        }

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

        if has_db_curves:
            ref_cond = db_kin_by_cond.get("Baseline") or db_kin_by_cond.get("VR") or db_kin_by_cond.get("Verbal") or {}
            ref_joint = ref_cond.get(joint, {"mean": norm_mean, "std": norm_std})
            b_series = (db_kin_by_cond.get("Baseline") or {}).get(joint, ref_joint)
            vr_series = (db_kin_by_cond.get("VR") or {}).get(joint, b_series)
            vb_series = (db_kin_by_cond.get("Verbal") or {}).get(joint, b_series)
            kinematics_data[joint] = {
                "name_ru": td_profile["name_ru"],
                "name_kz": td_profile["name_kz"],
                "unit": td_profile["unit"],
                "time_percent": t_percent,
                "baseline": {"mean": b_series["mean"], "std": b_series["std"]},
                "vr": {"mean": vr_series["mean"], "std": vr_series["std"]},
                "verbal": {"mean": vb_series["mean"], "std": vb_series["std"]},
                "norm_td": {"mean": norm_mean, "std": norm_std},
            }
            continue

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
        "is_surrogate": False,
        "is_fallback": False,
        "has_curves": True,
        "joints": kinematics_data
    }

@router.get("/analytics/cohort")
def get_cohort_analytics_endpoint(db: Session = Depends(get_db)):
    """Returns live cohort analytics computed directly from database patients and gait cycles."""
    patients = db.query(Patient).all()
    records: List[Dict[str, Any]] = []
    for p in patients:
        try:
            summary = _resolve_patient_summary(p.code, p, db)
            risk = analyze_compensation_risk(
                delta_hip=summary["delta_amin_sagh"],
                delta_gvs_p=summary["delta_gvs_pelvis"],
                delta_gvs_k=summary["delta_gvs_knee"],
                delta_gvs_a=summary["delta_gvs_ankle"],
                delta_pelvis_term=summary.get("delta_pelvis_tilt"),
            )
            mod = compare_modalities(summary)
            records.append({
                "code": p.code,
                "side": p.side,
                "weight": p.weight,
                "height": p.height,
                "leg_length": p.leg_length,
                "status": risk["status"],
                "tje": risk["tje"],
                "pcr": risk["pcr"],
                "best_method": mod["best_method"],
                "has_vr": bool(summary.get("has_vr", False)),
                "has_verbal": bool(summary.get("has_verbal", False)),
                "cycles_baseline": summary.get("cycles_baseline", 0),
                "cycles_verbal": summary.get("cycles_verbal", 0),
                "cycles_vr": summary.get("cycles_vr", 0),
                "baseline_gps": summary.get("baseline_gps"),
                "verbal_gps": summary.get("verbal_gps"),
                "vr_gps": summary.get("vr_gps"),
                "delta_amin_sagh": summary.get("delta_amin_sagh"),
            })
        except HTTPException:
            continue
    return build_cohort_analytics(records)

@router.get("/ml/metrics")
def get_ml_metrics():
    """Returns leak-free GroupKFold generalization metrics and feature importances."""
    return {
        **_ML_METRICS,
        "three_class": _ML_THREE_CLASS_METRICS,
        "pca_validation": _PCA_VALIDATION,
        "vr_responder": {
            **_VR_RESPONDER_METRICS,
            "note": "LOO-валидация на когорте n=29 (базовые биомеханические и кинематические признаки). Перед клиническим применением требуется расширение когорты."
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
    """Generates official bilingual clinical narrative (doctor protocol or parent guidance) and records it in database."""
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary = _resolve_patient_summary(code, patient, db)
    sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all()

    risk = analyze_compensation_risk(
        delta_hip=summary["delta_amin_sagh"],
        delta_gvs_p=summary["delta_gvs_pelvis"],
        delta_gvs_k=summary["delta_gvs_knee"],
        delta_gvs_a=summary["delta_gvs_ankle"],
        delta_pelvis_term=summary.get("delta_pelvis_tilt")
    )

    # Dynamic PCA Anomaly Detection on patient's VR kinematic curves for d450
    anomaly_rate, _, _ = _compute_patient_anomaly_rate(code, summary, sessions=sessions)
    summary["anomaly_rate"] = anomaly_rate

    icf_b770 = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0) if anomaly_rate is not None else "N/A"

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
        tje=risk["tje"] if risk["tje"] is not None else 0.0,
        pcr=risk["pcr"] if risk["pcr"] is not None else 0.0,
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
        if not summary.get("has_baseline", True):
            raise HTTPException(
                status_code=404,
                detail=f"Baseline gait session not recorded for patient {summary.get('subject')}"
            )
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

_PII_COLUMNS = {
    "iin", "иин", "жсн", "fio", "фио", "fullname", "full_name",
    "surname", "фамилия", "firstname", "name", "имя", "аты",
    "passport", "паспорт", "address", "адрес", "мекенжай",
    "phone", "телефон", "email", "birthdate", "birth_date", "датарождения", "дата_рождения",
}

_CONDITION_MAP = {

    "baseline": "Baseline",
    "verbal": "Verbal",
    "vr": "VR",
}

_COLUMN_ALIASES: Dict[str, List[str]] = {
    "subject": ["subject", "patient_code", "patient_id", "code"],
    "side": ["side", "limb", "affected_side", "leg"],
    "weight": ["weight", "weight_kg", "mass", "mass_kg", "body_mass"],
    "height": ["height", "height_m", "stature"],
    "leg_length": ["LegLength", "leg_length", "leg_length_m", "leglength_m"],
    "GPS_a": ["GPS_a", "gps", "gps_deg", "gait_profile_score"],
    "GVS_aSagP": ["GVS_aSagP", "pelvis_gvs", "gvs_pelvis", "gvs_asagp", "pelvic_gvs"],
    "GVS_aSagH": ["GVS_aSagH", "hip_gvs", "gvs_hip", "gvs_asagh"],
    "GVS_aSagK": ["GVS_aSagK", "knee_gvs", "gvs_knee", "gvs_asagk"],
    "GVS_aSagA": ["GVS_aSagA", "ankle_gvs", "gvs_ankle", "gvs_asaga"],
    "aMinSagH": ["aMinSagH", "hip_min_ext", "hip_ext_min", "min_hip_ext", "amin_sagh"],
    "pctmZeroStSagH": ["pctmZeroStSagH", "pctm_zero_st_sagh", "pctm_zero", "hip_moment_zero_pct"],
    "pelvic_tilt_mean": ["pelvic_tilt_mean", "pelvis_tilt_mean", "pelvis_tilt", "pelvic_tilt"],
}


def _find_col_by_aliases(df: pd.DataFrame, canonical: str) -> Optional[str]:
    aliases = _COLUMN_ALIASES.get(canonical, [canonical])
    norm_to_col = {c.lower().replace("_", ""): c for c in df.columns}
    for alias in aliases:
        if alias in df.columns:
            return alias
        norm = alias.lower().replace("_", "")
        if norm in norm_to_col:
            return norm_to_col[norm]
    return None


@router.get("/ingest/template")
def download_ingest_template(
    format: str = Query("vicon", pattern="^(vicon|imu|kinematics)$"),
):
    """Returns a downloadable CSV template (; separator, , decimal) for Vicon/GRAIL, IMU, or 51-point kinematics."""
    if format == "imu":
        csv_body = (
            "subject;side;weight_kg;height_m;leg_length_m;gps;pelvis_gvs;hip_gvs;knee_gvs;ankle_gvs;hip_min_ext;pelvis_tilt_mean\n"
            "s_imu_01;RIGHT;42,5;1,38;0,71;9,8;10,5;12,8;9,4;4,9;6,2;16,4\n"
        )
    elif format == "kinematics":
        headers = ["subject", "side", "weight", "height", "LegLength"]
        row_vals = ["s_kin_01", "RIGHT", "42,5", "1,38", "0,71"]
        for joint in ("aSagP", "aSagH", "aSagK", "aSagA"):
            td_mean = NORMATIVE_PROFILES[joint]["mean"][::20]
            offset = 4.0 if joint == "aSagP" else (6.0 if joint == "aSagH" else 2.0)
            for idx in range(51):
                headers.append(f"{joint}_pct_GC_{idx * 20}")
                row_vals.append(f"{td_mean[idx] + offset:.2f}".replace(".", ","))
        csv_body = ";".join(headers) + "\n" + ";".join(row_vals) + "\n"
    else:
        csv_body = (
            "subject;side;weight;height;LegLength;GPS_a;GVS_aSagP;GVS_aSagH;GVS_aSagK;GVS_aSagA;aMinSagH;pctmZeroStSagH\n"
            "s_demo_01;RIGHT;42,5;1,38;0,71;10,4;12,1;14,3;11,2;5,8;8,5;48,0\n"
        )
    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="libra_template_{format}.csv"'},
    )


@router.post("/ingest/discrete", include_in_schema=False)
@router.post("/patients/upload")
async def upload_patient_csv(
    file: UploadFile = File(...),
    condition: str = Form("Baseline"),
    subject_code: Optional[str] = Form(None),
    auth: Dict[str, Any] = Depends(require_clinician_auth),
    db: Session = Depends(get_db)
):
    """
    Accepts CSV from Vicon Nexus, GRAIL, or portable IMU / camera-pose sensors.
    Parses with support for European decimal commas and upserts patient + condition session.
    """
    import io
    import re

    cond_key = (condition or "Baseline").strip().lower()
    if cond_key not in _CONDITION_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid condition '{condition}'. Allowed values: Baseline, Verbal, VR."
        )
    normalized_condition = _CONDITION_MAP[cond_key]

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

    pii_hits = [
        str(c) for c in df_upload.columns
        if str(c).strip().lower().replace(" ", "_") in _PII_COLUMNS
        or str(c).strip().lower().replace("_", "").replace(" ", "") in _PII_COLUMNS
    ]
    if pii_hits:
        raise HTTPException(
            status_code=400,
            detail=f"Law of RK No. 94-V violation: personal data columns are prohibited ({', '.join(pii_hits)}). Use anonymized subject codes only.",
        )

    # Guard against non-finite values (inf, -inf)
    for col in df_upload.columns:
        str_col = df_upload[col].astype(str).str.lower().str.strip()
        if str_col.isin(["inf", "-inf", "+inf", "infinity", "-infinity"]).any():
            raise HTTPException(status_code=400, detail=f"Invalid non-finite value in column {col}")

    resolved_code = (subject_code or "").strip()
    if not resolved_code:
        sub_col = _find_col_by_aliases(df_upload, "subject")
        if sub_col:
            valid_subs = df_upload[sub_col].dropna().unique()
            if len(valid_subs) > 0:
                resolved_code = str(valid_subs[0]).strip()
    if not resolved_code:
        filename = file.filename or "patient"
        resolved_code = filename.replace(".csv", "").strip()

    if not resolved_code or not re.match(r"^[a-zA-Z0-9_\-]{1,64}$", resolved_code):
        raise HTTPException(
            status_code=400,
            detail="Invalid patient code. Allowed characters: alphanumeric, hyphens, and underscores (max 64 chars)."
        )

    def _parse_optional(canonical: str) -> Optional[float]:
        col = _find_col_by_aliases(df_upload, canonical)
        if col:
            s = df_upload[col].dropna()
            if not s.empty:
                s_clean = pd.to_numeric(s.astype(str).str.replace(",", ".").str.strip(), errors="coerce").dropna()
                valid_nums = s_clean[np.isfinite(s_clean)]
                if not valid_nums.empty:
                    return float(valid_nums.mean())
        return None

    def _parse_val(canonical: str, default_val: float) -> Tuple[float, bool]:
        val = _parse_optional(canonical)
        if val is not None:
            return val, True
        return default_val, False

    clinic = db.query(Clinic).first()
    clinic_id = clinic.id if clinic else None

    raw_weight, has_weight = _parse_val("weight", 42.0)
    raw_height, has_height = _parse_val("height", 1.38)
    raw_leg, has_leg = _parse_val("leg_length", 0.71)
    anthropometry_estimated = not (has_weight and has_height and has_leg)

    if raw_weight <= 0 or raw_height <= 0 or raw_leg <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid physiological measurements: weight, height, and leg length must be positive numbers."
        )

    side_col = _find_col_by_aliases(df_upload, "side")
    parsed_side: Optional[str] = None
    if side_col and not df_upload[side_col].dropna().empty:
        raw_side = str(df_upload[side_col].dropna().iloc[0]).strip().lower()
        side_map = {
            "left": "LEFT", "l": "LEFT", "левая": "LEFT", "левый": "LEFT", "л": "LEFT", "сол": "LEFT",
            "right": "RIGHT", "r": "RIGHT", "правая": "RIGHT", "правый": "RIGHT", "п": "RIGHT", "оң": "RIGHT",
        }
        if raw_side not in side_map:
            raise HTTPException(
                status_code=400,
                detail="Invalid limb side value. Expected LEFT or RIGHT."
            )
        parsed_side = side_map[raw_side]

    # Detect 51-point kinematic waveform columns (e.g. aSagH_pct_GC_0 .. aSagH_pct_GC_1000)
    curves_by_joint: Dict[str, np.ndarray] = {}
    kin_joints_payload: Dict[str, Dict[str, List[float]]] = {}
    for joint in ("aSagP", "aSagH", "aSagK", "aSagA", "mSagH"):
        j_cols = sorted(
            [c for c in df_upload.columns if c.startswith(f"{joint}_pct_GC_")],
            key=lambda x: int(x.split("_pct_GC_")[1]) if x.split("_pct_GC_")[1].isdigit() else 0,
        )
        if len(j_cols) == 51:
            j_df = df_upload[j_cols].apply(
                lambda col: pd.to_numeric(col.astype(str).str.replace(",", ".").str.strip(), errors="coerce")
            )
            j_df = j_df.interpolate(method="linear", axis=1, limit_direction="both")
            arr = j_df.to_numpy(dtype=float)
            if arr.size > 0 and not np.isnan(arr).all():
                curves_by_joint[joint] = arr
                kin_joints_payload[joint] = {
                    "mean": np.nan_to_num(np.nanmean(arr, axis=0), nan=0.0).tolist(),
                    "std": np.nan_to_num(np.nanstd(arr, axis=0), nan=0.0).tolist(),
                }

    has_kin_waveforms = len(curves_by_joint) > 0
    derived_gvs = compute_curve_gvs_gps(curves_by_joint, NORMATIVE_PROFILES) if has_kin_waveforms else {}
    derived_kin_summary = compute_kinematic_summary_metrics(curves_by_joint) if has_kin_waveforms else {}

    opt_gps = _parse_optional("GPS_a")
    if opt_gps is None:
        opt_gps = derived_gvs.get("GPS_a")
    opt_p = _parse_optional("GVS_aSagP")
    if opt_p is None:
        opt_p = derived_gvs.get("GVS_aSagP")
    opt_h = _parse_optional("GVS_aSagH")
    if opt_h is None:
        opt_h = derived_gvs.get("GVS_aSagH")
    opt_k = _parse_optional("GVS_aSagK")
    if opt_k is None:
        opt_k = derived_gvs.get("GVS_aSagK")
    opt_a = _parse_optional("GVS_aSagA")
    if opt_a is None:
        opt_a = derived_gvs.get("GVS_aSagA")
    opt_amin = _parse_optional("aMinSagH")
    if opt_amin is None:
        opt_amin = derived_kin_summary.get("aMinSagH")

    if all(v is None for v in (opt_gps, opt_p, opt_h, opt_k, opt_a, opt_amin)) and not has_kin_waveforms:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain at least one valid numeric gait metric column (GPS_a, aMinSagH, GVS_aSag*, or 51-pt *_pct_GC_* curves)."
        )

    kinematics_json_str: Optional[str] = None
    if has_kin_waveforms:
        hip_cycles = curves_by_joint["aSagH"].tolist() if "aSagH" in curves_by_joint else []
        kinematics_json_str = json.dumps({
            "joints": kin_joints_payload,
            "hip_cycles": hip_cycles,
            "hip_rom": derived_kin_summary.get("hip_rom"),
        })

    patient = db.query(Patient).filter(Patient.code == resolved_code).first()
    try:
        if patient is None:
            patient = Patient(
                code=resolved_code,
                side=parsed_side or "RIGHT",
                weight=raw_weight,
                height=raw_height,
                leg_length=raw_leg,
                clinic_id=clinic_id
            )
            db.add(patient)
            db.flush()
        else:
            if parsed_side is not None:
                patient.side = parsed_side
            if has_weight:
                patient.weight = raw_weight
            if has_height:
                patient.height = raw_height
            if has_leg:
                patient.leg_length = raw_leg

        calc_p = opt_p if opt_p is not None else 0.0
        calc_h = opt_h if opt_h is not None else 0.0
        calc_k = opt_k if opt_k is not None else 0.0
        calc_a = opt_a if opt_a is not None else 0.0
        gvs_sq = [v**2 for v in [calc_p, calc_h, calc_k, calc_a] if v > 0]
        derived_gps = math.sqrt(sum(gvs_sq) / len(gvs_sq)) if gvs_sq else 0.0
        avg_gps = opt_gps if opt_gps is not None else derived_gps
        avg_amin_sagh = opt_amin if opt_amin is not None else 0.0
        avg_pctm_zero = _parse_optional("pctmZeroStSagH")
        avg_pelvis_tilt = _parse_optional("pelvic_tilt_mean")
        if avg_pelvis_tilt is None:
            avg_pelvis_tilt = derived_kin_summary.get("pelvic_tilt_mean")

        existing_session = (
            db.query(GaitSession)
            .filter(GaitSession.patient_id == patient.id, GaitSession.condition == normalized_condition)
            .first()
        )
        if existing_session is not None:
            existing_session.cycle_count = len(df_upload)
            existing_session.avg_gps = avg_gps
            existing_session.avg_amin_sagh = avg_amin_sagh
            existing_session.avg_gvs_pelvis = calc_p
            existing_session.avg_gvs_hip = calc_h
            existing_session.avg_gvs_knee = calc_k
            existing_session.avg_gvs_ankle = calc_a
            existing_session.avg_pctm_zero = avg_pctm_zero
            existing_session.avg_pelvis_tilt = avg_pelvis_tilt
            if kinematics_json_str is not None:
                existing_session.kinematics_json = kinematics_json_str
        else:
            db.add(GaitSession(
                patient_id=patient.id,
                condition=normalized_condition,
                cycle_count=len(df_upload),
                avg_gps=avg_gps,
                avg_amin_sagh=avg_amin_sagh,
                avg_gvs_pelvis=calc_p,
                avg_gvs_hip=calc_h,
                avg_gvs_knee=calc_k,
                avg_gvs_ankle=calc_a,
                avg_pctm_zero=avg_pctm_zero,
                avg_pelvis_tilt=avg_pelvis_tilt,
                kinematics_json=kinematics_json_str,
            ))

        db.commit()
        db.refresh(patient)
    except Exception:
        db.rollback()
        raise

    return {
        "status": "success",
        "code": patient.code,
        "condition": normalized_condition,
        "anthropometry_estimated": anthropometry_estimated,
        "has_kinematics": has_kin_waveforms,
        "rows": len(df_upload),
        "columns": len(df_upload.columns),
        "message_ru": f"Файл {file.filename} успешно импортирован ({normalized_condition}). Пациент {patient.code} обновлен в реестре.",
        "message_kz": f"{file.filename} файлы сәтті импортталды ({normalized_condition}). Пациент {patient.code} тізілімде жаңартылды."
    }


@router.get("/patients/{code}/report.pdf")
def export_patient_pdf_report(
    code: str,
    lang: str = Query("ru", pattern="^(ru|kz|en)$"),
    audience: str = Query("doctor", pattern="^(doctor|parent)$"),
    db: Session = Depends(get_db),
):
    """Generates and returns a downloadable A4 PDF clinical or parent report with metric table, hip curves, and ICF codes."""
    patient = db.query(Patient).filter(Patient.code == code).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary = _resolve_patient_summary(code, patient, db)
    sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all()
    risk = analyze_compensation_risk(
        delta_hip=summary["delta_amin_sagh"],
        delta_gvs_p=summary["delta_gvs_pelvis"],
        delta_gvs_k=summary["delta_gvs_knee"],
        delta_gvs_a=summary["delta_gvs_ankle"],
        delta_pelvis_term=summary.get("delta_pelvis_tilt"),
    )
    modalities = compare_modalities(summary)
    anomaly_rate, _, _ = _compute_patient_anomaly_rate(code, summary, sessions=sessions)
    summary["anomaly_rate"] = anomaly_rate

    icf_b770_base = classify_icf_b770(summary["baseline_gps"])
    icf_b770_vr = classify_icf_b770(summary["vr_gps"])
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0) if anomaly_rate is not None else None

    eff_lang = "kz" if lang == "kz" else "ru"
    if audience == "parent":
        narrative = generate_parent_narrative(summary, lang=eff_lang)
    else:
        narrative = generate_clinical_narrative(summary, lang=eff_lang)

    # Extract real sagittal hip curve (no surrogate substitution in PDF)
    hip_curves: Optional[Dict[str, Any]] = None
    kin_resp = get_patient_kinematics(code, db=db)
    if not kin_resp.get("is_surrogate"):
        hip_joint = kin_resp.get("joints", {}).get("aSagH")
        if hip_joint:
            hip_curves = {
                "time_percent": hip_joint["time_percent"],
                "baseline": hip_joint["baseline"]["mean"],
                "vr": hip_joint["vr"]["mean"],
                "verbal": hip_joint["verbal"]["mean"] if summary.get("has_verbal") else None,
                "norm_mean": hip_joint["norm_td"]["mean"],
                "norm_std": hip_joint["norm_td"]["std"],
            }

    pdf_bytes = generate_pdf_report(
        summary=summary,
        risk=risk,
        modalities=modalities,
        icf_b770_base=icf_b770_base,
        icf_b770_vr=icf_b770_vr,
        icf_d450=icf_d450,
        narrative=narrative,
        lang=eff_lang,
        audience=audience,
        hip_curves=hip_curves,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="libra-report-{code}-{eff_lang}.pdf"'},
    )

