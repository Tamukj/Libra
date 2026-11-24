"""Biomechanical calculation engine, compensation guard, and WHO ICF classification."""

import math
from typing import Dict, Any, Optional
import numpy as np

def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        f = float(val)
        return default if (np.isnan(f) or not np.isfinite(f)) else f
    except (ValueError, TypeError):
        return default

def compute_true_joint_extension(delta_hip: float, delta_pelvis: float, alpha: float = 1.0) -> float:
    """
    Computes True Joint Extension (TJE) by isolating anatomical hip joint extension
    from compensatory anterior pelvic tilt.

    Formula:
        TJE = delta_hip + alpha * max(0, delta_pelvis)
    Penalizes anterior pelvic tilt worsening (delta_pelvis > 0) without inflating
    hip extension when pelvic tilt decreases (delta_pelvis < 0).
    Example: delta_hip = -4.2, delta_pelvis = +2.4 -> TJE = -1.8 (only 1.8 deg true gain).
    """
    return float(delta_hip + (alpha * max(0.0, delta_pelvis)))

def compute_pcr(
    delta_gvs_pelvis: float,
    delta_gvs_knee: float,
    delta_gvs_ankle: float,
    delta_hip_ext: float,
    w_p: float = 0.5,
    w_k: float = 0.3,
    w_a: float = 0.2
) -> float:
    """
    Pathological Compensation Ratio (PCR).
    Measures the ratio of adjacent segment kinematic degradation to the target hip improvement.
    
    Formula:
        PCR = (w_p * dGVS_P + w_k * dGVS_K + w_a * dGVS_A) / |delta_hip_ext|
    """
    # PCR is defined only when target hip extension improved (delta_hip_ext < 0)
    if delta_hip_ext >= -1e-4:
        return 0.0
    abs_gain = abs(delta_hip_ext)

    if any(v is None or np.isnan(v) or not np.isfinite(v) for v in [delta_gvs_pelvis, delta_gvs_knee, delta_gvs_ankle]):
        return float("nan")

    weighted_comp = (w_p * max(0.0, delta_gvs_pelvis) +
                     w_k * max(0.0, delta_gvs_knee) +
                     w_a * max(0.0, delta_gvs_ankle))
    
    return float(weighted_comp / abs_gain)

def classify_icf_b770(gps: float) -> str:
    """
    Maps Gait Profile Score (GPS) to WHO International Classification of Functioning (ICF) code b770:
    b770: Gait pattern functions.
      b770.0 - No impairment (GPS < 5.5 deg)
      b770.1 - Mild impairment (5.5 <= GPS < 7.5 deg)
      b770.2 - Moderate impairment (7.5 <= GPS < 11.0 deg)
      b770.3 - Severe impairment (11.0 <= GPS < 15.0 deg)
      b770.4 - Complete/Profound impairment (GPS >= 15.0 deg)
    """
    if gps is None or np.isnan(gps) or not np.isfinite(gps):
        return "b770.0"
    if gps < 5.5:
        return "b770.0"
    elif gps < 7.5:
        return "b770.1"
    elif gps < 11.0:
        return "b770.2"
    elif gps < 15.0:
        return "b770.3"
    else:
        return "b770.4"

def classify_icf_d450(anomaly_pct: float) -> str:
    """
    Maps step stability and anomaly rate to WHO ICF code d450 (Walking):
      d450.0 - No difficulty (< 5% anomalies)
      d450.1 - Mild difficulty (5% <= rate < 12%)
      d450.2 - Moderate difficulty (12% <= rate < 25%)
      d450.3 - Severe difficulty (25% <= rate < 45%)
      d450.4 - Complete difficulty (>= 45% gait collapses/anomalies)
    """
    if anomaly_pct is None or np.isnan(anomaly_pct) or not np.isfinite(anomaly_pct):
        return "d450.0"
    if anomaly_pct < 5.0:
        return "d450.0"
    elif anomaly_pct < 12.0:
        return "d450.1"
    elif anomaly_pct < 25.0:
        return "d450.2"
    elif anomaly_pct < 45.0:
        return "d450.3"
    else:
        return "d450.4"

