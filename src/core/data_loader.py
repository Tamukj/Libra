"""Data ingestion, parsing, and caching module for Libra."""

from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

# Root project and data directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "gait-cp-dataset"

# Discrete columns that must be float
DISCRETE_NUMERIC_COLS = [
    "weight", "height", "LegLength",
    "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
    "aMinSagH", "pctmZeroStSagH"
]

def load_discrete_dataset(path: Path) -> pd.DataFrame:
    """
    Loads and cleans a Discrete_Parameters_*.csv file.
    Handles semicolon separators, decimal commas, and NaN values.
    """
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    # Read raw with semicolon and comma decimal
    df = pd.read_csv(
        path,
        sep=";",
        decimal=",",
        na_values=["NaN", "nan", "NULL", "null", ""],
    )

    # Clean whitespace from string columns
    df["subject"] = df["subject"].astype(str).str.strip()
    df["side"] = df["side"].astype(str).str.strip()

    # Ensure numeric columns are floats
    for col in DISCRETE_NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df

def load_kinematics_dataset(path: Path) -> pd.DataFrame:
    """
    Loads and interpolates a Kinematics_Kinetics_*.csv file.
    Contains 51 points (GC 0% to 100% with step 20 = 2%) for pelvis, hip, knee, ankle angles and hip moment.
    """
    if not path.exists():
        raise FileNotFoundError(f"Kinematics file not found: {path}")

    df = pd.read_csv(
        path,
        sep=";",
        decimal=",",
        na_values=["NaN", "nan", "NULL", "null", ""],
    )

    df["subject"] = df["subject"].astype(str).str.strip()
    df["side"] = df["side"].astype(str).str.strip()

    # Numeric conversion for metadata
    for col in ["weight", "height", "LegLength"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Time series columns: interpolate any internal NaN linearly per row
    ts_cols = [c for c in df.columns if "_pct_GC_" in c]
    for col in ts_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    if ts_cols:
        prefixes = set(c.split("_pct_GC_")[0] for c in ts_cols)
        for pfx in sorted(prefixes):
            pfx_cols = [c for c in ts_cols if c.startswith(f"{pfx}_pct_GC_")]
            pfx_cols_sorted = sorted(pfx_cols, key=lambda x: int(x.split("_pct_GC_")[1]))
            df[pfx_cols_sorted] = df[pfx_cols_sorted].interpolate(method="linear", axis=1, limit_direction="both")

    return df

def get_patient_discrete_summary(
    df_baseline: pd.DataFrame,
    df_vr: pd.DataFrame,
    subject_id: str,
    df_verbal: Optional[pd.DataFrame] = None
) -> Dict[str, Any]:
    """
    Computes aggregated statistical summary for a patient comparing Baseline and VR (and Verbal if provided).
    """
    sub_base = df_baseline[df_baseline["subject"] == subject_id]
    sub_vr = df_vr[df_vr["subject"] == subject_id]

    if sub_base.empty:
        raise ValueError(f"Subject {subject_id} not found in Baseline dataset")

    def _mean_col(df: pd.DataFrame, col: str, fallback: float = 0.0) -> float:
        if col not in df.columns or df[col].dropna().empty:
            return float(fallback)
        val = df[col].dropna().mean()
        return float(fallback) if (np.isnan(val) or pd.isna(val)) else float(val)

    # Patient metadata
    side = sub_base["side"].iloc[0] if "side" in sub_base.columns and not sub_base["side"].empty else "RIGHT"
    weight = _mean_col(sub_base, "weight", 0.0)
    height = _mean_col(sub_base, "height", 0.0)
    leg_length = _mean_col(sub_base, "LegLength", 0.0)

    def _opt_mean_col(df: pd.DataFrame, col: str) -> Optional[float]:
        if col not in df.columns:
            return None
        clean = df[col].dropna()
        if clean.empty:
            return None
        val = float(clean.mean())
        return None if (np.isnan(val) or not np.isfinite(val)) else val

    # Baseline averages
    b_gps = _mean_col(sub_base, "GPS_a", 10.0)
    b_amin_sagh = _mean_col(sub_base, "aMinSagH", 0.0)
    b_gvs_p = _mean_col(sub_base, "GVS_aSagP", 0.0)
    b_gvs_h = _mean_col(sub_base, "GVS_aSagH", 0.0)
    b_gvs_k = _mean_col(sub_base, "GVS_aSagK", 0.0)
    b_gvs_a = _mean_col(sub_base, "GVS_aSagA", 0.0)
    b_pctm = _opt_mean_col(sub_base, "pctmZeroStSagH")

    def _mean_or(series: pd.Series, fallback: float) -> float:
        clean = series.dropna()
        if clean.empty:
            return float(fallback)
        val = clean.mean()
        return float(fallback) if (np.isnan(val) or pd.isna(val)) else float(val)

    # VR averages
    vr_gps = _mean_or(sub_vr["GPS_a"], b_gps) if not sub_vr.empty else b_gps
    vr_amin_sagh = _mean_or(sub_vr["aMinSagH"], b_amin_sagh) if not sub_vr.empty else b_amin_sagh
    vr_gvs_p = _mean_or(sub_vr["GVS_aSagP"], b_gvs_p) if not sub_vr.empty else b_gvs_p
    vr_gvs_h = _mean_or(sub_vr["GVS_aSagH"], b_gvs_h) if not sub_vr.empty else b_gvs_h
    vr_gvs_k = _mean_or(sub_vr["GVS_aSagK"], b_gvs_k) if not sub_vr.empty else b_gvs_k
    vr_gvs_a = _mean_or(sub_vr["GVS_aSagA"], b_gvs_a) if not sub_vr.empty else b_gvs_a
    vr_pctm = _opt_mean_col(sub_vr, "pctmZeroStSagH") if not sub_vr.empty else None
    delta_pctm = (vr_pctm - b_pctm) if (vr_pctm is not None and b_pctm is not None) else None

    res = {
        "subject": subject_id,
        "side": side,
        "weight": weight,
        "height": height,
        "leg_length": leg_length,
        "cycles_baseline": len(sub_base),
        "cycles_vr": len(sub_vr),
        "cycles_verbal": 0,
        "baseline_cycles": len(sub_base),
        "vr_cycles": len(sub_vr),
        "verbal_cycles": 0,
        # Baseline
        "baseline_gps": b_gps,
        "baseline_amin_sagh": b_amin_sagh,
        "baseline_gvs_pelvis": b_gvs_p,
        "baseline_gvs_hip": b_gvs_h,
        "baseline_gvs_knee": b_gvs_k,
        "baseline_gvs_ankle": b_gvs_a,
        "baseline_pctm_zero": b_pctm,
        # VR
        "vr_gps": vr_gps,
        "vr_amin_sagh": vr_amin_sagh,
        "vr_gvs_pelvis": vr_gvs_p,
        "vr_gvs_hip": vr_gvs_h,
        "vr_gvs_knee": vr_gvs_k,
        "vr_gvs_ankle": vr_gvs_a,
        "vr_pctm_zero": vr_pctm,
        "verbal_pctm_zero": None,
        # Deltas (VR - Baseline)
        "delta_gps": vr_gps - b_gps,
        "delta_amin_sagh": vr_amin_sagh - b_amin_sagh,
        "delta_gvs_pelvis": vr_gvs_p - b_gvs_p,
        "delta_gvs_hip": vr_gvs_h - b_gvs_h,
        "delta_gvs_knee": vr_gvs_k - b_gvs_k,
        "delta_gvs_ankle": vr_gvs_a - b_gvs_a,
        "delta_pctm_zero": delta_pctm,
        "has_vr": not sub_vr.empty,
        "has_verbal": False,
    }

    if df_verbal is not None and not df_verbal.empty:
        sub_vb = df_verbal[df_verbal["subject"] == subject_id]
        if not sub_vb.empty:
            res["has_verbal"] = True
            res["cycles_verbal"] = len(sub_vb)
            res["verbal_cycles"] = len(sub_vb)
            res["verbal_gps"] = _mean_col(sub_vb, "GPS_a", b_gps)
            res["verbal_amin_sagh"] = _mean_col(sub_vb, "aMinSagH", b_amin_sagh)
            res["verbal_gvs_pelvis"] = _mean_col(sub_vb, "GVS_aSagP", b_gvs_p)
            res["verbal_gvs_hip"] = _mean_col(sub_vb, "GVS_aSagH", b_gvs_h)
            res["verbal_gvs_knee"] = _mean_col(sub_vb, "GVS_aSagK", b_gvs_k)
            res["verbal_gvs_ankle"] = _mean_col(sub_vb, "GVS_aSagA", b_gvs_a)
            res["verbal_pctm_zero"] = _opt_mean_col(sub_vb, "pctmZeroStSagH")

    return res
