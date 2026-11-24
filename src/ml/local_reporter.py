"""Local AI Clinical Reporter.
Generates structured, bilingual (KZ / RU) medical summaries for clinicians,
fully mapped to WHO ICF (b770 / d450) and Clinical Decision Support (CDSS) standards.
"""

from typing import Dict, Any
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
    
    b_gps = summary.get("baseline_gps", 10.0)
    vr_gps = summary.get("vr_gps", b_gps)
    d_hip = summary.get("delta_amin_sagh", 0.0)
    d_pelvis = summary.get("delta_gvs_pelvis", 0.0)
    d_knee = summary.get("delta_gvs_knee", 0.0)
    d_ankle = summary.get("delta_gvs_ankle", 0.0)

    # Compute advanced metrics
    risk = analyze_compensation_risk(d_hip, d_pelvis, d_knee, d_ankle)
    pcr = risk["pcr"]
    tje = risk["tje"]
    modalities = compare_modalities(summary)

    icf_b_pre = classify_icf_b770(b_gps)
    icf_b_post = classify_icf_b770(vr_gps)
    icf_d = classify_icf_d450(summary.get("anomaly_rate", 5.0) * 100 if summary.get("anomaly_rate", 0.0) < 1.0 else summary.get("anomaly_rate", 5.0))

    if lang == "kz":
        icf_pre_desc = ICF_DESCRIPTIONS_KZ.get(icf_b_pre, icf_b_pre)
        icf_post_desc = ICF_DESCRIPTIONS_KZ.get(icf_b_post, icf_b_post)
        icf_d_desc = ICF_DESCRIPTIONS_KZ.get(icf_d, icf_d)

        narrative = (
            f"КЛИНИКАЛЫҚ БИОМЕХАНИКАЛЫҚ ҚОРЫТЫНДЫ (GaitAI CDSS)\n"
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
            f"Ескерту: Бұл құжат дәрігерлік шешімді қолдау жүйесі (CDSS) арқылы жасалған "
            f"және емдеуші дәрігердің растауына жатады (Damumed МИС-ке интеграциялауға дайын)."
        )
    else:
        icf_pre_desc = ICF_DESCRIPTIONS_RU.get(icf_b_pre, icf_b_pre)
        icf_post_desc = ICF_DESCRIPTIONS_RU.get(icf_b_post, icf_b_post)
        icf_d_desc = ICF_DESCRIPTIONS_RU.get(icf_d, icf_d)

        narrative = (
            f"КЛИНИЧЕСКИЙ БИОМЕХАНИЧЕСКИЙ ПРОТОКОЛ (GaitAI CDSS)\n"
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
            f"Дисклеймер: Заключение сформировано модулем поддержки принятия решений (CDSS) "
            f"и подлежит верификации лечащим врачом-реабилитологом (готов к экспорту в МИС Damumed)."
        )

    return narrative
