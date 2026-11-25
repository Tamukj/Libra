"""Clinical domain services: session resolution, kinematics extraction, and ML/CDSS synthesis."""

import json
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.database.models import Patient, GaitSession
from src.core.data_loader import get_patient_discrete_summary
from src.core.biomechanics import (
    analyze_compensation_risk,
    build_baseline_only_risk,
    classify_icf_b770,
    classify_icf_d450,
    compare_modalities,
    compute_pcr,
    compute_sagittal_gdi,
    compute_true_joint_extension,
    is_finite_number,
    opt_float,
    _safe_float,
)
from src.core.normative_data import NORMATIVE_PROFILES
from src.api.deps import ClinicalEngineState

logger = logging.getLogger(__name__)


def _compute_mean_pelvic_tilt(df_kin: pd.DataFrame, subject: str) -> Optional[float]:
    if df_kin is None or df_kin.empty:
        return None
    sub = df_kin[df_kin["subject"] == subject]
    if sub.empty:
        return None
    p_cols = [c for c in df_kin.columns if c.startswith("aSagP_pct_GC_")]
    if not p_cols:
        return None
    vals = sub[p_cols].to_numpy(dtype=float)
    valid = vals[np.isfinite(vals)] if vals.size > 0 else vals
    return float(np.mean(valid)) if valid.size > 0 else None


def _compute_mean_hip_rom(df_kin: pd.DataFrame, subject: str) -> Optional[float]:
    if df_kin is None or df_kin.empty:
        return None
    sub = df_kin[df_kin["subject"] == subject]
    if sub.empty:
        return None
    h_cols = [c for c in df_kin.columns if c.startswith("aSagH_pct_GC_")]
    if not h_cols:
        return None
    vals = sub[h_cols].to_numpy(dtype=float)
    if vals.size == 0 or np.isnan(vals).all():
        return None
    roms = np.nanmax(vals, axis=1) - np.nanmin(vals, axis=1)
    valid = roms[np.isfinite(roms)]
    return float(np.mean(valid)) if valid.size > 0 else None


def _parse_session_kinematics(sess: Optional[GaitSession]) -> Optional[Dict[str, Any]]:
    if sess is None or not getattr(sess, "kinematics_json", None):
        return None
    try:
        return json.loads(sess.kinematics_json)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Corrupted kinematics_json on GaitSession id=%s: %s", getattr(sess, "id", None), exc)
        return None


