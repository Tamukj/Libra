"""Live Cohort Analytics computed directly from registered patients and gait cycles."""

from typing import Dict, Any, List
import math
import numpy as np


def _mean_finite(vals: List[float]) -> float | None:
    clean = [float(v) for v in vals if v is not None and math.isfinite(float(v))]
    return round(float(np.mean(clean)), 2) if clean else None


def build_cohort_analytics(patient_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregates live cohort metrics across all patients currently in the database.
    Source provenance reflects whether seeded KU Leuven records are actually present.
    Baseline-only patients ('unassessed') are excluded from yellow/green/red VR risk counts.
    """
    total_patients = len(patient_records)
    cdss_counts = {"green": 0, "yellow": 0, "red": 0}
    unassessed_count = 0
    best_method_counts = {"VR": 0, "Verbal": 0, "Baseline": 0}
    side_counts = {"LEFT": 0, "RIGHT": 0}

    cycles_base = 0
    cycles_vb = 0
    cycles_vr = 0

    b_gps_list: List[float] = []
    vb_gps_list: List[float] = []
    vr_gps_list: List[float] = []
    d_hip_list: List[float] = []
    tje_list: List[float] = []
    pcr_list: List[float] = []
    weights: List[float] = []
    heights: List[float] = []
    leg_lengths: List[float] = []

    seeded_count = 0
    uploaded_count = 0

    for rec in patient_records:
        if rec.get("has_seeded"):
            seeded_count += 1
        else:
            uploaded_count += 1

        status = rec.get("status")
        if status in cdss_counts:
            cdss_counts[status] += 1
        else:
            unassessed_count += 1

        bm = rec.get("best_method", "Baseline")
        if bm in best_method_counts:
            best_method_counts[bm] += 1

        side = rec.get("side", "RIGHT")
        if side in side_counts:
            side_counts[side] += 1

        cycles_base += int(rec.get("cycles_baseline") or 0)
        cycles_vb += int(rec.get("cycles_verbal") or 0)
        cycles_vr += int(rec.get("cycles_vr") or 0)

        if rec.get("has_baseline", True) and rec.get("baseline_gps") is not None:
            b_gps_list.append(rec["baseline_gps"])
        if rec.get("has_verbal") and rec.get("verbal_gps") is not None:
            vb_gps_list.append(rec["verbal_gps"])
        if rec.get("has_vr") and rec.get("vr_gps") is not None:
            vr_gps_list.append(rec["vr_gps"])
        if rec.get("has_vr") and rec.get("has_baseline", True):
            if rec.get("delta_amin_sagh") is not None:
                d_hip_list.append(rec["delta_amin_sagh"])
            if rec.get("tje") is not None:
                tje_list.append(rec["tje"])
            if rec.get("pcr") is not None:
                pcr_list.append(rec["pcr"])

        if rec.get("weight") and rec["weight"] > 0:
            weights.append(float(rec["weight"]))
        if rec.get("height") and rec["height"] > 0:
            heights.append(float(rec["height"]))
        if rec.get("leg_length") and rec["leg_length"] > 0:
            leg_lengths.append(float(rec["leg_length"]))

    if seeded_count > 0 and uploaded_count == 0:
        source_meta = {
            "name": "KU Leuven Pediatric Cerebral Palsy Gait Dataset",
            "citation": "De Mulder et al., Children 2024, 11(5), 524",
            "doi": "10.48804/JUNNWW",
            "license": "CC-BY-NC-SA-4.0",
        }
    elif seeded_count > 0:
        source_meta = {
            "name": "KU Leuven Pediatric CP Gait Dataset + Uploaded Clinical Sessions",
            "citation": "De Mulder et al., Children 2024, 11(5), 524 & clinic CSV imports",
            "doi": "10.48804/JUNNWW",
            "license": "CC-BY-NC-SA-4.0 (open subset)",
        }
    else:
        source_meta = {
            "name": "Custom Uploaded Clinical Cohort",
            "citation": "Clinic-submitted anonymized gait sessions (Law of RK No. 94-V)",
            "doi": "N/A",
            "license": "Internal Clinical Data",
        }

    return {
        "source": source_meta,
        "total_patients": total_patients,
        "unassessed_patients": unassessed_count,
        "cycles": {
            "baseline": cycles_base,
            "verbal": cycles_vb,
            "vr": cycles_vr,
            "total": cycles_base + cycles_vb + cycles_vr,
        },
        "cdss_distribution": cdss_counts,
        "best_method_distribution": best_method_counts,
        "side_distribution": side_counts,
        "averages": {
            "baseline_gps": _mean_finite(b_gps_list),
            "verbal_gps": _mean_finite(vb_gps_list),
            "vr_gps": _mean_finite(vr_gps_list),
            "delta_amin_sagh": _mean_finite(d_hip_list),
            "tje_vr": _mean_finite(tje_list),
            "pcr_vr": _mean_finite(pcr_list),
        },
        "anthropometrics": {
            "weight_min": round(min(weights), 1) if weights else None,
            "weight_max": round(max(weights), 1) if weights else None,
            "height_min": round(min(heights), 2) if heights else None,
            "height_max": round(max(heights), 2) if heights else None,
            "leg_length_min": round(min(leg_lengths), 2) if leg_lengths else None,
            "leg_length_max": round(max(leg_lengths), 2) if leg_lengths else None,
        },
    }
