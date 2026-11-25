"""Data ingestion, parsing, and summary aggregation module for Libra."""

from pathlib import Path
from typing import Dict, Any, Optional
import math
import numpy as np
import pandas as pd

# Root project and data directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "gait-cp-dataset"

# Discrete columns that must be float
DISCRETE_NUMERIC_COLS = [
    "weight", "height", "LegLength",
    "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
    "aMinSagH", "pctmZeroStSagH",
]

GAIT_METRIC_COLS = (
    "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
    "aMinSagH", "pctmZeroStSagH",
)


def clean_identifier_value(val: Any) -> Any:
    """Normalizes string/numeric identifier while preserving missing values as NaN."""
    if val is None or pd.isna(val):
        return np.nan
    if isinstance(val, (float, np.floating)):
        f = float(val)
        if not math.isfinite(f):
            return np.nan
        return str(int(f)) if f.is_integer() else str(f)
    if isinstance(val, (int, np.integer)):
        return str(int(val))
    s = str(val).strip()
    if not s or s.lower() in {"nan", "none", "null", "<na>"}:
        return np.nan
    if s.endswith(".0") and s[:-2].lstrip("-").isdigit():
        return s[:-2]
    return s


def _clean_id_series(series: pd.Series) -> pd.Series:
    return series.apply(clean_identifier_value)


def _opt_mean_col(df: pd.DataFrame, col: str) -> Optional[float]:
    if col not in df.columns:
        return None
    clean = pd.to_numeric(df[col], errors="coerce").dropna()
    clean = clean[np.isfinite(clean)]
    if clean.empty:
        return None
    val = float(clean.mean())
    return val if math.isfinite(val) else None


def _count_valid_gait_cycles(df: pd.DataFrame) -> int:
    present = [c for c in GAIT_METRIC_COLS if c in df.columns]
    if not present:
        return 0
    numeric_df = df[present].apply(pd.to_numeric, errors="coerce")
    valid_mask = numeric_df.apply(lambda col: np.isfinite(col)).any(axis=1)
    return int(valid_mask.sum())


def _count_valid_col(df: pd.DataFrame, col: str) -> int:
    if col not in df.columns:
        return 0
    s = pd.to_numeric(df[col], errors="coerce")
    return int(np.isfinite(s).sum())


def _extract_valid_side(df: pd.DataFrame) -> Optional[str]:
    if "side" not in df.columns or df.empty:
        return None
    clean = df["side"].dropna().astype(str).str.strip().str.upper()
    clean = clean[clean.isin(["LEFT", "RIGHT"])]
    if clean.empty:
        return None
    unique_sides = clean.unique().tolist()
    if len(unique_sides) > 1:
        raise ValueError(f"Conflicting limb sides within condition rows: {unique_sides}")
    return unique_sides[0]


def _resolve_subject_column(df: pd.DataFrame, path_name: str) -> pd.DataFrame:
    """Normalizes common subject column aliases to 'subject' without silent KeyError."""
    if "subject" in df.columns:
        return df
    norm_to_col = {str(c).strip().lower().replace("_", ""): c for c in df.columns}
    for alias in ("patient_code", "patient_id", "code", "subject_id"):
        norm = alias.replace("_", "")
        if norm in norm_to_col:
            return df.rename(columns={norm_to_col[norm]: "subject"})
    raise ValueError(f"Missing required 'subject' column in {path_name}")


