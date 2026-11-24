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
        self.imputer = SimpleImputer(strategy="median")
        self.threshold: Optional[float] = None

    def fit(self, curves: np.ndarray):
        """
        Fits PCA on baseline stable gait cycle curves.
        curves: 2D array of shape (n_cycles, n_points), e.g. (870, 51).
        """
        clean_curves = self.imputer.fit_transform(curves)
        n_samples, n_features = clean_curves.shape
        n_comp = min(self.n_components, max(1, n_samples - 1), n_features)
        self.pca = PCA(n_components=n_comp, random_state=42)
        projected = self.pca.fit_transform(clean_curves)
        reconstructed = self.pca.inverse_transform(projected)

        # Squared Prediction Error (SPE)
        spe = np.sum((clean_curves - reconstructed) ** 2, axis=1)
        self.threshold = float(np.percentile(spe, self.percentile_threshold))
        return self

    def detect(self, curves: np.ndarray) -> Dict[str, Any]:
        """
        Evaluates test gait cycles and flags anomalies exceeding the threshold.
        """
        if self.threshold is None:
            raise RuntimeError("Anomaly detector must be fitted before running detection.")

        if len(curves) == 0:
            return {
                "is_anomaly": np.array([], dtype=bool),
                "reconstruction_error": np.array([], dtype=float),
                "threshold": self.threshold,
                "anomaly_rate": 0.0,
                "n_anomalies": 0,
                "n_total": 0,
            }

        clean_curves = self.imputer.transform(np.atleast_2d(np.asarray(curves, dtype=float)))
        projected = self.pca.transform(clean_curves)
        reconstructed = self.pca.inverse_transform(projected)

        spe = np.sum((clean_curves - reconstructed) ** 2, axis=1)
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
        """
        Evaluates out-of-fold Baseline anomaly rate under strict subject-level GroupKFold isolation.
        """
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
