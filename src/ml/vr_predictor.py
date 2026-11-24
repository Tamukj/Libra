"""GroupKFold Validated Gait ML Engine (Zero Data Leakage).
Features:
1. GaitConditionClassifier: Classifies Baseline vs VR condition from step kinematics
   using strict GroupKFold(n_splits=5) grouped by patient ('subject').
2. Feature Importance Extractor: Pinpoints which biomechanical markers (aMinSagH, GVS_aSagP)
   most reliably distinguish VR gait modification from baseline.
3. VRResponderPredictor: Subject-level therapeutic response assessment.
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, LeaveOneOut
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import balanced_accuracy_score, roc_auc_score, recall_score, f1_score
from src.core.biomechanics import compute_pcr

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
        self.imputer = SimpleImputer(strategy="median")
        self.feature_importances_: Optional[Dict[str, float]] = None

    def evaluate_group_kfold(self, df_base: pd.DataFrame, df_vr: pd.DataFrame) -> Dict[str, Any]:
        """
        Runs GroupKFold cross validation and returns leak-free generalization metrics.
        Imputation and scaling are performed strictly inside each training fold.
        """
        base = df_base.copy()
        base["condition"] = 0
        vr = df_vr.copy()
        vr["condition"] = 1

        df = pd.concat([base, vr], ignore_index=True)
        X = df[self.feature_names]
        y = df["condition"].values
        groups = df["subject"].values

        gkf = GroupKFold(n_splits=self.n_splits)
        y_trues: List[int] = []
        y_probs: List[float] = []

        importances = []

        for train_idx, test_idx in gkf.split(X, y, groups):
            fold_imputer = SimpleImputer(strategy="median")
            fold_scaler = StandardScaler()
            X_train = fold_scaler.fit_transform(fold_imputer.fit_transform(X.iloc[train_idx]))
            X_test = fold_scaler.transform(fold_imputer.transform(X.iloc[test_idx]))

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
        X = df[self.feature_names]
        y = df["condition"].values

        X_imputed = self.imputer.fit_transform(X)
        X_scaled = self.scaler.fit_transform(X_imputed)
        self.clf.fit(X_scaled, y)
        self.feature_importances_ = {
            name: float(imp) for name, imp in zip(self.feature_names, self.clf.feature_importances_)
        }

    def predict_cycle_condition(self, features_df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Predicts condition (0=Baseline, 1=VR) and probability for input cycles."""
        X = features_df[self.feature_names]
        X_imputed = self.imputer.transform(X)
        X_scaled = self.scaler.transform(X_imputed)
        preds = self.clf.predict(X_scaled)
        probs = self.clf.predict_proba(X_scaled)[:, 1]
        return preds, probs


