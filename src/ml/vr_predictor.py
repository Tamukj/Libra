"""GroupKFold Validated Gait ML Engine (Zero Data Leakage).
Features:
1. GaitConditionClassifier: Classifies Baseline vs VR condition from step kinematics
   using strict GroupKFold(n_splits=5) grouped by patient ('subject').
2. Feature Importance Extractor: Pinpoints which biomechanical markers (aMinSagH, GVS_aSagP)
   most reliably distinguish VR gait modification from baseline.
3. VRResponderPredictor: Subject-level therapeutic response assessment.
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import warnings
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

KINEMATIC_JOINTS = ["aSagP", "aSagH", "aSagK", "aSagA", "mSagH"]


def _extract_waveform_features(df_disc: pd.DataFrame, df_kin: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts discrete gait parameters plus per-cycle kinematic waveform summary features
    (mean, std, min, max, rom, terminal stance 15:26 mean) aligned with df_disc rows.
    """
    feats = pd.DataFrame(index=df_disc.index)
    for col in BIOMECH_FEATURES:
        feats[col] = pd.to_numeric(df_disc[col], errors="coerce") if col in df_disc.columns else np.nan
    feats["pctmZeroStSagH"] = (
        pd.to_numeric(df_disc["pctmZeroStSagH"], errors="coerce")
        if "pctmZeroStSagH" in df_disc.columns
        else np.nan
    )

    # Align kinematics rows to discrete rows either positionally or by (subject, cycle_idx)
    kin_aligned = df_kin
    if len(df_kin) != len(df_disc) or not (
        "subject" in df_disc.columns
        and "subject" in df_kin.columns
        and np.array_equal(df_disc["subject"].astype(str).values, df_kin["subject"].astype(str).values)
    ):
        disc_key = df_disc.assign(_sub=df_disc["subject"].astype(str), _occ=df_disc.groupby("subject").cumcount())
        kin_key = df_kin.assign(_sub=df_kin["subject"].astype(str), _occ=df_kin.groupby("subject").cumcount())
        kin_aligned = disc_key[["_sub", "_occ"]].merge(kin_key, on=["_sub", "_occ"], how="left")
        kin_aligned.index = df_disc.index

    for joint in KINEMATIC_JOINTS:
        cols = sorted(
            [c for c in kin_aligned.columns if c.startswith(f"{joint}_pct_GC_")],
            key=lambda x: int(x.split("_pct_GC_")[1]),
        )
        if not cols:
            for suffix in ("mean", "std", "min", "max", "rom", "term15_26_mean"):
                feats[f"{joint}_{suffix}"] = np.nan
            continue

        arr = kin_aligned[cols].to_numpy(dtype=float)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            j_mean = np.nanmean(arr, axis=1)
            j_std = np.nanstd(arr, axis=1)
            j_min = np.nanmin(arr, axis=1)
            j_max = np.nanmax(arr, axis=1)
            j_rom = j_max - j_min
            term_slice = arr[:, 15:26] if arr.shape[1] >= 26 else arr
            j_term = np.nanmean(term_slice, axis=1)

        feats[f"{joint}_mean"] = j_mean
        feats[f"{joint}_std"] = j_std
        feats[f"{joint}_min"] = j_min
        feats[f"{joint}_max"] = j_max
        feats[f"{joint}_rom"] = j_rom
        feats[f"{joint}_term15_26_mean"] = j_term

    return feats


