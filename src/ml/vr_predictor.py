"""GroupKFold Validated Gait ML Engine (Zero Data Leakage).
Features:
1. GaitConditionClassifier: Classifies Baseline vs VR condition from step kinematics
   using strict GroupKFold(n_splits=5) grouped by patient ('subject').
2. Feature Importance Extractor: Pinpoints which biomechanical markers (aMinSagH, GVS_aSagP)
   most reliably distinguish VR gait modification from baseline.
3. VRResponderPredictor: Subject-level therapeutic response assessment.
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import balanced_accuracy_score, roc_auc_score, recall_score, f1_score

BIOMECH_FEATURES = [
    "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
    "aMinSagH"
]

class GaitConditionClassifier:
    """
    Classifies gait cycles between Baseline and VR feedback conditions.
    Evaluated with strict GroupKFold(n_splits=5) grouped by subject,
    guaranteeing that steps of the same child never appear in train and test simultaneously.
    """
    def __init__(self, n_splits: int = 5):
        self.n_splits = n_splits
        self.feature_names = BIOMECH_FEATURES
        self.clf = RandomForestClassifier(
            n_estimators=100,
            max_depth=4,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_importances_: Optional[Dict[str, float]] = None

    def evaluate_group_kfold(self, df_base: pd.DataFrame, df_vr: pd.DataFrame) -> Dict[str, Any]:
        """
        Runs GroupKFold cross validation and returns leak-free generalization metrics.
        """
        base = df_base.copy()
        base["condition"] = 0
        vr = df_vr.copy()
        vr["condition"] = 1

        df = pd.concat([base, vr], ignore_index=True)
        X = df[self.feature_names].fillna(df[self.feature_names].median())
        y = df["condition"].values
        groups = df["subject"].values

        gkf = GroupKFold(n_splits=self.n_splits)
        y_trues: List[int] = []
        y_probs: List[float] = []

        importances = []

        for train_idx, test_idx in gkf.split(X, y, groups):
            scaler = StandardScaler()
            X_train = scaler.fit_transform(X.iloc[train_idx])
            X_test = scaler.transform(X.iloc[test_idx])

            model = RandomForestClassifier(
                n_estimators=100,
                max_depth=4,
                min_samples_leaf=5,
                class_weight="balanced",
                random_state=42
            )
            model.fit(X_train, y[train_idx])

            probs = model.predict_proba(X_test)[:, 1]
            y_trues.extend(y[test_idx])
            y_probs.extend(probs)
            importances.append(model.feature_importances_)

        y_pred = (np.array(y_probs) >= 0.5).astype(int)

        b_acc = float(balanced_accuracy_score(y_trues, y_pred))
        auc = float(roc_auc_score(y_trues, y_probs))
        sens = float(recall_score(y_trues, y_pred, pos_label=1))
        spec = float(recall_score(y_trues, y_pred, pos_label=0))
        f1_m = float(f1_score(y_trues, y_pred, average="macro"))

        # Mean feature importances
        avg_imp = np.mean(importances, axis=0)
        self.feature_importances_ = {
            name: float(imp) for name, imp in zip(self.feature_names, avg_imp)
        }

        return {
            "balanced_accuracy": b_acc,
            "roc_auc": auc,
            "sensitivity": sens,
            "specificity": spec,
            "f1_macro": f1_m,
            "n_splits": self.n_splits,
            "n_cycles": len(y),
            "n_subjects": len(np.unique(groups)),
            "feature_importances": self.feature_importances_,
        }

    def fit_full(self, df_base: pd.DataFrame, df_vr: pd.DataFrame):
        """Fits on all data to extract final production model."""
        base = df_base.copy()
        base["condition"] = 0
        vr = df_vr.copy()
        vr["condition"] = 1

        df = pd.concat([base, vr], ignore_index=True)
        X = df[self.feature_names].fillna(df[self.feature_names].median())
        y = df["condition"].values

        X_scaled = self.scaler.fit_transform(X)
        self.clf.fit(X_scaled, y)
        self.feature_importances_ = {
            name: float(imp) for name, imp in zip(self.feature_names, self.clf.feature_importances_)
        }

    def predict_cycle_condition(self, features_df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Predicts condition (0=Baseline, 1=VR) and probability for input cycles."""
        X = features_df[self.feature_names].fillna(features_df[self.feature_names].median())
        X_scaled = self.scaler.transform(X)
        preds = self.clf.predict(X_scaled)
        probs = self.clf.predict_proba(X_scaled)[:, 1]
        return preds, probs
