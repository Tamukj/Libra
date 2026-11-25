"""CSV ingestion, Law 94-V PII validation, size limiting, and atomic database upsert."""

import csv
import datetime
import io
import json
import math
import re
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from src.core.biomechanics import compute_curve_gvs_gps, compute_kinematic_summary_metrics, is_finite_number
from src.core.data_loader import clean_identifier_value
from src.core.normative_data import NORMATIVE_PROFILES
from src.database.models import Clinic, GaitSession, Patient
from src.api.services import default_visit_label, group_visits, parse_visit_suffix

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB cap per CSV upload

_CONDITION_MAP = {
    "baseline": "Baseline",
    "verbal": "Verbal",
    "vr": "VR",
}

_PII_NORMALIZED_TOKENS = {
    "iin", "иин", "жсн",
    "fio", "фио", "атыжөні", "аты", "тегі", "әкесініңаты",
    "fullname", "patientname", "firstname", "lastname", "middlename",
    "surname", "patronymic", "name", "фамилия", "имя", "отчество",
    "passport", "паспорт", "snils", "снилс",
    "address", "адрес", "мекенжай",
    "phone", "mobile", "cell", "tel", "телефон", "ұялы",
    "email", "mail", "почта",
    "dob", "birthdate", "dateofbirth", "datebirth", "childname", "датарождения", "туғанкүні",
}

_COLUMN_ALIASES: Dict[str, List[str]] = {
    "subject": ["subject", "patient_code", "patient_id", "code"],
    "side": ["side", "limb", "affected_side", "leg"],
    "weight": ["weight", "weight_kg", "mass", "mass_kg", "body_mass"],
    "height": ["height", "height_m", "stature"],
    "leg_length": ["LegLength", "leg_length", "leg_length_m", "leglength_m"],
    "GPS_a": ["GPS_a", "gps", "gps_deg", "gait_profile_score"],
    "GVS_aSagP": ["GVS_aSagP", "pelvis_gvs", "gvs_pelvis", "gvs_asagp", "pelvic_gvs"],
    "GVS_aSagH": ["GVS_aSagH", "hip_gvs", "gvs_hip", "gvs_asagh"],
    "GVS_aSagK": ["GVS_aSagK", "knee_gvs", "gvs_knee", "gvs_asagk"],
    "GVS_aSagA": ["GVS_aSagA", "ankle_gvs", "gvs_ankle", "gvs_asaga"],
    "aMinSagH": ["aMinSagH", "hip_min_ext", "hip_ext_min", "min_hip_ext", "amin_sagh"],
    "pctmZeroStSagH": ["pctmZeroStSagH", "pctm_zero_st_sagh", "pctm_zero", "hip_moment_zero_pct"],
    "pelvic_tilt_mean": ["pelvic_tilt_mean", "pelvis_tilt_mean", "pelvis_tilt", "pelvic_tilt"],
}

_SIDE_MAP = {
    "left": "LEFT", "l": "LEFT", "левая": "LEFT", "левый": "LEFT", "л": "LEFT", "сол": "LEFT",
    "right": "RIGHT", "r": "RIGHT", "правая": "RIGHT", "правый": "RIGHT", "п": "RIGHT", "оң": "RIGHT",
}


async def read_limited_upload(file: UploadFile, max_bytes: int = MAX_UPLOAD_BYTES) -> bytes:
    """Streams UploadFile in chunks and aborts immediately with 413 if it exceeds max_bytes."""
    chunks: List[bytes] = []
    total = 0
    chunk_size = 256 * 1024
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"CSV file exceeds maximum allowed size of {max_bytes // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _normalize_header_token(header: str) -> str:
    return re.sub(r"[^a-zа-яёәіңғүұқөһ0-9]", "", str(header).strip().lower())


