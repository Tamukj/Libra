"""FastAPI Route Handlers for Libra Platform."""

from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response
from sqlalchemy.orm import Session, joinedload, selectinload
from starlette.concurrency import run_in_threadpool

from src.database.session import get_db
from src.database.models import Patient, GaitSession, ClinicalReport
from src.core.biomechanics import (
    classify_icf_b770,
    classify_icf_d450,
    compare_modalities,
    compute_sagittal_gdi,
    compute_session_diff,
    get_solution_limitations,
    is_finite_number,
    opt_float,
)
from src.core.i18n import get_locale
from src.ml.local_reporter import generate_clinical_narrative, generate_parent_narrative
from src.ml.pdf_reporter import generate_pdf_report
from src.api.cohort_analytics import build_cohort_analytics
from src.api.deps import require_clinician_auth, get_engine_state, ClinicalEngineState
from src.api.services import (
    resolve_patient_summary,
    list_patient_visits,
    group_visits,
    extract_visit_metadata,
    evaluate_active_cdss_risk,
    compute_patient_cycle_stability,
    build_patient_kinematics,
    extract_session_metrics_for_diff,
    _parse_session_kinematics,
)
from src.api.ingest import (
    read_limited_upload,
    prepare_csv_upload_payloads,
    persist_upload_payloads,
    validate_visit_params,
)

router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_clinician_auth)])


