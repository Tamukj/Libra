"""Local AI Clinical Reporter.
Generates structured, bilingual (KZ / RU) medical summaries for clinicians,
fully mapped to WHO ICF (b770 / d450) and Clinical Decision Support (CDSS) standards.
"""

from typing import Dict, Any
import numpy as np
import pandas as pd

def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        f = float(val)
        return default if (np.isnan(f) or pd.isna(f)) else f
    except (ValueError, TypeError):
        return default
from src.core.biomechanics import (
    compute_true_joint_extension,
    compute_pcr,
    classify_icf_b770,
    classify_icf_d450,
    analyze_compensation_risk,
    compare_modalities,
)

ICF_DESCRIPTIONS_RU = {
    "b770.0": "b770.0 (Нарушений нет / Норма)",
    "b770.1": "b770.1 (Легкие нарушения стереотипа походки)",
    "b770.2": "b770.2 (Умеренные нарушения стереотипа походки)",
    "b770.3": "b770.3 (Тяжелые нарушения стереотипа походки)",
    "b770.4": "b770.4 (Абсолютные нарушения стереотипа походки)",
    "d450.0": "d450.0 (Ходьба без ограничений)",
    "d450.1": "d450.1 (Легкие затруднения при ходьбе)",
    "d450.2": "d450.2 (Умеренные затруднения при ходьбе)",
    "d450.3": "d450.3 (Тяжелые затруднения при ходьбе)",
    "d450.4": "d450.4 (Невозможность самостоятельной ходьбы)",
}

ICF_DESCRIPTIONS_KZ = {
    "b770.0": "b770.0 (Бұзылыстар жоқ / Қалыпты)",
    "b770.1": "b770.1 (Жүріс стереотипінің жеңіл бұзылуы)",
    "b770.2": "b770.2 (Жүріс стереотипінің орташа бұзылуы)",
    "b770.3": "b770.3 (Жүріс стереотипінің ауыр бұзылуы)",
    "b770.4": "b770.4 (Жүріс стереотипінің айқын/толық бұзылуы)",
    "d450.0": "d450.0 (Жүруде шектеулер жоқ)",
    "d450.1": "d450.1 (Жүрудегі жеңіл қиындықтар)",
    "d450.2": "d450.2 (Жүрудегі орташа қиындықтар)",
    "d450.3": "d450.3 (Жүрудегі ауыр қиындықтар)",
    "d450.4": "d450.4 (Өздігінен жүрудің мүмкін еместігі)",
}