def analyze_compensation_risk(
    delta_hip: float,
    delta_gvs_p: float,
    delta_gvs_k: float,
    delta_gvs_a: float,
    delta_pelvis_term: Optional[float] = None
) -> Dict[str, Any]:
    """
    Clinical Decision Support analysis of VR therapeutic efficacy vs compensatory risk.
    Note: PCR thresholds (0.4 / 0.8) and weights (0.5 pelvis, 0.3 knee, 0.2 ankle) are
    evidence-grounded clinical heuristics calibrated for cerebral palsy gait assessment.
    
    If delta_pelvis_term is provided (e.g. true sagittal pelvic tilt angle delta),
    it is used for True Joint Extension (TJE); otherwise delta_gvs_p serves as deviation surrogate.
    Returns status ('green', 'yellow', 'red') and bilingual explanations.
    """
    # Guard against NaN/non-finite sensor failures
    if delta_gvs_p is None or delta_hip is None or np.isnan(delta_gvs_p) or np.isnan(delta_hip) or not np.isfinite(delta_gvs_p) or not np.isfinite(delta_hip):
        return {
            "status": "yellow",
            "pcr": None,
            "tje": None,
            "label_ru": "Недостаточно данных (сбой датчика таза или бедра)",
            "label_kz": "Деректер жеткіліксіз (жамбас немесе сан сенсорының ақауы)",
            "recommendation_ru": "Параметры наклона таза или бедра содержат невалидные значения (NaN). Требуется повторная калибровка сенсоров.",
            "recommendation_kz": "Жамбас немесе сан еңкеюінің параметрлерінде жарамсыз мәндер (NaN) бар. Сенсорларды қайта калибрлеу қажет.",
        }

    # Sanitize optional pelvis tilt term if non-finite
    if delta_pelvis_term is not None and (np.isnan(delta_pelvis_term) or not np.isfinite(delta_pelvis_term)):
        delta_pelvis_term = None

    delta_gvs_k = _safe_float(delta_gvs_k, 0.0)
    delta_gvs_a = _safe_float(delta_gvs_a, 0.0)

    pcr = compute_pcr(delta_gvs_p, delta_gvs_k, delta_gvs_a, delta_hip)
    pelvis_comp = delta_pelvis_term if delta_pelvis_term is not None else delta_gvs_p
    tje = compute_true_joint_extension(delta_hip, pelvis_comp)

    # Secondary guard against non-finite computed outputs
    if np.isnan(tje) or not np.isfinite(tje) or np.isnan(pcr) or not np.isfinite(pcr):
        return {
            "status": "yellow",
            "pcr": None,
            "tje": None,
            "label_ru": "Недостаточно данных (сбой датчика таза или бедра)",
            "label_kz": "Деректер жеткіліксіз (жамбас немесе сан сенсорының ақауы)",
            "recommendation_ru": "Параметры наклона таза или бедра содержат невалидные значения (NaN). Требуется повторная калибровка сенсоров.",
            "recommendation_kz": "Жамбас немесе сан еңкеюінің параметрлерінде жарамсыз мәндер (NaN) бар. Сенсорларды қайта калибрлеу қажет.",
        }

    # Hip extension improved when delta_hip is negative
    improved = delta_hip <= -1.0

    if not improved:
        status = "yellow"
        label_ru = "Отсутствие терапевтического отклика (Non-responder)"
        label_kz = "Терапиялық жауаптың болмауы (Non-responder)"
        rec_ru = "Режим VR не привел к увеличению разгибания бедра. Рекомендована смена стимула."
        rec_kz = "VR режимі сан буынының жазылуына әкелмеді. Ынталандыру түрін ауыстыру ұсынылады."
    elif pcr > 0.8 or delta_gvs_p > 2.0:
        status = "red"
        label_ru = "Опасная компенсация наклоном таза (Pathological Compensation)"
        label_kz = "Жамбас еңкеюі арқылы қауіпті компенсация (Pathological Compensation)"
        trigger_metric_ru = f"PCR = {pcr:.2f} > 0.8" if (pcr is not None and pcr > 0.8) else f"ΔGVS таза = {delta_gvs_p:.2f}° > 2.0°"
        trigger_metric_kz = f"PCR = {pcr:.2f} > 0.8" if (pcr is not None and pcr > 0.8) else f"ΔGVS жамбас = {delta_gvs_p:.2f}° > 2.0°"
        rec_ru = f"Разгибание бедра достигнуто за счет наклона таза ({trigger_metric_ru}). Риск поясничного гиперлордоза. Снизьте порог тренажера на 30%."
        rec_kz = f"Санның жазылуы жамбастың еңкеюі есебінен орындалды ({trigger_metric_kz}). Бел гиперлордозының қаупі бар. Тренажер шегін 30%-ға азайтыңыз."
    elif pcr >= 0.4:
        status = "yellow"
        label_ru = "Допустимая адаптация (Moderate Adaptation)"
        label_kz = "Қалыпты бейімделу (Moderate Adaptation)"
        rec_ru = f"Умеренная компенсация смежных сегментов (PCR = {pcr:.2f}). Требуется контроль симметрии туловища инструктором."
        rec_kz = f"Сабақтас буындардың орташа компенсациясы (PCR = {pcr:.2f}). Нұсқаушы тарапынан дененің симметриясын бақылау қажет."
    else:
        status = "green"
        label_ru = "Истинный терапевтический прогресс (True Responder)"
        label_kz = "Шынайы терапиялық нәтиже (True Responder)"
        rec_ru = f"Истинное разгибание сустава (TJE = {tje:.1f}°) без патологического смещения таза. VR-протокол высокоэффективен."
        rec_kz = f"Жамбастың патологиялық ығысуынсыз шынайы буын жазылуы (TJE = {tje:.1f}°). VR-хаттама жоғары тиімді."

    return {
        "status": status,
        "pcr": float(pcr),
        "tje": float(tje),
        "label_ru": label_ru,
        "label_kz": label_kz,
        "recommendation_ru": rec_ru,
        "recommendation_kz": rec_kz,
    }