def load_discrete_dataset(path: Path) -> pd.DataFrame:
    """
    Loads and cleans a Discrete_Parameters_*.csv file.
    Handles semicolon separators, decimal commas, and NaN values.
    """
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    df = pd.read_csv(
        path,
        sep=";",
        decimal=",",
        na_values=["NaN", "nan", "NULL", "null", ""],
        dtype={"subject": str, "side": str},
    )

    df = _resolve_subject_column(df, path.name)

    df["subject"] = _clean_id_series(df["subject"])
    if "side" in df.columns:
        df["side"] = _clean_id_series(df["side"])

    for col in DISCRETE_NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def load_kinematics_dataset(path: Path) -> pd.DataFrame:
    """
    Loads and interpolates internal gaps in a Kinematics_Kinetics_*.csv file.
    Contains 51 points (GC 0% to 100% with step 20 = 2%) for pelvis, hip, knee, ankle angles and hip moment.
    """
    if not path.exists():
        raise FileNotFoundError(f"Kinematics file not found: {path}")

    df = pd.read_csv(
        path,
        sep=";",
        decimal=",",
        na_values=["NaN", "nan", "NULL", "null", ""],
        dtype={"subject": str, "side": str},
    )

    df = _resolve_subject_column(df, path.name)

    df["subject"] = _clean_id_series(df["subject"])
    if "side" in df.columns:
        df["side"] = _clean_id_series(df["side"])

    for col in ["weight", "height", "LegLength"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    ts_cols = [c for c in df.columns if "_pct_GC_" in c]
    for col in ts_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    if ts_cols:
        prefixes = set(c.split("_pct_GC_")[0] for c in ts_cols)
        for pfx in sorted(prefixes):
            pfx_cols = [c for c in ts_cols if c.startswith(f"{pfx}_pct_GC_")]
            pfx_cols_sorted = sorted(pfx_cols, key=lambda x: int(x.split("_pct_GC_")[1]))
            # Interpolate strictly internal gaps without extrapolating sparse endpoints
            df[pfx_cols_sorted] = df[pfx_cols_sorted].interpolate(method="linear", axis=1, limit_area="inside")

    return df


def get_patient_discrete_summary(
    df_baseline: pd.DataFrame,
    df_vr: pd.DataFrame,
    subject_id: str,
    df_verbal: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """
    Computes aggregated statistical summary for a patient comparing Baseline, VR, and Verbal.
    Never fabricates missing conditions or all-NaN metrics as numeric clinical values.
    """
    if "subject" not in df_baseline.columns:
        raise ValueError("df_baseline missing required 'subject' column")

    sub_base = df_baseline[df_baseline["subject"] == subject_id]
    if sub_base.empty:
        raise ValueError(f"Subject {subject_id} not found in Baseline dataset")

    sub_vr = (
        df_vr[df_vr["subject"] == subject_id]
        if (df_vr is not None and not df_vr.empty and "subject" in df_vr.columns)
        else df_baseline.iloc[0:0]
    )
    sub_vb = (
        df_verbal[df_verbal["subject"] == subject_id]
        if (df_verbal is not None and not df_verbal.empty and "subject" in df_verbal.columns)
        else df_baseline.iloc[0:0]
    )

    b_side = _extract_valid_side(sub_base)
    vr_side = _extract_valid_side(sub_vr) if not sub_vr.empty else None
    vb_side = _extract_valid_side(sub_vb) if not sub_vb.empty else None

    if b_side and vr_side and vr_side != b_side:
        raise ValueError(f"Limb side mismatch for {subject_id}: Baseline={b_side} vs VR={vr_side}")
    if b_side and vb_side and vb_side != b_side:
        raise ValueError(f"Limb side mismatch for {subject_id}: Baseline={b_side} vs Verbal={vb_side}")

    side = b_side or vr_side or vb_side or "RIGHT"
    weight = _opt_mean_col(sub_base, "weight")
    height = _opt_mean_col(sub_base, "height")
    leg_length = _opt_mean_col(sub_base, "LegLength")

    b_gps = _opt_mean_col(sub_base, "GPS_a")
    b_amin_sagh = _opt_mean_col(sub_base, "aMinSagH")
    b_gvs_p = _opt_mean_col(sub_base, "GVS_aSagP")
    b_gvs_h = _opt_mean_col(sub_base, "GVS_aSagH")
    b_gvs_k = _opt_mean_col(sub_base, "GVS_aSagK")
    b_gvs_a = _opt_mean_col(sub_base, "GVS_aSagA")
    b_pctm = _opt_mean_col(sub_base, "pctmZeroStSagH")

    has_vr = not sub_vr.empty
    vr_gps = _opt_mean_col(sub_vr, "GPS_a") if has_vr else None
    vr_amin_sagh = _opt_mean_col(sub_vr, "aMinSagH") if has_vr else None
    vr_gvs_p = _opt_mean_col(sub_vr, "GVS_aSagP") if has_vr else None
    vr_gvs_h = _opt_mean_col(sub_vr, "GVS_aSagH") if has_vr else None
    vr_gvs_k = _opt_mean_col(sub_vr, "GVS_aSagK") if has_vr else None
    vr_gvs_a = _opt_mean_col(sub_vr, "GVS_aSagA") if has_vr else None
    vr_pctm = _opt_mean_col(sub_vr, "pctmZeroStSagH") if has_vr else None

    has_vb = not sub_vb.empty
    vb_gps = _opt_mean_col(sub_vb, "GPS_a") if has_vb else None
    vb_amin_sagh = _opt_mean_col(sub_vb, "aMinSagH") if has_vb else None
    vb_gvs_p = _opt_mean_col(sub_vb, "GVS_aSagP") if has_vb else None
    vb_gvs_h = _opt_mean_col(sub_vb, "GVS_aSagH") if has_vb else None
    vb_gvs_k = _opt_mean_col(sub_vb, "GVS_aSagK") if has_vb else None
    vb_gvs_a = _opt_mean_col(sub_vb, "GVS_aSagA") if has_vb else None
    vb_pctm = _opt_mean_col(sub_vb, "pctmZeroStSagH") if has_vb else None

    def _diff(post_val: Optional[float], pre_val: Optional[float]) -> Optional[float]:
        return (post_val - pre_val) if (post_val is not None and pre_val is not None) else None

    cycles_b = _count_valid_gait_cycles(sub_base)
    cycles_vr = _count_valid_gait_cycles(sub_vr) if has_vr else 0
    cycles_vb = _count_valid_gait_cycles(sub_vb) if has_vb else 0

    return {
        "subject": subject_id,
        "side": side,
        "weight": weight,
        "height": height,
        "leg_length": leg_length,
        "cycles_baseline": cycles_b,
        "cycles_vr": cycles_vr,
        "cycles_verbal": cycles_vb,
        "baseline_cycles": cycles_b,
        "vr_cycles": cycles_vr,
        "verbal_cycles": cycles_vb,
        "cycles_baseline_pctm": _count_valid_col(sub_base, "pctmZeroStSagH"),
        "cycles_vr_pctm": _count_valid_col(sub_vr, "pctmZeroStSagH") if has_vr else 0,
        "cycles_verbal_pctm": _count_valid_col(sub_vb, "pctmZeroStSagH") if has_vb else 0,
        "has_baseline": True,
        "has_vr": has_vr,
        "has_verbal": has_vb,
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
        # Verbal
        "verbal_gps": vb_gps,
        "verbal_amin_sagh": vb_amin_sagh,
        "verbal_gvs_pelvis": vb_gvs_p,
        "verbal_gvs_hip": vb_gvs_h,
        "verbal_gvs_knee": vb_gvs_k,
        "verbal_gvs_ankle": vb_gvs_a,
        "verbal_pctm_zero": vb_pctm,
        # Deltas (VR - Baseline)
        "delta_gps": _diff(vr_gps, b_gps),
        "delta_amin_sagh": _diff(vr_amin_sagh, b_amin_sagh),
        "delta_gvs_pelvis": _diff(vr_gvs_p, b_gvs_p),
        "delta_gvs_hip": _diff(vr_gvs_h, b_gvs_h),
        "delta_gvs_knee": _diff(vr_gvs_k, b_gvs_k),
        "delta_gvs_ankle": _diff(vr_gvs_a, b_gvs_a),
        "delta_pctm_zero": _diff(vr_pctm, b_pctm),
    }