def resolve_patient_summary(
    code: str,
    patient: Optional[Patient],
    db: Session,
    state: ClinicalEngineState,
    sessions: Optional[List[GaitSession]] = None,
) -> Tuple[Dict[str, Any], List[GaitSession]]:
    """
    Resolves patient summary strictly from DB sessions when present, falling back to static CSVs
    ONLY per-condition when that session's source is 'seeded' (preventing split-brain overrides).
    """
    if sessions is None:
        sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all() if patient else []

    if sessions:
        by_cond = {s.condition: s for s in sessions}
        base_sess = by_cond.get("Baseline")
        vr_sess = by_cond.get("VR")
        vb_sess = by_cond.get("Verbal")

        def _s_val(sess: Optional[GaitSession], attr: str) -> Optional[float]:
            return opt_float(getattr(sess, attr, None)) if sess is not None else None

        b_gps = _s_val(base_sess, "avg_gps")
        b_hip = _s_val(base_sess, "avg_amin_sagh")
        b_p = _s_val(base_sess, "avg_gvs_pelvis")
        b_h = _s_val(base_sess, "avg_gvs_hip")
        b_k = _s_val(base_sess, "avg_gvs_knee")
        b_a = _s_val(base_sess, "avg_gvs_ankle")
        b_pctm = _s_val(base_sess, "avg_pctm_zero")

        vr_gps = _s_val(vr_sess, "avg_gps")
        vr_hip = _s_val(vr_sess, "avg_amin_sagh")
        vr_p = _s_val(vr_sess, "avg_gvs_pelvis")
        vr_h = _s_val(vr_sess, "avg_gvs_hip")
        vr_k = _s_val(vr_sess, "avg_gvs_knee")
        vr_a = _s_val(vr_sess, "avg_gvs_ankle")
        vr_pctm = _s_val(vr_sess, "avg_pctm_zero")

        vb_gps = _s_val(vb_sess, "avg_gps")
        vb_hip = _s_val(vb_sess, "avg_amin_sagh")
        vb_p = _s_val(vb_sess, "avg_gvs_pelvis")
        vb_h = _s_val(vb_sess, "avg_gvs_hip")
        vb_k = _s_val(vb_sess, "avg_gvs_knee")
        vb_a = _s_val(vb_sess, "avg_gvs_ankle")
        vb_pctm = _s_val(vb_sess, "avg_pctm_zero")

        def _delta(post: Optional[float], pre: Optional[float]) -> Optional[float]:
            return (post - pre) if (post is not None and pre is not None) else None

        def _cond_tilt(sess: Optional[GaitSession], df_kin_static: pd.DataFrame) -> Optional[float]:
            if sess is None:
                return None
            db_t = _s_val(sess, "avg_pelvis_tilt")
            if db_t is not None:
                return db_t
            if getattr(sess, "source", "seeded") == "seeded":
                return _compute_mean_pelvic_tilt(df_kin_static, code)
            return None

        tilt_b = _cond_tilt(base_sess, state.df_kin_base)
        tilt_vr = _cond_tilt(vr_sess, state.df_kin_vr)
        tilt_vb = _cond_tilt(vb_sess, state.df_kin_vb)

        hip_rom_b: Optional[float] = None
        if base_sess is not None:
            parsed_b = _parse_session_kinematics(base_sess)
            if parsed_b and is_finite_number(parsed_b.get("hip_rom")):
                hip_rom_b = float(parsed_b["hip_rom"])
            elif getattr(base_sess, "source", "seeded") == "seeded":
                hip_rom_b = _compute_mean_hip_rom(state.df_kin_base, code)

        has_seeded = any(getattr(s, "source", "seeded") == "seeded" for s in sessions)

        summary: Dict[str, Any] = {
            "subject": code,
            "side": patient.side if patient else "RIGHT",
            "weight": patient.weight if patient else None,
            "height": patient.height if patient else None,
            "leg_length": patient.leg_length if patient else None,
            "baseline_gps": b_gps,
            "vr_gps": vr_gps,
            "verbal_gps": vb_gps,
            "delta_gps": _delta(vr_gps, b_gps),
            "baseline_amin_sagh": b_hip,
            "vr_amin_sagh": vr_hip,
            "verbal_amin_sagh": vb_hip,
            "delta_amin_sagh": _delta(vr_hip, b_hip),
            "baseline_gvs_pelvis": b_p,
            "vr_gvs_pelvis": vr_p,
            "verbal_gvs_pelvis": vb_p,
            "delta_gvs_pelvis": _delta(vr_p, b_p),
            "baseline_gvs_hip": b_h,
            "vr_gvs_hip": vr_h,
            "verbal_gvs_hip": vb_h,
            "delta_gvs_hip": _delta(vr_h, b_h),
            "baseline_gvs_knee": b_k,
            "vr_gvs_knee": vr_k,
            "verbal_gvs_knee": vb_k,
            "delta_gvs_knee": _delta(vr_k, b_k),
            "baseline_gvs_ankle": b_a,
            "vr_gvs_ankle": vr_a,
            "verbal_gvs_ankle": vb_a,
            "delta_gvs_ankle": _delta(vr_a, b_a),
            "baseline_pctm_zero": b_pctm,
            "vr_pctm_zero": vr_pctm,
            "verbal_pctm_zero": vb_pctm,
            "delta_pctm_zero": _delta(vr_pctm, b_pctm),
            "cycles_baseline": base_sess.cycle_count if base_sess else 0,
            "cycles_vr": vr_sess.cycle_count if vr_sess else 0,
            "cycles_verbal": vb_sess.cycle_count if vb_sess else 0,
            "baseline_cycles": base_sess.cycle_count if base_sess else 0,
            "vr_cycles": vr_sess.cycle_count if vr_sess else 0,
            "verbal_cycles": vb_sess.cycle_count if vb_sess else 0,
            "has_baseline": base_sess is not None,
            "has_vr": vr_sess is not None,
            "has_verbal": vb_sess is not None,
            "has_seeded": has_seeded,
            "baseline_pelvis_tilt": round(tilt_b, 2) if tilt_b is not None else None,
            "vr_pelvis_tilt": round(tilt_vr, 2) if tilt_vr is not None else None,
            "verbal_pelvis_tilt": round(tilt_vb, 2) if tilt_vb is not None else None,
            "delta_pelvis_tilt": round(tilt_vr - tilt_b, 2) if (tilt_vr is not None and tilt_b is not None) else None,
            "verbal_delta_pelvis_tilt": round(tilt_vb - tilt_b, 2) if (tilt_vb is not None and tilt_b is not None) else None,
            "baseline_hip_rom": round(hip_rom_b, 2) if hip_rom_b is not None else None,
        }
        return summary, sessions

    try:
        summary = get_patient_discrete_summary(state.df_base, state.df_vr, code, df_verbal=state.df_vb)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=f"No biomechanical gait sessions recorded for patient {code}: {exc}")

    tilt_b = _compute_mean_pelvic_tilt(state.df_kin_base, code)
    tilt_vr = _compute_mean_pelvic_tilt(state.df_kin_vr, code)
    tilt_vb = _compute_mean_pelvic_tilt(state.df_kin_vb, code)
    hip_rom_b = _compute_mean_hip_rom(state.df_kin_base, code)
    summary["has_seeded"] = True
    summary["baseline_pelvis_tilt"] = round(tilt_b, 2) if tilt_b is not None else None
    summary["vr_pelvis_tilt"] = round(tilt_vr, 2) if tilt_vr is not None else None
    summary["verbal_pelvis_tilt"] = round(tilt_vb, 2) if tilt_vb is not None else None
    summary["delta_pelvis_tilt"] = round(tilt_vr - tilt_b, 2) if (tilt_vr is not None and tilt_b is not None) else None
    summary["verbal_delta_pelvis_tilt"] = round(tilt_vb - tilt_b, 2) if (tilt_vb is not None and tilt_b is not None) else None
    summary["baseline_hip_rom"] = round(hip_rom_b, 2) if hip_rom_b is not None else None
    return summary, []


