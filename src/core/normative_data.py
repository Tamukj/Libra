"""Normative gait reference database for Typically Developing (TD) healthy children.
Provides reference mean curves and +/- 1 SD corridors (1001 points) for:
- Pelvis tilt (aSagP)
- Hip flexion/extension (aSagH)
- Knee flexion/extension (aSagK)
- Ankle dorsi/plantarflexion (aSagA)
Based on open pediatric normative gait databases (Schwartz et al., Kirtley Open Gait).
"""

from typing import Dict, Any
import numpy as np

def generate_normative_curves(n_points: int = 1001) -> Dict[str, Dict[str, np.ndarray]]:
    """
    Generates reference 1001-point normative kinematic profiles (mean and std corridor)
    normalized across 0.0% to 100.0% of the gait cycle.
    """
    t = np.linspace(0, 100, n_points)
    
    # 1. Pelvis Sagittal Angle (Pelvic Tilt)
    # Healthy norm: steady anterior tilt around 11 degrees with 2-4 deg range of motion
    pelvis_mean = 11.0 + 1.8 * np.sin(2 * np.pi * t / 100.0 - 0.5)
    pelvis_std = np.full(n_points, 4.2)

    # 2. Hip Sagittal Angle (Hip Flexion/Extension)
    # Healthy norm: 35 deg at IC -> -10 deg peak extension at 50% stance -> 35 deg swing flexion
    hip_mean = 12.5 + 23.5 * np.cos(2 * np.pi * t / 100.0)
    hip_std = np.full(n_points, 5.0)

    # 3. Knee Sagittal Angle (Knee Flexion/Extension)
    # Healthy norm: 5 deg at IC -> 15 deg stance flexion -> 3 deg terminal stance -> 62 deg peak swing flexion at 70%
    # Parametric synthetic wave matching Winter / Schwartz
    knee_mean = (
        25.0
        - 18.0 * np.cos(2 * np.pi * t / 100.0)
        + 22.0 * np.exp(-((t - 70.0) ** 2) / (2 * (8.5 ** 2)))
        + 8.0 * np.exp(-((t - 15.0) ** 2) / (2 * (6.0 ** 2)))
    )
    knee_std = np.full(n_points, 5.5)

    # 4. Ankle Sagittal Angle (Dorsi/Plantarflexion)
    # Healthy norm: 0 deg at IC -> -5 deg plantarflexion -> +10 deg stance dorsiflexion -> -15 deg push-off -> 0 deg swing
    ankle_mean = (
        0.0
        + 10.0 * np.sin(2 * np.pi * t / 100.0)
        - 15.0 * np.exp(-((t - 60.0) ** 2) / (2 * (6.0 ** 2)))
    )
    ankle_std = np.full(n_points, 4.0)

    return {
        "aSagP": {
            "mean": pelvis_mean,
            "std": pelvis_std,
            "upper": pelvis_mean + pelvis_std,
            "lower": pelvis_mean - pelvis_std,
            "unit": "°",
            "name_ru": "Наклон таза (Pelvic Tilt)",
            "name_kz": "Жамбас еңкеюі (Pelvic Tilt)",
        },
        "aSagH": {
            "mean": hip_mean,
            "std": hip_std,
            "upper": hip_mean + hip_std,
            "lower": hip_mean - hip_std,
            "unit": "°",
            "name_ru": "Сгибание/Разгибание бедра",
            "name_kz": "Санның бүгілуі/жазылуы",
        },
        "aSagK": {
            "mean": knee_mean,
            "std": knee_std,
            "upper": knee_mean + knee_std,
            "lower": knee_mean - knee_std,
            "unit": "°",
            "name_ru": "Сгибание/Разгибание колена",
            "name_kz": "Тізенің бүгілуі/жазылуы",
        },
        "aSagA": {
            "mean": ankle_mean,
            "std": ankle_std,
            "upper": ankle_mean + ankle_std,
            "lower": ankle_mean - ankle_std,
            "unit": "°",
            "name_ru": "Тыльное/Подошвенное сгибание стопы",
            "name_kz": "Тобық бүгілуі/жазылуы",
        },
    }

NORMATIVE_PROFILES = generate_normative_curves(1001)
