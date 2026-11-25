"""Biomechanical calculation engine, compensation guard, and WHO ICF classification."""

import math
from typing import Dict, Any, Optional, List
import numpy as np


def is_finite_number(val: Any) -> bool:
    """Returns True when val is a real finite number (not None, bool, NaN, or Inf)."""
    if val is None or isinstance(val, bool):
        return False
    try:
        return math.isfinite(float(val))
    except (ValueError, TypeError):
        return False


def opt_float(val: Any) -> Optional[float]:
    """Converts val to finite float or returns None."""
    if not is_finite_number(val):
        return None
    return float(val)


def _safe_float(val: Any, default: float = 0.0) -> float:
    f = opt_float(val)
    return default if f is None else f


def get_solution_limitations(lang: str = "ru") -> str:
    """Returns mandatory Rule 8.2 / CDSS limitations statement in RU, KZ, or EN."""
    if lang == "kz":
        return (
            "Шешім шектеулері (Ереже 8.2-т.): Libra — дәрігерлік шешім қабылдауды қолдау жүйесі (СППР), "
            "дербес диагноз қоймайды және дәрі-дәрмек тағайындамайды. Алгоритм N=29 БЦП балалар когортасында "
            "(KU Leuven) калибрленген және тек сагиттальді жазықтық кинематикасын бағалайды. "
            "Түпкілікті шешімді емдеуші дәрігер қабылдайды; шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз."
        )
    if lang == "en":
        return (
            "Solution Limitations (Rule 8.2): Libra is an advisory Clinical Decision Support System (CDSS); "
            "it does not establish medical diagnoses or prescribe medications. Models are calibrated on a "
            "small pediatric CP cohort (N=29, KU Leuven) evaluating sagittal-plane kinematics only. "
            "All findings require attending physician confirmation; in emergencies call 103."
        )
    return (
        "Ограничения решения (п. 8.2 Положения): Libra является консультативной СППР, не ставит диагноз "
        "и не назначает лекарственные средства. Модель откалибрована на ограниченной выборке (N=29, KU Leuven) "
        "и анализирует только сагиттальную кинематику. Итоговую тактику определяет лечащий врач; "
        "в экстренных ситуациях вызывайте скорую помощь по номеру 103."
    )


def build_baseline_only_risk() -> Dict[str, Any]:
    """Explicit non-assessed CDSS payload for Baseline-only patients without VR/Verbal trials."""
    return {
        "status": "unassessed",
        "pcr": None,
        "tje": None,
        "label_ru": "Базовая оценка (ожидается проба VR / Verbal)",
        "label_kz": "Базалық бағалау (VR / Verbal сынамасы күтілуде)",
        "label_en": "Baseline assessment (awaiting VR / Verbal trial)",
        "recommendation_ru": (
            "Зафиксирован только исходный стереотип походки (Baseline). Для оценки компенсаторного риска "
            "таза проведите и загрузите пробу с обратной связью (VR или Verbal) под наблюдением врача."
        ),
        "recommendation_kz": (
            "Тек бастапқы жүріс стереотипі (Baseline) тіркелді. Жамбас компенсациясы қаупін бағалау үшін "
            "дәрігердің бақылауымен кері байланыс (VR немесе Verbal) сынамасын жүктеңіз."
        ),
        "recommendation_en": (
            "Only Baseline gait has been recorded. Upload a feedback trial (VR or Verbal) under clinician "
            "supervision to evaluate pelvic compensation risk."
        ),
    }


def compute_true_joint_extension(delta_hip: float, delta_pelvis: float, alpha: float = 1.0) -> float:
    """
    Computes True Joint Extension (TJE) by isolating anatomical hip joint extension
    from compensatory anterior pelvic tilt: TJE = delta_hip + alpha * max(0, delta_pelvis).
    """
    return float(delta_hip + (alpha * max(0.0, delta_pelvis)))


def compute_pcr(
    delta_gvs_pelvis: Optional[float],
    delta_gvs_knee: Optional[float],
    delta_gvs_ankle: Optional[float],
    delta_hip_ext: Optional[float],
    w_p: float = 0.5,
    w_k: float = 0.3,
    w_a: float = 0.2,
) -> float:
    """
    Pathological Compensation Ratio (PCR).
    Measures adjacent segment kinematic degradation relative to target hip extension gain.
    Returns NaN when any adjacent GVS delta is missing/non-finite; returns 0.0 when hip
    extension did not improve meaningfully (delta_hip_ext > -0.5 or non-finite).
    """
    if any(not is_finite_number(v) for v in (delta_gvs_pelvis, delta_gvs_knee, delta_gvs_ankle)):
        return float("nan")
    if not is_finite_number(delta_hip_ext):
        return 0.0

    d_hip = float(delta_hip_ext)
    if d_hip > -0.5:
        return 0.0

    weighted_comp = (
        w_p * max(0.0, float(delta_gvs_pelvis))
        + w_k * max(0.0, float(delta_gvs_knee))
        + w_a * max(0.0, float(delta_gvs_ankle))
    )
    return float(weighted_comp / abs(d_hip))