def _detect_pii_columns(columns: List[Any]) -> List[str]:
    hits: List[str] = []
    for c in columns:
        norm = _normalize_header_token(str(c))
        if norm in _PII_NORMALIZED_TOKENS:
            hits.append(str(c))
            continue
        # Catch composite variants like patient_last_name, patient_dob, contact_phone
        parts = [p for p in re.split(r"[^a-zа-яёәіңғүұқөһ0-9]+", str(c).strip().lower()) if p]
        if any(p in _PII_NORMALIZED_TOKENS for p in parts if p not in {"name"}):
            hits.append(str(c))
        elif "name" in parts and "patient" in parts:
            hits.append(str(c))
    return hits


def _validate_non_pii_subject_code(target_code: str) -> None:
    if not target_code or not re.match(r"^[a-zA-Z0-9_\-]{1,64}$", target_code):
        raise HTTPException(
            status_code=400,
            detail="Invalid patient code. Allowed characters: alphanumeric, hyphens, and underscores (max 64 chars).",
        )
    digits_only = re.sub(r"[-_]", "", target_code)
    # Block 12-digit RK IIN (e.g. 090512501234 or 0905-1250-1234)
    if re.fullmatch(r"\d{12}", digits_only):
        raise HTTPException(
            status_code=400,
            detail="Law of RK No. 94-V violation: 12-digit IIN identifiers are prohibited in subject code.",
        )
    # Block embedded dates (YYYY-MM-DD / DD-MM-YYYY) or long phone-like sequences
    if re.search(r"(?:19|20)\d{2}[-_.]\d{2}[-_.]\d{2}", target_code) or re.search(
        r"\d{2}[-_.]\d{2}[-_.](?:19|20)\d{2}", target_code
    ):
        raise HTTPException(
            status_code=400,
            detail="Law of RK No. 94-V violation: personal name/birth-date identifiers are prohibited in subject code.",
        )
    if re.search(r"\d{10,}", digits_only):
        raise HTTPException(
            status_code=400,
            detail="Law of RK No. 94-V violation: numeric personal/phone identifiers are prohibited.",
        )


def _find_col_by_aliases(df: pd.DataFrame, canonical: str) -> Optional[str]:
    aliases = _COLUMN_ALIASES.get(canonical, [canonical])
    norm_to_col = {str(c).lstrip("\ufeff").strip().lower().replace("_", ""): c for c in df.columns}
    for alias in aliases:
        if alias in df.columns:
            return alias
        norm = alias.lower().replace("_", "")
        if norm in norm_to_col:
            return norm_to_col[norm]
    return None


def _parse_csv_bytes(contents: bytes) -> pd.DataFrame:
    if not contents or not contents.strip():
        raise HTTPException(status_code=400, detail="Invalid CSV: File is empty.")
    na_vals = ["NaN", "nan", "NULL", "null", ""]
    df: Optional[pd.DataFrame] = None
    try:
        df = pd.read_csv(
            io.BytesIO(contents),
            sep=None,
            decimal=",",
            engine="python",
            encoding="utf-8-sig",
            na_values=na_vals,
        )
    except (pd.errors.ParserError, pd.errors.EmptyDataError, csv.Error, UnicodeDecodeError, ValueError):
        try:
            df = pd.read_csv(io.BytesIO(contents), sep=";", decimal=",", encoding="utf-8-sig", na_values=na_vals)
        except (pd.errors.ParserError, pd.errors.EmptyDataError, csv.Error, UnicodeDecodeError, ValueError):
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=",", decimal=".", encoding="utf-8-sig", na_values=na_vals)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {exc}")
    df.columns = [str(c).lstrip("\ufeff").strip() for c in df.columns]
    return df


def _sanitize_json_matrix(arr: np.ndarray) -> List[List[Optional[float]]]:
    rows: List[List[Optional[float]]] = []
    for row in arr:
        rows.append([float(v) if math.isfinite(float(v)) else None for v in row])
    return rows