class VRResponderPredictor:
    """
    Subject-level Clinical Decision Support (CDSS) predictor.
    Predicts BEFORE therapy whether a child with CP will achieve true therapeutic response
    (d_hip <= -1.0 deg AND PCR < 0.8: genuine hip extension) vs high-risk compensation or non-response.
    """
    def __init__(self):
        self.feature_names = [
            "weight", "height", "LegLength",
            "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
            "aMinSagH"
        ]
        self.clf = LogisticRegression(class_weight="balanced", C=1.0, random_state=42)
        self.scaler = StandardScaler()
        self.imputer = SimpleImputer(strategy="median")
        self.is_fitted = False
        self.metrics_: Dict[str, float] = {}

    def fit_evaluate_subjects(self, df_base: pd.DataFrame, df_vr: pd.DataFrame) -> Dict[str, Any]:
        """
        Builds subject-level cohort dataset and evaluates LOO (Leave-One-Subject-Out) performance.
        Data imputation and scaling are strictly performed within training folds.
        """
        subjects = df_base["subject"].dropna().unique()
        X_rows = []
        y_labels = []
        subject_ids = []

        for sub in subjects:
            sb = df_base[df_base["subject"] == sub]
            sv = df_vr[df_vr["subject"] == sub]
            if sb.empty or sv.empty:
                continue

            # Target computation from actual VR response
            d_hip = float(sv["aMinSagH"].mean() - sb["aMinSagH"].mean())
            d_p = float(sv["GVS_aSagP"].mean() - sb["GVS_aSagP"].mean())
            d_k = float(sv["GVS_aSagK"].mean() - sb["GVS_aSagK"].mean())
            d_a = float(sv["GVS_aSagA"].mean() - sb["GVS_aSagA"].mean())
            pcr = compute_pcr(d_p, d_k, d_a, d_hip)

            # True responder: clinically meaningful hip extension gain (d_hip <= -1.0 deg)
            # AND no dangerous pelvic tilt compensation (pcr < 0.8)
            is_gain = d_hip <= -1.0
            label = 1 if (is_gain and pcr < 0.8) else 0

            # Baseline predictors
            row = {}
            for feat in self.feature_names:
                row[feat] = float(sb[feat].dropna().mean()) if feat in sb.columns else np.nan

            X_rows.append(row)
            y_labels.append(label)
            subject_ids.append(sub)

        X_df = pd.DataFrame(X_rows)
        y = np.array(y_labels)

        # Cross validation LOO across subjects with strict fold isolation
        loo = LeaveOneOut()
        y_preds = []
        y_probs = []

        for train_idx, test_idx in loo.split(X_df):
            fold_imputer = SimpleImputer(strategy="median")
            fold_scaler = StandardScaler()
            X_tr = fold_scaler.fit_transform(fold_imputer.fit_transform(X_df.iloc[train_idx]))
            X_te = fold_scaler.transform(fold_imputer.transform(X_df.iloc[test_idx]))

            model = LogisticRegression(class_weight="balanced", C=1.0, random_state=42)
            model.fit(X_tr, y[train_idx])
            p = model.predict_proba(X_te)[0, 1]
            y_probs.append(p)
            y_preds.append(int(p >= 0.5))

        b_acc = float(balanced_accuracy_score(y, y_preds))
        try:
            auc = float(roc_auc_score(y, y_probs))
        except Exception:
            auc = float("nan")

        # Fit final model on all subjects
        X_all_imputed = self.imputer.fit_transform(X_df)
        X_all_scaled = self.scaler.fit_transform(X_all_imputed)
        self.clf.fit(X_all_scaled, y)
        self.is_fitted = True
        self.metrics_ = {
            "balanced_accuracy": b_acc,
            "roc_auc": auc,
            "n_subjects": len(y),
            "n_responders": int(np.sum(y == 1)),
            "n_compensators": int(np.sum(y == 0)),
        }
        return self.metrics_

    def predict_subject_response(self, patient_data: Union[pd.DataFrame, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Predicts clinical VR response probability for a patient given baseline features.
        """
        if not self.is_fitted:
            raise RuntimeError("VRResponderPredictor must be fitted before inference.")

        feature_map = {
            "weight": "weight",
            "height": "height",
            "LegLength": "leg_length",
            "GPS_a": "baseline_gps",
            "GVS_aSagP": "baseline_gvs_pelvis",
            "GVS_aSagH": "baseline_gvs_hip",
            "GVS_aSagK": "baseline_gvs_knee",
            "GVS_aSagA": "baseline_gvs_ankle",
            "aMinSagH": "baseline_amin_sagh",
        }

        row = {}
        for feat in self.feature_names:
            alt_key = feature_map.get(feat, feat)
            if isinstance(patient_data, pd.DataFrame):
                if feat in patient_data.columns:
                    val = patient_data[feat].dropna().mean()
                elif alt_key in patient_data.columns:
                    val = patient_data[alt_key].dropna().mean()
                else:
                    val = np.nan
            else:
                val = patient_data.get(feat, patient_data.get(alt_key, np.nan))
            if val is not None:
                try:
                    f_val = float(val)
                    row[feat] = f_val if not np.isnan(f_val) else np.nan
                except (ValueError, TypeError):
                    row[feat] = np.nan
            else:
                row[feat] = np.nan

        feat_vec = pd.DataFrame([row])[self.feature_names]
        feat_imputed = self.imputer.transform(feat_vec)
        feat_scaled = self.scaler.transform(feat_imputed)
        prob = float(self.clf.predict_proba(feat_scaled)[0, 1])
        is_resp = bool(prob >= 0.5)

        # Analytical Closed-Form Feature Attributions (Exact Linear XAI without heavy dependencies)
        coefs = self.clf.coef_[0]
        attributions = []
        for idx, feat in enumerate(self.feature_names):
            x_val = float(feat_imputed[0, idx])
            z_val = float(feat_scaled[0, idx])
            phi = float(coefs[idx] * z_val)
            attributions.append({
                "feature": feat,
                "value": round(x_val, 2),
                "z_score": round(z_val, 2),
                "attribution": round(phi, 3),
                "direction": "fosters_responder" if phi > 0 else "increases_compensation_risk"
            })
        attributions.sort(key=lambda item: abs(item["attribution"]), reverse=True)

        return {
            "responder_probability": prob,
            "is_predicted_responder": is_resp,
            "feature_attributions": attributions,
            "clinical_status_ru": "Благоприятный отклик (True Responder)" if is_resp else "Высокий риск компенсации таза (High Compensation Risk)",
            "clinical_status_kz": "Оң клиникалық жауап (True Responder)" if is_resp else "Жамбастың компенсациялық қаупі жоғары (High Compensation Risk)",
            "recommendation_ru": "Рекомендован стандартный протокол VR-тренировок с биообратной связью." if is_resp else "Рекомендована коррекция целевого угла аватара (-30%) во избежание гиперлордоза.",
            "recommendation_kz": "Биологиялық кері байланысы бар стандартты VR-жаттығу хаттамасы ұсынылады." if is_resp else "Гиперлордоздың алдын алу үшін аватардың мақсатты бұрышын азайту (-30%) ұсынылады.",
        }
