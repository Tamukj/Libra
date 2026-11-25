"""Clean A4 PDF clinical report generator for Libra using matplotlib."""

import datetime
import io
import textwrap
from typing import Any, Dict, Optional

import matplotlib
matplotlib.use("Agg")
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np

from src.core.biomechanics import is_finite_number
from src.core.i18n import get_locale


def _fmt_num(val: Any, digits: int = 2, suffix: str = "") -> str:
    if not is_finite_number(val):
        return "—"
    return f"{float(val):.{digits}f}{suffix}"


def _fmt_signed(val: Any, digits: int = 2, suffix: str = "") -> str:
    if not is_finite_number(val):
        return "—"
    return f"{float(val):+.{digits}f}{suffix}"


def _fmt_cycles(val: Any) -> str:
    return str(int(val)) if is_finite_number(val) else "—"


def _wrap_text(text: str, width: int) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        if not raw.strip():
            lines.append("")
        else:
            lines.extend(textwrap.wrap(raw, width=width, break_long_words=True))
    return lines


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
    Renders a structured A4 PDF report with trilingual support (RU / KZ / EN),
    metric table, optional sagittal hip curve comparison, clinical narrative,
    and mandatory Rule 8.2 disclaimer + model limitations.
    """
    eff_lang = lang if lang in ("ru", "kz", "en") else "ru"
    is_kz = eff_lang == "kz"
    is_en = eff_lang == "en"
    loc = get_locale(eff_lang)
    pdf_loc = loc.get("pdf", {})

    subject = str(summary.get("subject", "N/A"))
    side = str(summary.get("side") or "UNSPECIFIED").strip().upper()
    visit_label = str(
        (summary.get("visit_label_kz") if is_kz else None)
        or summary.get("visit_label")
        or summary.get("visit_key")
        or ""
    ).strip()
    visit_date = str(summary.get("visit_date") or "").strip()
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    fig = plt.figure(figsize=(8.27, 11.69), dpi=150)  # A4 portrait
    fig.patch.set_facecolor("#FFFFFF")

    ax = fig.add_axes([0.0, 0.0, 1.0, 1.0])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    font_family = "DejaVu Sans"

    # 1. Header bar
    ax.add_patch(FancyBboxPatch(
        (0.05, 0.900), 0.90, 0.068,
        boxstyle="round,pad=0.004,rounding_size=0.008",
        facecolor="#F7F5F0", edgecolor="#DDD8CE", linewidth=1.0,
    ))
    if is_kz:
        title = f"LIBRA · {'Баланың жүріс төлқұжаты' if audience == 'parent' else 'Клиникалық биомеханикалық есеп'}"
        side_display = "Сол жақ" if side == "LEFT" else ("Оң жақ" if side == "RIGHT" else "—")
        meta_line = (
            f"Пациент: {subject} | Аяқ: {side_display} | "
            f"Салмақ: {_fmt_num(summary.get('weight'), 1, ' кг')} | "
            f"Бой: {_fmt_num(summary.get('height'), 2, ' м')} | {now_str}"
        )
        visit_prefix = "Қабылдау"
    elif is_en:
        title = f"LIBRA · {'Child Gait Passport' if audience == 'parent' else 'Clinical Biomechanical Report'}"
        side_display = "Left" if side == "LEFT" else ("Right" if side == "RIGHT" else "—")
        meta_line = (
            f"Patient: {subject} | Side: {side_display} | "
            f"Weight: {_fmt_num(summary.get('weight'), 1, ' kg')} | "
            f"Height: {_fmt_num(summary.get('height'), 2, ' m')} | {now_str}"
        )
        visit_prefix = "Visit"
    else:
        title = f"LIBRA · {'Паспорт походки ребенка' if audience == 'parent' else 'Клинический биомеханический отчёт'}"
        side_display = "Левая" if side == "LEFT" else ("Правая" if side == "RIGHT" else "—")
        meta_line = (
            f"Пациент: {subject} | Сторона: {side_display} | "
            f"Вес: {_fmt_num(summary.get('weight'), 1, ' кг')} | "
            f"Рост: {_fmt_num(summary.get('height'), 2, ' м')} | {now_str}"
        )
        visit_prefix = "Визит"

    visit_meta = f"{visit_label} ({visit_date})" if (visit_label and visit_date) else (visit_label or visit_date)
    meta_lines = textwrap.wrap(meta_line, width=96, break_long_words=True)
    if visit_meta:
        ax.text(0.065, 0.952, title, fontsize=11.2, fontweight="bold", color="#1C1917", family=font_family)
        my = 0.935
        for mline in meta_lines[:2]:
            ax.text(0.065, my, mline, fontsize=7.0, color="#57534E", family=font_family)
            my -= 0.013
        ax.text(0.065, 0.906, f"{visit_prefix}: {visit_meta}", fontsize=7.2, fontweight="bold", color="#44403C", family=font_family)
    else:
        ax.text(0.065, 0.948, title, fontsize=11.6, fontweight="bold", color="#1C1917", family=font_family)
        my = 0.928
        for mline in meta_lines[:2]:
            ax.text(0.065, my, mline, fontsize=7.2, color="#57534E", family=font_family)
            my -= 0.014

    # 2. CDSS Status Banner
    status = risk.get("status", "yellow")
    status_palette = {
        "green": ("#ECFDF5", "#0F766E"),
        "yellow": ("#FFFBEB", "#B45309"),
        "red": ("#FEF2F2", "#B91C1C"),
        "unassessed": ("#F5F5F4", "#44403C"),
    }
    bg_col, fg_col = status_palette.get(status, ("#F5F5F4", "#44403C"))
    ax.add_patch(FancyBboxPatch(
        (0.05, 0.822), 0.90, 0.068,
        boxstyle="round,pad=0.004,rounding_size=0.008",
        facecolor=bg_col, edgecolor=fg_col, linewidth=1.2,
    ))
    status_label = risk.get(f"label_{eff_lang}") or risk.get("label_ru") or ""
    icf_d_txt = icf_d450 or ("жоқ" if is_kz else ("N/A" if is_en else "нет данных"))
    icf_tag = pdf_loc.get("icf_label", "ICF" if is_en else ("ХҚЖ" if is_kz else "МКФ"))
    cdss_lines = textwrap.wrap(f"CDSS: {status_label}", width=84, break_long_words=True)
    cy = 0.872 if len(cdss_lines) > 1 else 0.868
    for cline in cdss_lines[:2]:
        ax.text(0.065, cy, cline, fontsize=8.4 if len(cdss_lines) > 1 else 9.0, fontweight="bold", color=fg_col, family=font_family)
        cy -= 0.015
    method_label = "Ұсыныс" if is_kz else ("Best" if is_en else "Метод")
    metrics_pill = (
        f"TJE: {_fmt_signed(risk.get('tje'), 2, '°')}  |  "
        f"PCR: {_fmt_num(risk.get('pcr'), 2)}  |  "
        f"{method_label}: {modalities.get('best_method', 'Baseline')}  |  "
        f"{icf_tag}: {icf_b770_base} -> {icf_b770_vr}, d450: {icf_d_txt}"
    )
    ax.text(0.065, 0.833, metrics_pill, fontsize=7.6, color="#1C1917", family=font_family)

    # 3. Quantitative Metrics Table
    y_top = 0.798
    table_title = (
        "Салыстырмалы биомеханикалық кесте (Baseline / Verbal / VR)"
        if is_kz
        else ("Comparative Biomechanical Table (Baseline / Verbal / VR)" if is_en else "Сравнительная таблица параметров походки (Baseline / Verbal / VR)")
    )
    ax.text(0.05, y_top, table_title, fontsize=9.5, fontweight="bold", color="#1C1917", family=font_family)

    has_base = bool(summary.get("has_baseline", True)) and (
        int(summary.get("cycles_baseline") or 0) > 0
        or summary.get("baseline_gps") is not None
        or summary.get("baseline_amin_sagh") is not None
    )
    has_vr = bool(summary.get("has_vr")) or summary.get("vr_gps") is not None or summary.get("vr_amin_sagh") is not None
    has_vb = bool(summary.get("has_verbal")) or summary.get("verbal_gps") is not None or summary.get("verbal_amin_sagh") is not None

    if has_vr:
        delta_col_hdr = "Δ (VR - Base)"
    elif has_vb:
        delta_col_hdr = "Δ (Vb - Base)"
    else:
        delta_col_hdr = "Δ"

    headers = (
        ["Көрсеткіш", "Baseline", "Verbal", "VR", delta_col_hdr]
        if is_kz
        else (["Parameter", "Baseline", "Verbal", "VR", delta_col_hdr] if is_en else ["Параметр", "Baseline", "Verbal", "VR", delta_col_hdr])
    )

    def _row_vals(label: str, key_suffix: str, unit: str = "°") -> list[str]:
        b_v = summary.get(f"baseline_{key_suffix}") if has_base else None
        vb_v = summary.get(f"verbal_{key_suffix}") if has_vb else None
        vr_v = summary.get(f"vr_{key_suffix}") if has_vr else None
        if has_vr:
            d_v = summary.get(f"delta_{key_suffix}")
            if d_v is None and is_finite_number(vr_v) and is_finite_number(b_v):
                d_v = float(vr_v) - float(b_v)
        elif has_vb and is_finite_number(vb_v) and is_finite_number(b_v):
            d_v = float(vb_v) - float(b_v)
        else:
            d_v = None
        return [
            label,
            _fmt_num(b_v, 2, unit),
            _fmt_num(vb_v, 2, unit),
            _fmt_num(vr_v, 2, unit),
            _fmt_signed(d_v, 2, unit),
        ]

    if is_kz:
        cyc_lbl, gps_lbl, hip_lbl, pel_lbl, ghip_lbl, knee_lbl, ank_lbl = (
            "Қадам циклдері (n)",
            "Жүріс индексі (GPS_a, °)",
            "Сан жазылуы (aMinSagH, °)",
            "Жамбас GVS (Pelvis, °)",
            "Сан GVS (Hip, °)",
            "Тізе GVS (Knee, °)",
            "Тобық GVS (Ankle, °)",
        )
    elif is_en:
        cyc_lbl, gps_lbl, hip_lbl, pel_lbl, ghip_lbl, knee_lbl, ank_lbl = (
            "Gait cycles (n)",
            "Gait Profile Score (GPS_a)",
            "Min hip flexion (aMinSagH)",
            "Pelvis GVS (aSagP)",
            "Hip GVS (aSagH)",
            "Knee GVS (aSagK)",
            "Ankle GVS (aSagA)",
        )
    else:
        cyc_lbl, gps_lbl, hip_lbl, pel_lbl, ghip_lbl, knee_lbl, ank_lbl = (
            "Циклы шага (n)",
            "Индекс профиля (GPS_a, °)",
            "Разгибание бедра (aMinSagH)",
            "Отклонение таза (GVS_P)",
            "Отклонение бедра (GVS_H)",
            "Отклонение колена (GVS_K)",
            "Отклонение стопы (GVS_A)",
        )

    rows = [
        [
            cyc_lbl,
            _fmt_cycles(summary.get("cycles_baseline")),
            _fmt_cycles(summary.get("cycles_verbal")),
            _fmt_cycles(summary.get("cycles_vr")),
            "—",
        ],
        _row_vals(gps_lbl, "gps"),
        _row_vals(hip_lbl, "amin_sagh"),
        _row_vals(pel_lbl, "gvs_pelvis"),
        _row_vals(ghip_lbl, "gvs_hip"),
        _row_vals(knee_lbl, "gvs_knee"),
        _row_vals(ank_lbl, "gvs_ankle"),
    ]

    col_x = [0.055, 0.48, 0.59, 0.70, 0.81]
    row_h = 0.0205
    y_cur = y_top - 0.023
    ax.add_patch(FancyBboxPatch(
        (0.05, y_cur - 0.004), 0.90, row_h,
        boxstyle="square,pad=0", facecolor="#EDE8DF", edgecolor="#D6D0C4", linewidth=0.7,
    ))
    for cx, h_txt in zip(col_x, headers):
        ax.text(cx, y_cur + 0.0025, h_txt, fontsize=8.0, fontweight="bold", color="#1C1917", family=font_family)

    for idx, r in enumerate(rows):
        y_cur -= row_h
        bg = "#FAF8F5" if idx % 2 == 1 else "#FFFFFF"
        ax.add_patch(FancyBboxPatch(
            (0.05, y_cur - 0.004), 0.90, row_h,
            boxstyle="square,pad=0", facecolor=bg, edgecolor="#E7E2D9", linewidth=0.5,
        ))
        for cx, cell in zip(col_x, r):
            ax.text(cx, y_cur + 0.0025, cell, fontsize=7.8, color="#1C1917", family=font_family)

    # 4. Optional Hip Kinematics Mini-Chart (0-100% gait cycle)
    narrative_top = y_cur - 0.024
    if hip_curves and (hip_curves.get("baseline") or hip_curves.get("vr") or hip_curves.get("verbal")):
        chart_bottom = y_cur - 0.185
        chart_ax = fig.add_axes([0.10, chart_bottom + 0.030, 0.82, 0.125])
        raw_t = hip_curves.get("time_percent") or list(range(0, 102, 2))
        norm_mean = hip_curves.get("norm_mean")
        norm_std = hip_curves.get("norm_std")
        if norm_mean and norm_std and len(norm_mean) == len(norm_std):
            t_norm = raw_t if len(raw_t) == len(norm_mean) else np.linspace(0, 100, len(norm_mean))
            upper = [m + s for m, s in zip(norm_mean, norm_std)]
            lower = [m - s for m, s in zip(norm_mean, norm_std)]
            chart_ax.fill_between(
                t_norm, lower, upper, color="#D6D3D1", alpha=0.45,
                label=pdf_loc.get("norm_legend", "TD Norm (±1 SD)"),
            )

        def _plot_series(vals: Any, **kwargs):
            if not vals:
                return
            x_vals = raw_t if len(raw_t) == len(vals) else np.linspace(0, 100, len(vals))
            chart_ax.plot(x_vals, vals, **kwargs)

        if hip_curves.get("baseline"):
            _plot_series(
                hip_curves["baseline"], color="#3B82F6", linewidth=1.4,
                label="Базалық" if is_kz else ("Baseline" if is_en else "Обычная ходьба"),
            )
        if hip_curves.get("verbal"):
            _plot_series(
                hip_curves["verbal"], color="#D97706", linewidth=1.2, linestyle="--",
                label="Ауызша" if is_kz else ("Verbal" if is_en else "Голос"),
            )
        if hip_curves.get("vr"):
            _plot_series(hip_curves["vr"], color="#0F766E", linewidth=1.6, label="VR")

        chart_ax.axhline(0, color="#A8A29E", linewidth=0.6, linestyle=":")
        chart_title = (
            "Сагиттальді сан қисығы (aSagH, 0–100% цикл)"
            if is_kz
            else ("Sagittal Hip Kinematics (aSagH, 0–100% GC)" if is_en else "Сагиттальная кинематика бедра (aSagH, 0–100% цикла)")
        )
        chart_ax.set_title(chart_title, fontsize=8.5, fontweight="bold", family=font_family, pad=4)
        chart_ax.set_xlabel("% циклі" if is_kz else ("% gait cycle" if is_en else "% цикла шага"), fontsize=7.5, family=font_family)
        chart_ax.set_ylabel("°", fontsize=8, family=font_family)
        chart_ax.tick_params(labelsize=7)
        chart_ax.grid(alpha=0.25, linewidth=0.5)
        chart_ax.legend(fontsize=6.8, loc="upper right", ncol=4, frameon=True)
        narrative_top = chart_bottom - 0.012

    # 5. Clinical / Parent Narrative Block (guaranteed no right overflow & zero vertical overlap)
    sec_hdr = (
        "Қорытынды және ұсынымдар"
        if is_kz
        else ("Conclusions & Clinical Recommendations" if is_en else "Заключение и рекомендации")
    )
    ax.text(0.05, narrative_top, sec_hdr, fontsize=9.5, fontweight="bold", color="#1C1917", family=font_family)

    wrapped_lines = _wrap_text(narrative, width=74)
    box_bottom = 0.088
    box_top = narrative_top - 0.012
    ax.add_patch(FancyBboxPatch(
        (0.05, box_bottom), 0.90, max(0.08, box_top - box_bottom),
        boxstyle="round,pad=0.004,rounding_size=0.008",
        facecolor="#FAF8F5", edgecolor="#DDD8CE", linewidth=0.8,
    ))

    font_sz = 6.6
    min_step = 0.0115
    line_y = box_top - 0.014
    avail_h = max(0.04, line_y - (box_bottom + 0.008))
    max_lines = max(1, int(avail_h // min_step))
    display_lines = wrapped_lines[:max_lines]
    overflow_lines = wrapped_lines[max_lines:]
    line_step = min(0.0135, avail_h / max(1, len(display_lines))) if not overflow_lines else min_step

    for line in display_lines:
        if line_y < box_bottom + 0.008:
            break
        ax.text(0.062, line_y, line, fontsize=font_sz, color="#1C1917", family=font_family)
        line_y -= line_step

    # 6. Mandatory Footer (Rule 8.2, model limitations N=29 sagittal-only, & Emergency 103)
    if is_kz:
        footer_raw = (
            "Ескерту және шектеулер (Ереже 8.2-т.): Libra СППР диагноз қоймайды, N=29 іріктемесінде "
            "тек сагиттальді кинематикада калибрленген. Дәрігер тексеруі міндетті; шұғыл көмек: 103."
        )
    elif is_en:
        footer_raw = (
            "Limitations & Notice (Rule 8.2): Libra is an advisory CDSS calibrated on N=29 (sagittal kinematics only); "
            "it does not diagnose or prescribe. Physician confirmation required; emergency: 103."
        )
    else:
        footer_raw = (
            "Ограничения и примечание (п. 8.2): Libra — СППР, не ставит диагноз; модель калибрована на выборке N=29 "
            "(только сагиттальная кинематика). Нужен контроль врача; экстренная помощь: 103."
        )
    footer_lines = textwrap.wrap(footer_raw, width=98)

    def _draw_footer(target_ax):
        fy = 0.068
        for fline in footer_lines:
            target_ax.text(0.05, fy, fline, fontsize=7.0, fontweight="bold", color="#B45309", family=font_family)
            fy -= 0.013

    _draw_footer(ax)

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        pdf.savefig(fig)
        plt.close(fig)

        while overflow_lines:
            fig_ov = plt.figure(figsize=(8.27, 11.69), dpi=150)
            fig_ov.patch.set_facecolor("#FFFFFF")
            ax_ov = fig_ov.add_axes([0.0, 0.0, 1.0, 1.0])
            ax_ov.set_xlim(0, 1)
            ax_ov.set_ylim(0, 1)
            ax_ov.axis("off")

            ax_ov.text(0.05, 0.950, f"{title} · {subject}", fontsize=10.5, fontweight="bold", color="#1C1917", family=font_family)
            ov_box_top = 0.928
            ax_ov.add_patch(FancyBboxPatch(
                (0.05, box_bottom), 0.90, ov_box_top - box_bottom,
                boxstyle="round,pad=0.004,rounding_size=0.008",
                facecolor="#FAF8F5", edgecolor="#DDD8CE", linewidth=0.8,
            ))
            ov_y = ov_box_top - 0.016
            ov_avail = ov_y - (box_bottom + 0.008)
            ov_max = max(1, int(ov_avail // min_step))
            chunk = overflow_lines[:ov_max]
            overflow_lines = overflow_lines[ov_max:]
            for line in chunk:
                ax_ov.text(0.062, ov_y, line, fontsize=font_sz, color="#1C1917", family=font_family)
                ov_y -= min_step
            _draw_footer(ax_ov)
            pdf.savefig(fig_ov)
            plt.close(fig_ov)

    return buf.getvalue()
