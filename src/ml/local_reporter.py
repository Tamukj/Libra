"""Deterministic Rule-Based Clinical Protocol Synthesizer.
Generates structured, trilingual (RU / KZ / EN) medical summaries for clinicians without generative
hallucinations, mapped to WHO ICF (b770 / d450) and Clinical Decision Support (CDSS) standards.
"""

from typing import Dict, Any, Tuple, Optional
from src.core.biomechanics import (
    _safe_float,
    is_finite_number,
    opt_float,
    get_solution_limitations,
    classify_icf_b770,
    classify_icf_d450,
    analyze_compensation_risk,
    compare_modalities,
    compute_sagittal_gdi,
)
from src.core.i18n import get_locale


def _resolve_active_comparison(summary: Dict[str, Any]) -> Tuple[str, Optional[float], Optional[float], float, float, float, float, Optional[float]]:
    """
    Determines the active post-baseline comparison condition:
    VR if recorded, else Verbal if recorded, else Baseline-only.
    """
    has_vr = bool(summary.get("has_vr")) and is_finite_number(summary.get("vr_amin_sagh"))
    has_vb = bool(summary.get("has_verbal")) and is_finite_number(summary.get("verbal_amin_sagh"))

    b_gps = opt_float(summary.get("baseline_gps"))
    b_hip = _safe_float(summary.get("baseline_amin_sagh"), 0.0)
    b_p = _safe_float(summary.get("baseline_gvs_pelvis"), 0.0)
    b_k = _safe_float(summary.get("baseline_gvs_knee"), 0.0)
    b_a = _safe_float(summary.get("baseline_gvs_ankle"), 0.0)

    if has_vr:
        vr_gps = opt_float(summary.get("vr_gps"))
        d_hip = opt_float(summary.get("delta_amin_sagh"))
        if d_hip is None:
            d_hip = float(summary["vr_amin_sagh"]) - b_hip
        d_p = opt_float(summary.get("delta_gvs_pelvis"))
        if d_p is None:
            d_p = _safe_float(summary.get("vr_gvs_pelvis"), b_p) - b_p
        d_k = opt_float(summary.get("delta_gvs_knee"))
        if d_k is None:
            d_k = _safe_float(summary.get("vr_gvs_knee"), b_k) - b_k
        d_a = opt_float(summary.get("delta_gvs_ankle"))
        if d_a is None:
            d_a = _safe_float(summary.get("vr_gvs_ankle"), b_a) - b_a
        d_tilt = opt_float(summary.get("delta_pelvis_tilt"))
        return "VR", b_gps, vr_gps, d_hip, d_p, d_k, d_a, d_tilt

    if has_vb:
        vb_gps = opt_float(summary.get("verbal_gps"))
        d_hip = float(summary["verbal_amin_sagh"]) - b_hip
        d_p = _safe_float(summary.get("verbal_gvs_pelvis"), b_p) - b_p
        d_k = _safe_float(summary.get("verbal_gvs_knee"), b_k) - b_k
        d_a = _safe_float(summary.get("verbal_gvs_ankle"), b_a) - b_a
        d_tilt = opt_float(summary.get("verbal_delta_pelvis_tilt"))
        return "Verbal", b_gps, vb_gps, d_hip, d_p, d_k, d_a, d_tilt

    return "Baseline", b_gps, b_gps, 0.0, 0.0, 0.0, 0.0, None


def _resolve_anomaly_pct(summary: Dict[str, Any]) -> Optional[float]:
    raw_pct = opt_float(summary.get("anomaly_pct"))
    if raw_pct is not None:
        return raw_pct
    raw_rate = opt_float(summary.get("anomaly_rate"))
    if raw_rate is None:
        return None
    # Ratios in [0, 1) convert to percentage; explicit 1.0 without anomaly_pct means 1.0%
    return raw_rate * 100.0 if raw_rate < 1.0 else raw_rate


def _format_visit_segment(summary: Dict[str, Any], lang: str) -> str:
    visit_label = str(
        (summary.get("visit_label_kz") if lang == "kz" else None)
        or summary.get("visit_label")
        or summary.get("visit_key")
        or ""
    ).strip()
    visit_date = str(summary.get("visit_date") or "").strip()
    if not visit_label and not visit_date:
        return ""
    meta = f"{visit_label} ({visit_date})" if (visit_label and visit_date) else (visit_label or visit_date)
    if lang == "kz":
        return f"Қабылдау: {meta} · "
    if lang == "en":
        return f"Visit: {meta} · "
    return f"Визит: {meta} · "