def _prepare_subject_payload(df_sub: pd.DataFrame, target_code: str) -> Dict[str, Any]:
    _validate_non_pii_subject_code(target_code)

    def _parse_optional(canonical: str, require_positive: bool = False) -> Optional[float]:
        col = _find_col_by_aliases(df_sub, canonical)
        if not col:
            return None
        s = df_sub[col].dropna()
        if s.empty:
            return None
        s_clean = pd.to_numeric(s.astype(str).str.replace(",", ".").str.strip(), errors="coerce").dropna()
        valid_nums = s_clean[np.isfinite(s_clean)]
        if valid_nums.empty:
            return None
        if (valid_nums.abs() > 1e6).any():
            raise HTTPException(
                status_code=400,
                detail="Invalid physiological measurement: value exceeds physical bounds.",
            )
        if require_positive and (valid_nums <= 0).any():
            raise HTTPException(
                status_code=400,
                detail="Invalid physiological measurements: weight, height, and leg length must be positive numbers.",
            )
        return float(valid_nums.mean())

    raw_weight = _parse_optional("weight", require_positive=True)
    raw_height = _parse_optional("height", require_positive=True)
    raw_leg = _parse_optional("leg_length", require_positive=True)
    has_weight = raw_weight is not None
    has_height = raw_height is not None
    has_leg = raw_leg is not None
    anthropometry_estimated = not (has_weight and has_height and has_leg)

    side_col = _find_col_by_aliases(df_sub, "side")
    parsed_side: Optional[str] = None
    if side_col and not df_sub[side_col].dropna().empty:
        raw_sides = {str(v).strip().lower() for v in df_sub[side_col].dropna() if str(v).strip()}
        mapped_sides = set()
        for rs in raw_sides:
            if rs not in _SIDE_MAP:
                raise HTTPException(status_code=400, detail="Invalid limb side value. Expected LEFT or RIGHT.")
            mapped_sides.add(_SIDE_MAP[rs])
        if len(mapped_sides) > 1:
            raise HTTPException(status_code=400, detail="Conflicting limb sides (LEFT and RIGHT) in same subject rows.")
        if mapped_sides:
            parsed_side = next(iter(mapped_sides))
    side_estimated = parsed_side is None

    curves_by_joint: Dict[str, np.ndarray] = {}
    kin_joints_payload: Dict[str, Dict[str, List[Optional[float]]]] = {}
    for joint in ("aSagP", "aSagH", "aSagK", "aSagA", "mSagH"):
        j_cols = sorted(
            [c for c in df_sub.columns if str(c).startswith(f"{joint}_pct_GC_")],
            key=lambda x: int(str(x).split("_pct_GC_")[1]) if str(x).split("_pct_GC_")[1].isdigit() else 0,
        )
        if len(j_cols) == 51:
            j_df = df_sub[j_cols].apply(
                lambda col: pd.to_numeric(col.astype(str).str.replace(",", ".").str.strip(), errors="coerce")
            )
            # Interpolate strictly internal gaps (no constant endpoint extrapolation)
            j_df = j_df.interpolate(method="linear", axis=1, limit_area="inside")
            arr = j_df.to_numpy(dtype=float)
            if arr.size > 0:
                valid_row_mask = ~np.isnan(arr).all(axis=1)
                arr_valid = arr[valid_row_mask]
                if arr_valid.size > 0:
                    curves_by_joint[joint] = arr_valid
                    mean_vec = np.nanmean(arr_valid, axis=0)
                    std_vec = np.nanstd(arr_valid, axis=0)
                    kin_joints_payload[joint] = {
                        "mean": [float(v) if math.isfinite(float(v)) else 0.0 for v in mean_vec],
                        "std": [float(v) if math.isfinite(float(v)) else 0.0 for v in std_vec],
                    }

    has_kin_waveforms = len(curves_by_joint) > 0
    derived_gvs = compute_curve_gvs_gps(curves_by_joint, NORMATIVE_PROFILES) if has_kin_waveforms else {}
    derived_kin_summary = compute_kinematic_summary_metrics(curves_by_joint) if has_kin_waveforms else {}

    # Preserve explicit 0.0 if parsed; fall back to curve-derived GPS only when None.
    raw_gps = _parse_optional("GPS_a")
    opt_gps = raw_gps if raw_gps is not None else derived_gvs.get("GPS_a")

    def _pick_metric(canonical: str, derived_key: str) -> Optional[float]:
        val = _parse_optional(canonical)
        return val if val is not None else derived_gvs.get(derived_key)

    opt_p = _pick_metric("GVS_aSagP", "GVS_aSagP")
    opt_h = _pick_metric("GVS_aSagH", "GVS_aSagH")
    opt_k = _pick_metric("GVS_aSagK", "GVS_aSagK")
    opt_a = _pick_metric("GVS_aSagA", "GVS_aSagA")
    raw_amin = _parse_optional("aMinSagH")
    opt_amin = raw_amin if raw_amin is not None else derived_kin_summary.get("aMinSagH")

    if all(v is None for v in (opt_gps, opt_p, opt_h, opt_k, opt_a, opt_amin)) and not has_kin_waveforms:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain at least one valid numeric gait metric column (GPS_a, aMinSagH, GVS_aSag*, or 51-pt *_pct_GC_* curves).",
        )

    present_gvs = [v for v in (opt_p, opt_h, opt_k, opt_a) if is_finite_number(v)]
    try:
        derived_gps = math.sqrt(sum(v ** 2 for v in present_gvs) / len(present_gvs)) if present_gvs else None
    except OverflowError:
        raise HTTPException(status_code=400, detail="Invalid physiological measurement: value exceeds physical bounds.")
    avg_gps = opt_gps if opt_gps is not None else derived_gps
    avg_pctm_zero = _parse_optional("pctmZeroStSagH")
    avg_pelvis_tilt = _parse_optional("pelvic_tilt_mean")
    if avg_pelvis_tilt is None:
        avg_pelvis_tilt = derived_kin_summary.get("pelvic_tilt_mean")

    # Count valid gait cycles (excluding all-NaN dropout rows)
    metric_cols = [
        _find_col_by_aliases(df_sub, c)
        for c in ("GPS_a", "GVS_aSagP", "GVS_aSagH", "GVS_aSagK", "GVS_aSagA", "aMinSagH", "pctmZeroStSagH")
    ]
    present_m_cols = [c for c in metric_cols if c is not None]
    if has_kin_waveforms:
        any_joint = next(iter(curves_by_joint.values()))
        valid_cycle_count = int(any_joint.shape[0])
    elif present_m_cols:
        num_df = df_sub[present_m_cols].apply(
            lambda col: pd.to_numeric(col.astype(str).str.replace(",", ".").str.strip(), errors="coerce")
        )
        valid_cycle_count = int(num_df.apply(lambda c: np.isfinite(c)).any(axis=1).sum())
    else:
        valid_cycle_count = len(df_sub)

    kinematics_json_str: Optional[str] = None
    if has_kin_waveforms:
        hip_cycles = _sanitize_json_matrix(curves_by_joint["aSagH"]) if "aSagH" in curves_by_joint else []
        kinematics_json_str = json.dumps(
            {
                "joints": kin_joints_payload,
                "hip_cycles": hip_cycles,
                "hip_rom": derived_kin_summary.get("hip_rom"),
            },
            allow_nan=False,
        )

    return {
        "code": target_code,
        "parsed_side": parsed_side,
        "side_estimated": side_estimated,
        "raw_weight": raw_weight,
        "has_weight": has_weight,
        "raw_height": raw_height,
        "has_height": has_height,
        "raw_leg": raw_leg,
        "has_leg": has_leg,
        "anthropometry_estimated": anthropometry_estimated,
        "has_kinematics": has_kin_waveforms,
        "cycle_count": valid_cycle_count,
        "avg_gps": avg_gps,
        "avg_amin_sagh": opt_amin,
        "avg_gvs_pelvis": opt_p,
        "avg_gvs_hip": opt_h,
        "avg_gvs_knee": opt_k,
        "avg_gvs_ankle": opt_a,
        "avg_pctm_zero": avg_pctm_zero,
        "avg_pelvis_tilt": avg_pelvis_tilt,
        "kinematics_json": kinematics_json_str,
    }