def generate_clinical_narrative(summary: Dict[str, Any], lang: str = "ru") -> str:
    """
    Generates an executive medical narrative based on biomechanical metrics and ML output.
    Supports Russian ('ru') and Kazakh ('kz').
    """
    subject = summary.get("subject", "N/A")
    side = summary.get("side", "RIGHT")
    
    b_gps = _safe_float(summary.get("baseline_gps"), 10.0)
    vr_gps = _safe_float(summary.get("vr_gps"), b_gps)
    d_hip = _safe_float(summary.get("delta_amin_sagh"), 0.0)
    d_pelvis = _safe_float(summary.get("delta_gvs_pelvis"), 0.0)
    d_knee = _safe_float(summary.get("delta_gvs_knee"), 0.0)
    d_ankle = _safe_float(summary.get("delta_gvs_ankle"), 0.0)

    # Compute advanced metrics
    raw_tilt = summary.get("delta_pelvis_tilt")
    d_pelvis_tilt = _safe_float(raw_tilt) if raw_tilt is not None else None
    risk = analyze_compensation_risk(d_hip, d_pelvis, d_knee, d_ankle, delta_pelvis_term=d_pelvis_tilt)
    pcr = risk["pcr"]
    tje = risk["tje"]
    has_vr = summary.get("has_vr", summary.get("cycles_vr", 0) > 0)
    has_vb = summary.get("has_verbal", summary.get("cycles_verbal", 0) > 0)
    if not has_vr and not has_vb:
        modalities = {
            "best_method": "Baseline",
            "verdict_ru": "Зафиксирован исходный шаг (Baseline). Тестирование режимов биообратной связи (VR / Verbal) еще не проводилось.",
            "verdict_kz": "Бастапқы жүріс (Baseline) тіркелді. Кері байланыс сынамалары (VR / Verbal) әлі өткізілмеді."
        }
    else:
        modalities = compare_modalities(summary)
    if not has_vr and not has_vb:
        risk["label_ru"] = "Базовая биомеханическая оценка (Baseline)"
        risk["label_kz"] = "Базалық биомеханикалық бағалау (Baseline)"
        risk["recommendation_ru"] = "Сессия VR-терапии еще не проводилась. Зафиксирован исходный стереотип походки (Baseline)."
        risk["recommendation_kz"] = "VR-терапия сессиясы әлі өткізілмеді. Бастапқы жүріс стереотипі (Baseline) тіркелді."
    elif not has_vr and has_vb:
        risk["label_ru"] = f"Оценка вербальной биообратной связи (Verbal): {modalities['best_method']}"
        risk["label_kz"] = f"Вербалды кері байланысты бағалау (Verbal): {modalities['best_method']}"
        risk["recommendation_ru"] = modalities["verdict_ru"]
        risk["recommendation_kz"] = modalities["verdict_kz"]

    icf_b_pre = classify_icf_b770(b_gps)
    icf_b_post = classify_icf_b770(vr_gps)

    raw_anomaly = summary.get("anomaly_rate")
    if raw_anomaly is None:
        anomaly_pct = 5.0
    else:
        try:
            f_anom = float(raw_anomaly)
            if np.isnan(f_anom) or not np.isfinite(f_anom):
                anomaly_pct = 5.0
            else:
                anomaly_pct = f_anom * 100.0 if f_anom <= 1.0 else f_anom
        except (ValueError, TypeError):
            anomaly_pct = 5.0
    icf_d = classify_icf_d450(anomaly_pct)

    if lang == "kz":
        icf_pre_desc = ICF_DESCRIPTIONS_KZ.get(icf_b_pre, icf_b_pre)
        icf_post_desc = ICF_DESCRIPTIONS_KZ.get(icf_b_post, icf_b_post)
        icf_d_desc = ICF_DESCRIPTIONS_KZ.get(icf_d, icf_d)

        narrative = (
            f"КЛИНИКАЛЫҚ БИОМЕХАНИКАЛЫҚ ҚОРЫТЫНДЫ (Libra CDSS)\n"
            f"Пациент: {subject} | Зерттелген аяқ: {side}\n"
            f"--------------------------------------------------\n"
            f"1. ДДҰ ХҚЖ (МКФ/ICF) БОЙЫНША СТАТУС:\n"
            f"   • b770 (Жүріс стереотипі): {icf_pre_desc} -> {icf_post_desc}\n"
            f"   • d450 (Жүру тұрақтылығы): {icf_d_desc}\n\n"
            f"2. БИОМЕХАНИКА ЖӘНЕ БЕЙІМДЕЛУ ТАЛДАУЫ:\n"
            f"   • Санның жазылу бұрышының өзгерісі: {d_hip:+.2f}°\n"
            f"   • Шынайы буындық жазылу (TJE): {tje:+.2f}°\n"
            f"   • Патологиялық компенсация коэффициенті (PCR): {pcr:.2f}\n"
            f"   • Жамбастың еңкею девиациясы (GVS Pelvis): {d_pelvis:+.2f}°\n\n"
            f"3. ТЕРАПИЯЛЫҚ ӘДІСТІ ТАҢДАУ (Verbal vs VR):\n"
            f"   • Таңдалған тиімді әдіс: {modalities['best_method']}\n"
            f"   • Сараптама: {modalities['verdict_kz']}\n\n"
            f"4. ДӘРІГЕРГЕ АРНАЛҒАН ИИ-ҰСЫНЫМЫ:\n"
            f"   Статус: {risk['label_kz']}\n"
            f"   Нұсқаулық: {risk['recommendation_kz']}\n"
            f"--------------------------------------------------\n"
            f"НАЗАР АУДАРЫҢЫЗ (Ереже 8.4-бабы): Libra дәрігерлік шешімді қолдау жүйесі (CDSS) "
            f"болып табылады, диагноз қоймайды және емдеу препараттарын тағайындамайды. Қорытынды емдеуші "
            f"дәрігердің растауына жатады (Damumed МИС интеграциясы). Шұғыл жағдайларда және денсаулыққа қауіп "
            f"төнгенде 103 нөмірі бойынша жедел медициналық көмекке хабарласыңыз."
        )
    else:
        icf_pre_desc = ICF_DESCRIPTIONS_RU.get(icf_b_pre, icf_b_pre)
        icf_post_desc = ICF_DESCRIPTIONS_RU.get(icf_b_post, icf_b_post)
        icf_d_desc = ICF_DESCRIPTIONS_RU.get(icf_d, icf_d)

        narrative = (
            f"КЛИНИЧЕСКИЙ БИОМЕХАНИЧЕСКИЙ ПРОТОКОЛ (Libra CDSS)\n"
            f"Пациент: {subject} | Исследуемая сторона: {side}\n"
            f"--------------------------------------------------\n"
            f"1. СТАТУС ПО МКФ ВОЗ (ICF CLASSIFICATION):\n"
            f"   • b770 (Стереотип походки): {icf_pre_desc} -> {icf_post_desc}\n"
            f"   • d450 (Стабильность ходьбы): {icf_d_desc}\n\n"
            f"2. АНАЛИЗ БИОМЕХАНИКИ И КОМПЕНСАЦИЙ:\n"
            f"   • Дельта угла разгибания бедра: {d_hip:+.2f}°\n"
            f"   • Истинное суставное разгибание (TJE): {tje:+.2f}°\n"
            f"   • Коэффициент компенсации таза (PCR): {pcr:.2f}\n"
            f"   • Смещение наклона таза (GVS Pelvis): {d_pelvis:+.2f}°\n\n"
            f"3. ВЫБОР ОПТИМАЛЬНОЙ МЕТОДИКИ (Verbal vs VR):\n"
            f"   • Рекомендованный метод: {modalities['best_method']}\n"
            f"   • Обоснование: {modalities['verdict_ru']}\n\n"
            f"4. РЕКОМЕНДАЦИЯ ИИ ДЛЯ ВРАЧА-РЕАБИЛИТОЛОГА:\n"
            f"   Статус: {risk['label_ru']}\n"
            f"   Тактика: {risk['recommendation_ru']}\n"
            f"--------------------------------------------------\n"
            f"ВНИМАНИЕ (ст. 8.4 Положения): Libra является системой поддержки принятия врачебных решений (CDSS), "
            f"не ставит диагноз и не назначает лекарственные средства. Заключение подлежит обязательной верификации "
            f"лечащим врачом-реабилитологом (готов к экспорту в МИС Damumed). В экстренных случаях и опасных ситуациях "
            f"незамедлительно обращайтесь к врачу или вызывайте скорую помощь по номеру 103."
        )

    return narrative