def compare_modalities(summary: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compares Baseline vs Verbal vs VR modalities to determine the clinically optimal method.
    Answers: 'Which method is better: Verbal or VR?'
    """
    base_hip = _safe_float(summary.get("baseline_amin_sagh"), 0.0)
    base_pelvis = _safe_float(summary.get("baseline_gvs_pelvis"), 0.0)
    base_knee = _safe_float(summary.get("baseline_gvs_knee"), 0.0)
    base_ankle = _safe_float(summary.get("baseline_gvs_ankle"), 0.0)

    has_vr = bool(summary.get("has_vr", True)) and (summary.get("vr_amin_sagh") is not None)
    has_vb = bool(summary.get("has_verbal", True)) and (summary.get("verbal_amin_sagh") is not None)

    delta_hip_vr = (_safe_float(summary.get("vr_amin_sagh"), base_hip) - base_hip) if has_vr else 0.0
    delta_pelvis_vr = (_safe_float(summary.get("vr_gvs_pelvis"), base_pelvis) - base_pelvis) if has_vr else 0.0
    delta_knee_vr = (_safe_float(summary.get("vr_gvs_knee"), base_knee) - base_knee) if has_vr else 0.0
    delta_ankle_vr = (_safe_float(summary.get("vr_gvs_ankle"), base_ankle) - base_ankle) if has_vr else 0.0

    delta_hip_vb = (_safe_float(summary.get("verbal_amin_sagh"), base_hip) - base_hip) if has_vb else 0.0
    delta_pelvis_vb = (_safe_float(summary.get("verbal_gvs_pelvis"), base_pelvis) - base_pelvis) if has_vb else 0.0
    delta_knee_vb = (_safe_float(summary.get("verbal_gvs_knee"), base_knee) - base_knee) if has_vb else 0.0
    delta_ankle_vb = (_safe_float(summary.get("verbal_gvs_ankle"), base_ankle) - base_ankle) if has_vb else 0.0

    pelvis_for_tje_vr = _safe_float(summary.get("delta_pelvis_tilt"), delta_pelvis_vr)
    pelvis_for_tje_vb = _safe_float(summary.get("verbal_delta_pelvis_tilt"), delta_pelvis_vb)

    pcr_vr = compute_pcr(delta_pelvis_vr, delta_knee_vr, delta_ankle_vr, delta_hip_vr) if has_vr else 0.0
    tje_vr = compute_true_joint_extension(delta_hip_vr, pelvis_for_tje_vr) if has_vr else 0.0

    pcr_vb = compute_pcr(delta_pelvis_vb, delta_knee_vb, delta_ankle_vb, delta_hip_vb) if has_vb else 0.0
    tje_vb = compute_true_joint_extension(delta_hip_vb, pelvis_for_tje_vb) if has_vb else 0.0

    vr_improved = has_vr and (delta_hip_vr <= -1.0)
    vb_improved = has_vb and (delta_hip_vb <= -1.0)

    if not has_vr and not has_vb:
        best_method = "Baseline"
        verdict_ru = "Зафиксирован исходный шаг (Baseline). Тестирование режимов биообратной связи (VR / Verbal) еще не проводилось."
        verdict_kz = "Бастапқы жүріс (Baseline) тіркелді. Кері байланыс сынамалары (VR / Verbal) әлі өткізілмеді."
    elif vr_improved and pcr_vr <= 0.8 and (not vb_improved or tje_vr <= tje_vb):
        best_method = "VR"
        if not has_vb:
            verdict_ru = f"VR-терапия показала суставной прогресс (TJE = {tje_vr:.1f}°). Достигнуто стабильное суставное разгибание при контролируемом тазе. Вербальный режим не исследовался."
            verdict_kz = f"VR-терапиясы буындық оң нәтиже көрсетті (TJE = {tje_vr:.1f}°). Жамбас бақылауымен тұрақты буын жазылуы қамтамасыз етілді. Вербалды режим зерттелмеді."
        else:
            diff = abs(tje_vb - tje_vr) if vb_improved else abs(tje_vr)
            verdict_ru = f"VR-терапия эффективнее словесных инструкций на {diff:.1f}°. Достигнуто стабильное суставное разгибание при контролируемом тазе."
            verdict_kz = f"VR-терапиясы вербалды нұсқаулардан {diff:.1f}°-қа тиімдірек. Жамбас бақылауымен тұрақты буын жазылуы қамтамасыз етілді."
    elif vb_improved and pcr_vb <= 0.8 and (not vr_improved or tje_vb < tje_vr or pcr_vr > 0.8):
        best_method = "Verbal"
        if pcr_vr > 0.8:
            verdict_ru = f"Вербальные команды врача безопаснее и физиологичнее. В VR ребенок компенсирует шаг завалом таза (PCR = {pcr_vr:.2f} > 0.8), тогда как словесный контроль предотвращает гиперлордоз."
            verdict_kz = f"Дәрігердің вербалды нұсқаулары қауіпсіз және физиологиялық тұрғыдан дұрыс. VR кезінде бала жамбасын шамадан тыс еңкейтеді (PCR = {pcr_vr:.2f} > 0.8), ал вербалды бақылау гиперлордоздың алдын алады."
        else:
            verdict_ru = "Вербальные команды врача эффективнее и физиологичнее. Словесный контроль инструктора обеспечивает лучшее разгибание сустава."
            verdict_kz = "Дәрігердің вербалды нұсқаулары тиімдірек және физиологиялық тұрғыдан дұрыс. Нұсқаушының сөздік бақылауы буынның жақсы жазылуын қамтамасыз етеді."
    else:
        best_method = "Baseline"
        if (has_vr and pcr_vr > 0.8) or (has_vb and pcr_vb > 0.8):
            verdict_ru = "Оба режима биообратной связи вызывают патологическую компенсацию (PCR > 0.8) или не улучшают разгибание сустава. Рекомендован возврат к базовым упражнениям."
            verdict_kz = "Кері байланыстың екі режимі де патологиялық компенсация тудырады (PCR > 0.8) немесе буын жазылуын жақсартпайды. Базалық жаттығуларға қайта оралу ұсынылады."
        else:
            verdict_ru = "Оба режима биообратной связи не привели к улучшению разгибания сустава или вызывают моторную утомляемость. Рекомендован возврат к базовым упражнениям."
            verdict_kz = "Кері байланыстың екі режимі де буын жазылуын жақсартпады немесе моторлық шаршау туғызады. Базалық жаттығуларға қайта оралу ұсынылады."

    return {
        "best_method": best_method,
        "tje_vr": float(tje_vr),
        "tje_verbal": float(tje_vb),
        "pcr_vr": float(pcr_vr),
        "pcr_verbal": float(pcr_vb),
        "delta_hip_vr": float(delta_hip_vr),
        "delta_hip_verbal": float(delta_hip_vb),
        "delta_pelvis_vr": float(delta_pelvis_vr),
        "delta_pelvis_verbal": float(delta_pelvis_vb),
        "verdict_ru": verdict_ru,
        "verdict_kz": verdict_kz
    }

def compute_sagittal_gdi(gps: float) -> float:
    """
    Computes Sagittal Gait Deviation Index (GDI, Schwartz & Rozumalski 2008 adapted to Sagittal GPS).
    GDI scale:
      >= 100: Normal TD gait (equal or superior to mean healthy control)
      90-99: 1 standard deviation below TD mean (mild deviation)
      80-89: 2 standard deviations below TD mean (moderate deviation)
      70-79: 3 standard deviations below TD mean (severe deviation)
      < 70: Profound deviation
    Formula:
      z_score = (gps - 5.2) / 1.2
      GDI = 100.0 - 10.0 * z_score
    Clamped to range [0.0, 100.0].
    """
    if gps is None:
        return float("nan")
    try:
        f_gps = float(gps)
    except (ValueError, TypeError):
        return float("nan")
    if np.isnan(f_gps) or math.isnan(f_gps):
        return float("nan")
    if f_gps <= 5.2:
        return 100.0
    z_score = (f_gps - 5.2) / 1.2
    gdi = 100.0 - 10.0 * z_score
    return float(max(0.0, min(100.0, round(gdi, 1))))

def compute_session_diff(session_a: Dict[str, Any], session_b: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes a Biomechanical Git Diff between two gait sessions (e.g. Session 1 Baseline vs Session 2 After 1 Month).
    Tracks delta TJE, delta PCR, delta GPS, Sagittal GDI, and WHO ICF code shift (b770/d450).
    """
    gps_a = _safe_float(session_a.get("gps"), 10.0)
    gps_b = _safe_float(session_b.get("gps"), 10.0)
    tje_a = _safe_float(session_a.get("tje"), 0.0)
    tje_b = _safe_float(session_b.get("tje"), 0.0)
    pcr_a = _safe_float(session_a.get("pcr"), 0.0)
    pcr_b = _safe_float(session_b.get("pcr"), 0.0)

    gdi_a = compute_sagittal_gdi(gps_a)
    gdi_b = compute_sagittal_gdi(gps_b)

    icf_a = classify_icf_b770(gps_a)
    icf_b = classify_icf_b770(gps_b)

    delta_gps = round(gps_b - gps_a, 2)
    delta_tje = round(tje_b - tje_a, 2)
    delta_pcr = round(pcr_b - pcr_a, 2)
    delta_gdi = round(gdi_b - gdi_a, 1)

    rank_a = int(icf_a.split(".")[1])
    rank_b = int(icf_b.split(".")[1])
    icf_improved = rank_b < rank_a
    icf_regressed = rank_b > rank_a

    if (delta_gps < -0.3 or delta_gdi > 3.0 or icf_improved) and delta_pcr <= 0.15:
        status = "improved"
        verdict_ru = f"Положительная динамика курса (+{delta_gdi} к индексу GDI). Снижение девиации походки на {abs(delta_gps):.1f}° без усиления компенсации таза."
        verdict_kz = f"Оң клиникалық динамика (GDI индексі +{delta_gdi}). Жамбас компенсациясынсыз жүріс ауытқуы {abs(delta_gps):.1f}°-қа азайды."
    elif delta_pcr > 0.3 or delta_gps > 0.8 or icf_regressed:
        status = "regressed"
        verdict_ru = f"Отрицательная динамика: зафиксирован рост патологической компенсации (дельта PCR {delta_pcr:+.2f}). Риск перегрузки поясничного отдела."
        verdict_kz = f"Теріс динамика: патологиялық компенсация өсті (дельта PCR {delta_pcr:+.2f}). Бел омыртқасына шамадан тыс жүктеме түсу қаупі бар."
    else:
        status = "stable"
        verdict_ru = f"Стабильный двигательный статус (GDI {gdi_b}). Существенных изменений стереотипа походки не выявлено."
        verdict_kz = f"Тұрақты қимыл-қозғалыс статусы (GDI {gdi_b}). Жүріс стереотипінде елеулі өзгерістер тіркелмеді."

    return {
        "status": status,
        "session_a_label": session_a.get("label", "Сессия 1 (Базовая)"),
        "session_b_label": session_b.get("label", "Сессия 2 (Текущая)"),
        "gps_a": gps_a,
        "gps_b": gps_b,
        "delta_gps": delta_gps,
        "gdi_a": gdi_a,
        "gdi_b": gdi_b,
        "delta_gdi": delta_gdi,
        "tje_a": tje_a,
        "tje_b": tje_b,
        "delta_tje": delta_tje,
        "pcr_a": pcr_a,
        "pcr_b": pcr_b,
        "delta_pcr": delta_pcr,
        "icf_a": icf_a,
        "icf_b": icf_b,
        "icf_transition": f"{icf_a} -> {icf_b}",
        "icf_improved": icf_improved,
        "verdict_ru": verdict_ru,
        "verdict_kz": verdict_kz,
    }

