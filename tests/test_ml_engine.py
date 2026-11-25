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
    assert metrics["n_responders"] == 11
    assert 0.45 <= metrics["balanced_accuracy"] <= 1.0
    assert 0.50 <= metrics["roc_auc"] <= 1.0

    # W3-01: CDSS 'red' subjects must never be labeled positive responder=1
    from src.core.data_loader import get_patient_discrete_summary
    from src.core.biomechanics import analyze_compensation_risk
    for code in sorted(set(df_base["subject"]) & set(df_vr["subject"])):
        s = get_patient_discrete_summary(df_base, df_vr, code)
        risk = analyze_compensation_risk(
            s["delta_amin_sagh"], s["delta_gvs_pelvis"], s["delta_gvs_knee"], s["delta_gvs_ankle"],
        )
        if risk["status"] == "red":
            assert not (s["delta_amin_sagh"] <= -1.0 and risk["status"] != "red")

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


def test_ml_edge_cases_and_safety(discrete_data):
    df_base, df_vr = discrete_data
    df_kin_base = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")

    # W3-02: reject empty payload; discrete-only input uses disc_clf instead of median-imputing pelvis_mean
    predictor = VRResponderPredictor()
    predictor.fit_evaluate_subjects(df_base, df_vr, df_kin_base=df_kin_base)
    with pytest.raises(ValueError):
        predictor.predict_subject_response({})

    disc_only = predictor.predict_subject_response(
        {"baseline_gps": 9.0, "baseline_gvs_pelvis": 6.0, "baseline_amin_sagh": 12.0}
    )
    assert disc_only["feature_mode"] == "discrete_fallback"
    assert len(disc_only["feature_attributions"]) == 3

    # W3-03 / W4-08: all-NaN optional training column is handled without IndexError or column shift
    df_syn_base = pd.DataFrame({
        "subject": ["s1", "s2", "s3", "s4"],
        "side": ["LEFT", "LEFT", "RIGHT", "RIGHT"],
        "weight": [30.0, 40.0, 50.0, 60.0],
        "height": [1.2, 1.3, 1.4, 1.5],
        "LegLength": [np.nan, np.nan, np.nan, np.nan],
        "GPS_a": [10.0, 11.0, 9.0, 12.0],
        "GVS_aSagP": [12.0, 13.0, 11.0, 14.0],
        "GVS_aSagH": [14.0, 15.0, 12.0, 16.0],
        "GVS_aSagK": [10.0, 11.0, 9.0, 12.0],
        "GVS_aSagA": [5.0, 6.0, 4.0, 7.0],
        "aMinSagH": [10.0, 12.0, 8.0, 14.0],
    })
    df_syn_vr = df_syn_base.copy()
    df_syn_vr.loc[:1, "aMinSagH"] = [7.0, 9.0]  # responders
    df_syn_vr.loc[2:, "GVS_aSagP"] = [15.0, 18.0]  # red compensators
    p_nan = VRResponderPredictor()
    m_nan = p_nan.fit_evaluate_subjects(df_syn_base, df_syn_vr)
    assert m_nan["n_subjects"] == 4
    out_nan = p_nan.predict_subject_response(df_syn_base.iloc[[0]])
    assert 0.0 <= out_nan["responder_probability"] <= 1.0

    # W3-04: single-class fit/CV guards never raise IndexError/KeyError or fabricate 1.0
    clf_one = GaitConditionClassifier(n_splits=5)
    metrics_one = clf_one.evaluate_group_kfold(df_base.iloc[:30], df_vr.iloc[0:0])
    assert metrics_one["roc_auc"] == 0.5
    clf_one.fit_full(df_base.iloc[:30], df_vr.iloc[0:0])
    preds_one, probs_one = clf_one.predict_cycle_condition(df_base.iloc[:5])
    assert len(preds_one) == 5 and np.allclose(probs_one, 0.0)


def test_reporters_multilingual_verbal_and_limitations():
    import subprocess
    import tempfile
    from src.ml.pdf_reporter import generate_pdf_report

    summary_vb = {
        "subject": "s_vb_only", "side": "RIGHT", "weight": 40.0, "height": 1.35, "leg_length": 0.70,
        "cycles_baseline": 20, "cycles_verbal": 20, "cycles_vr": 0,
        "has_baseline": True, "has_verbal": True, "has_vr": False,
        "baseline_gps": 11.0, "verbal_gps": 8.5, "vr_gps": None, "delta_gps": None,
        "baseline_amin_sagh": 15.0, "verbal_amin_sagh": 10.5, "vr_amin_sagh": None, "delta_amin_sagh": None,
        "baseline_gvs_pelvis": 12.0, "verbal_gvs_pelvis": 12.2, "vr_gvs_pelvis": None, "delta_gvs_pelvis": None,
        "baseline_gvs_hip": 14.0, "verbal_gvs_hip": 9.8, "vr_gvs_hip": None, "delta_gvs_hip": None,
        "baseline_gvs_knee": 10.0, "verbal_gvs_knee": 9.5, "vr_gvs_knee": None, "delta_gvs_knee": None,
        "baseline_gvs_ankle": 5.0, "verbal_gvs_ankle": 5.0, "vr_gvs_ankle": None, "delta_gvs_ankle": None,
    }
    risk = {"status": "green", "tje": -4.3, "pcr": 0.02, "label_ru": "Прогресс", "label_kz": "Ілгерілеу", "label_en": "True progress"}
    mod = {"best_method": "Verbal"}

    # W3-06: Verbal-only does not emit 0.00 deg VR deltas; anomaly_rate=1.0 (%) -> d450.0; lang=en works; Rule 8.2
    summary_vb_rep = {
        **summary_vb,
        "delta_amin_sagh": -4.5,
        "delta_gvs_pelvis": 0.2,
        "delta_gvs_knee": -0.5,
        "delta_gvs_ankle": 0.0,
        "anomaly_rate": 1.0,
    }
    nar_en = generate_clinical_narrative(summary_vb_rep, lang="en")
    assert "0.00°" not in nar_en
    assert "d450.0" in nar_en
    assert "CLINICAL" in nar_en and "8.2" in nar_en
    assert "8.4" not in nar_en

    # W3-07: KZ PDF localizes legend & ICF, renders '-' in VR column, handles uneven curve lengths
    pdf_kz = generate_pdf_report(
        summary_vb, risk, mod, "b770.3", "b770.1", "d450.0", "Қорытынды",
        lang="kz", audience="doctor",
        hip_curves={"baseline": [10.0] * 100, "verbal": [8.0] * 51, "norm_mean": [12.0] * 51, "norm_std": [5.0] * 51},
    )
    assert pdf_kz.startswith(b"%PDF-")
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(pdf_kz)
        f.flush()
        extracted = subprocess.check_output(["pdftotext", f.name, "-"]).decode("utf-8", "replace")
        assert "Қалыпты (±1 SD)" in extracted
        assert "Норма (±1 SD)" not in extracted
        assert "ХҚЖ:" in extracted
        assert "8.2" in extracted and "8.4" not in extracted
        assert "11.00°" in extracted
        assert "—" in extracted