def prepare_csv_upload_payloads(
    contents: bytes,
    condition: str,
    subject_code: Optional[str],
    filename: Optional[str],
) -> Tuple[str, int, int, List[Dict[str, Any]]]:
    """Parses CSV bytes, checks RK Law 94-V PII rules, and prepares per-subject payloads in threadpool."""
    cond_key = (condition or "Baseline").strip().lower()
    if cond_key not in _CONDITION_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid condition '{condition}'. Allowed values: Baseline, Verbal, VR.",
        )
    normalized_condition = _CONDITION_MAP[cond_key]

    df_upload = _parse_csv_bytes(contents)
    df_upload = df_upload.dropna(how="all")
    if len(df_upload) == 0:
        raise HTTPException(status_code=400, detail="Invalid CSV: File contains no gait cycle data rows.")

    pii_hits = _detect_pii_columns(list(df_upload.columns))
    if pii_hits:
        raise HTTPException(
            status_code=400,
            detail=f"Law of RK No. 94-V violation: personal data columns are prohibited ({', '.join(pii_hits)}). Use anonymized subject codes only.",
        )

    for col in df_upload.columns:
        str_col = df_upload[col].astype(str).str.lower().str.strip()
        if str_col.isin(["inf", "-inf", "+inf", "infinity", "-infinity"]).any():
            raise HTTPException(status_code=400, detail=f"Invalid non-finite value in column {col}")

    explicit_code = (subject_code or "").strip()
    sub_col = _find_col_by_aliases(df_upload, "subject")

    payloads: List[Dict[str, Any]] = []
    if explicit_code:
        payloads.append(_prepare_subject_payload(df_upload, explicit_code))
    elif sub_col:
        df_work = df_upload.copy()
        df_work["_norm_sub"] = df_work[sub_col].apply(clean_identifier_value)
        clean_subs = [str(v) for v in df_work["_norm_sub"].dropna().unique() if str(v).strip()]
        if len(clean_subs) > 1:
            for sub_id in clean_subs:
                df_sub = df_work[df_work["_norm_sub"] == sub_id].drop(columns=["_norm_sub"])
                if not df_sub.empty:
                    payloads.append(_prepare_subject_payload(df_sub, sub_id))
        elif len(clean_subs) == 1:
            df_sub = df_work[df_work["_norm_sub"].isna() | (df_work["_norm_sub"] == clean_subs[0])].drop(columns=["_norm_sub"])
            payloads.append(_prepare_subject_payload(df_sub, clean_subs[0]))
        else:
            fallback_name = (filename or "patient").replace(".csv", "").strip()
            payloads.append(_prepare_subject_payload(df_upload, fallback_name))
    else:
        fallback_name = (filename or "patient").replace(".csv", "").strip()
        payloads.append(_prepare_subject_payload(df_upload, fallback_name))

    return normalized_condition, len(df_upload), len(df_upload.columns), payloads