def generate_parent_narrative(summary: Dict[str, Any], lang: str = "ru") -> str:
    """
    Generates an empathetic, plain-language summary for parents ('Баланың жүріс төлқұжаты').
    Provides descriptive observational feedback without prescribing medical treatments (Rule 8.4 compliance).
    """
    subject = summary.get("subject", "N/A")
    d_hip = _safe_float(summary.get("delta_amin_sagh"), 0.0)
    d_pelvis = _safe_float(summary.get("delta_gvs_pelvis"), 0.0)
    b_gps = _safe_float(summary.get("baseline_gps"), 10.0)
    vr_gps = _safe_float(summary.get("vr_gps"), b_gps)

    from src.core.biomechanics import compute_sagittal_gdi, analyze_compensation_risk
    d_knee = _safe_float(summary.get("delta_gvs_knee"), 0.0)
    d_ankle = _safe_float(summary.get("delta_gvs_ankle"), 0.0)
    raw_tilt = summary.get("delta_pelvis_tilt")
    d_pelvis_tilt = _safe_float(raw_tilt) if raw_tilt is not None else None
    risk = analyze_compensation_risk(d_hip, d_pelvis, d_knee, d_ankle, delta_pelvis_term=d_pelvis_tilt)
    gdi_val = compute_sagittal_gdi(vr_gps)

    # Hip improvement in degrees
    hip_straightening = abs(d_hip) if d_hip < -0.5 else 0.0
    posture_safe = risk["status"] != "red"

    if lang == "kz":
        posture_text = "Қалыпты, жамбастың патологиялық алға еңкеюі тіркелмеді" if posture_safe else "Назар аударыңыз: бала қадам басқанда жамбасын алға тым қатты еңкейтеді, белге жүктеме түседі"
        progress_text = f"Аяқтың жазылу динамикасы: жазылу бұрышы шамамен {hip_straightening:.1f}° жақсарды." if hip_straightening > 0 else "Аяқтың жазылу динамикасы: бұл сессияда айтарлықтай өзгеріс тіркелмеді."
        narrative = (
            f"БАЛАНЫҢ ЖҮРІС ТӨЛҚҰЖАТЫ (Ата-аналарға арналған ақпараттық анықтама)\n"
            f"Пациент коды: {subject} | Зерттеу түрі: Кері байланыс сынамасы (Verbal / VR)\n"
            f"--------------------------------------------------\n"
            f"1. ҚИМЫЛ-ҚОЗҒАЛЫС БАЙҚАУЫ:\n"
            f"   • {progress_text}\n"
            f"   • Жамбас пен бел қалпы: {posture_text}.\n"
            f"   • Жүрістің үйлесімділік көрсеткіші (GDI): {gdi_val:.0f} / 100 балл.\n\n"
            f"2. ҚАУІПСІЗДІК ПЕН БАҚЫЛАУ:\n"
            f"   • Жүріс параметрлері жүйе арқылы тіркелді. Шаршау белгілері дәрігерге жолданды.\n\n"
            f"3. МАҢЫЗДЫ ЕСКЕРТУ (Ереже 8.4-бабы):\n"
            f"   • Жаттығулар жиынтығы мен емдік жүктемені тек емдеуші дәрігер-реабилитолог тағайындайды.\n"
            f"   • Үйде өз бетінше емдеу жаттығуларын тағайындауға болмайды.\n"
            f"--------------------------------------------------\n"
            f"Сұрақтар туындаған жағдайда емдеуші дәрігермен кеңесіңіз. "
            f"Шұғыл жағдайларда дереу 103 жедел жәрдем қызметіне хабарласыңыз."
        )
    else:
        posture_text = "Осанка стабильная, патологического наклона таза вперед не зафиксировано" if posture_safe else "Внимание: при шаге ребенок наклоняет таз вперед, создавая нагрузку на поясницу"
        progress_text = f"Разгибание ножки: угол раскрытия сустава улучшился примерно на {hip_straightening:.1f}°." if hip_straightening > 0 else "Разгибание ножки: в данной сессии выраженной динамики не зафиксировано."
        narrative = (
            f"ПАСПОРТ ПОХОДКИ РЕБЕНКА (Информационная справка для родителей)\n"
            f"Код пациента: {subject} | Тип исследования: Проба с обратной связью (Verbal / VR)\n"
            f"--------------------------------------------------\n"
            f"1. НАБЛЮДЕНИЯ ЗА ДВИЖЕНИЕМ:\n"
            f"   • {progress_text}\n"
            f"   • Положение таза и спины: {posture_text}.\n"
            f"   • Индекс гармоничности походки (GDI): {gdi_val:.0f} из 100 баллов.\n\n"
            f"2. БЕЗОПАСНОСТЬ И УТОМЛЕНИЕ:\n"
            f"   • Параметры стабильности зафиксированы сенсорами и переданы лечащему специалисту.\n\n"
            f"3. ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ (ст. 8.4 Положения):\n"
            f"   • Двигательный режим и лечебную гимнастику назначает исключительно лечащий врач-реабилитолог на очном приеме.\n"
            f"   • Самостоятельное назначение нагрузок без согласования с врачом не допускается.\n"
            f"--------------------------------------------------\n"
            f"При любых вопросах обращайтесь к вашему лечащему врачу-реабилитологу. "
            f"В экстренных ситуациях незамедлительно звоните по номеру 103."
        )

    return narrative
