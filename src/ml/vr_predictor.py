"""GroupKFold Validated Gait ML Engine (Zero Data Leakage).
Features:
1. GaitConditionClassifier: Classifies Baseline vs VR condition from step kinematics
   using strict GroupKFold(n_splits=5) grouped by patient ('subject').
2. Feature Importance Extractor: Pinpoints which biomechanical markers (aMinSagH, GVS_aSagP)
   most reliably distinguish VR gait modification from baseline.
3. VRResponderPredictor: Subject-level therapeutic response assessment aligned with CDSS.
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
from src.core.biomechanics import analyze_compensation_risk, is_finite_number

BIOMECH_FEATURES = [
    "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
    "aMinSagH",
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

    kin_aligned = df_kin
    has_sub_cols = "subject" in df_disc.columns and "subject" in df_kin.columns
    if len(df_kin) != len(df_disc) or (
        has_sub_cols and not np.array_equal(df_disc["subject"].astype(str).values, df_kin["subject"].astype(str).values)
    ):
        if has_sub_cols:
            disc_key = df_disc.assign(_sub=df_disc["subject"].astype(str), _occ=df_disc.groupby("subject").cumcount())
            kin_key = df_kin.assign(_sub=df_kin["subject"].astype(str), _occ=df_kin.groupby("subject").cumcount())
            kin_aligned = disc_key[["_sub", "_occ"]].merge(kin_key, on=["_sub", "_occ"], how="left")
            kin_aligned.index = df_disc.index
        else:
            kin_aligned = df_kin.reset_index(drop=True).reindex(range(len(df_disc)))
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
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        self.kin_clf = LogisticRegression(
            C=0.2,
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
        )
        self.kin_scaler = StandardScaler()
        self.kin_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        self.kin_feature_names: Optional[List[str]] = None
        self.kin_fitted = False
        self.single_class_: Optional[int] = None
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
                df_base["subject"].values if "subject" in df_base.columns else np.zeros(len(df_base), dtype=int),
                df_vr["subject"].values if "subject" in df_vr.columns else np.ones(len(df_vr), dtype=int),
            ])
        else:
            base = df_base.copy()
            base["condition"] = 0
            vr = df_vr.copy()
            vr["condition"] = 1
            df = pd.concat([base, vr], ignore_index=True)
            X = df[self.feature_names]
            y = df["condition"].values
            groups = df["subject"].values if "subject" in df.columns else np.zeros(len(df), dtype=int)

        n_groups = len(np.unique(groups)) if len(groups) > 0 else 0
        if n_groups < 2 or len(np.unique(y)) < 2:
            self.fit_full(df_base, df_vr, df_kin_base=df_kin_base, df_kin_vr=df_kin_vr)
            return {
                "balanced_accuracy": 0.5,
                "roc_auc": 0.5,
                "sensitivity": 0.0,
                "specificity": 0.0,
                "f1_macro": 0.0,
                "n_splits": 0,
                "n_cycles": len(y),
                "n_subjects": n_groups,
                "feature_importances": self.feature_importances_ or {f: 0.0 for f in self.feature_names},
            }

        effective_splits = min(self.n_splits, n_groups)
        gkf = GroupKFold(n_splits=effective_splits)
        y_trues: List[int] = []
        y_probs: List[float] = []
        importances: List[np.ndarray] = []

        for train_idx, test_idx in gkf.split(X, y, groups):
            y_train = y[train_idx]
            if len(np.unique(y_train)) < 2:
                const_prob = float(y_train[0]) if len(y_train) > 0 else 0.5
                y_trues.extend(y[test_idx])
                y_probs.extend([const_prob] * len(test_idx))
                continue

            fold_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
            fold_scaler = StandardScaler()
            X_train = fold_scaler.fit_transform(fold_imputer.fit_transform(X.iloc[train_idx]))
            X_test = fold_scaler.transform(fold_imputer.transform(X.iloc[test_idx]))

            if use_kin:
                model = LogisticRegression(C=0.2, class_weight="balanced", max_iter=1000, random_state=42)
            else:
                model = RandomForestClassifier(
                    n_estimators=100, max_depth=4, min_samples_leaf=5,
                    class_weight="balanced", random_state=42,
                )
            model.fit(X_train, y_train)

            probs = model.predict_proba(X_test)[:, 1]
            y_trues.extend(y[test_idx])
            y_probs.extend(probs)
            if use_kin:
                importances.append(np.abs(model.coef_[0]))
            else:
                importances.append(model.feature_importances_)

        y_pred = (np.array(y_probs) >= 0.5).astype(int)
        y_true_arr = np.array(y_trues, dtype=int)

        b_acc = float(balanced_accuracy_score(y_true_arr, y_pred)) if len(y_true_arr) > 0 else 0.5
        auc = float(roc_auc_score(y_true_arr, y_probs)) if len(np.unique(y_true_arr)) >= 2 else 0.5
        sens = float(recall_score(y_true_arr, y_pred, pos_label=1, zero_division=0))
        spec = float(recall_score(y_true_arr, y_pred, pos_label=0, zero_division=0))
        f1_m = float(f1_score(y_true_arr, y_pred, average="macro", zero_division=0))

        self.fit_full(df_base, df_vr, df_kin_base=df_kin_base, df_kin_vr=df_kin_vr)

        if importances:
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
        """Runs 3-class GroupKFold cross validation (Baseline=0, Verbal=1, VR=2) grouped by subject."""
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

        n_groups = len(np.unique(groups)) if len(groups) > 0 else 0
        if n_groups < 2 or len(np.unique(y)) < 2:
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
            y_train = y[train_idx]
            if len(np.unique(y_train)) < 2:
                const_cls = int(y_train[0]) if len(y_train) > 0 else 0
                y_trues.extend(y[test_idx])
                y_preds.extend([const_cls] * len(test_idx))
                continue

            fold_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
            fold_scaler = StandardScaler()
            X_train = fold_scaler.fit_transform(fold_imputer.fit_transform(X.iloc[train_idx]))
            X_test = fold_scaler.transform(fold_imputer.transform(X.iloc[test_idx]))

            if use_kin:
                model = LogisticRegression(C=0.2, class_weight="balanced", max_iter=1000, random_state=42)
            else:
                model = RandomForestClassifier(
                    n_estimators=100, max_depth=4, min_samples_leaf=5,
                    class_weight="balanced", random_state=42,
                )
            model.fit(X_train, y_train)
            y_trues.extend(y[test_idx])
            y_preds.extend(model.predict(X_test))

        return {
            "balanced_accuracy": float(balanced_accuracy_score(y_trues, y_preds)),
            "f1_macro": float(f1_score(y_trues, y_preds, average="macro", zero_division=0)),
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

        if len(y) == 0 or len(np.unique(y)) < 2:
            self.single_class_ = int(y[0]) if len(y) > 0 else 0
            self.kin_fitted = False
            self.feature_importances_ = {name: 0.0 for name in self.feature_names}
            return

        self.single_class_ = None
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
        if self.single_class_ is not None:
            n = len(features_df)
            return np.full(n, self.single_class_, dtype=int), np.full(n, float(self.single_class_), dtype=float)

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
    Predicts BEFORE therapy whether a child with CP will achieve genuine therapeutic response
    (d_hip <= -1.0 deg AND CDSS status != 'red') vs high-risk pelvic compensation or non-response.
    """

    KINEMATIC_FEATURES = ["GPS_a", "GVS_aSagP", "aMinSagH", "pelvis_mean", "hip_rom"]
    CORE_DISCRETE_FEATURES = ["GPS_a", "GVS_aSagP", "aMinSagH"]
    DISCRETE_FALLBACK_FEATURES = [
        "weight", "height", "LegLength",
        "GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA",
        "aMinSagH",
    ]

    def __init__(self):
        self.feature_names = list(self.DISCRETE_FALLBACK_FEATURES)
        self.reg_c = 1.0
        self.clf = LogisticRegression(class_weight="balanced", C=self.reg_c, random_state=42)
        self.scaler = StandardScaler()
        self.imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        # Dedicated discrete-only fallback model when kinematic curves are unavailable
        self.disc_feature_names = list(self.CORE_DISCRETE_FEATURES)
        self.disc_clf = LogisticRegression(class_weight="balanced", C=1.0, random_state=42)
        self.disc_scaler = StandardScaler()
        self.disc_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        self.disc_fitted = False
        self.active_train_cols_: Optional[set[str]] = None
        self.is_fitted = False
        self.metrics_: Dict[str, Any] = {}

    @staticmethod
    def _extract_subject_kin_stats(df_kin_sub: pd.DataFrame) -> Dict[str, float]:
        if df_kin_sub is None or df_kin_sub.empty:
            return {"pelvis_mean": np.nan, "hip_rom": np.nan}
        p_cols = [c for c in df_kin_sub.columns if c.startswith("aSagP_pct_GC_")]
        h_cols = [c for c in df_kin_sub.columns if c.startswith("aSagH_pct_GC_")]
        p_vals = df_kin_sub[p_cols].values if p_cols else np.array([])
        p_mean = float(np.nanmean(p_vals)) if (p_vals.size > 0 and not np.isnan(p_vals).all()) else np.nan
        if h_cols:
            h_vals = df_kin_sub[h_cols].values
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=RuntimeWarning)
                roms = np.nanmax(h_vals, axis=1) - np.nanmin(h_vals, axis=1)
                valid_roms = roms[np.isfinite(roms)]
                h_rom = float(np.mean(valid_roms)) if valid_roms.size > 0 else np.nan
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
        Target label is strictly aligned with CDSS compensation rules (never responder=1 when CDSS='red').
        """
        use_kin = df_kin_base is not None and not df_kin_base.empty
        self.feature_names = list(self.KINEMATIC_FEATURES) if use_kin else list(self.DISCRETE_FALLBACK_FEATURES)
        self.reg_c = 0.5 if use_kin else 1.0
        self.clf = LogisticRegression(class_weight="balanced", C=self.reg_c, random_state=42)

        subjects = df_base["subject"].dropna().unique()
        X_rows: List[Dict[str, float]] = []
        X_disc_rows: List[Dict[str, float]] = []
        y_labels: List[int] = []

        for sub in subjects:
            sb = df_base[df_base["subject"] == sub]
            sv = df_vr[df_vr["subject"] == sub]
            if sb.empty or sv.empty:
                continue

            d_hip = float(sv["aMinSagH"].mean() - sb["aMinSagH"].mean())
            d_p = float(sv["GVS_aSagP"].mean() - sb["GVS_aSagP"].mean())
            d_k = float(sv["GVS_aSagK"].mean() - sb["GVS_aSagK"].mean())
            d_a = float(sv["GVS_aSagA"].mean() - sb["GVS_aSagA"].mean())
            cdss_risk = analyze_compensation_risk(d_hip, d_p, d_k, d_a)

            # Align target strictly with CDSS: gain achieved AND no pelvic overload ('red')
            label = 1 if (d_hip <= -1.0 and cdss_risk["status"] != "red") else 0

            kin_stats = (
                self._extract_subject_kin_stats(df_kin_base[df_kin_base["subject"] == sub])
                if use_kin
                else {}
            )
            row: Dict[str, float] = {}
            for feat in self.feature_names:
                if feat in kin_stats:
                    row[feat] = kin_stats[feat]
                elif feat in sb.columns and not sb[feat].dropna().empty:
                    row[feat] = float(sb[feat].dropna().mean())
                else:
                    row[feat] = np.nan

            disc_row = {
                feat: (float(sb[feat].dropna().mean()) if feat in sb.columns and not sb[feat].dropna().empty else np.nan)
                for feat in self.disc_feature_names
            }

            X_rows.append(row)
            X_disc_rows.append(disc_row)
            y_labels.append(label)

        X_df = pd.DataFrame(X_rows)
        X_disc_df = pd.DataFrame(X_disc_rows)
        y = np.array(y_labels)
        feature_mode = "kinematics_biomech" if use_kin else "discrete_fallback"

        if len(y) == 0:
            self.is_fitted = False
            self.disc_fitted = False
            self.metrics_ = {
                "balanced_accuracy": 0.0,
                "roc_auc": float("nan"),
                "n_subjects": 0,
                "n_responders": 0,
                "n_compensators": 0,
                "feature_mode": feature_mode,
            }
            return self.metrics_

        if len(np.unique(y)) < 2:
            # Single-class cohort cannot be cross-validated reliably; never report fake 1.0 accuracy
            self.is_fitted = False
            self.disc_fitted = False
            self.metrics_ = {
                "balanced_accuracy": 0.0,
                "roc_auc": float("nan"),
                "n_subjects": len(y),
                "n_responders": int(np.sum(y == 1)),
                "n_compensators": int(np.sum(y == 0)),
                "feature_mode": feature_mode,
            }
            return self.metrics_

        loo = LeaveOneOut()
        y_preds: List[int] = []
        y_probs: List[float] = []

        for train_idx, test_idx in loo.split(X_df):
            if len(np.unique(y[train_idx])) < 2:
                maj = int(y[train_idx][0])
                y_probs.append(float(maj))
                y_preds.append(maj)
                continue

            fold_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
            fold_scaler = StandardScaler()
            X_tr = fold_scaler.fit_transform(fold_imputer.fit_transform(X_df.iloc[train_idx]))
            X_te = fold_scaler.transform(fold_imputer.transform(X_df.iloc[test_idx]))

            model = LogisticRegression(class_weight="balanced", C=self.reg_c, random_state=42)
            model.fit(X_tr, y[train_idx])
            p = float(model.predict_proba(X_te)[0, 1])
            y_probs.append(p)
            y_preds.append(int(p >= 0.5))

        b_acc = float(balanced_accuracy_score(y, y_preds))
        try:
            auc = float(roc_auc_score(y, y_probs))
        except Exception:
            auc = float("nan")

        self.active_train_cols_ = {
            c for c in self.feature_names if c in X_df.columns and X_df[c].notna().any()
        }
        X_all_imputed = self.imputer.fit_transform(X_df)
        X_all_scaled = self.scaler.fit_transform(X_all_imputed)
        self.clf.fit(X_all_scaled, y)
        self.is_fitted = True

        # Fit discrete-only fallback model when primary model requires kinematic curves
        if use_kin and not X_disc_df.empty:
            X_d_imp = self.disc_imputer.fit_transform(X_disc_df)
            X_d_sc = self.disc_scaler.fit_transform(X_d_imp)
            self.disc_clf.fit(X_d_sc, y)
            self.disc_fitted = True
        else:
            self.disc_fitted = False

        self.metrics_ = {
            "balanced_accuracy": b_acc,
            "roc_auc": auc,
            "n_subjects": len(y),
            "n_responders": int(np.sum(y == 1)),
            "n_compensators": int(np.sum(y == 0)),
            "feature_mode": feature_mode,
        }
        return self.metrics_

    def _extract_input_row(
        self,
        patient_data: Union[pd.DataFrame, Dict[str, Any]],
        cols: List[str],
        kin_stats: Dict[str, float],
    ) -> Dict[str, float]:
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
        row: Dict[str, float] = {}
        for feat in cols:
            alt_key = feature_map.get(feat, feat)
            if isinstance(patient_data, pd.DataFrame):
                if feat in patient_data.columns:
                    clean = pd.to_numeric(patient_data[feat], errors="coerce").dropna()
                    val = float(clean.mean()) if not clean.empty else np.nan
                elif alt_key in patient_data.columns:
                    clean = pd.to_numeric(patient_data[alt_key], errors="coerce").dropna()
                    val = float(clean.mean()) if not clean.empty else np.nan
                elif feat in kin_stats:
                    val = kin_stats[feat]
                else:
                    val = np.nan
            else:
                val = patient_data.get(feat, patient_data.get(alt_key, np.nan))
            row[feat] = float(val) if is_finite_number(val) else np.nan
        return row

    def predict_subject_response(self, patient_data: Union[pd.DataFrame, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Predicts clinical VR response probability for a patient given baseline features.
        Raises ValueError on empty input or missing required features rather than silently
        hallucinating via median imputation.
        """
        if not self.is_fitted:
            raise RuntimeError("VRResponderPredictor must be fitted before inference.")

        if isinstance(patient_data, pd.DataFrame):
            if patient_data.empty:
                raise ValueError("Cannot predict responder probability on empty DataFrame.")
            kin_stats = self._extract_subject_kin_stats(patient_data)
        elif isinstance(patient_data, dict):
            if not patient_data:
                raise ValueError("Cannot predict responder probability on empty dictionary.")
            kin_stats = {}
        else:
            raise TypeError("patient_data must be a pandas DataFrame or dictionary.")

        primary_row = self._extract_input_row(patient_data, self.feature_names, kin_stats)

        # If model uses kinematic features, verify whether pelvis_mean/hip_rom are present
        missing_kin = any(
            not is_finite_number(primary_row.get(k))
            for k in ("pelvis_mean", "hip_rom")
            if k in self.feature_names
        )

        if missing_kin and self.disc_fitted:
            disc_row = self._extract_input_row(patient_data, self.disc_feature_names, kin_stats)
            missing_disc = [f for f in self.disc_feature_names if not is_finite_number(disc_row.get(f))]
            if missing_disc:
                raise ValueError(f"Missing required baseline features for prediction: {missing_disc}")
            used_cols = self.disc_feature_names
            feat_vec = pd.DataFrame([disc_row])[used_cols]
            feat_imputed = self.disc_imputer.transform(feat_vec)
            feat_scaled = self.disc_scaler.transform(feat_imputed)
            model = self.disc_clf
            used_mode = "discrete_fallback"
        else:
            required_cols = (
                [c for c in self.feature_names if c in self.active_train_cols_]
                if self.active_train_cols_ is not None
                else list(self.feature_names)
            )
            missing_primary = [f for f in required_cols if not is_finite_number(primary_row.get(f))]
            if missing_primary:
                raise ValueError(f"Missing required baseline features for prediction: {missing_primary}")
            used_cols = self.feature_names
            feat_vec = pd.DataFrame([primary_row])[used_cols]
            feat_imputed = self.imputer.transform(feat_vec)
            feat_scaled = self.scaler.transform(feat_imputed)
            model = self.clf
            used_mode = "kinematics_biomech" if "pelvis_mean" in self.feature_names else "discrete_fallback"

        prob = float(model.predict_proba(feat_scaled)[0, 1])
        is_resp = bool(prob >= 0.5)

        coefs = model.coef_[0]
        attributions = []
        for idx, feat in enumerate(used_cols):
            x_val = float(feat_imputed[0, idx])
            z_val = float(feat_scaled[0, idx])
            phi = float(coefs[idx] * z_val)
            attributions.append({
                "feature": feat,
                "value": round(x_val, 2),
                "z_score": round(z_val, 2),
                "attribution": round(phi, 3),
                "direction": "fosters_responder" if phi > 0 else "increases_compensation_risk",
            })
        attributions.sort(key=lambda item: abs(item["attribution"]), reverse=True)

        raw_bacc = self.metrics_.get("balanced_accuracy", 0.0)
        raw_auc = self.metrics_.get("roc_auc", float("nan"))
        bacc_val = float(raw_bacc) if is_finite_number(raw_bacc) else 0.0
        auc_valid = is_finite_number(raw_auc)
        auc_val = float(raw_auc) if auc_valid else 0.5
        model_reliable = bool(auc_valid and auc_val >= 0.75)

        result: Dict[str, Any] = {
            "responder_probability": prob,
            "is_predicted_responder": is_resp,
            "loo_balanced_accuracy": bacc_val,
            "loo_roc_auc": auc_val,
            "model_reliable": model_reliable,
            "feature_mode": used_mode,
            "feature_attributions": attributions,
            "clinical_status_ru": "Благоприятный прогноз отклика на VR" if is_resp else "Высокий риск компенсации таза",
            "clinical_status_kz": "VR-терапияға оң жауап болжамы" if is_resp else "Жамбас компенсациясының жоғары қаупі",
            "clinical_status_en": "Favorable VR response prognosis" if is_resp else "High pelvic compensation risk",
            "recommendation_ru": (
                "Рекомендован стандартный протокол VR-тренировок с обратной связью под контролем врача."
                if is_resp
                else "Рекомендована консультация врача-реабилитолога и возможная коррекция целевого угла и нагрузки тренажера во избежание гиперлордоза (п. 8.2)."
            ),
            "recommendation_kz": (
                "Дәрігер бақылауымен стандартты VR-жаттығу хаттамасы ұсынылады."
                if is_resp
                else "Гиперлордоздың алдын алу үшін дәрігермен келісіп тренажердің мақсатты бұрышы мен жүктемесін түзету мүмкіндігін қарастыру ұсынылады (8.2-т.)."
            ),
            "recommendation_en": (
                "Standard VR biofeedback protocol under physician oversight is advised."
                if is_resp
                else "Physician review and potential adjustment of VR target angle or cue intensity advised to avoid hyperlordosis (Rule 8.2)."
            ),
        }
        if not model_reliable:
            result["note"] = (
                f"Ограничение выборки (n={self.metrics_.get('n_subjects', 29)}): LOO ROC-AUC={auc_val:.3f} < 0.75; "
                "прогноз носит ориентировочный характер и не заменяет показатели CDSS (TJE/PCR)."
            )
            result["note_kz"] = (
                f"Іріктеме шектеуі (n={self.metrics_.get('n_subjects', 29)}): LOO ROC-AUC={auc_val:.3f} < 0.75; "
                "болжам бағдарлық сипатта, негізгі шешім CDSS (TJE/PCR) бойынша қабылданады."
            )
            result["note_en"] = (
                f"Small-cohort caveat (n={self.metrics_.get('n_subjects', 29)}): LOO ROC-AUC={auc_val:.3f} < 0.75; "
                "exploratory prognosis only—anchor clinical decisions to CDSS (TJE/PCR)."
            )
        return result