@router.get("/patients")
def list_patients(
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Returns all registered patients with latest-visit biomechanics & CDSS triage status (O(1) queries)."""
    patients = (
        db.query(Patient)
        .options(joinedload(Patient.clinic), selectinload(Patient.sessions))
        .all()
    )
    result = []
    for p in patients:
        grouped = group_visits(p.sessions)
        visit_count = len(grouped)
        if grouped:
            latest_vk, latest_sess = grouped[-1]
            v_meta = extract_visit_metadata(latest_vk, latest_sess)
        else:
            v_meta = {"visit_key": None, "visit_label": None, "visit_date": None}

        item: Dict[str, Any] = {
            "id": p.id,
            "code": p.code,
            "side": p.side,
            "weight": p.weight,
            "height": p.height,
            "leg_length": p.leg_length,
            "anthropometry_estimated": bool(getattr(p, "anthropometry_estimated", False)),
            "side_estimated": bool(getattr(p, "side_estimated", False)),
            "clinic_name": p.clinic.name if p.clinic else None,
            "visit_count": visit_count,
            "latest_visit_key": v_meta["visit_key"],
            "latest_visit_label": v_meta["visit_label"],
            "latest_visit_date": v_meta["visit_date"],
        }
        try:
            summary, _ = resolve_patient_summary(p.code, p, db, state, sessions=p.sessions)
            risk = evaluate_active_cdss_risk(summary)
            item.update({
                "pcr": risk["pcr"],
                "tje": risk["tje"],
                "status": risk["status"],
                "baseline_gps": summary["baseline_gps"],
                "vr_gps": summary["vr_gps"],
                "delta_amin_sagh": summary["delta_amin_sagh"],
                "active_modality": summary.get("active_modality"),
                "active_delta_amin_sagh": summary.get("active_delta_amin_sagh"),
                "has_vr": bool(summary.get("has_vr", False)),
                "has_verbal": bool(summary.get("has_verbal", False)),
            })
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            item.update({
                "pcr": None,
                "tje": None,
                "status": "unassessed",
                "baseline_gps": None,
                "vr_gps": None,
                "delta_amin_sagh": None,
                "active_modality": None,
                "active_delta_amin_sagh": None,
                "has_vr": False,
                "has_verbal": False,
            })
        result.append(item)
    return result


@router.get("/patients/{code}/visits")
def list_patient_visits_endpoint(
    code: str,
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Returns chronological visits/courses recorded for a patient."""
    patient = (
        db.query(Patient)
        .options(selectinload(Patient.sessions))
        .filter(Patient.code == code)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    visits = list_patient_visits(patient, patient.sessions, state)
    return {
        "code": code,
        "visits": visits,
    }


@router.get("/patients/{code}/analysis")
def get_patient_analysis(
    code: str,
    lang: str = Query("ru", pattern="^(ru|kz|en)$"),
    visit: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """
    Returns comparative biomechanical and clinical CDSS analysis for a visit (or latest visit)
    (Baseline vs Verbal vs VR, TJE, PCR, WHO ICF, ML prognosis, and Rule 8.2 limitations).
    """
    patient = (
        db.query(Patient)
        .options(selectinload(Patient.sessions))
        .filter(Patient.code == code)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary, sessions = resolve_patient_summary(
        code, patient, db, state, sessions=patient.sessions, visit_key=visit
    )
    visits = list_patient_visits(patient, patient.sessions, state)
    active_visit = next((v for v in visits if v["visit_key"] == summary.get("visit_key")), None)

    risk = evaluate_active_cdss_risk(summary)

    anomaly_rate, n_anomalies, n_cycles, cycle_stability = compute_patient_cycle_stability(
        code, summary, state, sessions=sessions, visit_key=summary.get("visit_key")
    )

    if summary.get("has_vr"):
        post_cond: Optional[str] = "VR"
        post_gps = summary.get("vr_gps")
    elif summary.get("has_verbal"):
        post_cond = "Verbal"
        post_gps = summary.get("verbal_gps")
    else:
        post_cond = None
        post_gps = None

    icf_b770_base = classify_icf_b770(summary.get("baseline_gps"))
    icf_b770_post = classify_icf_b770(post_gps)
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0) if anomaly_rate is not None else None

    # ML condition discrimination on active condition without stale static override
    by_cond = {s.condition: s for s in sessions}
    target_cond = "VR" if summary.get("has_vr") else ("Baseline" if summary.get("has_baseline") else "Verbal")
    target_sess = by_cond.get(target_cond)
    cond_prefix = target_cond.lower()

    if target_sess is not None and getattr(target_sess, "source", "seeded") == "seeded":
        sub_disc = (state.df_vr if target_cond == "VR" else (state.df_base if target_cond == "Baseline" else state.df_vb))
        sub_kin = (state.df_kin_vr if target_cond == "VR" else (state.df_kin_base if target_cond == "Baseline" else state.df_kin_vb))
        sub_disc_c = sub_disc[sub_disc["subject"] == code]
        sub_kin_c = sub_kin[sub_kin["subject"] == code]
        if not sub_disc_c.empty:
            _, probs = state.ml_classifier.predict_cycle_condition(
                sub_disc_c, df_kin=sub_kin_c if not sub_kin_c.empty else None
            )
            response_prob: Optional[float] = float(np.mean(probs))
        else:
            response_prob = None
    else:
        df_uploaded_row = pd.DataFrame([{
            "subject": code,
            "GPS_a": summary.get(f"{cond_prefix}_gps"),
            "GVS_aSagP": summary.get(f"{cond_prefix}_gvs_pelvis"),
            "GVS_aSagH": summary.get(f"{cond_prefix}_gvs_hip"),
            "GVS_aSagK": summary.get(f"{cond_prefix}_gvs_knee"),
            "GVS_aSagA": summary.get(f"{cond_prefix}_gvs_ankle"),
            "aMinSagH": summary.get(f"{cond_prefix}_amin_sagh"),
            "pctmZeroStSagH": summary.get(f"{cond_prefix}_pctm_zero"),
        }])
        parsed_kin = _parse_session_kinematics(target_sess)
        df_kin_uploaded = None
        if parsed_kin and parsed_kin.get("joints"):
            kin_row: Dict[str, Any] = {"subject": code}
            for j_name, j_series in parsed_kin["joints"].items():
                j_mean = j_series.get("mean") or []
                if len(j_mean) == 51:
                    for idx_pt, val in enumerate(j_mean):
                        kin_row[f"{j_name}_pct_GC_{idx_pt * 20}"] = val
            if len(kin_row) > 1:
                df_kin_uploaded = pd.DataFrame([kin_row])
        _, probs = state.ml_classifier.predict_cycle_condition(df_uploaded_row, df_kin=df_kin_uploaded)
        response_prob = float(probs[0])

    responder_prediction: Optional[Dict[str, Any]] = None
    if summary.get("has_baseline"):
        try:
            responder_prediction = state.vr_responder.predict_subject_response(summary)
        except ValueError:
            responder_prediction = None

    modalities = compare_modalities(summary)

    b_gdi_raw = compute_sagittal_gdi(summary.get("baseline_gps"))
    vr_gdi_raw = compute_sagittal_gdi(summary.get("vr_gps"))
    vb_gdi_raw = compute_sagittal_gdi(summary.get("verbal_gps"))
    summary["baseline_gdi"] = b_gdi_raw if is_finite_number(b_gdi_raw) else None
    summary["vr_gdi"] = vr_gdi_raw if is_finite_number(vr_gdi_raw) else None
    summary["verbal_gdi"] = vb_gdi_raw if is_finite_number(vb_gdi_raw) else None
    summary["delta_gdi"] = (
        round(summary["vr_gdi"] - summary["baseline_gdi"], 1)
        if (summary["vr_gdi"] is not None and summary["baseline_gdi"] is not None)
        else None
    )

    loc = get_locale(lang)
    return {
        "summary": summary,
        "active_visit": active_visit,
        "visits": visits,
        "cdss_risk": risk,
        "modalities": modalities,
        "icf": {
            "b770_baseline": icf_b770_base,
            "b770_vr": icf_b770_post,
            "b770_post": icf_b770_post,
            "b770_post_condition": post_cond,
            "d450": icf_d450 or "N/A",
        },
        "ml": {
            "vr_gait_signature_confidence": response_prob,
            "active_condition_evaluated": target_cond,
            "predicted_condition": ("VR" if response_prob >= 0.5 else "Baseline") if response_prob is not None else None,
            "binary_roc_auc": round(float(state.ml_metrics.get("roc_auc", 0.0)), 3),
            "is_vr_discriminative": bool(response_prob > 0.5) if response_prob is not None else False,
            "responder_prediction": responder_prediction,
            "pca_stability": {
                "has_curves": anomaly_rate is not None,
                "anomaly_rate": anomaly_rate,
                "n_anomalies": n_anomalies,
                "n_cycles": n_cycles,
                "is_stable": bool(anomaly_rate < 0.15) if anomaly_rate is not None else None,
                "cycles": cycle_stability,
            },
        },
        "limitations": get_solution_limitations(lang),
        "disclaimer": loc.get("disclaimer", ""),
    }


@router.get("/patients/{code}/kinematics")
def get_patient_kinematics(
    code: str,
    visit: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Returns 51-point kinematic curves per recorded condition with TD normative corridor."""
    patient = db.query(Patient).filter(Patient.code == code).first()
    return build_patient_kinematics(code, patient, db, state, visit_key=visit)


@router.get("/analytics/cohort")
def get_cohort_analytics_endpoint(
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Returns live cohort analytics computed in O(1) SQL queries from registered patients."""
    patients = db.query(Patient).options(selectinload(Patient.sessions)).all()
    records: List[Dict[str, Any]] = []
    for p in patients:
        try:
            summary, _ = resolve_patient_summary(p.code, p, db, state, sessions=p.sessions)
            risk = evaluate_active_cdss_risk(summary)
            mod = compare_modalities(summary)
            records.append({
                "code": p.code,
                "side": p.side,
                "weight": p.weight,
                "height": p.height,
                "leg_length": p.leg_length,
                "status": risk["status"],
                "tje": risk["tje"],
                "pcr": risk["pcr"],
                "best_method": mod["best_method"],
                "has_baseline": bool(summary.get("has_baseline", False)),
                "has_vr": bool(summary.get("has_vr", False)),
                "has_verbal": bool(summary.get("has_verbal", False)),
                "has_seeded": bool(summary.get("has_seeded", False)),
                "cycles_baseline": summary.get("cycles_baseline", 0),
                "cycles_verbal": summary.get("cycles_verbal", 0),
                "cycles_vr": summary.get("cycles_vr", 0),
                "baseline_gps": summary.get("baseline_gps"),
                "verbal_gps": summary.get("verbal_gps"),
                "vr_gps": summary.get("vr_gps"),
                "delta_amin_sagh": summary.get("delta_amin_sagh"),
            })
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            continue
    return build_cohort_analytics(records)


@router.get("/ml/metrics")
def get_ml_metrics(state: ClinicalEngineState = Depends(get_engine_state)):
    """Returns leak-free GroupKFold generalization metrics and feature importances."""
    return {
        **state.ml_metrics,
        "three_class": state.three_class_metrics,
        "pca_validation": state.pca_validation,
        "vr_responder": {
            **state.vr_responder_metrics,
            "note": "LOO-валидация на когорте n=29 (базовые биомеханические и кинематические признаки). Перед клиническим применением требуется расширение когорты.",
            "note_kz": "n=29 когортасындағы LOO-валидация (базалық биомеханикалық және кинематикалық белгілер). Клиникалық қолдану алдында когортаны кеңейту қажет.",
            "note_en": "LOO validation on n=29 cohort (baseline biomechanical & kinematic features). Multi-center validation required prior to clinical deployment.",
        },
    }


@router.post("/patients/{code}/report")
def create_patient_report(
    code: str,
    lang: str = Query("ru", pattern="^(ru|kz|en)$"),
    audience: str = Query("doctor", pattern="^(doctor|parent)$"),
    visit: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Generates trilingual clinical narrative (doctor protocol or parent guidance) and records it in DB."""
    patient = (
        db.query(Patient)
        .options(selectinload(Patient.sessions))
        .filter(Patient.code == code)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary, sessions = resolve_patient_summary(
        code, patient, db, state, sessions=patient.sessions, visit_key=visit
    )
    risk = evaluate_active_cdss_risk(summary)

    anomaly_rate, _, _, _ = compute_patient_cycle_stability(
        code, summary, state, sessions=sessions, visit_key=summary.get("visit_key")
    )
    summary["anomaly_rate"] = anomaly_rate
    summary["anomaly_pct"] = anomaly_rate * 100.0 if anomaly_rate is not None else None

    post_gps = summary["vr_gps"] if summary.get("has_vr") else summary.get("verbal_gps")
    icf_b770 = classify_icf_b770(post_gps if post_gps is not None else summary.get("baseline_gps"))
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0) if anomaly_rate is not None else "N/A"

    gen_fn = generate_parent_narrative if audience == "parent" else generate_clinical_narrative
    narrative_ru = gen_fn(summary, lang="ru")
    narrative_kz = gen_fn(summary, lang="kz")
    narrative_selected = gen_fn(summary, lang=lang) if lang == "en" else (narrative_kz if lang == "kz" else narrative_ru)

    resolved_vk = summary.get("visit_key") or "visit-1"
    report = ClinicalReport(
        patient_id=patient.id,
        visit_key=resolved_vk,
        icf_b770=icf_b770,
        icf_d450=icf_d450,
        tje=risk["tje"] if risk["tje"] is not None else 0.0,
        pcr=risk["pcr"] if risk["pcr"] is not None else 0.0,
        status=risk["status"],
        narrative_ru=narrative_ru,
        narrative_kz=narrative_kz,
        audience=audience,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report.id,
        "patient": code,
        "visit_key": report.visit_key,
        "visit_label": summary.get("visit_label"),
        "visit_date": summary.get("visit_date"),
        "audience": audience,
        "lang": lang,
        "status": risk["status"],
        "pcr": risk["pcr"],
        "tje": risk["tje"],
        "icf_b770": icf_b770,
        "icf_d450": icf_d450,
        "narrative": narrative_selected,
        "created_at": report.created_at.isoformat(),
    }


@router.get("/patients/{code}/diff")
def get_patient_diff(
    code: str,
    session_a: str = Query("Baseline", description="Baseline or prior session condition"),
    session_b: str = Query("VR", description="Current or follow-up session condition"),
    visit: Optional[str] = Query(None),
    visit_a: Optional[str] = Query(None),
    visit_b: Optional[str] = Query(None),
    lang: str = Query("ru", pattern="^(ru|kz|en)$"),
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Computes clinical comparison between two gait sessions or visits (TJE, PCR, GPS, GDI, WHO ICF, Rule 8.2)."""
    patient = (
        db.query(Patient)
        .options(selectinload(Patient.sessions))
        .filter(Patient.code == code)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    eff_va = visit_a or visit
    eff_vb = visit_b or visit
    summary_a, _ = resolve_patient_summary(
        code, patient, db, state, sessions=patient.sessions, visit_key=eff_va
    )
    summary_b = (
        summary_a
        if eff_va == eff_vb
        else resolve_patient_summary(
            code, patient, db, state, sessions=patient.sessions, visit_key=eff_vb
        )[0]
    )

    sess_a_data = extract_session_metrics_for_diff(summary_a, session_a, lang=lang)
    sess_b_data = extract_session_metrics_for_diff(summary_b, session_b, lang=lang)

    if summary_a.get("visit_key") != summary_b.get("visit_key"):
        for s_data, s_sum in ((sess_a_data, summary_a), (sess_b_data, summary_b)):
            v_lbl_ru = s_sum.get("visit_label") or s_sum.get("visit_key") or ""
            v_lbl_kz = s_sum.get("visit_label_kz") or v_lbl_ru
            v_date = s_sum.get("visit_date") or ""
            sfx_ru = f"{v_lbl_ru} ({v_date})" if (v_lbl_ru and v_date) else (v_lbl_ru or v_date)
            sfx_kz = f"{v_lbl_kz} ({v_date})" if (v_lbl_kz and v_date) else (v_lbl_kz or v_date)
            if sfx_ru:
                s_data["label_ru"] = f"{s_data['label_ru']} · {sfx_ru}"
                s_data["label_en"] = f"{s_data['label_en']} · {sfx_ru}"
            if sfx_kz:
                s_data["label_kz"] = f"{s_data['label_kz']} · {sfx_kz}"

    diff_res = compute_session_diff(sess_a_data, sess_b_data, lang=lang)
    loc = get_locale(lang)
    return {
        "patient": code,
        "session_a": session_a,
        "session_b": session_b,
        "visit_a": summary_a.get("visit_key"),
        "visit_b": summary_b.get("visit_key"),
        **diff_res,
        "disclaimer": loc.get("disclaimer", ""),
    }


@router.get("/ingest/template")
def download_ingest_template(
    format: str = Query("vicon", pattern="^(vicon|imu|kinematics)$"),
):
    """Returns a downloadable CSV template (; separator, , decimal) for Vicon/GRAIL, IMU, or 51-point kinematics."""
    from src.core.normative_data import NORMATIVE_PROFILES

    if format == "imu":
        csv_body = (
            "subject;side;weight_kg;height_m;leg_length_m;gps;pelvis_gvs;hip_gvs;knee_gvs;ankle_gvs;hip_min_ext;pelvis_tilt_mean\n"
            "s_imu_01;RIGHT;42,5;1,38;0,71;9,8;10,5;12,8;9,4;4,9;6,2;16,4\n"
        )
    elif format == "kinematics":
        headers = ["subject", "side", "weight", "height", "LegLength"]
        row_vals = ["s_kin_01", "RIGHT", "42,5", "1,38", "0,71"]
        for joint in ("aSagP", "aSagH", "aSagK", "aSagA"):
            td_mean = NORMATIVE_PROFILES[joint]["mean"][::20]
            offset = 4.0 if joint == "aSagP" else (6.0 if joint == "aSagH" else 2.0)
            for idx in range(51):
                headers.append(f"{joint}_pct_GC_{idx * 20}")
                row_vals.append(f"{td_mean[idx] + offset:.2f}".replace(".", ","))
        csv_body = ";".join(headers) + "\n" + ";".join(row_vals) + "\n"
    else:
        csv_body = (
            "subject;side;weight;height;LegLength;GPS_a;GVS_aSagP;GVS_aSagH;GVS_aSagK;GVS_aSagA;aMinSagH;pctmZeroStSagH\n"
            "s_demo_01;RIGHT;42,5;1,38;0,71;10,4;12,1;14,3;11,2;5,8;8,5;48,0\n"
        )
    return Response(
        content=csv_body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="libra_template_{format}.csv"'},
    )


@router.post("/patients/upload")
async def upload_patient_csv(
    file: UploadFile = File(...),
    condition: str = Form("Baseline"),
    subject_code: Optional[str] = Form(None),
    visit_key: Optional[str] = Form(None),
    visit_label: Optional[str] = Form(None),
    visit_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Accepts CSV from Vicon Nexus, GRAIL, or IMU sensors (<= 10 MB), enforces Law 94-V PII filter,
    validates visit metadata, parses in threadpool without blocking event loop, and atomically upserts patient & visit session.
    """
    validate_visit_params(visit_key, visit_label, visit_date)
    contents = await read_limited_upload(file)
    normalized_condition, n_rows, n_cols, payloads = await run_in_threadpool(
        prepare_csv_upload_payloads,
        contents,
        condition,
        subject_code,
        file.filename,
    )
    uploaded_results = await run_in_threadpool(
        persist_upload_payloads,
        db,
        normalized_condition,
        payloads,
        visit_key,
        visit_label,
        visit_date,
    )

    primary = uploaded_results[0]
    codes = [r["code"] for r in uploaded_results]
    if len(codes) > 1:
        msg_ru = f"Файл {file.filename} успешно импортирован ({normalized_condition}). Обновлено пациентов: {len(codes)} ({n_rows} циклов)."
        msg_kz = f"{file.filename} файлы сәтті импортталды ({normalized_condition}). Жаңартылған пациенттер: {len(codes)} ({n_rows} цикл)."
    else:
        msg_ru = f"Файл {file.filename} успешно импортирован ({normalized_condition}). Пациент {primary['code']} обновлен в реестре."
        msg_kz = f"{file.filename} файлы сәтті импортталды ({normalized_condition}). Пациент {primary['code']} тізілімде жаңартылды."

    return {
        "status": "success",
        "code": primary["code"],
        "codes": codes,
        "patients_updated": len(codes),
        "condition": normalized_condition,
        "visit_key": primary["visit_key"],
        "visit_label": primary["visit_label"],
        "visit_date": primary["visit_date"],
        "visit_created": primary["visit_created"],
        "anthropometry_estimated": primary["anthropometry_estimated"],
        "side_estimated": primary["side_estimated"],
        "has_kinematics": any(r["has_kinematics"] for r in uploaded_results),
        "rows": n_rows,
        "columns": n_cols,
        "message_ru": msg_ru,
        "message_kz": msg_kz,
    }


@router.get("/patients/{code}/report.pdf")
def export_patient_pdf_report(
    code: str,
    lang: str = Query("ru", pattern="^(ru|kz|en)$"),
    audience: str = Query("doctor", pattern="^(doctor|parent)$"),
    visit: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    state: ClinicalEngineState = Depends(get_engine_state),
):
    """Generates and returns a downloadable A4 PDF clinical or parent report in RU, KZ, or EN."""
    patient = (
        db.query(Patient)
        .options(selectinload(Patient.sessions))
        .filter(Patient.code == code)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {code} not found")

    summary, sessions = resolve_patient_summary(
        code, patient, db, state, sessions=patient.sessions, visit_key=visit
    )
    risk = evaluate_active_cdss_risk(summary)
    modalities = compare_modalities(summary)
    anomaly_rate, _, _, _ = compute_patient_cycle_stability(
        code, summary, state, sessions=sessions, visit_key=summary.get("visit_key")
    )
    summary["anomaly_rate"] = anomaly_rate
    summary["anomaly_pct"] = anomaly_rate * 100.0 if anomaly_rate is not None else None

    post_gps = summary["vr_gps"] if summary.get("has_vr") else summary.get("verbal_gps")
    icf_b770_base = classify_icf_b770(summary.get("baseline_gps"))
    icf_b770_vr = classify_icf_b770(post_gps if post_gps is not None else summary.get("baseline_gps"))
    icf_d450 = classify_icf_d450(anomaly_rate * 100.0) if anomaly_rate is not None else None

    narrative = (
        generate_parent_narrative(summary, lang=lang)
        if audience == "parent"
        else generate_clinical_narrative(summary, lang=lang)
    )

    hip_curves: Optional[Dict[str, Any]] = None
    kin_resp = build_patient_kinematics(code, patient, db, state, visit_key=summary.get("visit_key"))
    if not kin_resp.get("is_surrogate"):
        hip_joint = kin_resp.get("joints", {}).get("aSagH")
        if hip_joint:
            hip_curves = {
                "time_percent": hip_joint["time_percent"],
                "baseline": hip_joint["baseline"]["mean"] if hip_joint.get("baseline") else None,
                "vr": hip_joint["vr"]["mean"] if hip_joint.get("vr") else None,
                "verbal": hip_joint["verbal"]["mean"] if hip_joint.get("verbal") else None,
                "norm_mean": hip_joint["norm_td"]["mean"],
                "norm_std": hip_joint["norm_td"]["std"],
            }

    pdf_bytes = generate_pdf_report(
        summary=summary,
        risk=risk,
        modalities=modalities,
        icf_b770_base=icf_b770_base,
        icf_b770_vr=icf_b770_vr,
        icf_d450=icf_d450,
        narrative=narrative,
        lang=lang,
        audience=audience,
        hip_curves=hip_curves,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="libra-report-{code}-{lang}.pdf"'},
    )