def classify_icf_b770(gps: Optional[float]) -> str:
    """Maps Gait Profile Score (GPS) to WHO ICF code b770, or 'N/A' when missing."""
    if not is_finite_number(gps):
        return "N/A"
    val = float(gps)
    if val < 5.5:
        return "b770.0"
    if val < 7.5:
        return "b770.1"
    if val < 11.0:
        return "b770.2"
    if val < 15.0:
        return "b770.3"
    return "b770.4"


def classify_icf_d450(anomaly_pct: Optional[float]) -> str:
    """Maps step anomaly percentage [0..100] to WHO ICF code d450, or 'N/A' when missing."""
    if not is_finite_number(anomaly_pct):
        return "N/A"
    val = float(anomaly_pct)
    if val < 5.0:
        return "d450.0"
    if val < 12.0:
        return "d450.1"
    if val < 25.0:
        return "d450.2"
    if val < 45.0:
        return "d450.3"
    return "d450.4"


def analyze_compensation_risk(
    delta_hip: Optional[float],
    delta_gvs_p: Optional[float],
    delta_gvs_k: Optional[float],
    delta_gvs_a: Optional[float],
    delta_pelvis_term: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Clinical Decision Support analysis of therapeutic efficacy vs compensatory pelvic risk.
    Returns status ('green', 'yellow', 'red') and trilingual advisory explanations (Rule 8.2).
    """
    if not is_finite_number(delta_gvs_p) or not is_finite_number(delta_hip):
        return {
            "status": "yellow",
            "pcr": None,
            "tje": None,
            "label_ru": "Недостаточно данных (пропуск показателя таза или бедра)",
            "label_kz": "Деректер жеткіліксіз (жамбас немесе сан көрсеткіші жоқ)",
            "label_en": "Insufficient data (missing pelvis or hip metric)",
            "recommendation_ru": (
                "Параметры наклона таза или бедра отсутствуют или некорректны (NaN). "
                "Требуется повторная проверка датчиков врачом; в экстренных ситуациях звоните 103 (п. 8.2)."
            ),
            "recommendation_kz": (
                "Жамбас немесе сан еңкеюінің параметрлері жоқ немесе жарамсыз (NaN). "
                "Дәрігердің қатысуымен сенсорларды қайта тексеру қажет; шұғыл жағдайда 103 нөміріне қоңырау шалыңыз (8.2-т.)."
            ),
            "recommendation_en": (
                "Pelvis or hip parameters are missing or invalid (NaN). Clinician sensor recalibration is advised; "
                "in emergencies call 103 (Rule 8.2)."
            ),
        }

    d_hip = float(delta_hip)
    d_p = float(delta_gvs_p)
    d_k = _safe_float(delta_gvs_k, 0.0)
    d_a = _safe_float(delta_gvs_a, 0.0)
    pelvis_comp = float(delta_pelvis_term) if is_finite_number(delta_pelvis_term) else d_p

    pcr = compute_pcr(d_p, d_k, d_a, d_hip)
    tje = compute_true_joint_extension(d_hip, pelvis_comp)

    if not is_finite_number(tje) or not is_finite_number(pcr):
        return {
            "status": "yellow",
            "pcr": None,
            "tje": None,
            "label_ru": "Недостаточно данных (сбой вычисления TJE/PCR)",
            "label_kz": "Деректер жеткіліксіз (TJE/PCR есептеу ақауы)",
            "label_en": "Insufficient data (TJE/PCR calculation error)",
            "recommendation_ru": "Требуется очная проверка врача и калибровка сенсоров (п. 8.2). Экстренная помощь: 103.",
            "recommendation_kz": "Дәрігердің тексеруі және сенсорларды калибрлеу қажет (8.2-т.). Жедел жәрдем: 103.",
            "recommendation_en": "Physician review and sensor calibration required (Rule 8.2). Emergency: 103.",
        }

    hip_raw_improved = d_hip <= -1.0
    true_improved = hip_raw_improved and (tje < 0.0)
    pelvic_overload = (pcr > 0.8) or (d_p > 2.0) or (hip_raw_improved and tje > 0.0 and pelvis_comp > 2.0)

    if pelvic_overload:
        status = "red"
        label_ru = "Патологическая компенсация наклоном таза"
        label_kz = "Жамбас еңкеюінің патологиялық компенсациясы"
        label_en = "Pathological pelvic tilt compensation"
        if pcr > 0.8:
            trig_ru = f"PCR = {pcr:.2f} > 0.8"
            trig_kz = f"PCR = {pcr:.2f} > 0.8"
            trig_en = f"PCR = {pcr:.2f} > 0.8"
        elif d_p > 2.0:
            trig_ru = f"ΔGVS таза = {d_p:+.2f}° > +2.0°"
            trig_kz = f"ΔGVS жамбас = {d_p:+.2f}° > +2.0°"
            trig_en = f"ΔGVS pelvis = {d_p:+.2f}° > +2.0°"
        else:
            trig_ru = f"TJE = {tje:+.2f}° > 0° при Δнаклона таза = {pelvis_comp:+.2f}°"
            trig_kz = f"TJE = {tje:+.2f}° > 0° (жамбас еңкеюі = {pelvis_comp:+.2f}°)"
            trig_en = f"TJE = {tje:+.2f}° > 0° with pelvic tilt = {pelvis_comp:+.2f}°"

        if hip_raw_improved:
            rec_ru = (
                f"Разгибание бедра достигнуто за счет компенсаторного наклона таза ({trig_ru}). "
                f"Риск поясничного гиперлордоза. Рекомендуется консультация лечащего врача-реабилитолога "
                f"для рассмотрения коррекции целевого угла и нагрузки тренажера (п. 8.2). "
                f"При острой боли или ухудшении состояния немедленно обратитесь к врачу или звоните 103."
            )
            rec_kz = (
                f"Санның жазылуы жамбастың компенсаторлық еңкеюі есебінен орындалды ({trig_kz}). "
                f"Бел гиперлордозының қаупі бар. Емдеуші дәрігер-реабилитологпен тренажердің мақсатты бұрышы мен "
                f"жүктемесін түзетуді келісу ұсынылады (8.2-т.). Жедел ауырсыну кезінде дәрігерге немесе 103 нөміріне хабарласыңыз."
            )
            rec_en = (
                f"Apparent hip extension was achieved via compensatory pelvic tilt ({trig_en}), risking lumbar hyperlordosis. "
                f"Consult the attending physiatrist regarding adjusting the VR target angle or cue intensity (Rule 8.2). "
                f"In acute pain or emergency, seek immediate medical care or call 103."
            )
        else:
            rec_ru = (
                f"Увеличения разгибания бедра не достигнуто, при этом отклонение таза возросло ({trig_ru}). "
                f"Риск поясничного гиперлордоза. Рекомендуется обсудить с лечащим врачом прекращение "
                f"текущей VR-нагрузки и пересмотр протокола (п. 8.2). В экстренной ситуации звоните 103."
            )
            rec_kz = (
                f"Санның жазылуы жақсармады, бірақ жамбас ауытқуы өсті ({trig_kz}). Бел гиперлордозының қаупі бар. "
                f"Емдеуші дәрігермен VR-жүктемені тоқтатуды талқылау ұсынылады (8.2-т.). Шұғыл жағдайда 103 нөміріне қоңырау шалыңыз."
            )
            rec_en = (
                f"Hip extension did not improve while pelvic deviation increased ({trig_en}), risking lumbar hyperlordosis. "
                f"Consult the attending physician about pausing VR cueing (Rule 8.2). In emergencies call 103."
            )
    elif not true_improved:
        status = "yellow"
        if hip_raw_improved and tje >= 0.0:
            label_ru = "Компенсация нивелировала прирост разгибания (TJE ≥ 0°)"
            label_kz = "Жамбас еңкеюі сан жазылуын жойды (TJE ≥ 0°)"
            label_en = "Pelvic tilt offset hip extension gain (TJE >= 0°)"
            rec_ru = (
                f"Прирост угла бедра полностью перекрыт передним наклоном таза (TJE = {tje:+.2f}°). "
                f"Рекомендуется очная оценка лечащим врачом и коррекция биообратной связи."
            )
            rec_kz = (
                f"Сан бұрышының өсімін жамбастың алға еңкеюі толық жапты (TJE = {tje:+.2f}°). "
                f"Емдеуші дәрігердің қарауы және кері байланысты түзету қажет."
            )
            rec_en = (
                f"Hip angle gain was neutralized by anterior pelvic tilt (TJE = {tje:+.2f}°). "
                f"Attending physician review and biofeedback adjustment are advised."
            )
        else:
            label_ru = "Отсутствие выраженного отклика"
            label_kz = "Айқын терапиялық жауап жоқ"
            label_en = "No clinically significant response"
            rec_ru = "Проба не привела к клинически значимому увеличению разгибания бедра (ΔaMinSagH > -1.0°). Требуется оценка лечащим врачом."
            rec_kz = "Сынама сан буыны жазылуының клиникалық маңызды өсімін бермеді (ΔaMinSagH > -1.0°). Дәрігердің бағалауы қажет."
            rec_en = "No clinically significant hip extension gain (ΔaMinSagH > -1.0°). Attending physician evaluation advised."
    elif pcr >= 0.4:
        status = "yellow"
        label_ru = "Умеренная адаптация смежных сегментов"
        label_kz = "Сабақтас буындардың орташа бейімделуі"
        label_en = "Moderate adjacent segment adaptation"
        rec_ru = f"Умеренная компенсация смежных сегментов (PCR = {pcr:.2f}). Требуется контроль осанки и симметрии туловища инструктором ЛФК и врачом."
        rec_kz = f"Сабақтас буындардың орташа компенсациясы (PCR = {pcr:.2f}). ЕДШ нұсқаушысы мен дәрігердің бақылауы қажет."
        rec_en = f"Moderate adjacent segment compensation (PCR = {pcr:.2f}). Requires posture monitoring by therapist and physician."
    else:
        status = "green"
        label_ru = "Истинный терапевтический прогресс"
        label_kz = "Шынайы терапиялық нәтиже"
        label_en = "True therapeutic progress"
        rec_ru = f"Истинное разгибание сустава (TJE = {tje:.1f}°) без патологического смещения таза. Выбранный режим биообратной связи безопасен и эффективен."
        rec_kz = f"Жамбастың патологиялық ығысуынсыз шынайы буын жазылуы (TJE = {tje:.1f}°). Таңдалған кері байланыс режимі қауіпсіз әрі тиімді."
        rec_en = f"True joint extension (TJE = {tje:.1f}°) without pathological pelvic tilt. Selected biofeedback mode is safe and effective."

    return {
        "status": status,
        "pcr": float(pcr),
        "tje": float(tje),
        "label_ru": label_ru,
        "label_kz": label_kz,
        "label_en": label_en,
        "recommendation_ru": rec_ru,
        "recommendation_kz": rec_kz,
        "recommendation_en": rec_en,
    }


def compare_modalities(summary: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compares Baseline vs Verbal vs VR modalities to determine the clinically optimal method.
    Synchronized with CDSS safety rules (TJE < 0, PCR <= 0.8, delta_pelvis <= 2.0) and
    never fabricates NaN/missing condition deltas as 0.0.
    """
    has_base = bool(summary.get("has_baseline", True)) and is_finite_number(summary.get("baseline_amin_sagh"))
    base_hip = opt_float(summary.get("baseline_amin_sagh")) or 0.0
    base_pelvis = opt_float(summary.get("baseline_gvs_pelvis")) or 0.0
    base_knee = opt_float(summary.get("baseline_gvs_knee")) or 0.0
    base_ankle = opt_float(summary.get("baseline_gvs_ankle")) or 0.0

    has_vr = has_base and bool(summary.get("has_vr", True)) and is_finite_number(summary.get("vr_amin_sagh"))
    has_vb = has_base and bool(summary.get("has_verbal", True)) and is_finite_number(summary.get("verbal_amin_sagh"))

    def _cond_metrics(prefix: str, tilt_key: str) -> Dict[str, Optional[float]]:
        d_hip = float(summary[f"{prefix}_amin_sagh"]) - base_hip
        raw_p = opt_float(summary.get(f"{prefix}_gvs_pelvis"))
        raw_k = opt_float(summary.get(f"{prefix}_gvs_knee"))
        raw_a = opt_float(summary.get(f"{prefix}_gvs_ankle"))
        d_p = (raw_p - base_pelvis) if (raw_p is not None and is_finite_number(summary.get("baseline_gvs_pelvis"))) else 0.0
        d_k = (raw_k - base_knee) if (raw_k is not None and is_finite_number(summary.get("baseline_gvs_knee"))) else 0.0
        d_a = (raw_a - base_ankle) if (raw_a is not None and is_finite_number(summary.get("baseline_gvs_ankle"))) else 0.0
        pelvis_for_tje = _safe_float(summary.get(tilt_key), d_p)
        pcr = compute_pcr(d_p, d_k, d_a, d_hip)
        tje = compute_true_joint_extension(d_hip, pelvis_for_tje)
        return {"d_hip": d_hip, "d_p": d_p, "pcr": pcr, "tje": tje}

    vr_m = _cond_metrics("vr", "delta_pelvis_tilt") if has_vr else None
    vb_m = _cond_metrics("verbal", "verbal_delta_pelvis_tilt") if has_vb else None

    def _is_safe_effective(m: Optional[Dict[str, Optional[float]]]) -> bool:
        if m is None or m["d_hip"] is None or m["tje"] is None or m["pcr"] is None or m["d_p"] is None:
            return False
        return (m["d_hip"] <= -1.0) and (m["tje"] < 0.0) and (m["pcr"] <= 0.8) and (m["d_p"] <= 2.0)

    vr_safe = _is_safe_effective(vr_m)
    vb_safe = _is_safe_effective(vb_m)

    if not has_vr and not has_vb:
        best_method = "Baseline"
        verdict_ru = "Зафиксирована обычная ходьба (Baseline). Тестирование режимов обратной связи (VR / Verbal) не проводилось."
        verdict_kz = "Бастапқы жүріс (Baseline) тіркелді. Кері байланыс сынамалары (VR / Verbal) әлі өткізілмеді."
        verdict_en = "Only Baseline gait recorded. Feedback trials (VR / Verbal) have not been conducted yet."
    elif vr_safe and (not vb_safe or vr_m["tje"] <= vb_m["tje"]):  # type: ignore[index]
        best_method = "VR"
        tje_vr_v = vr_m["tje"]  # type: ignore[index]
        pcr_vr_v = vr_m["pcr"]  # type: ignore[index]
        is_moderate_adapt = pcr_vr_v >= 0.4  # type: ignore[operator]
        if not has_vb:
            if is_moderate_adapt:
                verdict_ru = (
                    f"VR-терапия обеспечила чистое разгибание бедра (TJE = {tje_vr_v:.1f}°), однако отмечена умеренная "
                    f"адаптация смежных сегментов (PCR = {pcr_vr_v:.2f}); требуется контроль осанки. Голосовой режим не исследовался."
                )
                verdict_kz = (
                    f"VR-терапиясы сан жазылуын жақсартты (TJE = {tje_vr_v:.1f}°), алайда сабақтас буындардың орташа бейімделуі "
                    f"тіркелді (PCR = {pcr_vr_v:.2f}); дене қалпын бақылау қажет. Ауызша режим зерттелмеді."
                )
                verdict_en = (
                    f"VR feedback improved true hip extension (TJE = {tje_vr_v:.1f}°) with moderate adjacent adaptation "
                    f"(PCR = {pcr_vr_v:.2f}); posture monitoring advised. Verbal mode was not tested."
                )
            else:
                verdict_ru = f"VR-терапия показала истинный суставной прогресс (TJE = {tje_vr_v:.1f}°). Достигнуто устойчивое разгибание бедра при контролируемом тазе. Голосовой режим не исследовался."
                verdict_kz = f"VR-терапиясы шынайы буындық оң нәтиже көрсетті (TJE = {tje_vr_v:.1f}°). Жамбас бақылауымен тұрақты буын жазылуы қамтамасыз етілді. Ауызша режим зерттелмеді."
                verdict_en = f"VR feedback achieved true joint improvement (TJE = {tje_vr_v:.1f}°) with controlled pelvis. Verbal mode was not tested."
        else:
            tje_vb_v = vb_m["tje"]  # type: ignore[index]
            gain_diff = abs(tje_vb_v - tje_vr_v)  # type: ignore[operator]
            if is_moderate_adapt:
                verdict_ru = (
                    f"VR-терапия превосходит голосовые инструкции по приросту разгибания на {gain_diff:.1f}° "
                    f"(TJE = {tje_vr_v:.1f}°), но сопровождается умеренной адаптацией смежных сегментов (PCR = {pcr_vr_v:.2f}); "
                    f"требуется контроль осанки инструктором."
                )
                verdict_kz = (
                    f"VR-терапиясы ауызша нұсқаулардан {gain_diff:.1f}°-қа тиімдірек (TJE = {tje_vr_v:.1f}°), алайда сабақтас буындардың "
                    f"орташа бейімделуі байқалады (PCR = {pcr_vr_v:.2f}); нұсқаушының бақылауы қажет."
                )
                verdict_en = (
                    f"VR feedback outperforms verbal cues by {gain_diff:.1f}° (TJE = {tje_vr_v:.1f}°) with moderate "
                    f"adjacent segment adaptation (PCR = {pcr_vr_v:.2f}); therapist posture monitoring required."
                )
            else:
                verdict_ru = f"VR-терапия эффективнее голосовых инструкций на {gain_diff:.1f}°. Достигнуто стабильное суставное разгибание при контролируемом тазе."
                verdict_kz = f"VR-терапиясы ауызша нұсқаулардан {gain_diff:.1f}°-қа тиімдірек. Жамбас бақылауымен тұрақты буын жазылуы қамтамасыз етілді."
                verdict_en = f"VR feedback outperforms verbal cueing by {gain_diff:.1f}° with stable joint extension and controlled pelvis."
    elif vb_safe and (not vr_safe or vb_m["tje"] < vr_m["tje"]):  # type: ignore[index]
        best_method = "Verbal"
        if has_vr and vr_m is not None and (vr_m["pcr"] > 0.8 or vr_m["d_p"] > 2.0):  # type: ignore[operator]
            verdict_ru = f"Вербальные команды врача безопаснее и физиологичнее. В VR ребенок компенсирует шаг завалом таза (PCR = {vr_m['pcr']:.2f}, ΔGVS таза = {vr_m['d_p']:+.1f}°), тогда как голосовой контроль предотвращает гиперлордоз."
            verdict_kz = f"Дәрігердің ауызша нұсқаулары қауіпсіз және физиологиялық тұрғыдан дұрыс. VR кезінде бала жамбасын шамадан тыс еңкейтеді (PCR = {vr_m['pcr']:.2f}, ΔGVS жамбас = {vr_m['d_p']:+.1f}°), ал ауызша бақылау гиперлордоздың алдын алады."
            verdict_en = f"Verbal clinician cueing is safer: VR induces pelvic compensation (PCR = {vr_m['pcr']:.2f}, ΔGVS pelvis = {vr_m['d_p']:+.1f}°), whereas verbal guidance preserves posture."
        else:
            verdict_ru = "Вербальные команды врача эффективнее и физиологичнее. Словесный контроль инструктора обеспечивает лучшее разгибание сустава."
            verdict_kz = "Дәрігердің ауызша нұсқаулары тиімдірек және физиологиялық тұрғыдан дұрыс. Нұсқаушының сөздік бақылауы буынның жақсы жазылуын қамтамасыз етеді."
            verdict_en = "Verbal clinician cueing is more effective and physiological, delivering superior true joint extension."
    else:
        best_method = "Baseline"
        vr_over = has_vr and vr_m is not None and (vr_m["pcr"] > 0.8 or vr_m["d_p"] > 2.0)  # type: ignore[operator]
        vb_over = has_vb and vb_m is not None and (vb_m["pcr"] > 0.8 or vb_m["d_p"] > 2.0)  # type: ignore[operator]
        if vr_over or vb_over:
            verdict_ru = "Режимы обратной связи вызывают патологическую компенсацию таза (PCR > 0.8 или ΔGVS таза > +2.0°) либо не дают чистого разгибания. Рекомендован возврат к базовым упражнениям под контролем врача."
            verdict_kz = "Кері байланыс режимдері жамбастың патологиялық компенсациясын тудырады (PCR > 0.8 немесе ΔGVS жамбас > +2.0°) не таза жазылу бермейді. Дәрігер бақылауымен базалық жаттығуларға оралу ұсынылады."
            verdict_en = "Feedback modes trigger pathological pelvic compensation (PCR > 0.8 or ΔGVS pelvis > +2.0°) or fail to improve true extension. Return to baseline exercises under clinician review."
        else:
            verdict_ru = "Режимы обратной связи не привели к клинически значимому истинному разгибанию сустава. Рекомендован возврат к базовым упражнениям."
            verdict_kz = "Кері байланыс режимдері буынның клиникалық маңызды шынайы жазылуына әкелмеді. Базалық жаттығуларға қайта оралу ұсынылады."
            verdict_en = "Feedback modes did not achieve clinically significant true joint extension. Baseline exercise regimen advised."

    return {
        "best_method": best_method,
        "tje_vr": float(vr_m["tje"]) if vr_m is not None else None,
        "tje_verbal": float(vb_m["tje"]) if vb_m is not None else None,
        "pcr_vr": float(vr_m["pcr"]) if vr_m is not None else None,
        "pcr_verbal": float(vb_m["pcr"]) if vb_m is not None else None,
        "delta_hip_vr": float(vr_m["d_hip"]) if vr_m is not None else None,
        "delta_hip_verbal": float(vb_m["d_hip"]) if vb_m is not None else None,
        "delta_pelvis_vr": float(vr_m["d_p"]) if vr_m is not None else None,
        "delta_pelvis_verbal": float(vb_m["d_p"]) if vb_m is not None else None,
        "verdict_ru": verdict_ru,
        "verdict_kz": verdict_kz,
        "verdict_en": verdict_en,
    }


def compute_sagittal_gdi(gps: Optional[float]) -> float:
    """
    Computes Sagittal GDI Proxy (0-100 scale using TD baseline 5.2 +/- 1.2 deg).
    Returns NaN for None, NaN, or +/-Inf inputs.
    """
    if not is_finite_number(gps):
        return float("nan")
    f_gps = float(gps)
    if f_gps <= 5.2:
        return 100.0
    z_score = (f_gps - 5.2) / 1.2
    gdi = 100.0 - 10.0 * z_score
    return float(max(0.0, min(100.0, round(gdi, 1))))


def compute_session_diff(
    session_a: Dict[str, Any],
    session_b: Dict[str, Any],
    lang: str = "ru",
) -> Dict[str, Any]:
    """
    Computes a Biomechanical Diff between two gait sessions without fabricating defaults for empty sessions.
    """
    gps_a = opt_float(session_a.get("gps"))
    gps_b = opt_float(session_b.get("gps"))
    tje_a = opt_float(session_a.get("tje"))
    tje_b = opt_float(session_b.get("tje"))
    pcr_a = opt_float(session_a.get("pcr"))
    pcr_b = opt_float(session_b.get("pcr"))

    label_a_ru = session_a.get("label_ru") or session_a.get("label") or "Сессия 1 (Базовая)"
    label_a_kz = session_a.get("label_kz") or session_a.get("label") or "1-сессия (Базалық)"
    label_a_en = session_a.get("label_en") or session_a.get("label") or "Session 1 (Baseline)"
    label_b_ru = session_b.get("label_ru") or session_b.get("label") or "Сессия 2 (Текущая)"
    label_b_kz = session_b.get("label_kz") or session_b.get("label") or "2-сессия (Ағымдағы)"
    label_b_en = session_b.get("label_en") or session_b.get("label") or "Session 2 (Current)"

    if lang == "kz":
        label_a, label_b = label_a_kz, label_b_kz
    elif lang == "en":
        label_a, label_b = label_a_en, label_b_en
    else:
        label_a, label_b = label_a_ru, label_b_ru

    icf_a = classify_icf_b770(gps_a)
    icf_b = classify_icf_b770(gps_b)

    if gps_a is None or gps_b is None:
        return {
            "status": "insufficient_data",
            "session_a_label": label_a,
            "session_b_label": label_b,
            "session_a_label_ru": label_a_ru,
            "session_a_label_kz": label_a_kz,
            "session_a_label_en": label_a_en,
            "session_b_label_ru": label_b_ru,
            "session_b_label_kz": label_b_kz,
            "session_b_label_en": label_b_en,
            "gps_a": gps_a,
            "gps_b": gps_b,
            "delta_gps": None,
            "gdi_a": opt_float(compute_sagittal_gdi(gps_a)) if gps_a is not None else None,
            "gdi_b": opt_float(compute_sagittal_gdi(gps_b)) if gps_b is not None else None,
            "delta_gdi": None,
            "tje_a": tje_a,
            "tje_b": tje_b,
            "delta_tje": None,
            "pcr_a": pcr_a,
            "pcr_b": pcr_b,
            "delta_pcr": None,
            "icf_a": icf_a,
            "icf_b": icf_b,
            "icf_transition": f"{icf_a} -> {icf_b}",
            "icf_improved": False,
            "verdict_ru": "Недостаточно данных (отсутствуют значения GPS для сопоставления сессий). Требуется проверка врачом (п. 8.2).",
            "verdict_kz": "Деректер жеткіліксіз (сессияларды салыстыру үшін GPS мәндері жоқ). Дәрігердің тексеруі қажет (8.2-т.).",
            "verdict_en": "Insufficient data (missing GPS metrics to compare sessions). Physician evaluation required (Rule 8.2).",
            "limitations": get_solution_limitations(lang),
        }

    tje_a_val = tje_a if tje_a is not None else 0.0
    tje_b_val = tje_b if tje_b is not None else 0.0
    pcr_a_val = pcr_a if pcr_a is not None else 0.0
    pcr_b_val = pcr_b if pcr_b is not None else 0.0

    gdi_a = compute_sagittal_gdi(gps_a)
    gdi_b = compute_sagittal_gdi(gps_b)

    delta_gps = round(gps_b - gps_a, 2)
    delta_tje = round(tje_b_val - tje_a_val, 2)
    delta_pcr = round(pcr_b_val - pcr_a_val, 2)
    delta_gdi = round(gdi_b - gdi_a, 1)

    rank_a = int(icf_a.split(".")[1])
    rank_b = int(icf_b.split(".")[1])
    icf_improved = rank_b < rank_a
    icf_regressed = rank_b > rank_a

    if (delta_gps < -0.3 or delta_gdi > 3.0 or icf_improved) and delta_pcr <= 0.15:
        status = "improved"
        verdict_ru = f"Положительная динамика курса (+{delta_gdi} к индексу GDI). Снижение отклонения походки на {abs(delta_gps):.1f}° без усиления компенсации таза."
        verdict_kz = f"Оң клиникалық динамика (GDI индексі +{delta_gdi}). Жамбас компенсациясынсыз жүріс ауытқуы {abs(delta_gps):.1f}°-қа азайды."
        verdict_en = f"Positive clinical progression (+{delta_gdi} GDI points). Gait deviation decreased by {abs(delta_gps):.1f}° without added pelvic compensation."
    elif delta_pcr > 0.3 or delta_gps > 0.8 or icf_regressed:
        status = "regressed"
        verdict_ru = (
            f"Отрицательная динамика: зафиксирован рост патологической компенсации (прирост PCR {delta_pcr:+.2f}). "
            f"Риск перегрузки поясничного отдела; требуется очная консультация лечащего врача (в экстренных ситуациях звоните 103, п. 8.2)."
        )
        verdict_kz = (
            f"Теріс динамика: патологиялық компенсация өсті (PCR өсімі {delta_pcr:+.2f}). "
            f"Бел омыртқасына жүктеме қаупі бар; емдеуші дәрігердің кеңесі қажет (шұғыл жағдайда 103, 8.2-т.)."
        )
        verdict_en = (
            f"Negative progression: increased pathological compensation (ΔPCR {delta_pcr:+.2f}). "
            f"Lumbar overload risk; consult the attending physician (in emergencies call 103, Rule 8.2)."
        )
    else:
        status = "stable"
        verdict_ru = f"Стабильный двигательный статус (индекс GDI {gdi_b}). Существенных изменений стереотипа походки не выявлено."
        verdict_kz = f"Тұрақты қимыл-қозғалыс статусы (GDI индексі {gdi_b}). Жүріс стереотипінде елеулі өзгерістер тіркелмеді."
        verdict_en = f"Stable motor status (GDI {gdi_b}). No major shift in gait pattern observed."

    return {
        "status": status,
        "session_a_label": label_a,
        "session_b_label": label_b,
        "session_a_label_ru": label_a_ru,
        "session_a_label_kz": label_a_kz,
        "session_a_label_en": label_a_en,
        "session_b_label_ru": label_b_ru,
        "session_b_label_kz": label_b_kz,
        "session_b_label_en": label_b_en,
        "gps_a": gps_a,
        "gps_b": gps_b,
        "delta_gps": delta_gps,
        "gdi_a": gdi_a,
        "gdi_b": gdi_b,
        "delta_gdi": delta_gdi,
        "tje_a": tje_a_val,
        "tje_b": tje_b_val,
        "delta_tje": delta_tje,
        "pcr_a": pcr_a_val,
        "pcr_b": pcr_b_val,
        "delta_pcr": delta_pcr,
        "icf_a": icf_a,
        "icf_b": icf_b,
        "icf_transition": f"{icf_a} -> {icf_b}",
        "icf_improved": icf_improved,
        "verdict_ru": verdict_ru,
        "verdict_kz": verdict_kz,
        "verdict_en": verdict_en,
        "limitations": get_solution_limitations(lang),
    }


def compute_curve_gvs_gps(
    curves_by_joint: Dict[str, Any],
    normative_profiles: Dict[str, Any],
) -> Dict[str, Optional[float]]:
    """
    Computes Baker Gait Variable Scores (GVS) and Gait Profile Score (GPS) directly from
    51-point sagittal kinematic cycle arrays against the TD normative reference mean.
    Supports Python lists, numpy arrays, 51- or 1001-point normative profiles, and unequal joint cycle counts.
    """
    joint_to_gvs_key = {
        "aSagP": "GVS_aSagP",
        "aSagH": "GVS_aSagH",
        "aSagK": "GVS_aSagK",
        "aSagA": "GVS_aSagA",
    }
    gvs_results: Dict[str, Optional[float]] = {v: None for v in joint_to_gvs_key.values()}
    per_joint_cycle_sq: List[np.ndarray] = []

    for joint, gvs_key in joint_to_gvs_key.items():
        raw_arr = curves_by_joint.get(joint)
        profile = normative_profiles.get(joint)
        if raw_arr is None or profile is None:
            continue
        arr = np.asarray(raw_arr, dtype=float)
        if arr.size == 0:
            continue
        arr_2d = np.atleast_2d(arr)
        if arr_2d.shape[1] != 51:
            continue
        raw_mean = np.asarray(profile["mean"], dtype=float)
        if raw_mean.shape[0] == 51:
            norm_mean = raw_mean
        elif raw_mean.shape[0] == 1001:
            norm_mean = raw_mean[::20]
        else:
            norm_mean = np.interp(
                np.linspace(0.0, 100.0, 51),
                np.linspace(0.0, 100.0, raw_mean.shape[0]),
                raw_mean,
            )
        diff_sq = (arr_2d - norm_mean[None, :]) ** 2
        cycle_gvs = np.sqrt(np.nanmean(diff_sq, axis=1))
        valid = cycle_gvs[np.isfinite(cycle_gvs)]
        if valid.size > 0:
            gvs_results[gvs_key] = float(np.mean(valid))
            per_joint_cycle_sq.append(cycle_gvs ** 2)

    gps_val: Optional[float] = None
    if per_joint_cycle_sq:
        max_cycles = max(c.shape[0] for c in per_joint_cycle_sq)
        padded = np.full((len(per_joint_cycle_sq), max_cycles), np.nan, dtype=float)
        for idx, arr_c in enumerate(per_joint_cycle_sq):
            padded[idx, : arr_c.shape[0]] = arr_c
        cycle_gps = np.sqrt(np.nanmean(padded, axis=0))
        valid_gps = cycle_gps[np.isfinite(cycle_gps)]
        if valid_gps.size > 0:
            gps_val = float(np.mean(valid_gps))

    return {
        **gvs_results,
        "GPS_a": gps_val,
    }


def compute_kinematic_summary_metrics(
    curves_by_joint: Dict[str, Any],
) -> Dict[str, Optional[float]]:
    """
    Extracts cycle-averaged discrete biomechanical summaries (aMinSagH, pelvic_tilt_mean, hip_rom)
    from 51-point kinematic curve arrays or lists.
    """
    amin_sagh: Optional[float] = None
    hip_rom: Optional[float] = None
    pelvis_tilt_mean: Optional[float] = None

    raw_hip = curves_by_joint.get("aSagH")
    if raw_hip is not None:
        hip_arr = np.asarray(raw_hip, dtype=float)
        if hip_arr.size > 0:
            hip_2d = np.atleast_2d(hip_arr)
            mins = np.nanmin(hip_2d, axis=1)
            maxs = np.nanmax(hip_2d, axis=1)
            valid_min = mins[np.isfinite(mins)]
            valid_rom = (maxs - mins)[np.isfinite(maxs - mins)]
            if valid_min.size > 0:
                amin_sagh = float(np.mean(valid_min))
            if valid_rom.size > 0:
                hip_rom = float(np.mean(valid_rom))

    raw_pelvis = curves_by_joint.get("aSagP")
    if raw_pelvis is not None:
        pelvis_arr = np.asarray(raw_pelvis, dtype=float)
        if pelvis_arr.size > 0:
            pelvis_2d = np.atleast_2d(pelvis_arr)
            means = np.nanmean(pelvis_2d, axis=1)
            valid_p = means[np.isfinite(means)]
            if valid_p.size > 0:
                pelvis_tilt_mean = float(np.mean(valid_p))

    return {
        "aMinSagH": amin_sagh,
        "hip_rom": hip_rom,
        "pelvic_tilt_mean": pelvis_tilt_mean,
    }