def validate_visit_params(
    visit_key: Optional[str],
    visit_label: Optional[str],
    visit_date: Optional[str],
) -> Tuple[Optional[str], str, str]:
    """Validates optional visit_key, visit_label, and visit_date upload parameters at API boundary."""
    clean_vk = visit_key.strip() if visit_key is not None else ""
    norm_vk: Optional[str] = clean_vk if clean_vk else None
    if norm_vk is not None and norm_vk.lower() != "new":
        if not re.fullmatch(r"[a-zA-Z0-9_\-]{1,64}", norm_vk):
            raise HTTPException(
                status_code=400,
                detail="Invalid visit_key. Allowed characters: alphanumeric, hyphens, and underscores (max 64 chars).",
            )
    elif norm_vk is not None:
        norm_vk = "new"

    clean_vl = (visit_label or "").strip()[:128]
    clean_vd = (visit_date or "").strip()
    if clean_vd:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean_vd):
            raise HTTPException(status_code=400, detail="Invalid visit_date. Expected YYYY-MM-DD format.")
        try:
            datetime.date.fromisoformat(clean_vd)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid visit_date. Expected valid YYYY-MM-DD calendar date.")

    return norm_vk, clean_vl, clean_vd


def _resolve_patient_visit_target(
    existing_sessions: List[GaitSession],
    req_visit_key: Optional[str],
    req_visit_label: str,
    req_visit_date: str,
) -> Tuple[str, str, str, bool]:
    today_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    grouped = group_visits(existing_sessions)
    existing_by_key = dict(grouped)

    if req_visit_key == "new":
        existing_keys = set(existing_by_key.keys())
        nums = [n for vk in existing_keys if (n := parse_visit_suffix(vk)) > 0]
        next_n = (max(nums) if nums else len(existing_keys)) + 1
        resolved_vk = f"visit-{next_n}"
        while resolved_vk in existing_keys:
            next_n += 1
            resolved_vk = f"visit-{next_n}"
        resolved_vl = req_visit_label or f"Визит {next_n}"
        resolved_vd = req_visit_date or today_utc
        return resolved_vk, resolved_vl, resolved_vd, True

    if req_visit_key is None:
        if grouped:
            resolved_vk, target_sessions = grouped[-1]
            prev_vl = next((s.visit_label for s in target_sessions if getattr(s, "visit_label", "")), "")
            prev_vd = next((s.visit_date for s in target_sessions if getattr(s, "visit_date", "")), "")
            is_seeded = any(getattr(s, "source", "seeded") == "seeded" for s in target_sessions)
            resolved_vl = req_visit_label or prev_vl or default_visit_label(resolved_vk, is_seeded=is_seeded)
            resolved_vd = req_visit_date or prev_vd
            return resolved_vk, resolved_vl, resolved_vd, False
        resolved_vk = "visit-1"
        resolved_vl = req_visit_label or "Визит 1"
        resolved_vd = req_visit_date or today_utc
        return resolved_vk, resolved_vl, resolved_vd, True

    resolved_vk = req_visit_key
    target_sessions = existing_by_key.get(resolved_vk, [])
    visit_created = len(target_sessions) == 0
    if visit_created:
        resolved_vl = req_visit_label or default_visit_label(resolved_vk)
        resolved_vd = req_visit_date or today_utc
    else:
        prev_vl = next((s.visit_label for s in target_sessions if getattr(s, "visit_label", "")), "")
        prev_vd = next((s.visit_date for s in target_sessions if getattr(s, "visit_date", "")), "")
        is_seeded = any(getattr(s, "source", "seeded") == "seeded" for s in target_sessions)
        resolved_vl = req_visit_label or prev_vl or default_visit_label(resolved_vk, is_seeded=is_seeded)
        resolved_vd = req_visit_date or prev_vd
    return resolved_vk, resolved_vl, resolved_vd, visit_created


