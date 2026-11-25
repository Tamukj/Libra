"""API dependencies: clinician authentication and lazy-initialized ML/dataset engine state."""

from functools import lru_cache
import os
import secrets
from typing import Dict, Any, Optional, List
from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
import pandas as pd

from src.core.data_loader import load_discrete_dataset, load_kinematics_dataset, DATA_DIR
from src.ml.vr_predictor import GaitConditionClassifier, VRResponderPredictor
from src.ml.anomaly_detector import KinematicPCAAnomalyDetector

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_clinician_auth(
    request: Request,
    api_key: Optional[str] = Depends(API_KEY_HEADER),
) -> Dict[str, Any]:
    """
    Validates X-API-Key against LIBRA_API_KEY (no hardcoded secret fallback).
    Demo access is allowed only when LIBRA_ALLOW_DEMO is truthy ('1', 'true', 'yes').
    """
    configured_key = os.getenv("LIBRA_API_KEY", "").strip()
    demo_raw = os.getenv("LIBRA_ALLOW_DEMO", "1").strip().lower()
    demo_mode = demo_raw in ("1", "true", "yes")

    raw_header = api_key if api_key is not None else request.headers.get("x-api-key")
    if raw_header is not None:
        if configured_key and secrets.compare_digest(raw_header.strip(), configured_key):
            return {"authorized": True, "role": "clinician", "demo": False}
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")

    if demo_mode:
        return {"authorized": True, "role": "clinician-demo", "demo": True}

    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Valid X-API-Key required.",
    )


class ClinicalEngineState:
    """Holds preloaded reference datasets and trained ML models initialized once on startup/first call."""

    def __init__(self):
        self.df_base: pd.DataFrame = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Baseline.csv")
        self.df_vr: pd.DataFrame = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_VR.csv")
        self.df_vb: pd.DataFrame = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Verbal.csv")
        self.df_kin_base: pd.DataFrame = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")
        self.df_kin_vr: pd.DataFrame = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_VR.csv")
        self.df_kin_vb: pd.DataFrame = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Verbal.csv")

        self.ml_classifier = GaitConditionClassifier(n_splits=5)
        self.ml_metrics = self.ml_classifier.evaluate_group_kfold(
            self.df_base, self.df_vr, df_kin_base=self.df_kin_base, df_kin_vr=self.df_kin_vr
        )
        self.three_class_metrics = self.ml_classifier.evaluate_three_class_group_kfold(
            self.df_base, self.df_vb, self.df_vr,
            df_kin_base=self.df_kin_base, df_kin_verbal=self.df_kin_vb, df_kin_vr=self.df_kin_vr,
        )

        self.vr_responder = VRResponderPredictor()
        self.vr_responder_metrics = self.vr_responder.fit_evaluate_subjects(
            self.df_base, self.df_vr, df_kin_base=self.df_kin_base
        )

        self.hip_cols: List[str] = [c for c in self.df_kin_base.columns if "aSagH_pct_GC_" in c]
        self.pca_detector = KinematicPCAAnomalyDetector(n_components=6)
        self.pca_validation: Dict[str, Any] = {
            "oof_baseline_anomaly_rate": 0.0,
            "vr_anomaly_rate": 0.0,
            "fold_rates": [],
            "n_splits": 0,
            "n_subjects": 0,
            "n_cycles": 0,
        }
        if self.hip_cols:
            self.pca_validation = self.pca_detector.evaluate_group_kfold(
                self.df_kin_base[self.hip_cols].values,
                self.df_kin_base["subject"].values,
                n_splits=5,
            )
            self.pca_detector.fit(self.df_kin_base[self.hip_cols].values)
            vr_pca_res = self.pca_detector.detect(self.df_kin_vr[self.hip_cols].values)
            self.pca_validation["vr_anomaly_rate"] = float(vr_pca_res["anomaly_rate"])
            self.pca_validation["vr_n_cycles"] = int(vr_pca_res["n_total"])


@lru_cache(maxsize=1)
def get_engine_state() -> ClinicalEngineState:
    return ClinicalEngineState()