def _aggregate_coef_importances(feature_cols: List[str], abs_coefs: np.ndarray) -> Dict[str, float]:
    """Aggregates absolute linear model weights into clinical feature importances summing to 1.0."""
    total = float(np.sum(abs_coefs))
    if total <= 0.0 or not np.isfinite(total):
        uniform = 1.0 / (len(BIOMECH_FEATURES) + 2)
        out = {f: uniform for f in BIOMECH_FEATURES}
        out["pctmZeroStSagH"] = uniform
        out["kinematic_waveforms"] = uniform
        return out

    normed = abs_coefs / total
    grouped: Dict[str, float] = {f: 0.0 for f in BIOMECH_FEATURES}
    grouped["pctmZeroStSagH"] = 0.0
    grouped["kinematic_waveforms"] = 0.0
    for col, weight in zip(feature_cols, normed):
        if col in grouped:
            grouped[col] += float(weight)
        else:
            grouped["kinematic_waveforms"] += float(weight)
    return grouped


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
        self.kin_clf = LogisticRegression(
            C=0.2,
            class_weight="balanced",
            max_iter=1000,
            random_state=42
        )
        self.kin_scaler = StandardScaler()
        self.kin_imputer = SimpleImputer(strategy="median")
        self.kin_feature_names: Optional[List[str]] = None
        self.kin_fitted = False
        self.feature_importances_: Optional[Dict[str, float]] = None

    def evaluate_group_kfold(
        self,
        df_base: pd.DataFrame,
        df_vr: pd.DataFrame,
        df_kin_base: Optional[pd.DataFrame] = None,
        df_kin_vr: Optional[pd.DataFrame] = None,
    ) -> Dict[str, Any]:
        """
        Runs GroupKFold cross validation and returns leak-free generalization metrics.
        Imputation and scaling are performed strictly inside each training fold.
        Uses LogisticRegression + kinematic waveform summaries when df_kin_base/df_kin_vr are provided,
        or discrete-only RandomForest when omitted.
        """
        use_kin = df_kin_base is not None and df_kin_vr is not None
        if use_kin:
            X_base = _extract_waveform_features(df_base, df_kin_base)
            X_vr = _extract_waveform_features(df_vr, df_kin_vr)
            X = pd.concat([X_base, X_vr], ignore_index=True)
            y = np.concatenate([
                np.zeros(len(df_base), dtype=int),
                np.ones(len(df_vr), dtype=int),
            ])
            groups = np.concatenate([
                df_base["subject"].values,
                df_vr["subject"].values,
            ])
        else:
            base = df_base.copy()
            base["condition"] = 0
            vr = df_vr.copy()
            vr["condition"] = 1
            df = pd.concat([base, vr], ignore_index=True)
            X = df[self.feature_names]
            y = df["condition"].values
            groups = df["subject"].values

        n_groups = len(np.unique(groups))
        if n_groups < 2:
            self.fit_full(df_base, df_vr, df_kin_base=df_kin_base, df_kin_vr=df_kin_vr)
            return {
                "balanced_accuracy": 0.5,
                "roc_auc": 0.5,
                "sensitivity": 0.0,
                "specificity": 0.0,
                "f1_macro": 0.0,
                "n_splits": 0,
                "n_cycles": len(y),
            }
        effective_splits = min(self.n_splits, n_groups)
        gkf = GroupKFold(n_splits=effective_splits)
        y_trues: List[int] = []
        y_probs: List[float] = []

        importances = []

        for train_idx, test_idx in gkf.split(X, y, groups):
            fold_imputer = SimpleImputer(strategy="median")
            fold_scaler = StandardScaler()
            X_train = fold_scaler.fit_transform(fold_imputer.fit_transform(X.iloc[train_idx]))
            X_test = fold_scaler.transform(fold_imputer.transform(X.iloc[test_idx]))

            if use_kin:
                model = LogisticRegression(
                    C=0.2,
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=42
                )
            else:
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
            if use_kin:
                importances.append(np.abs(model.coef_[0]))
            else:
                importances.append(model.feature_importances_)

        y_pred = (np.array(y_probs) >= 0.5).astype(int)

        b_acc = float(balanced_accuracy_score(y_trues, y_pred))
        auc = float(roc_auc_score(y_trues, y_probs))
        sens = float(recall_score(y_trues, y_pred, pos_label=1))
        spec = float(recall_score(y_trues, y_pred, pos_label=0))
        f1_m = float(f1_score(y_trues, y_pred, average="macro"))

        # Fit full model so instance clf/scaler/imputer are ready for prediction
        self.fit_full(df_base, df_vr, df_kin_base=df_kin_base, df_kin_vr=df_kin_vr)

        # Mean feature importances across folds
        avg_imp = np.mean(importances, axis=0)
        if use_kin:
            self.feature_importances_ = _aggregate_coef_importances(list(X.columns), avg_imp)
        else:
            self.feature_importances_ = {
                name: float(imp) for name, imp in zip(self.feature_names, avg_imp)
            }

        return {
            "balanced_accuracy": b_acc,
            "roc_auc": auc,
            "sensitivity": sens,
            "specificity": spec,
            "f1_macro": f1_m,
            "n_splits": effective_splits,
            "n_cycles": len(y),
            "n_subjects": n_groups,
            "feature_importances": self.feature_importances_,
        }

    def evaluate_three_class_group_kfold(
        self,
        df_base: pd.DataFrame,
        df_verbal: pd.DataFrame,
        df_vr: pd.DataFrame,
        df_kin_base: Optional[pd.DataFrame] = None,
        df_kin_verbal: Optional[pd.DataFrame] = None,
        df_kin_vr: Optional[pd.DataFrame] = None,
    ) -> Dict[str, Any]:
        """
        Runs 3-class GroupKFold cross validation (Baseline=0, Verbal=1, VR=2) grouped by subject.
        Imputation and scaling are performed strictly inside each fold.
        """
        use_kin = df_kin_base is not None and df_kin_verbal is not None and df_kin_vr is not None
        if use_kin:
            X = pd.concat([
                _extract_waveform_features(df_base, df_kin_base),
                _extract_waveform_features(df_verbal, df_kin_verbal),
                _extract_waveform_features(df_vr, df_kin_vr),
            ], ignore_index=True)
        else:
            X = pd.concat([
                df_base[self.feature_names],
                df_verbal[self.feature_names],
                df_vr[self.feature_names],
            ], ignore_index=True)

        y = np.concatenate([
            np.zeros(len(df_base), dtype=int),
            np.ones(len(df_verbal), dtype=int),
            np.full(len(df_vr), 2, dtype=int),
        ])
        groups = np.concatenate([
            df_base["subject"].values,
            df_verbal["subject"].values,
            df_vr["subject"].values,
        ])

        n_groups = len(np.unique(groups))
        if n_groups < 2:
            return {
                "balanced_accuracy": 1.0 / 3.0,
                "f1_macro": 0.0,
                "n_splits": 0,
                "n_cycles": len(y),
                "n_subjects": n_groups,
                "classes": ["Baseline", "Verbal", "VR"],
            }

        effective_splits = min(self.n_splits, n_groups)
        gkf = GroupKFold(n_splits=effective_splits)
        y_trues: List[int] = []
        y_preds: List[int] = []

        for train_idx, test_idx in gkf.split(X, y, groups):
            fold_imputer = SimpleImputer(strategy="median")
            fold_scaler = StandardScaler()
            X_train = fold_scaler.fit_transform(fold_imputer.fit_transform(X.iloc[train_idx]))
            X_test = fold_scaler.transform(fold_imputer.transform(X.iloc[test_idx]))

            if use_kin:
                model = LogisticRegression(
                    C=0.2,
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=42
                )
            else:
                model = RandomForestClassifier(
                    n_estimators=100,
                    max_depth=4,
                    min_samples_leaf=5,
                    class_weight="balanced",
                    random_state=42
                )
            model.fit(X_train, y[train_idx])
            y_trues.extend(y[test_idx])
            y_preds.extend(model.predict(X_test))

        return {
            "balanced_accuracy": float(balanced_accuracy_score(y_trues, y_preds)),
            "f1_macro": float(f1_score(y_trues, y_preds, average="macro")),
            "n_splits": effective_splits,
            "n_cycles": len(y),
            "n_subjects": n_groups,
            "classes": ["Baseline", "Verbal", "VR"],
        }

    def fit_full(
        self,
        df_base: pd.DataFrame,
        df_vr: pd.DataFrame,
        df_kin_base: Optional[pd.DataFrame] = None,
        df_kin_vr: Optional[pd.DataFrame] = None,
    ):
        """Fits on all data to extract final production model (plus discrete-only fallback)."""
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

        if df_kin_base is not None and df_kin_vr is not None:
            X_kin_df = pd.concat([
                _extract_waveform_features(df_base, df_kin_base),
                _extract_waveform_features(df_vr, df_kin_vr),
            ], ignore_index=True)
            self.kin_feature_names = list(X_kin_df.columns)
            X_kin_imp = self.kin_imputer.fit_transform(X_kin_df)
            X_kin_sc = self.kin_scaler.fit_transform(X_kin_imp)
            self.kin_clf.fit(X_kin_sc, y)
            self.kin_fitted = True
            self.feature_importances_ = _aggregate_coef_importances(
                self.kin_feature_names,
                np.abs(self.kin_clf.coef_[0]),
            )
        else:
            self.kin_fitted = False

    def predict_cycle_condition(
        self,
        features_df: pd.DataFrame,
        df_kin: Optional[pd.DataFrame] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Predicts condition (0=Baseline, 1=VR) and probability for input cycles."""
        if df_kin is not None and self.kin_fitted and self.kin_feature_names is not None:
            X_kin_df = _extract_waveform_features(features_df, df_kin)[self.kin_feature_names]
            X_imputed = self.kin_imputer.transform(X_kin_df)
            X_scaled = self.kin_scaler.transform(X_imputed)
            preds = self.kin_clf.predict(X_scaled)
            probs = self.kin_clf.predict_proba(X_scaled)[:, 1]
            return preds, probs

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
    Uses 5 domain-grounded baseline biomechanical features (GPS_a, GVS_aSagP, aMinSagH, pelvis_mean, hip_rom)
    when kinematic curves are provided, or discrete-only fallback otherwise.
    """
    KINEMATIC_FEATURES = ["GPS_a", "GVS_aSagP", "aMinSagH", "pelvis_mean", "hip_rom"]
    DISCRETE_FALLBACK_FEATURES = [
        "weight", "height", "LegLength",
        "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
        "aMinSagH"
    ]

    def __init__(self):
        self.feature_names = list(self.DISCRETE_FALLBACK_FEATURES)
        self.reg_c = 1.0
        self.clf = LogisticRegression(class_weight="balanced", C=self.reg_c, random_state=42)
        self.scaler = StandardScaler()
        self.imputer = SimpleImputer(strategy="median")
        self.is_fitted = False
        self.metrics_: Dict[str, float] = {}

    @staticmethod
    def _extract_subject_kin_stats(df_kin_sub: pd.DataFrame) -> Dict[str, float]:
        if df_kin_sub is None or df_kin_sub.empty:
            return {"pelvis_mean": np.nan, "hip_rom": np.nan}
        p_cols = [c for c in df_kin_sub.columns if c.startswith("aSagP_pct_GC_")]
        h_cols = [c for c in df_kin_sub.columns if c.startswith("aSagH_pct_GC_")]
        p_mean = float(np.nanmean(df_kin_sub[p_cols].values)) if p_cols else np.nan
        if h_cols:
            h_vals = df_kin_sub[h_cols].values
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=RuntimeWarning)
                roms = np.nanmax(h_vals, axis=1) - np.nanmin(h_vals, axis=1)
                h_rom = float(np.nanmean(roms))
        else:
            h_rom = np.nan
        return {"pelvis_mean": p_mean, "hip_rom": h_rom}

    def fit_evaluate_subjects(
        self,
        df_base: pd.DataFrame,
        df_vr: pd.DataFrame,
        df_kin_base: Optional[pd.DataFrame] = None,
    ) -> Dict[str, Any]:
        """
        Builds subject-level cohort dataset and evaluates LOO (Leave-One-Subject-Out) performance.
        Data imputation and scaling are strictly performed within training folds.
        """
        use_kin = df_kin_base is not None and not df_kin_base.empty
        self.feature_names = list(self.KINEMATIC_FEATURES) if use_kin else list(self.DISCRETE_FALLBACK_FEATURES)
        self.reg_c = 0.5 if use_kin else 1.0
        self.clf = LogisticRegression(class_weight="balanced", C=self.reg_c, random_state=42)

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
            kin_stats = (
                self._extract_subject_kin_stats(df_kin_base[df_kin_base["subject"] == sub])
                if use_kin
                else {}
            )
            row = {}
            for feat in self.feature_names:
                if feat in kin_stats:
                    row[feat] = kin_stats[feat]
                else:
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

        if len(y) == 0:
            return {
                "balanced_accuracy": 0.0,
                "roc_auc": float("nan"),
                "n_subjects": 0,
                "n_responders": 0,
                "n_compensators": 0,
                "feature_mode": "kinematics_biomech" if use_kin else "discrete_fallback",
            }

        if len(np.unique(y)) < 2:
            y_preds = list(y)
            y_probs = [float(v) for v in y]
        else:
            for train_idx, test_idx in loo.split(X_df):
                if len(np.unique(y[train_idx])) < 2:
                    maj = int(y[train_idx][0])
                    y_probs.append(float(maj))
                    y_preds.append(maj)
                    continue

                fold_imputer = SimpleImputer(strategy="median")
                fold_scaler = StandardScaler()
                X_tr = fold_scaler.fit_transform(fold_imputer.fit_transform(X_df.iloc[train_idx]))
                X_te = fold_scaler.transform(fold_imputer.transform(X_df.iloc[test_idx]))

                model = LogisticRegression(class_weight="balanced", C=self.reg_c, random_state=42)
                model.fit(X_tr, y[train_idx])
                p = model.predict_proba(X_te)[0, 1]
                y_probs.append(p)
                y_preds.append(int(p >= 0.5))

        b_acc = float(balanced_accuracy_score(y, y_preds))
        try:
            auc = float(roc_auc_score(y, y_probs))
        except Exception:
            auc = float("nan")

        # Fit final model on all subjects if multiple classes exist
        X_all_imputed = self.imputer.fit_transform(X_df)
        X_all_scaled = self.scaler.fit_transform(X_all_imputed)
        if len(np.unique(y)) >= 2:
            self.clf.fit(X_all_scaled, y)
            self.is_fitted = True
        else:
            self.is_fitted = False
        self.metrics_ = {
            "balanced_accuracy": b_acc,
            "roc_auc": auc,
            "n_subjects": len(y),
            "n_responders": int(np.sum(y == 1)),
            "n_compensators": int(np.sum(y == 0)),
            "feature_mode": "kinematics_biomech" if use_kin else "discrete_fallback",
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
            "pelvis_mean": "baseline_pelvis_tilt",
            "hip_rom": "baseline_hip_rom",
        }

        kin_stats = self._extract_subject_kin_stats(patient_data) if isinstance(patient_data, pd.DataFrame) else {}

        row = {}
        for feat in self.feature_names:
            alt_key = feature_map.get(feat, feat)
            if isinstance(patient_data, pd.DataFrame):
                if feat in patient_data.columns:
                    val = patient_data[feat].dropna().mean()
                elif alt_key in patient_data.columns:
                    val = patient_data[alt_key].dropna().mean()
                elif feat in kin_stats:
                    val = kin_stats[feat]
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

        raw_bacc = self.metrics_.get("balanced_accuracy", 0.0)
        raw_auc = self.metrics_.get("roc_auc", float("nan"))
        bacc_val = 0.0 if (raw_bacc is None or np.isnan(raw_bacc) or not np.isfinite(raw_bacc)) else float(raw_bacc)
        auc_valid = raw_auc is not None and not np.isnan(raw_auc) and np.isfinite(raw_auc)
        auc_val = float(raw_auc) if auc_valid else 0.5
        model_reliable = bool(auc_valid and auc_val >= 0.60)

        return {
            "responder_probability": prob,
            "is_predicted_responder": is_resp,
            "loo_balanced_accuracy": bacc_val,
            "loo_roc_auc": auc_val,
            "model_reliable": model_reliable,
            "feature_attributions": attributions,
            "clinical_status_ru": "Благоприятный отклик (True Responder)" if is_resp else "Высокий риск компенсации таза (High Compensation Risk)",
            "clinical_status_kz": "Оң клиникалық жауап (True Responder)" if is_resp else "Жамбастың компенсациялық қаупі жоғары (High Compensation Risk)",
            "recommendation_ru": "Рекомендован стандартный протокол VR-тренировок с биообратной связью." if is_resp else "Рекомендована коррекция целевого угла аватара (-30%) во избежание гиперлордоза.",
            "recommendation_kz": "Биологиялық кері байланысы бар стандартты VR-жаттығу хаттамасы ұсынылады." if is_resp else "Гиперлордоздың алдын алу үшін аватардың мақсатты бұрышын азайту (-30%) ұсынылады.",
        }
