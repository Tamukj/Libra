"""Biomechanical calculation engine, compensation guard, and WHO ICF classification."""

from typing import Dict, Any

def compute_true_joint_extension(delta_hip: float, delta_pelvis: float, alpha: float = 1.0) -> float:
    """
    Computes True Joint Extension (TJE) by isolating anatomical hip joint extension
    from compensatory anterior pelvic tilt.
    
    When delta_hip < 0 (hip extension improved) and delta_pelvis > 0 (pelvis tilted anteriorly):
        TJE = delta_hip + alpha * delta_pelvis
    Example: delta_hip = -4.2, delta_pelvis = +2.4 -> TJE = -1.8 (only 1.8 deg true gain).
    """
    return float(delta_hip + (alpha * delta_pelvis))

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
    abs_gain = abs(delta_hip_ext)
    if abs_gain < 1e-4:
        return 0.0

    weighted_comp = (w_p * max(0.0, delta_gvs_pelvis) +
                     w_k * max(0.0, delta_gvs_knee) +
                     w_a * max(0.0, delta_gvs_ankle))
    
    # If using signed raw deltas as in the clinical paper test:
    raw_weighted = (w_p * delta_gvs_pelvis + w_k * delta_gvs_knee + w_a * delta_gvs_ankle)
    return float(raw_weighted / abs_gain)

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

def classify_icf_d450(anomaly_pct: float, cv_stride: float = 0.0) -> str:
    """
    Maps step stability and anomaly rate to WHO ICF code d450 (Walking):
      d450.0 - No difficulty (< 5% anomalies)
      d450.1 - Mild difficulty (5% <= rate < 12%)
      d450.2 - Moderate difficulty (12% <= rate < 25%)
      d450.3 - Severe difficulty (25% <= rate < 45%)
      d450.4 - Complete difficulty (>= 45% gait collapses/anomalies)
    """
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
    delta_pelvis_term: float = 0.0
) -> Dict[str, Any]:
    """
    Clinical Decision Support analysis of VR therapeutic efficacy vs compensatory risk.
    Returns status ('green', 'yellow', 'red') and bilingual explanations.
    """
    pcr = compute_pcr(delta_gvs_p, delta_gvs_k, delta_gvs_a, delta_hip)
    tje = compute_true_joint_extension(delta_hip, delta_pelvis_term or delta_gvs_p)

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
        rec_ru = f"Разгибание бедра достигнуто за счет наклона таза (PCR = {pcr:.2f} > 0.8). Риск поясничного гиперлордоза. Снизьте порог тренажера на 30%."
        rec_kz = f"Санның жазылуы жамбастың еңкеюі есебінен орындалды (PCR = {pcr:.2f} > 0.8). Бел гиперлордозының қаупі бар. Тренажер шегін 30%-ға азайтыңыз."
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
    delta_hip_vr = summary.get("vr_amin_sagh", 0.0) - summary.get("baseline_amin_sagh", 0.0)
    delta_pelvis_vr = summary.get("vr_gvs_pelvis", 0.0) - summary.get("baseline_gvs_pelvis", 0.0)
    delta_knee_vr = summary.get("vr_gvs_knee", 0.0) - summary.get("baseline_gvs_knee", 0.0)
    delta_ankle_vr = summary.get("vr_gvs_ankle", 0.0) - summary.get("baseline_gvs_ankle", 0.0)

    delta_hip_vb = summary.get("verbal_amin_sagh", 0.0) - summary.get("baseline_amin_sagh", 0.0)
    delta_pelvis_vb = summary.get("verbal_gvs_pelvis", 0.0) - summary.get("baseline_gvs_pelvis", 0.0)
    delta_knee_vb = summary.get("verbal_gvs_knee", 0.0) - summary.get("baseline_gvs_knee", 0.0)
    delta_ankle_vb = summary.get("verbal_gvs_ankle", 0.0) - summary.get("baseline_gvs_ankle", 0.0)

    pcr_vr = compute_pcr(delta_pelvis_vr, delta_knee_vr, delta_ankle_vr, delta_hip_vr)
    tje_vr = compute_true_joint_extension(delta_hip_vr, delta_pelvis_vr)

    pcr_vb = compute_pcr(delta_pelvis_vb, delta_knee_vb, delta_ankle_vb, delta_hip_vb)
    tje_vb = compute_true_joint_extension(delta_hip_vb, delta_pelvis_vb)

    if tje_vr < tje_vb and pcr_vr <= 0.8:
        best_method = "VR"
        diff = abs(tje_vb - tje_vr)
        verdict_ru = f"VR-терапия эффективнее словесных инструкций на {diff:.1f}°. Достигнуто стабильное суставное разгибание при контролируемом тазе."
        verdict_kz = f"VR-терапиясы вербалды нұсқаулардан {diff:.1f}°-қа тиімдірек. Жамбас бақылауымен тұрақты буын жазылуы қамтамасыз етілді."
    elif tje_vb < tje_vr or pcr_vr > 0.8:
        best_method = "Verbal"
        verdict_ru = f"Вербальные команды врача безопаснее и физиологичнее. В VR ребенок компенсирует шаг завалом таза (PCR = {pcr_vr:.2f}), тогда как словесный контроль предотвращает гиперлордоз."
        verdict_kz = f"Дәрігердің вербалды нұсқаулары қауіпсіз және физиологиялық тұрғыдан дұрыс. VR кезінде бала жамбасын шамадан тыс еңкейтеді (PCR = {pcr_vr:.2f}), ал вербалды бақылау гиперлордоздың алдын алады."
    else:
        best_method = "Baseline"
        verdict_ru = "Оба режима биообратной связи вызывают моторную утомляемость. Рекомендован возврат к базовым упражнениям."
        verdict_kz = "Кері байланыстың екі режимі де моторлық шаршау туғызады. Базалық жаттығуларға қайта оралу ұсынылады."

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

