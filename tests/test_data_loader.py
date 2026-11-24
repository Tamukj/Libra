import pytest
from pathlib import Path
import pandas as pd
import numpy as np

from src.core.data_loader import (
    load_discrete_dataset,
    load_kinematics_dataset,
    get_patient_discrete_summary,
    DATA_DIR,
)

def test_data_files_exist():
    assert DATA_DIR.exists(), f"Dataset directory {DATA_DIR} does not exist"
    assert (DATA_DIR / "Discrete_Parameters_Baseline.csv").exists()
    assert (DATA_DIR / "Kinematics_Kinetics_Baseline.csv").exists()

def test_load_discrete_dataset_parsing():
    df = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Baseline.csv")
    assert not df.empty
    assert len(df) > 800
    assert "subject" in df.columns
    assert "side" in df.columns
    assert "GPS_a" in df.columns
    assert "aMinSagH" in df.columns
    assert "GVS_aSagP" in df.columns
    
    # Check that decimal separator was parsed as float, not string
    assert pd.api.types.is_float_dtype(df["weight"])
    assert pd.api.types.is_float_dtype(df["GPS_a"])
    assert pd.api.types.is_float_dtype(df["aMinSagH"])

def test_load_kinematics_dataset():
    df = load_kinematics_dataset(DATA_DIR / "Kinematics_Kinetics_Baseline.csv")
    assert not df.empty
    assert "subject" in df.columns
    assert "side" in df.columns
    
    # Check that 1001 points exist for pelvis, hip, knee, ankle
    assert "aSagP_pct_GC_0" in df.columns
    assert "aSagP_pct_GC_1000" in df.columns
    assert "aSagH_pct_GC_500" in df.columns
    assert "aSagK_pct_GC_1000" in df.columns
    assert "aSagA_pct_GC_0" in df.columns

def test_get_patient_discrete_summary():
    df_base = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_Baseline.csv")
    df_vr = load_discrete_dataset(DATA_DIR / "Discrete_Parameters_VR.csv")
    
    subjects = df_base["subject"].unique()
    assert len(subjects) == 29
    
    first_subject = subjects[0]
    summary = get_patient_discrete_summary(df_base, df_vr, first_subject)
    
    assert summary["subject"] == first_subject
    assert "baseline_gps" in summary
    assert "vr_gps" in summary
    assert "delta_amin_sagh" in summary
    assert "delta_gvs_pelvis" in summary
    assert summary["cycles_baseline"] > 0
    assert summary["cycles_vr"] > 0
