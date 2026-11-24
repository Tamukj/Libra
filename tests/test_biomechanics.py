import pytest
import numpy as np

from src.core.biomechanics import (
    compute_true_joint_extension,
    compute_pcr,
    classify_icf_b770,
    classify_icf_d450,
    analyze_compensation_risk,
)

def test_true_joint_extension():
    # If hip extension improved by -4.2 degrees, but pelvis tilted by +2.4 degrees
    # True Joint Extension should discount the pelvic tilt
    tje = compute_true_joint_extension(delta_hip=-4.2, delta_pelvis=2.4)
    assert pytest.approx(tje, 0.01) == -1.8

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
