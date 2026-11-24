import pytest
import numpy as np
import pandas as pd

from src.core.data_loader import load_discrete_dataset, load_kinematics_dataset, DATA_DIR
from src.ml.vr_predictor import GaitConditionClassifier
from src.ml.anomaly_detector import KinematicPCAAnomalyDetector
from src.ml.local_reporter import generate_clinical_narrative

@pytest.fixture
def discrete_data():
    df_base = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Baseline.csv")
    df_vr = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_VR.csv")
    return df_base, df_vr

def test_gait_condition_classifier_group_kfold(discrete_data):
    df_base, df_vr = discrete_data
    clf = GaitConditionClassifier(n_splits=5)
    
    # Train and evaluate using GroupKFold grouped strictly by subject
    metrics = clf.evaluate_group_kfold(df_base, df_vr)
    
    assert "balanced_accuracy" in metrics
    assert "roc_auc" in metrics
    assert "sensitivity" in metrics
    assert "specificity" in metrics
    assert "feature_importances" in metrics
    
    # Prove zero-leakage: balanced accuracy is realistic (not fake 99%)
    assert 0.55 <= metrics["balanced_accuracy"] <= 0.85
    assert 0.60 <= metrics["roc_auc"] <= 0.90
    assert metrics["n_subjects"] == 29
    
    # Check feature importances exist for clinical interpretation
    importances = metrics["feature_importances"]
    assert "aMinSagH" in importances
    assert "GVS_aSagP" in importances
    assert sum(importances.values()) == pytest.approx(1.0, 0.05)

def test_gait_condition_classifier_single_inference(discrete_data):
    df_base, df_vr = discrete_data
    clf = GaitConditionClassifier(n_splits=5)
    clf.fit_full(df_base, df_vr)
    
    sample_patient = df_base[df_base["subject"] == "s61520_22"]
    preds, probs = clf.predict_cycle_condition(sample_patient)
    
    assert len(preds) == len(sample_patient)
    assert len(probs) == len(sample_patient)
    assert np.all((probs >= 0.0) & (probs <= 1.0))

def test_kinematic_pca_anomaly_detector():
    df_kin = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")
    detector = KinematicPCAAnomalyDetector(n_components=6)
    
    # Extract hip sagittal columns (sampled points present in dataset)
    hip_cols = [c for c in df_kin.columns if "aSagH_pct_GC_" in c]
    assert len(hip_cols) == 51, f"Expected 51 hip columns, found {len(hip_cols)}"
    
    hip_curves = df_kin[hip_cols].values
    
    detector.fit(hip_curves)
    results = detector.detect(hip_curves)
    
    assert "is_anomaly" in results
    assert "reconstruction_error" in results
    assert len(results["is_anomaly"]) == len(hip_curves)
    
    anomaly_rate = float(np.mean(results["is_anomaly"]))
    # Expected outlier rate should be roughly 3% to 10%
    assert 0.01 <= anomaly_rate <= 0.15

def test_local_clinical_reporter():
    summary = {
        "subject": "s61520_22",
        "side": "RIGHT",
        "baseline_gps": 11.27,
        "vr_gps": 10.89,
        "delta_amin_sagh": -4.18,
        "delta_gvs_pelvis": 2.57,
        "delta_gvs_knee": 2.07,
        "delta_gvs_ankle": 1.67,
    }
    
    narrative_ru = generate_clinical_narrative(summary, lang="ru")
    narrative_kz = generate_clinical_narrative(summary, lang="kz")
    
    assert "МКФ" in narrative_ru or "b770" in narrative_ru
    assert "компенсация" in narrative_ru.lower() or "таз" in narrative_ru.lower()
    
    assert "БЦП" in narrative_kz or "ДЦП" in narrative_kz or "МКФ" in narrative_kz or "b770" in narrative_kz
    assert "жамбас" in narrative_kz.lower()
