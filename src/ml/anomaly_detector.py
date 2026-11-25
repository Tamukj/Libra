"""Kinematic PCA Anomaly & Step Fatigue Detector.
Detects unstable gait cycles, tripping, and loss of postural control
based on Squared Prediction Error (SPE / Q-statistic) of kinematic curves.
"""

from typing import Dict, Any, Optional, List
import numpy as np
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.model_selection import GroupKFold


class KinematicPCAAnomalyDetector:
    """
    Unsupervised gait stability guardian.
    Models normal multi-joint kinematic manifolds using Principal Component Analysis (PCA).
    Unstable or fatigued steps deviate from the manifold, exhibiting high reconstruction error.
    """

    def __init__(self, n_components: int = 6, percentile_threshold: float = 95.0):
        self.n_components = n_components
        self.percentile_threshold = percentile_threshold
        self.pca = PCA(n_components=n_components, random_state=42)
        self.imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        self.threshold: Optional[float] = None
        self._single_sample_center: Optional[np.ndarray] = None

    def fit(self, curves: np.ndarray):
        """
        Fits PCA on baseline stable gait cycle curves.
        curves: 2D array of shape (n_cycles, n_points), e.g. (870, 51).
        """
        arr = np.atleast_2d(np.asarray(curves, dtype=float))
        if arr.size == 0 or arr.shape[0] == 0:
            raise ValueError("Cannot fit KinematicPCAAnomalyDetector on 0 gait cycles.")

        arr = np.where(np.isfinite(arr), arr, np.nan)
        valid_rows = ~np.isnan(arr).all(axis=1)
        arr = arr[valid_rows]
        if arr.shape[0] == 0:
            raise ValueError("Cannot fit KinematicPCAAnomalyDetector: all gait cycles are NaN.")

        clean_curves = self.imputer.fit_transform(arr)
        n_samples, n_features = clean_curves.shape

        if n_samples == 1:
            # Degenerate 1-cycle manifold: store center and avoid NaN explained_variance_
            self._single_sample_center = clean_curves[0].copy()
            self.pca = PCA(n_components=1, random_state=42)
            self.pca.mean_ = clean_curves[0].copy()
            self.pca.components_ = np.zeros((1, n_features), dtype=float)
            self.pca.explained_variance_ = np.array([0.0], dtype=float)
            self.pca.explained_variance_ratio_ = np.array([0.0], dtype=float)
            self.pca.n_features_in_ = n_features
            self.threshold = 0.0
            return self

        self._single_sample_center = None
        n_comp = min(self.n_components, max(1, n_samples - 1), n_features)
        self.pca = PCA(n_components=n_comp, random_state=42)
        projected = self.pca.fit_transform(clean_curves)
        reconstructed = self.pca.inverse_transform(projected)

        spe = np.sum((clean_curves - reconstructed) ** 2, axis=1)
        self.threshold = float(np.percentile(spe, self.percentile_threshold))
        return self

    def detect(self, curves: np.ndarray) -> Dict[str, Any]:
        """Evaluates test gait cycles and flags anomalies exceeding the threshold."""
        if self.threshold is None:
            raise RuntimeError("Anomaly detector must be fitted before running detection.")

        arr = np.asarray(curves, dtype=float)
        if arr.size == 0 or len(arr) == 0:
            return {
                "is_anomaly": np.array([], dtype=bool),
                "reconstruction_error": np.array([], dtype=float),
                "threshold": self.threshold,
                "anomaly_rate": 0.0,
                "n_anomalies": 0,
                "n_total": 0,
            }

        arr_2d = np.where(np.isfinite(np.atleast_2d(arr)), np.atleast_2d(arr), np.nan)
        all_nan_mask = np.isnan(arr_2d).all(axis=1)
        clean_curves = self.imputer.transform(arr_2d)

        if self._single_sample_center is not None:
            spe = np.sum((clean_curves - self._single_sample_center[None, :]) ** 2, axis=1)
        else:
            projected = self.pca.transform(clean_curves)
            reconstructed = self.pca.inverse_transform(projected)
            spe = np.sum((clean_curves - reconstructed) ** 2, axis=1)

        if all_nan_mask.any():
            spe = spe.astype(float)
            spe[all_nan_mask] = np.inf

        is_anomaly = spe > self.threshold

        return {
            "is_anomaly": is_anomaly,
            "reconstruction_error": spe,
            "threshold": self.threshold,
            "anomaly_rate": float(np.mean(is_anomaly)),
            "n_anomalies": int(np.sum(is_anomaly)),
            "n_total": len(clean_curves),
        }

    def evaluate_group_kfold(
        self,
        curves: np.ndarray,
        groups: np.ndarray,
        n_splits: int = 5,
    ) -> Dict[str, Any]:
        """Evaluates out-of-fold Baseline anomaly rate under strict subject-level GroupKFold isolation."""
        valid_mask = np.array(
            [g is not None and not (isinstance(g, float) and np.isnan(g)) for g in groups],
            dtype=bool,
        )
        curves = curves[valid_mask]
        groups = np.asarray(groups)[valid_mask]
        unique_groups = np.unique(groups)
        n_subjects = len(unique_groups)
        if n_subjects < 2:
            return {
                "oof_baseline_anomaly_rate": 0.0,
                "fold_rates": [],
                "n_splits": 0,
                "n_subjects": n_subjects,
                "n_cycles": len(curves),
            }

        eff_splits = min(n_splits, n_subjects)
        gkf = GroupKFold(n_splits=eff_splits)
        fold_rates: List[float] = []
        oof_anomalies: List[bool] = []

        for train_idx, test_idx in gkf.split(curves, groups=groups):
            fold_det = KinematicPCAAnomalyDetector(
                n_components=self.n_components,
                percentile_threshold=self.percentile_threshold,
            ).fit(curves[train_idx])
            res = fold_det.detect(curves[test_idx])
            fold_rates.append(float(res["anomaly_rate"]))
            oof_anomalies.extend(bool(x) for x in res["is_anomaly"])

        return {
            "oof_baseline_anomaly_rate": float(np.mean(oof_anomalies)) if oof_anomalies else 0.0,
            "fold_rates": [round(r, 4) for r in fold_rates],
            "n_splits": eff_splits,
            "n_subjects": n_subjects,
            "n_cycles": len(curves),
        }