def evaluate_active_cdss_risk(summary: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates CDSS risk for VR (if recorded) or Verbal (if VR absent), or returns
    'unassessed' for Baseline-only patients without fabricating post-therapy deltas.
    """
    has_base = bool(summary.get("has_baseline", True))
    has_vr = bool(summary.get("has_vr"))
    has_vb = bool(summary.get("has_verbal"))

    if not has_base or (not has_vr and not has_vb):
        return build_baseline_only_risk()

    if has_vr:
        return analyze_compensation_risk(
            delta_hip=summary.get("delta_amin_sagh"),
            delta_gvs_p=summary.get("delta_gvs_pelvis"),
            delta_gvs_k=summary.get("delta_gvs_knee"),
            delta_gvs_a=summary.get("delta_gvs_ankle"),
            delta_pelvis_term=summary.get("delta_pelvis_tilt"),
        )

    b_hip = opt_float(summary.get("baseline_amin_sagh"))
    vb_hip = opt_float(summary.get("verbal_amin_sagh"))
    b_p = opt_float(summary.get("baseline_gvs_pelvis"))
    vb_p = opt_float(summary.get("verbal_gvs_pelvis"))
    b_k = opt_float(summary.get("baseline_gvs_knee"))
    vb_k = opt_float(summary.get("verbal_gvs_knee"))
    b_a = opt_float(summary.get("baseline_gvs_ankle"))
    vb_a = opt_float(summary.get("verbal_gvs_ankle"))

    d_hip = (vb_hip - b_hip) if (vb_hip is not None and b_hip is not None) else None
    d_p = (vb_p - b_p) if (vb_p is not None and b_p is not None) else None
    d_k = (vb_k - b_k) if (vb_k is not None and b_k is not None) else None
    d_a = (vb_a - b_a) if (vb_a is not None and b_a is not None) else None

    return analyze_compensation_risk(
        delta_hip=d_hip,
        delta_gvs_p=d_p,
        delta_gvs_k=d_k,
        delta_gvs_a=d_a,
        delta_pelvis_term=summary.get("verbal_delta_pelvis_tilt"),
    )


def compute_patient_cycle_stability(
    code: str,
    summary: Dict[str, Any],
    state: ClinicalEngineState,
    sessions: Optional[List[GaitSession]] = None,
) -> Tuple[Optional[float], int, int, List[Dict[str, Any]]]:
    """
    Computes PCA kinematic anomaly rate and per-cycle SPE diagnostics strictly for the
    active target session (VR if present, else Baseline, else Verbal) without falling back
    to static CSV curves when an uploaded session replaced them with discrete metrics.
    """
    by_cond = {s.condition: s for s in sessions} if sessions else {}
    if summary.get("has_vr"):
        target_cond = "VR"
        static_df = state.df_kin_vr
        n_cycles_summary = int(summary.get("vr_cycles") or 0)
    elif summary.get("has_baseline"):
        target_cond = "Baseline"
        static_df = state.df_kin_base
        n_cycles_summary = int(summary.get("baseline_cycles") or 0)
    else:
        target_cond = "Verbal"
        static_df = state.df_kin_vb
        n_cycles_summary = int(summary.get("verbal_cycles") or 0)

    target_sess = by_cond.get(target_cond)
    target_curves: Optional[np.ndarray] = None

    if target_sess is not None:
        parsed = _parse_session_kinematics(target_sess)
        if parsed and parsed.get("hip_cycles"):
            arr = np.asarray(parsed["hip_cycles"], dtype=float)
            if arr.size > 0:
                arr_2d = np.atleast_2d(arr)
                valid_mask = ~np.isnan(arr_2d).all(axis=1)
                if valid_mask.any():
                    target_curves = arr_2d[valid_mask]
        elif getattr(target_sess, "source", "seeded") == "seeded" and state.hip_cols:
            sub_kin = static_df[static_df["subject"] == code]
            if not sub_kin.empty:
                target_curves = sub_kin[state.hip_cols].to_numpy(dtype=float)
    elif not sessions and state.hip_cols:
        sub_kin = static_df[static_df["subject"] == code]
        if not sub_kin.empty:
            target_curves = sub_kin[state.hip_cols].to_numpy(dtype=float)

    if target_curves is not None and target_curves.size > 0 and state.pca_detector.threshold is not None:
        pca_res = state.pca_detector.detect(target_curves)
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

    return None, 0, n_cycles_summary, []


def build_patient_kinematics(
    code: str,
    patient: Optional[Patient],
    db: Session,
    state: ClinicalEngineState,
) -> Dict[str, Any]:
    """
    Returns 51-point kinematic curves per condition without cross-patient surrogate copying
    or cloning Baseline into unrecorded VR/Verbal conditions.
    """
    if not patient and code not in state.df_kin_base["subject"].values:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    db_sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all() if patient else []
    by_cond = {s.condition: s for s in db_sessions}
    has_any_db = len(db_sessions) > 0

    static_by_cond = {
        "Baseline": state.df_kin_base[state.df_kin_base["subject"] == code],
        "Verbal": state.df_kin_vb[state.df_kin_vb["subject"] == code],
        "VR": state.df_kin_vr[state.df_kin_vr["subject"] == code],
    }

    joints_by_cond: Dict[str, Dict[str, Dict[str, List[float]]]] = {}
    for cond in ("Baseline", "Verbal", "VR"):
        sess = by_cond.get(cond)
        if sess is not None:
            parsed = _parse_session_kinematics(sess)
            if parsed and parsed.get("joints"):
                joints_by_cond[cond] = parsed["joints"]
            elif getattr(sess, "source", "seeded") == "seeded":
                sub_static = static_by_cond[cond]
                if not sub_static.empty:
                    joints_by_cond[cond] = _extract_static_cond_joints(sub_static)
        elif not has_any_db:
            sub_static = static_by_cond[cond]
            if not sub_static.empty:
                joints_by_cond[cond] = _extract_static_cond_joints(sub_static)

    if not joints_by_cond:
        return {
            "subject": code,
            "is_surrogate": False,
            "is_fallback": False,
            "has_curves": False,
            "available_conditions": [],
            "joints": {},
        }

    t_percent = np.linspace(0, 100, 51).tolist()
    kinematics_data: Dict[str, Any] = {}

    for joint in ("aSagP", "aSagH", "aSagK", "aSagA", "mSagH"):
        b_series = joints_by_cond.get("Baseline", {}).get(joint)
        vb_series = joints_by_cond.get("Verbal", {}).get(joint)
        vr_series = joints_by_cond.get("VR", {}).get(joint)
        if b_series is None and vb_series is None and vr_series is None:
            continue

        td_profile = NORMATIVE_PROFILES[joint]
        norm_mean = td_profile["mean"][::20].tolist()
        norm_std = td_profile["std"][::20].tolist()

        kinematics_data[joint] = {
            "name_ru": td_profile["name_ru"],
            "name_kz": td_profile["name_kz"],
            "name_en": td_profile["name_en"],
            "unit": td_profile["unit"],
            "time_percent": t_percent,
            "baseline": b_series,
            "vr": vr_series,
            "verbal": vb_series,
            "norm_td": {"mean": norm_mean, "std": norm_std},
        }

    available_conditions = [
        c for c in ("Baseline", "Verbal", "VR")
        if any(c in joints_by_cond and j in joints_by_cond[c] for j in kinematics_data)
    ]

    return {
        "subject": code,
        "is_surrogate": False,
        "is_fallback": False,
        "has_curves": len(kinematics_data) > 0,
        "available_conditions": available_conditions,
        "joints": kinematics_data,
    }


def _extract_static_cond_joints(sub_df: pd.DataFrame) -> Dict[str, Dict[str, List[float]]]:
    extracted: Dict[str, Dict[str, List[float]]] = {}
    for joint in ("aSagP", "aSagH", "aSagK", "aSagA", "mSagH"):
        cols = [f"{joint}_pct_GC_{i * 20}" for i in range(51)]
        if not all(c in sub_df.columns for c in cols):
            continue
        arr = sub_df[cols].to_numpy(dtype=float)
        if arr.size == 0 or np.isnan(arr).all():
            continue
        valid_rows = ~np.isnan(arr).all(axis=1)
        arr = arr[valid_rows]
        if arr.size == 0:
            continue
        extracted[joint] = {
            "mean": np.nan_to_num(np.nanmean(arr, axis=0), nan=0.0).tolist(),
            "std": np.nan_to_num(np.nanstd(arr, axis=0), nan=0.0).tolist(),
        }
    return extracted


def extract_session_metrics_for_diff(summary: Dict[str, Any], condition: str, lang: str = "ru") -> Dict[str, Any]:
    c = condition.strip().lower()
    base_gps = opt_float(summary.get("baseline_gps"))
    base_hip = opt_float(summary.get("baseline_amin_sagh"))
    base_p = opt_float(summary.get("baseline_gvs_pelvis"))
    base_k = opt_float(summary.get("baseline_gvs_knee"))
    base_a = opt_float(summary.get("baseline_gvs_ankle"))

    if c == "baseline":
        if not summary.get("has_baseline"):
            raise HTTPException(
                status_code=404,
                detail=f"Baseline gait session not recorded for patient {summary.get('subject')}",
            )
        return {
            "label_ru": "Базовая сессия (Baseline)",
            "label_kz": "Базалық сессия (Baseline)",
            "label_en": "Baseline session (Baseline)",
            "gps": base_gps,
            "tje": 0.0,
            "pcr": 0.0,
        }

    if c in ("vr", "verbal"):
        is_vr = c == "vr"
        flag = "has_vr" if is_vr else "has_verbal"
        pfx = "vr" if is_vr else "verbal"
        tilt_key = "delta_pelvis_tilt" if is_vr else "verbal_delta_pelvis_tilt"
        cond_label = "VR" if is_vr else "Verbal"
        if not summary.get(flag):
            raise HTTPException(
                status_code=404,
                detail=f"{cond_label} gait session not recorded for patient {summary.get('subject')}",
            )
        post_gps = opt_float(summary.get(f"{pfx}_gps"))
        post_hip = opt_float(summary.get(f"{pfx}_amin_sagh"))
        post_p = opt_float(summary.get(f"{pfx}_gvs_pelvis"))
        post_k = opt_float(summary.get(f"{pfx}_gvs_knee"))
        post_a = opt_float(summary.get(f"{pfx}_gvs_ankle"))

        d_hip = (post_hip - base_hip) if (post_hip is not None and base_hip is not None) else None
        d_p = (post_p - base_p) if (post_p is not None and base_p is not None) else None
        d_k = (post_k - base_k) if (post_k is not None and base_k is not None) else None
        d_a = (post_a - base_a) if (post_a is not None and base_a is not None) else None
        d_pelvis_tilt = opt_float(summary.get(tilt_key))
        pelvis_term = d_pelvis_tilt if d_pelvis_tilt is not None else d_p

        tje = compute_true_joint_extension(d_hip, pelvis_term) if (d_hip is not None and pelvis_term is not None) else None
        pcr_raw = compute_pcr(d_p, d_k or 0.0, d_a or 0.0, d_hip) if (d_p is not None and d_hip is not None) else None
        pcr = opt_float(pcr_raw)
        if is_vr:
            labels = {
                "label_ru": "Сессия VR (зрительная обратная связь)",
                "label_kz": "VR сессиясы (аватар арқылы кері байланыс)",
                "label_en": "VR session (visual biofeedback)",
            }
        else:
            labels = {
                "label_ru": "Сессия Verbal (голосовые инструкции)",
                "label_kz": "Verbal сессиясы (ауызша нұсқау)",
                "label_en": "Verbal session (auditory cueing)",
            }
        return {**labels, "gps": post_gps, "tje": tje, "pcr": pcr}

    raise HTTPException(
        status_code=400,
        detail=f"Unknown session condition '{condition}'. Expected Baseline, VR, or Verbal.",
    )