def persist_upload_payloads(
    db: Session,
    normalized_condition: str,
    payloads: List[Dict[str, Any]],
    visit_key: Optional[str] = None,
    visit_label: Optional[str] = None,
    visit_date: Optional[str] = None,
    clinic_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Atomically upserts Patient and longitudinal GaitSession rows using dialect-native ON CONFLICT."""
    norm_vk, clean_vl, clean_vd = validate_visit_params(visit_key, visit_label, visit_date)
    if clinic_id is None:
        default_clinic = db.query(Clinic).order_by(Clinic.id.asc()).first()
        clinic_id = default_clinic.id if default_clinic else None

    dialect = db.bind.dialect.name if db.bind is not None else "sqlite"
    insert_fn = pg_insert if dialect == "postgresql" else sqlite_insert

    results: List[Dict[str, Any]] = []
    try:
        for item in payloads:
            target_code = item["code"]
            existing_patient = db.query(Patient).filter(Patient.code == target_code).first()
            if (
                existing_patient is not None
                and item["parsed_side"] is not None
                and existing_patient.side in ("LEFT", "RIGHT")
                and existing_patient.side != item["parsed_side"]
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Conflicting limb side for patient {target_code}: existing {existing_patient.side}, uploaded {item['parsed_side']}.",
                )
            p_stmt = insert_fn(Patient).values(
                code=target_code,
                side=item["parsed_side"] or "UNSPECIFIED",
                weight=item["raw_weight"],
                height=item["raw_height"],
                leg_length=item["raw_leg"],
                anthropometry_estimated=item["anthropometry_estimated"],
                side_estimated=item["side_estimated"],
                clinic_id=clinic_id,
            )
            update_patient_cols: Dict[str, Any] = {}
            if item["parsed_side"] is not None:
                update_patient_cols["side"] = item["parsed_side"]
                update_patient_cols["side_estimated"] = False
            if item["has_weight"]:
                update_patient_cols["weight"] = item["raw_weight"]
            if item["has_height"]:
                update_patient_cols["height"] = item["raw_height"]
            if item["has_leg"]:
                update_patient_cols["leg_length"] = item["raw_leg"]
            if item["has_weight"] and item["has_height"] and item["has_leg"]:
                update_patient_cols["anthropometry_estimated"] = False

            if update_patient_cols:
                p_stmt = p_stmt.on_conflict_do_update(index_elements=["code"], set_=update_patient_cols)
            else:
                p_stmt = p_stmt.on_conflict_do_nothing(index_elements=["code"])
            db.execute(p_stmt)
            db.flush()

            patient = db.query(Patient).populate_existing().filter(Patient.code == target_code).one()
            existing_sessions = db.query(GaitSession).filter(GaitSession.patient_id == patient.id).all()
            resolved_vk, resolved_vl, resolved_vd, visit_created = _resolve_patient_visit_target(
                existing_sessions, norm_vk, clean_vl, clean_vd
            )

            s_stmt = insert_fn(GaitSession).values(
                patient_id=patient.id,
                visit_key=resolved_vk,
                visit_label=resolved_vl,
                visit_date=resolved_vd,
                condition=normalized_condition,
                cycle_count=item["cycle_count"],
                avg_gps=item["avg_gps"],
                avg_amin_sagh=item["avg_amin_sagh"],
                avg_gvs_pelvis=item["avg_gvs_pelvis"],
                avg_gvs_hip=item["avg_gvs_hip"],
                avg_gvs_knee=item["avg_gvs_knee"],
                avg_gvs_ankle=item["avg_gvs_ankle"],
                avg_pctm_zero=item["avg_pctm_zero"],
                avg_pelvis_tilt=item["avg_pelvis_tilt"],
                kinematics_json=item["kinematics_json"],
                source="uploaded",
            ).on_conflict_do_update(
                index_elements=["patient_id", "visit_key", "condition"],
                set_={
                    "visit_label": resolved_vl,
                    "visit_date": resolved_vd,
                    "cycle_count": item["cycle_count"],
                    "avg_gps": item["avg_gps"],
                    "avg_amin_sagh": item["avg_amin_sagh"],
                    "avg_gvs_pelvis": item["avg_gvs_pelvis"],
                    "avg_gvs_hip": item["avg_gvs_hip"],
                    "avg_gvs_knee": item["avg_gvs_knee"],
                    "avg_gvs_ankle": item["avg_gvs_ankle"],
                    "avg_pctm_zero": item["avg_pctm_zero"],
                    "avg_pelvis_tilt": item["avg_pelvis_tilt"],
                    "kinematics_json": item["kinematics_json"],
                    "source": "uploaded",
                },
            )
            db.execute(s_stmt)

            if not visit_created and (clean_vl or clean_vd):
                sync_fields: Dict[str, Any] = {}
                if clean_vl:
                    sync_fields["visit_label"] = resolved_vl
                if clean_vd:
                    sync_fields["visit_date"] = resolved_vd
                if sync_fields:
                    db.query(GaitSession).filter(
                        GaitSession.patient_id == patient.id,
                        GaitSession.visit_key == resolved_vk,
                    ).update(sync_fields, synchronize_session=False)

            results.append({
                "code": patient.code,
                "anthropometry_estimated": bool(patient.anthropometry_estimated),
                "side_estimated": bool(patient.side_estimated),
                "has_kinematics": item["has_kinematics"],
                "visit_key": resolved_vk,
                "visit_label": resolved_vl,
                "visit_date": resolved_vd,
                "visit_created": visit_created,
            })

        db.commit()
    except Exception:
        db.rollback()
        raise

    return results
