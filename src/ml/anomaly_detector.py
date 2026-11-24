"""Kinematic PCA Anomaly & Step Fatigue Detector.
Detects unstable gait cycles, tripping, and loss of postural control
based on Squared Prediction Error (SPE / Q-statistic) of kinematic curves.
"""

from typing import Dict, Any, Optional
import numpy as np
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer

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
        curves: 2D array of shape (n_cycles, n_points), e.g. (870, 1001).
        """
        clean_curves = self.imputer.fit_transform(curves)
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

        clean_curves = self.imputer.transform(curves)
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
            "n_total": len(curves),
        }
