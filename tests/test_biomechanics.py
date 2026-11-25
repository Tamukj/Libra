import pytest
import numpy as np

from src.core.biomechanics import (
    compute_true_joint_extension,
    compute_pcr,
    classify_icf_b770,
    classify_icf_d450,
    analyze_compensation_risk,
    compare_modalities,
)

def test_true_joint_extension():
    # If hip extension improved by -4.2 degrees, but pelvis tilted anteriorly by +2.4 degrees
    # True Joint Extension should discount the pelvic tilt
    tje = compute_true_joint_extension(delta_hip=-4.2, delta_pelvis=2.4)
    assert pytest.approx(tje, 0.01) == -1.8

    # If pelvic tilt decreased (delta_pelvis < 0), max(0, delta_pelvis) clamps to 0
    # so hip extension gain is not artificially inflated
    tje_clamped = compute_true_joint_extension(delta_hip=-4.2, delta_pelvis=-3.0)
    assert pytest.approx(tje_clamped, 0.01) == -4.2

def test_pcr_calculation():
    # De Mulder et al. dataset numbers:
    # delta_hip_ext = -4.18
    # delta_gvs_pelvis = +2.57
    # delta_gvs_knee = +2.07
    # delta_gvs_ankle = +1.67
    pcr = compute_pcr(
        delta_gvs_pelvis=2.57,
        delta_gvs_knee=2.07,
        delta_gvs_ankle=1.67,
        delta_hip_ext=-4.18,
    )
    # Expected weighted sum: 0.5*2.57 + 0.3*2.07 + 0.2*1.67 = 1.285 + 0.621 + 0.334 = 2.24
    # 2.24 / 4.18 = 0.536
    assert pcr > 0.5
    assert pytest.approx(pcr, 0.05) == 0.536

def test_pcr_zero_division_guard():
    pcr = compute_pcr(1.0, 1.0, 1.0, delta_hip_ext=0.0)
    assert pcr == 0.0

def test_classify_icf_b770():
    # WHO ICF b770 thresholds:
    # <5.5 -> b770.0 (None)
    # 5.5 - 7.5 -> b770.1 (Mild)
    # 7.5 - 11.0 -> b770.2 (Moderate)
    # 11.0 - 15.0 -> b770.3 (Severe)
    # >= 15.0 -> b770.4 (Profound)
    assert classify_icf_b770(4.8) == "b770.0"
    assert classify_icf_b770(6.2) == "b770.1"
    assert classify_icf_b770(9.8) == "b770.2"
    assert classify_icf_b770(13.4) == "b770.3"
    assert classify_icf_b770(16.5) == "b770.4"

def test_classify_icf_d450():
    # d450 based on anomaly percentage:
    # <5% -> d450.0
    # 5-12% -> d450.1
    # 12-25% -> d450.2
    # 25-45% -> d450.3
    # >=45% -> d450.4
    assert classify_icf_d450(anomaly_pct=2.0) == "d450.0"
    assert classify_icf_d450(anomaly_pct=8.5) == "d450.1"
    assert classify_icf_d450(anomaly_pct=18.0) == "d450.2"
    assert classify_icf_d450(anomaly_pct=30.0) == "d450.3"
    assert classify_icf_d450(anomaly_pct=50.0) == "d450.4"

def test_analyze_compensation_risk():
    # Case A: True Responder (Hip extended by -4.0, pelvis changed minimally +0.2)
    res_a = analyze_compensation_risk(delta_hip=-4.0, delta_gvs_p=0.2, delta_gvs_k=0.1, delta_gvs_a=0.1)
    assert res_a["status"] == "green"
    assert "Истинный" in res_a["label_ru"] or "Шынайы" in res_a["label_kz"]

    # Case B: Severe Compensation (Hip extended by -2.5, but pelvis tilted by +4.0)
    res_b = analyze_compensation_risk(delta_hip=-2.5, delta_gvs_p=4.0, delta_gvs_k=3.0, delta_gvs_a=2.0)
    assert res_b["status"] == "red"
    assert res_b["pcr"] > 0.8

def test_compare_modalities():
    # VR has large pelvic tilt, Verbal has clean extension
    summary = {
        "baseline_amin_sagh": 10.0,
        "baseline_gvs_pelvis": 5.0,
        "baseline_gvs_knee": 6.0,
        "baseline_gvs_ankle": 4.0,
        "vr_amin_sagh": 7.0, # -3.0
        "vr_gvs_pelvis": 11.0, # +6.0 (compensation!)
        "vr_gvs_knee": 8.0,
        "vr_gvs_ankle": 5.0,
        "verbal_amin_sagh": 8.0, # -2.0
        "verbal_gvs_pelvis": 5.2, # +0.2 (no compensation!)
        "verbal_gvs_knee": 6.0,
        "verbal_gvs_ankle": 4.0,
    }
    res = compare_modalities(summary)
    assert res["best_method"] == "Verbal"
    assert "Вербальные команды" in res["verdict_ru"]

def test_compute_sagittal_gdi():
    from src.core.biomechanics import compute_sagittal_gdi
    # Norm TD (5.2 deg) -> 100.0 GDI
    assert compute_sagittal_gdi(5.2) == 100.0
    assert compute_sagittal_gdi(4.0) == 100.0 # Better or equal to norm
    # 1 SD deviation (6.4 deg) -> 90.0 GDI
    assert compute_sagittal_gdi(6.4) == 90.0
    # 2 SD deviation (7.6 deg) -> 80.0 GDI
    assert compute_sagittal_gdi(7.6) == 80.0
    # Severe deviation
    assert compute_sagittal_gdi(11.2) == 50.0

