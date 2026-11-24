import pytest
import numpy as np
import pandas as pd

from src.core.data_loader import load_discrete_dataset, load_kinematics_dataset, DATA_DIR
from src.ml.vr_predictor import GaitConditionClassifier, VRResponderPredictor
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


def test_vr_responder_predictor(discrete_data):
    df_base, df_vr = discrete_data
    predictor = VRResponderPredictor()
    metrics = predictor.fit_evaluate_subjects(df_base, df_vr)

    assert "balanced_accuracy" in metrics
    assert "roc_auc" in metrics
    assert metrics["n_subjects"] == 29

    # Test single patient response prediction
    sample_sub = df_base[df_base["subject"] == "s61520_1"]
    res = predictor.predict_subject_response(sample_sub)

    assert "responder_probability" in res
    assert 0.0 <= res["responder_probability"] <= 1.0
    assert "is_predicted_responder" in res
    assert "loo_balanced_accuracy" in res
    assert "loo_roc_auc" in res
    assert "model_reliable" in res
    assert isinstance(res["model_reliable"], bool)
    assert res["model_reliable"] == (res["loo_roc_auc"] >= 0.75)
    assert "clinical_status_ru" in res
    assert "clinical_status_kz" in res
    assert "recommendation_ru" in res
    assert "recommendation_kz" in res


def test_gait_condition_classifier_kinematics_and_three_class(discrete_data):
    df_base, df_vr = discrete_data
    df_vb = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Verbal.csv")
    df_kin_base = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")
    df_kin_vr = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_VR.csv")
    df_kin_vb = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Verbal.csv")

    clf = GaitConditionClassifier(n_splits=5)
    metrics = clf.evaluate_group_kfold(df_base, df_vr, df_kin_base=df_kin_base, df_kin_vr=df_kin_vr)
    assert 0.60 <= metrics["balanced_accuracy"] <= 0.85
    assert 0.65 <= metrics["roc_auc"] <= 0.90
    imps = metrics["feature_importances"]
    for key in ("aMinSagH", "GVS_aSagP", "GPS_a", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA", "kinematic_waveforms"):
        assert key in imps
    assert sum(imps.values()) == pytest.approx(1.0, abs=1e-4)

    three = clf.evaluate_three_class_group_kfold(
        df_base, df_vb, df_vr,
        df_kin_base=df_kin_base, df_kin_verbal=df_kin_vb, df_kin_vr=df_kin_vr,
    )
    assert three["classes"] == ["Baseline", "Verbal", "VR"]
    assert three["balanced_accuracy"] > 0.35
    assert three["f1_macro"] > 0.35


def test_vr_responder_nan_auc_guard():
    predictor = VRResponderPredictor()
    # Fit directly on minimal synthetic data without calling fit_evaluate_subjects (empty metrics_)
    df_syn = pd.DataFrame({
        "weight": [30.0, 40.0, 50.0, 60.0],
        "height": [1.2, 1.3, 1.4, 1.5],
        "LegLength": [0.6, 0.65, 0.7, 0.75],
        "GPS_a": [10.0, 11.0, 9.0, 12.0],
        "GVS_aSagP": [12.0, 13.0, 11.0, 14.0],
        "GVS_aSagH": [14.0, 15.0, 12.0, 16.0],
        "GVS_aSagK": [10.0, 11.0, 9.0, 12.0],
        "GVS_aSagA": [5.0, 6.0, 4.0, 7.0],
        "aMinSagH": [10.0, 12.0, 8.0, 14.0],
    })
    X_imp = predictor.imputer.fit_transform(df_syn)
    X_sc = predictor.scaler.fit_transform(X_imp)
    predictor.clf.fit(X_sc, [0, 1, 0, 1])
    predictor.is_fitted = True
    predictor.metrics_ = {"balanced_accuracy": 0.5, "roc_auc": float("nan")}

    out = predictor.predict_subject_response(df_syn.iloc[[0]])
    assert out["model_reliable"] is False
    assert out["loo_roc_auc"] == 0.5


def test_vr_responder_with_kinematics_and_pca_group_kfold(discrete_data):
    df_base, df_vr = discrete_data
    df_kin_base = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")

    predictor = VRResponderPredictor()
    metrics = predictor.fit_evaluate_subjects(df_base, df_vr, df_kin_base=df_kin_base)
    assert metrics["feature_mode"] == "kinematics_biomech"
    assert metrics["n_subjects"] == 29
    assert metrics["balanced_accuracy"] >= 0.70
    assert metrics["roc_auc"] >= 0.60

    sub_summary = {
        "baseline_gps": 7.25,
        "baseline_gvs_pelvis": 5.5,
        "baseline_amin_sagh": 10.0,
        "baseline_pelvis_tilt": 14.0,
        "baseline_hip_rom": 42.0,
    }
    pred = predictor.predict_subject_response(sub_summary)
    assert pred["model_reliable"] == (pred["loo_roc_auc"] >= 0.75)
    assert len(pred["feature_attributions"]) == 5

    hip_cols = [c for c in df_kin_base.columns if "aSagH_pct_GC_" in c]
    det = KinematicPCAAnomalyDetector(n_components=6)
    pca_val = det.evaluate_group_kfold(df_kin_base[hip_cols].values, df_kin_base["subject"].values, n_splits=5)
    assert pca_val["n_splits"] == 5
    assert pca_val["n_subjects"] == 29
    assert 0.02 <= pca_val["oof_baseline_anomaly_rate"] <= 0.15