def generate_clinical_narrative(summary: Dict[str, Any], lang: str = "ru") -> str:
    """
    Generates an executive medical narrative based on biomechanical metrics and ML output.
    Supports Russian ('ru'), Kazakh ('kz'), and English ('en').
    """
    eff_lang = lang if lang in ("ru", "kz", "en") else "ru"
    loc = get_locale(eff_lang)
    icf_desc_map = loc.get("icf_descriptions", {})
    conditions_map = loc.get("conditions", {})

    subject = summary.get("subject", "N/A")
    side = str(summary.get("side") or "UNSPECIFIED").strip().upper()
    visit_seg = _format_visit_segment(summary, eff_lang)

    mode, b_gps, post_gps, d_hip, d_pelvis, d_knee, d_ankle, d_pelvis_tilt = _resolve_active_comparison(summary)

    if mode == "Baseline":
        risk = {
            "status": "unassessed",
            "pcr": 0.0,
            "tje": 0.0,
            "label_ru": "Базовая биомеханическая оценка (Baseline)",
            "label_kz": "Базалық биомеханикалық бағалау (Baseline)",
            "label_en": "Baseline biomechanical assessment",
            "recommendation_ru": "Сессии VR / Verbal еще не проводились. Зафиксирован исходный стереотип походки (Baseline).",
            "recommendation_kz": "VR / Verbal сессиялары әлі өткізілмеді. Бастапқы жүріс стереотипі (Baseline) тіркелді.",
            "recommendation_en": "VR / Verbal feedback trials have not been conducted yet. Baseline gait pattern recorded.",
        }
        modalities = {
            "best_method": "Baseline",
            "verdict_ru": "Зафиксирован исходный шаг (Baseline). Тестирование режимов биообратной связи (VR / Verbal) еще не проводилось.",
            "verdict_kz": "Бастапқы жүріс (Baseline) тіркелді. Кері байланыс сынамалары (VR / Verbal) әлі өткізілмеді.",
            "verdict_en": "Baseline walking recorded. Biofeedback trials (VR / Verbal) have not been conducted yet.",
        }
    else:
        risk = analyze_compensation_risk(d_hip, d_pelvis, d_knee, d_ankle, delta_pelvis_term=d_pelvis_tilt)
        modalities = compare_modalities(summary)

    pcr = risk["pcr"] if risk.get("pcr") is not None else 0.0
    tje = risk["tje"] if risk.get("tje") is not None else 0.0

    icf_b_pre = classify_icf_b770(b_gps)
    icf_b_post = classify_icf_b770(post_gps)
    anomaly_pct = _resolve_anomaly_pct(summary)
    icf_d = classify_icf_d450(anomaly_pct) if anomaly_pct is not None else None

    icf_pre_desc = icf_desc_map.get(icf_b_pre, icf_b_pre)
    icf_post_desc = icf_desc_map.get(icf_b_post, icf_b_post)

    best_method_key = modalities["best_method"]
    best_method_label = conditions_map.get(best_method_key, best_method_key)
    limitations = get_solution_limitations(eff_lang)

    if eff_lang == "kz":
        side_txt = "Сол аяқ" if side == "LEFT" else ("Оң аяқ" if side == "RIGHT" else "Көрсетілмеген")
        icf_d_desc = (
            icf_desc_map.get(icf_d, icf_d)
            if icf_d is not None
            else "Бағаланбады (51 нүктелі кинематикалық қисықтар жоқ)"
        )
        return (
            f"Клиникалық биомеханикалық қорытынды (Libra СППР)\n"
            f"Пациент: {subject} · Зерттелген аяқ: {side_txt} · {visit_seg}Белсенді сынама: {mode}\n\n"
            f"1. ДДҰ ХҚЖ (МКФ) бойынша статус:\n"
            f"   • b770 (Жүріс стереотипі): {icf_pre_desc} → {icf_post_desc}\n"
            f"   • d450 (Жүру тұрақтылығы): {icf_d_desc}\n\n"
            f"2. Биомеханика және бейімделу талдауы:\n"
            f"   • Санның жазылу бұрышының өзгерісі (aMinSagH): {d_hip:+.2f}°\n"
            f"   • Шынайы буындық жазылу (TJE): {tje:+.2f}°\n"
            f"   • Жамбас компенсациясы коэффициенті (PCR): {pcr:.2f}\n"
            f"   • Жамбастың ауытқу өзгерісі (GVS Таз): {d_pelvis:+.2f}°\n\n"
            f"3. Оңалту әдісін таңдау (Ауызша нұсқау / VR):\n"
            f"   • Ұсынылған әдіс: {best_method_label}\n"
            f"   • Негіздеме: {modalities['verdict_kz']}\n\n"
            f"4. Оңалту дәрігеріне арналған ұсыным:\n"
            f"   Мәртебе: {risk['label_kz']}\n"
            f"   Тактика: {risk['recommendation_kz']}\n\n"
            f"5. Ескерту және шектеулер:\n"
            f"   {limitations}"
        )

    if eff_lang == "en":
        side_txt = "Left limb" if side == "LEFT" else ("Right limb" if side == "RIGHT" else "Unspecified")
        icf_d_desc = (
            icf_desc_map.get(icf_d, icf_d)
            if icf_d is not None
            else "Not evaluated (51-point kinematic curves unavailable)"
        )
        return (
            f"CLINICAL BIOMECHANICAL REPORT (Libra CDSS)\n"
            f"Patient: {subject} · Side: {side_txt} · {visit_seg}Evaluated trial: {mode}\n\n"
            f"1. WHO ICF functional status:\n"
            f"   • b770 (Gait pattern functions): {icf_pre_desc} → {icf_post_desc}\n"
            f"   • d450 (Walking stability): {icf_d_desc}\n\n"
            f"2. Biomechanics & compensation analysis:\n"
            f"   • Hip extension delta (aMinSagH): {d_hip:+.2f}°\n"
            f"   • True Joint Extension (TJE): {tje:+.2f}°\n"
            f"   • Pathological Compensation Ratio (PCR): {pcr:.2f}\n"
            f"   • Pelvic deviation delta (GVS Pelvis): {d_pelvis:+.2f}°\n\n"
            f"3. Rehabilitation tactics (Verbal / VR):\n"
            f"   • Optimal mode: {best_method_label}\n"
            f"   • Rationale: {modalities['verdict_en']}\n\n"
            f"4. Clinical guidance for physician:\n"
            f"   Status: {risk['label_en']}\n"
            f"   Guidance: {risk['recommendation_en']}\n\n"
            f"5. Safety notice:\n"
            f"   {limitations}"
        )

    side_txt = "Левая сторона" if side == "LEFT" else ("Правая сторона" if side == "RIGHT" else "Не указана")
    icf_d_desc = (
        icf_desc_map.get(icf_d, icf_d)
        if icf_d is not None
        else "Не оценивался (отсутствуют 51-точечные кривые кинематики)"
    )
    return (
        f"Клинический биомеханический протокол (Libra СППР)\n"
        f"Пациент: {subject} · Исследуемая сторона: {side_txt} · {visit_seg}Активная проба: {mode}\n\n"
        f"1. Статус по МКФ ВОЗ:\n"
        f"   • b770 (Стереотип походки): {icf_pre_desc} → {icf_post_desc}\n"
        f"   • d450 (Стабильность ходьбы): {icf_d_desc}\n\n"
        f"2. Анализ биомеханики и компенсаций:\n"
        f"   • Изменение угла разгибания бедра (aMinSagH): {d_hip:+.2f}°\n"
        f"   • Истинное суставное разгибание (TJE): {tje:+.2f}°\n"
        f"   • Коэффициент компенсации таза (PCR): {pcr:.2f}\n"
        f"   • Отклонение наклона таза (GVS Таза): {d_pelvis:+.2f}°\n\n"
        f"3. Выбор тактики реабилитации (Голосовые инструкции / VR):\n"
        f"   • Рекомендованный режим: {best_method_label}\n"
        f"   • Клиническое обоснование: {modalities['verdict_ru']}\n\n"
        f"4. Рекомендация для врача-реабилитолога:\n"
        f"   Статус: {risk['label_ru']}\n"
        f"   Тактика: {risk['recommendation_ru']}\n\n"
        f"5. Примечание и ограничения:\n"
        f"   {limitations}"
    )