def test_compute_session_diff():
    from src.core.biomechanics import compute_session_diff
    sess_a = {"label": "Baseline", "gps": 11.4, "tje": 0.0, "pcr": 0.0}
    sess_b = {"label": "VR Month-1", "gps": 8.8, "tje": -2.5, "pcr": 0.12}

    diff = compute_session_diff(sess_a, sess_b)
    assert diff["status"] == "improved"
    assert diff["delta_gps"] == -2.6
    assert diff["delta_gdi"] > 0
    assert diff["icf_improved"] is True
    assert "Положительная" in diff["verdict_ru"]

def test_compare_modalities_with_none_values():
    # Verify that partial or None sensor values in summary do not trigger TypeError
    summary = {
        "baseline_amin_sagh": -2.0,
        "baseline_gvs_pelvis": 1.0,
        "baseline_gvs_knee": None,
        "baseline_gvs_ankle": None,
        "has_vr": True,
        "vr_amin_sagh": -5.0,
        "vr_gvs_pelvis": None,
        "vr_gvs_knee": None,
        "vr_gvs_ankle": None,
        "has_verbal": False,
        "verbal_amin_sagh": None,
    }
    res = compare_modalities(summary)
    assert "best_method" in res
    assert res["best_method"] in ["VR", "Baseline"]

def test_analyze_compensation_risk_nan_guards():
    # If delta_pelvis_term is NaN, it should sanitize gracefully rather than producing nan TJE
    res = analyze_compensation_risk(
        delta_hip=-2.0,
        delta_gvs_p=0.5,
        delta_gvs_k=0.2,
        delta_gvs_a=0.1,
        delta_pelvis_term=float("nan")
    )
    assert res["status"] in ["green", "yellow", "red"]
    assert not np.isnan(res["tje"])
    assert not np.isnan(res["pcr"])


def test_compare_modalities_uses_pelvis_tilt_and_matches_cdss():
    summary = {
        "baseline_amin_sagh": 15.0,
        "baseline_gvs_pelvis": 12.0,
        "baseline_gvs_knee": 10.0,
        "baseline_gvs_ankle": 6.0,
        "has_vr": True,
        "vr_amin_sagh": 10.0,
        "vr_gvs_pelvis": 11.0,
        "vr_gvs_knee": 10.2,
        "vr_gvs_ankle": 6.1,
        "delta_pelvis_tilt": 2.5,
        "has_verbal": True,
        "verbal_amin_sagh": 11.5,
        "verbal_gvs_pelvis": 12.2,
        "verbal_gvs_knee": 10.0,
        "verbal_gvs_ankle": 6.0,
        "verbal_delta_pelvis_tilt": -1.0,
    }
    mod = compare_modalities(summary)
    risk = analyze_compensation_risk(
        delta_hip=-5.0,
        delta_gvs_p=-1.0,
        delta_gvs_k=0.2,
        delta_gvs_a=0.1,
        delta_pelvis_term=2.5,
    )
    assert mod["tje_vr"] == pytest.approx(-2.5, abs=1e-6)
    assert mod["tje_vr"] == pytest.approx(risk["tje"], abs=1e-6)
    assert mod["tje_verbal"] == pytest.approx(-3.5, abs=1e-6)


def test_pelvic_overload_blocks_unsafe_vr_and_noise_pcr():
    # Even when delta_hip > -1.0, delta_gvs_p > 2.0 must raise red pelvic overload
    risk_overload = analyze_compensation_risk(delta_hip=-0.8, delta_gvs_p=4.5, delta_gvs_k=0.5, delta_gvs_a=0.5)
    assert risk_overload["status"] == "red"
    # Tiny hip delta (-0.06 deg) must not explode PCR denominator
    assert compute_pcr(delta_gvs_pelvis=1.7, delta_gvs_knee=0.0, delta_gvs_ankle=0.0, delta_hip_ext=-0.06) == 0.0

    # When both VR and Verbal exceed delta_gvs_pelvis > 2.0, compare_modalities must not recommend VR
    mod = compare_modalities({
        "baseline_amin_sagh": 10.0,
        "baseline_gvs_pelvis": 8.0,
        "baseline_gvs_knee": 8.0,
        "baseline_gvs_ankle": 5.0,
        "has_vr": True,
        "vr_amin_sagh": 6.5,
        "vr_gvs_pelvis": 11.0,  # +3.0 > 2.0
        "vr_gvs_knee": 8.0,
        "vr_gvs_ankle": 5.0,
        "has_verbal": True,
        "verbal_amin_sagh": 6.0,
        "verbal_gvs_pelvis": 14.0,  # +6.0 > 2.0
        "verbal_gvs_knee": 12.0,
        "verbal_gvs_ankle": 8.0,
    })
    assert mod["best_method"] == "Baseline"


def test_rule82_non_prescriptive_wording():
    res_red = analyze_compensation_risk(delta_hip=-3.0, delta_gvs_p=4.5, delta_gvs_k=1.0, delta_gvs_a=0.5)
    assert res_red["status"] == "red"
    for lang_key, rule_tag in (("ru", "8.2"), ("kz", "8.2"), ("en", "Rule 8.2")):
        rec = res_red[f"recommendation_{lang_key}"]
        assert "30%" not in rec
        assert "103" in rec
        assert rule_tag in rec





