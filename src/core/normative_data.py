"""Parametric pediatric normative gait reference model for Typically Developing (TD) healthy children.
Provides reference mean curves and +/- 1 SD corridors for:
- Pelvis tilt (aSagP)
- Hip flexion/extension (aSagH)
- Knee flexion/extension (aSagK)
- Ankle dorsi/plantarflexion (aSagA)
- Hip sagittal moment (mSagH)

Calibrated against clinical gait cycle landmarks (Initial Contact, Loading Response,
Mid-Stance, Terminal Stance, Push-Off, Mid-Swing) from pediatric biomechanics standards
(Winter / Schwartz et al., 2008).
"""

from typing import Dict, Any
import numpy as np
from scipy.interpolate import CubicSpline


def _periodic_spline(landmarks_pct: list[float], values: list[float], t: np.ndarray) -> np.ndarray:
    """Evaluates a periodic cubic spline through gait cycle landmarks (0% == 100%)."""
    x = np.asarray(landmarks_pct, dtype=float)
    y = np.asarray(values, dtype=float)
    return CubicSpline(x, y, bc_type="periodic")(t)


def generate_normative_curves(n_points: int = 1001) -> Dict[str, Dict[str, Any]]:
    """
    Generates reference normative kinematic profiles (mean and std corridor)
    normalized across 0.0% to 100.0% of the gait cycle.
    """
    t = np.linspace(0.0, 100.0, n_points)

    # 1. Pelvis Sagittal Angle (Pelvic Tilt): steady ~10.5 deg anterior tilt, ~2.4 deg ROM
    pelvis_mean = 10.5 + 1.2 * np.sin(2 * np.pi * t / 100.0 - 0.5)
    pelvis_std = np.full(n_points, 4.2)

    # 2. Hip Sagittal Angle (Hip Flexion/Extension): ~32 deg IC -> -3.5 deg terminal stance (52%) -> ~33 deg swing
    hip_mean = _periodic_spline(
        [0, 10, 25, 40, 52, 62, 75, 88, 95, 100],
        [32.0, 28.0, 16.0, 4.0, -3.5, 2.0, 17.0, 30.0, 33.0, 32.0],
        t,
    )
    hip_std = np.full(n_points, 5.0)

    # 3. Knee Sagittal Angle (Knee Flexion/Extension):
    # ~5 deg IC -> ~17 deg loading response (15%) -> ~4-5.5 deg terminal stance (42-50%) -> ~58 deg swing (72%)
    knee_mean = _periodic_spline(
        [0, 8, 15, 28, 42, 50, 60, 72, 85, 95, 100],
        [5.0, 11.0, 17.0, 10.0, 4.0, 5.5, 34.0, 58.0, 28.0, 7.0, 5.0],
        t,
    )
    knee_std = np.full(n_points, 5.5)

    # 4. Ankle Sagittal Angle (Dorsi/Plantarflexion):
    # 0 deg IC -> -4.5 deg loading plantarflexion -> +10 deg dorsiflexion (50%) -> -11 deg push-off (64%) -> ~0.5 deg swing (75%)
    ankle_mean = _periodic_spline(
        [0, 7, 15, 25, 42, 50, 58, 64, 75, 88, 100],
        [0.0, -4.5, -1.5, 4.0, 10.5, 10.0, -2.0, -11.0, 0.5, 2.0, 0.0],
        t,
    )
    ankle_std = np.full(n_points, 4.0)

    # 5. Hip Sagittal Moment (mSagH - internal extensor/flexor moment, Nm/kg)
    hip_moment_mean = 0.85 * np.cos(2 * np.pi * t / 100.0) - 0.35 * np.sin(2 * np.pi * t / 100.0)
    hip_moment_std = np.full(n_points, 0.22)

    return {
        "aSagP": {
            "mean": pelvis_mean,
            "std": pelvis_std,
            "upper": pelvis_mean + pelvis_std,
            "lower": pelvis_mean - pelvis_std,
            "unit": "°",
            "name_ru": "Наклон таза (Pelvic Tilt)",
            "name_kz": "Жамбас еңкеюі (Pelvic Tilt)",
            "name_en": "Pelvic Tilt (aSagP)",
        },
        "aSagH": {
            "mean": hip_mean,
            "std": hip_std,
            "upper": hip_mean + hip_std,
            "lower": hip_mean - hip_std,
            "unit": "°",
            "name_ru": "Сгибание/Разгибание бедра",
            "name_kz": "Санның бүгілуі/жазылуы",
            "name_en": "Hip Flexion/Extension (aSagH)",
        },
        "aSagK": {
            "mean": knee_mean,
            "std": knee_std,
            "upper": knee_mean + knee_std,
            "lower": knee_mean - knee_std,
            "unit": "°",
            "name_ru": "Сгибание/Разгибание колена",
            "name_kz": "Тізенің бүгілуі/жазылуы",
            "name_en": "Knee Flexion/Extension (aSagK)",
        },
        "aSagA": {
            "mean": ankle_mean,
            "std": ankle_std,
            "upper": ankle_mean + ankle_std,
            "lower": ankle_mean - ankle_std,
            "unit": "°",
            "name_ru": "Тыльное/Подошвенное сгибание стопы",
            "name_kz": "Тобық бүгілуі/жазылуы",
            "name_en": "Ankle Dorsi/Plantarflexion (aSagA)",
        },
        "mSagH": {
            "mean": hip_moment_mean,
            "std": hip_moment_std,
            "upper": hip_moment_mean + hip_moment_std,
            "lower": hip_moment_mean - hip_moment_std,
            "unit": "Nm/kg",
            "name_ru": "Момент разгибания бедра",
            "name_kz": "Сан жазылу моменті",
            "name_en": "Hip Sagittal Moment (mSagH)",
        },
    }


NORMATIVE_PROFILES = generate_normative_curves(1001)