def generate_parent_narrative(summary: Dict[str, Any], lang: str = "ru") -> str:
    """
    Generates an empathetic, plain-language summary for parents ('Баланың жүріс төлқұжаты').
    Provides descriptive observational feedback without prescribing medical treatments (Rule 8.2).
    """
    eff_lang = lang if lang in ("ru", "kz", "en") else "ru"
    subject = summary.get("subject", "N/A")
    visit_seg = _format_visit_segment(summary, eff_lang)
    mode, _, post_gps, d_hip, d_pelvis, d_knee, d_ankle, d_pelvis_tilt = _resolve_active_comparison(summary)

    risk = analyze_compensation_risk(d_hip, d_pelvis, d_knee, d_ankle, delta_pelvis_term=d_pelvis_tilt)
    gdi_val = compute_sagittal_gdi(post_gps) if post_gps is not None else float("nan")
    gdi_txt = f"{gdi_val:.0f}" if is_finite_number(gdi_val) else "—"

    hip_straightening = abs(d_hip) if d_hip < -0.5 else 0.0
    posture_safe = risk["status"] != "red"
    limitations = get_solution_limitations(eff_lang)

    if eff_lang == "kz":
        posture_text = (
            "Қалыпты, жамбастың патологиялық алға еңкеюі тіркелмеді"
            if posture_safe
            else "Назар аударыңыз: бала қадам басқанда жамбасын алға тым қатты еңкейтеді, белге жүктеме түседі"
        )
        progress_text = (
            f"Аяқтың жазылу динамикасы ({mode}): жазылу бұрышы шамамен {hip_straightening:.1f}° жақсарды."
            if hip_straightening > 0
            else "Аяқтың жазылу динамикасы: бұл сессияда айтарлықтай өзгеріс тіркелмеді."
        )
        return (
            f"БАЛАНЫҢ ЖҮРІС ТӨЛҚҰЖАТЫ (Ата-аналарға арналған ақпараттық анықтама)\n"
            f"Пациент коды: {subject} · {visit_seg}Зерттеу түрі: {mode}\n\n"
            f"1. Қимыл-қозғалыс байқауы:\n"
            f"   • {progress_text}\n"
            f"   • Жамбас пен бел қалпы: {posture_text}.\n"
            f"   • Жүрістің үйлесімділік көрсеткіші (GDI): {gdi_txt} / 100 балл.\n\n"
            f"2. Қауіпсіздік ескертпесі:\n"
            f"   • {limitations}\n"
            f"   • Жаттығулар жиынтығы мен емдік жүктемені тек емдеуші дәрігер-реабилитолог тағайындайды."
        )

    if eff_lang == "en":
        posture_text = (
            "Stable posture with no excessive anterior pelvic tilt observed"
            if posture_safe
            else "Attention: the child tilts the pelvis forward excessively during steps, adding lumbar strain"
        )
        progress_text = (
            f"Leg extension observation ({mode}): hip extension improved by approximately {hip_straightening:.1f}°."
            if hip_straightening > 0
            else "Leg extension observation: no marked angle change recorded in this session."
        )
        return (
            f"CHILD GAIT PASSPORT (Parent Information Summary)\n"
            f"Patient code: {subject} · {visit_seg}Session: {mode}\n\n"
            f"1. Movement observations:\n"
            f"   • {progress_text}\n"
            f"   • Pelvis & posture: {posture_text}.\n"
            f"   • Gait Deviation Index (GDI): {gdi_txt} / 100.\n\n"
            f"2. Important notice:\n"
            f"   • {limitations}\n"
            f"   • Only the attending physician prescribes exercises or rehabilitation loads."
        )

    posture_text = (
        "Осанка стабильная, патологического наклона таза вперед не зафиксировано"
        if posture_safe
        else "Внимание: при шаге ребенок наклоняет таз вперед, создавая нагрузку на поясницу"
    )
    progress_text = (
        f"Разгибание ножки ({mode}): угол раскрытия сустава улучшился примерно на {hip_straightening:.1f}°."
        if hip_straightening > 0
        else "Разгибание ножки: в данной сессии выраженной динамики не зафиксировано."
    )
    return (
        f"ПАСПОРТ ПОХОДКИ РЕБЕНКА (Информационная справка для родителей)\n"
        f"Код пациента: {subject} · {visit_seg}Тип исследования: {mode}\n\n"
        f"1. Наблюдения за движением:\n"
        f"   • {progress_text}\n"
        f"   • Положение таза и спины: {posture_text}.\n"
        f"   • Индекс гармоничности походки (GDI): {gdi_txt} из 100 баллов.\n\n"
        f"2. Важное примечание:\n"
        f"   • {limitations}\n"
        f"   • Двигательный режим и лечебную гимнастику назначает исключительно лечащий врач-реабилитолог."
    )
