"""Clean A4 PDF clinical report generator for Libra using matplotlib."""

import datetime
import io
import textwrap
from typing import Any, Dict, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


def _fmt_num(val: Any, digits: int = 2, suffix: str = "") -> str:
    if val is None:
        return "—"
    try:
        f = float(val)
        if f != f:  # NaN
            return "—"
        return f"{f:.{digits}f}{suffix}"
    except (ValueError, TypeError):
        return "—"


def _fmt_signed(val: Any, digits: int = 2, suffix: str = "") -> str:
    if val is None:
        return "—"
    try:
        f = float(val)
        if f != f:
            return "—"
        return f"{f:+.{digits}f}{suffix}"
    except (ValueError, TypeError):
        return "—"


def generate_pdf_report(
    summary: Dict[str, Any],
    risk: Dict[str, Any],
    modalities: Dict[str, Any],
    icf_b770_base: str,
    icf_b770_vr: str,
    icf_d450: Optional[str],
    narrative: str,
    lang: str = "ru",
    audience: str = "doctor",
    hip_curves: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Renders a structured A4 PDF report with bilingual Cyrillic support (RU / KZ),
    metric table, optional sagittal hip curve comparison, clinical narrative,
    and mandatory Rule 8.4 disclaimer.
    """
    is_kz = lang == "kz"
    subject = str(summary.get("subject", "N/A"))
    side = str(summary.get("side", "RIGHT"))
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    fig = plt.figure(figsize=(8.27, 11.69), dpi=150)  # A4 portrait
    fig.patch.set_facecolor("#FFFFFF")

    # Main page canvas axes in normalized [0..1] coordinates
    ax = fig.add_axes([0.0, 0.0, 1.0, 1.0])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    font_family = "DejaVu Sans"

    # 1. Header bar
    ax.add_patch(FancyBboxPatch(
        (0.05, 0.905), 0.90, 0.06,
        boxstyle="round,pad=0.004,rounding_size=0.008",
        facecolor="#F7F5F0", edgecolor="#DDD8CE", linewidth=1.0
    ))
    title = (
        f"LIBRA · {'Баланың жүріс төлқұжаты' if audience == 'parent' else 'Клиникалық биомеханикалық есеп'}"
        if is_kz
        else f"LIBRA · {'Паспорт походки ребенка' if audience == 'parent' else 'Клинический биомеханический отчёт'}"
    )
    ax.text(0.07, 0.943, title, fontsize=13, fontweight="bold", color="#1C1917", family=font_family)

    meta_line = (
        f"Пациент: {subject}  |  {'Аяқ' if is_kz else 'Сторона'}: {side}  |  "
        f"{'Салмағы' if is_kz else 'Вес'}: {_fmt_num(summary.get('weight'), 1, ' кг')}  |  "
        f"{'Бойы' if is_kz else 'Рост'}: {_fmt_num(summary.get('height'), 2, ' м')}  |  {now_str}"
    )
    ax.text(0.07, 0.917, meta_line, fontsize=8.5, color="#57534E", family=font_family)

    # 2. CDSS Status Banner
    status = risk.get("status", "yellow")
    status_palette = {
        "green": ("#ECFDF5", "#0F766E"),
        "yellow": ("#FFFBEB", "#B45309"),
        "red": ("#FEF2F2", "#B91C1C"),
    }
    bg_col, fg_col = status_palette.get(status, ("#F5F5F4", "#44403C"))
    ax.add_patch(FancyBboxPatch(
        (0.05, 0.825), 0.90, 0.065,
        boxstyle="round,pad=0.004,rounding_size=0.008",
        facecolor=bg_col, edgecolor=fg_col, linewidth=1.2
    ))
    status_label = risk.get("label_kz" if is_kz else "label_ru", "")
    icf_d_txt = icf_d450 or ("жоқ" if is_kz else "нет данных")
    ax.text(0.07, 0.868, f"CDSS: {status_label}", fontsize=10, fontweight="bold", color=fg_col, family=font_family)
    metrics_pill = (
        f"TJE: {_fmt_signed(risk.get('tje'), 2, '°')}   |   "
        f"PCR: {_fmt_num(risk.get('pcr'), 2)}   |   "
        f"{'Ұсынылған әдіс' if is_kz else 'Оптимальный метод'}: {modalities.get('best_method', 'Baseline')}   |   "
        f"ICF: {icf_b770_base} -> {icf_b770_vr}, d450: {icf_d_txt}"
    )
    ax.text(0.07, 0.840, metrics_pill, fontsize=8.5, color="#1C1917", family=font_family)

    # 3. Quantitative Metrics Table
    y_top = 0.800
    ax.text(
        0.05, y_top,
        "Салыстырмалы биомеханикалық кесте (Baseline / Verbal / VR)" if is_kz else "Сравнительная таблица параметров походки (Baseline / Verbal / VR)",
        fontsize=10, fontweight="bold", color="#1C1917", family=font_family
    )

    headers = (
        ["Көрсеткіш", "Baseline", "Verbal", "VR", "Δ (VR - Base)"]
        if is_kz
        else ["Параметр", "Baseline", "Verbal", "VR", "Δ (VR - Base)"]
    )
    rows = [
        [
            "Цикл саны / Число циклов",
            str(summary.get("cycles_baseline", 0)),
            str(summary.get("cycles_verbal", 0)),
            str(summary.get("cycles_vr", 0)),
            "—",
        ],
        [
            "GPS_a (Индекс походки, °)",
            _fmt_num(summary.get("baseline_gps"), 2, "°"),
            _fmt_num(summary.get("verbal_gps"), 2, "°"),
            _fmt_num(summary.get("vr_gps"), 2, "°"),
            _fmt_signed(summary.get("delta_gps"), 2, "°"),
        ],
        [
            "aMinSagH (Разгибание бедра, °)",
            _fmt_num(summary.get("baseline_amin_sagh"), 2, "°"),
            _fmt_num(summary.get("verbal_amin_sagh"), 2, "°"),
            _fmt_num(summary.get("vr_amin_sagh"), 2, "°"),
            _fmt_signed(summary.get("delta_amin_sagh"), 2, "°"),
        ],
        [
            "GVS Pelvis (Таз, °)",
            _fmt_num(summary.get("baseline_gvs_pelvis"), 2, "°"),
            _fmt_num(summary.get("verbal_gvs_pelvis"), 2, "°"),
            _fmt_num(summary.get("vr_gvs_pelvis"), 2, "°"),
            _fmt_signed(summary.get("delta_gvs_pelvis"), 2, "°"),
        ],
        [
            "GVS Hip (Бедро, °)",
            _fmt_num(summary.get("baseline_gvs_hip"), 2, "°"),
            _fmt_num(summary.get("verbal_gvs_hip"), 2, "°"),
            _fmt_num(summary.get("vr_gvs_hip"), 2, "°"),
            _fmt_signed(summary.get("delta_gvs_hip"), 2, "°"),
        ],
        [
            "GVS Knee (Колено, °)",
            _fmt_num(summary.get("baseline_gvs_knee"), 2, "°"),
            _fmt_num(summary.get("verbal_gvs_knee"), 2, "°"),
            _fmt_num(summary.get("vr_gvs_knee"), 2, "°"),
            _fmt_signed(summary.get("delta_gvs_knee"), 2, "°"),
        ],
        [
            "GVS Ankle (Стопа, °)",
            _fmt_num(summary.get("baseline_gvs_ankle"), 2, "°"),
            _fmt_num(summary.get("verbal_gvs_ankle"), 2, "°"),
            _fmt_num(summary.get("vr_gvs_ankle"), 2, "°"),
            _fmt_signed(summary.get("delta_gvs_ankle"), 2, "°"),
        ],
    ]

    col_x = [0.055, 0.44, 0.57, 0.70, 0.83]
    row_h = 0.0205
    y_cur = y_top - 0.023
    ax.add_patch(FancyBboxPatch(
        (0.05, y_cur - 0.004), 0.90, row_h,
        boxstyle="square,pad=0", facecolor="#EDE8DF", edgecolor="#D6D0C4", linewidth=0.7
    ))
    for cx, h_txt in zip(col_x, headers):
        ax.text(cx, y_cur + 0.0025, h_txt, fontsize=8.3, fontweight="bold", color="#1C1917", family=font_family)

    for idx, r in enumerate(rows):
        y_cur -= row_h
        bg = "#FAF8F5" if idx % 2 == 1 else "#FFFFFF"
        ax.add_patch(FancyBboxPatch(
            (0.05, y_cur - 0.004), 0.90, row_h,
            boxstyle="square,pad=0", facecolor=bg, edgecolor="#E7E2D9", linewidth=0.5
        ))
        for cx, cell in zip(col_x, r):
            ax.text(cx, y_cur + 0.0025, cell, fontsize=8.0, color="#1C1917", family=font_family)

    # 4. Optional Hip Kinematics Mini-Chart (0-100% gait cycle)
    narrative_top = y_cur - 0.025
    if hip_curves and hip_curves.get("baseline") and hip_curves.get("vr"):
        chart_bottom = y_cur - 0.190
        chart_ax = fig.add_axes([0.10, chart_bottom + 0.030, 0.82, 0.130])
        t_pct = hip_curves.get("time_percent") or list(range(0, 102, 2))
        norm_mean = hip_curves.get("norm_mean")
        norm_std = hip_curves.get("norm_std")
        if norm_mean and norm_std and len(norm_mean) == len(t_pct):
            upper = [m + s for m, s in zip(norm_mean, norm_std)]
            lower = [m - s for m, s in zip(norm_mean, norm_std)]
            chart_ax.fill_between(t_pct, lower, upper, color="#D6D3D1", alpha=0.45, label="TD ±1 SD")
        chart_ax.plot(t_pct, hip_curves["baseline"], color="#3B82F6", linewidth=1.4, label="Baseline")
        if hip_curves.get("verbal"):
            chart_ax.plot(t_pct, hip_curves["verbal"], color="#D97706", linewidth=1.2, linestyle="--", label="Verbal")
        chart_ax.plot(t_pct, hip_curves["vr"], color="#0F766E", linewidth=1.6, label="VR")
        chart_ax.axhline(0, color="#A8A29E", linewidth=0.6, linestyle=":")
        chart_ax.set_title(
            "Сагиттальді сан қисығы (aSagH, 0–100% цикл)" if is_kz else "Сагиттальная кинематика бедра (aSagH, 0–100% цикла)",
            fontsize=8.5, fontweight="bold", family=font_family, pad=4
        )
        chart_ax.set_xlabel("% GC", fontsize=7.5, family=font_family)
        chart_ax.set_ylabel("°", fontsize=8, family=font_family)
        chart_ax.tick_params(labelsize=7)
        chart_ax.grid(alpha=0.25, linewidth=0.5)
        chart_ax.legend(fontsize=7, loc="upper right", ncol=4, frameon=True)
        narrative_top = chart_bottom - 0.012

    # 5. Clinical / Parent Narrative Block
    ax.text(
        0.05, narrative_top,
        "Қорытынды және ұсынымдар" if is_kz else "Заключение и рекомендации",
        fontsize=9.8, fontweight="bold", color="#1C1917", family=font_family
    )

    wrapped_lines = []
    for raw_line in narrative.splitlines():
        if not raw_line.strip():
            wrapped_lines.append("")
        else:
            wrapped_lines.extend(textwrap.wrap(raw_line, width=104))

    # Fit narrative lines cleanly above footer disclaimer
    box_bottom = 0.072
    box_top = narrative_top - 0.012
    ax.add_patch(FancyBboxPatch(
        (0.05, box_bottom), 0.90, max(0.08, box_top - box_bottom),
        boxstyle="round,pad=0.004,rounding_size=0.008",
        facecolor="#FAF8F5", edgecolor="#DDD8CE", linewidth=0.8
    ))

    line_y = box_top - 0.014
    avail_h = max(0.05, line_y - (box_bottom + 0.008))
    n_lines = max(1, len(wrapped_lines))
    line_step = min(0.013, avail_h / n_lines)
    font_sz = 7.3 if line_step >= 0.0115 else 6.6
    for line in wrapped_lines:
        if line_y < box_bottom + 0.006:
            break
        ax.text(0.065, line_y, line, fontsize=font_sz, color="#1C1917", family=font_family)
        line_y -= line_step

    # 6. Mandatory Footer (Rule 8.4 & Emergency 103)
    footer_txt = (
        "Ескерту (8.4-бап): Libra СППР болып табылады, диагноз қоймайды. Шұғыл жағдайда 103 нөміріне қоңырау шалыңыз."
        if is_kz
        else "Примечание (ст. 8.4): Libra является СППР, не ставит диагноз и не назначает лечение. Экстренная помощь: 103."
    )
    ax.text(0.05, 0.050, footer_txt, fontsize=8, fontweight="bold", color="#B45309", family=font_family)

    buf = io.BytesIO()
    fig.savefig(buf, format="pdf")
    plt.close(fig)
    return buf.getvalue()
