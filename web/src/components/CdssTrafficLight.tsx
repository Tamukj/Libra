"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { PatientAnalysis, GaitCondition } from "@/lib/types";
import { translations } from "@/lib/translations";

interface CdssProps {
  analysis: PatientAnalysis;
  lang: "ru" | "kz";
}

function isFiniteNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function CdssTrafficLight({ analysis, lang }: CdssProps) {
  const t = translations[lang];
  const cdss_risk = analysis.cdss_risk || analysis.cdss || {
    status: "yellow" as const,
    pcr: null,
    tje: null,
    label_ru: "Оценка данных",
    label_kz: "Деректерді бағалау",
    recommendation_ru: "Ожидание результатов биомеханического анализа.",
    recommendation_kz: "Биомеханикалық талдау нәтижелерін күту.",
  };

  const { summary, icf } = analysis;
  const tjeVal = isFiniteNum(cdss_risk.tje) ? cdss_risk.tje : null;
  const pcrVal = isFiniteNum(cdss_risk.pcr) ? cdss_risk.pcr : null;

  const hasVr = Boolean(
    summary.has_vr ||
      (summary.vr_cycles ?? summary.cycles_vr ?? 0) > 0 ||
      isFiniteNum(summary.vr_amin_sagh)
  );
  const hasVerbal = Boolean(
    summary.has_verbal ||
      (summary.verbal_cycles ?? summary.cycles_verbal ?? 0) > 0 ||
      isFiniteNum(summary.verbal_amin_sagh)
  );
  const activeModality: GaitCondition =
    summary.active_modality ?? (hasVr ? "VR" : hasVerbal ? "Verbal" : "Baseline");

  const activePostHip = isFiniteNum(summary.active_post_amin_sagh)
    ? summary.active_post_amin_sagh
    : activeModality === "VR"
    ? summary.vr_amin_sagh ?? null
    : activeModality === "Verbal"
    ? summary.verbal_amin_sagh ?? null
    : null;

  const activeDeltaHip = isFiniteNum(summary.active_delta_amin_sagh)
    ? summary.active_delta_amin_sagh
    : activeModality === "VR"
    ? summary.delta_amin_sagh ?? null
    : activeModality === "Verbal" &&
      isFiniteNum(summary.verbal_amin_sagh) &&
      isFiniteNum(summary.baseline_amin_sagh)
    ? summary.verbal_amin_sagh - summary.baseline_amin_sagh
    : null;

  const activeDeltaPelvis =
    activeModality === "VR"
      ? summary.delta_gvs_pelvis ?? null
      : activeModality === "Verbal" &&
        isFiniteNum(summary.verbal_gvs_pelvis) &&
        isFiniteNum(summary.baseline_gvs_pelvis)
      ? summary.verbal_gvs_pelvis - summary.baseline_gvs_pelvis
      : null;

  const activePostGps =
    activeModality === "VR"
      ? summary.vr_gps ?? null
      : activeModality === "Verbal"
      ? summary.verbal_gps ?? null
      : null;

  const postB770 = icf.b770_post || icf.b770_vr;
  const comparisonArrowLabel = activeModality === "Verbal" ? "Base → Verbal" : "Base → VR";

  const statusConfig = {
    green: {
      bg: "var(--teal-bg)",
      border: "var(--teal-border)",
      color: "var(--teal)",
      badgeClass: "badge-green",
      icon: CheckCircle2,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
    yellow: {
      bg: "var(--amber-bg)",
      border: "var(--amber-border)",
      color: "var(--amber)",
      badgeClass: "badge-yellow",
      icon: AlertTriangle,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
    red: {
      bg: "var(--red-bg)",
      border: "var(--red-border)",
      color: "var(--red)",
      badgeClass: "badge-red",
      icon: AlertOctagon,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
    unassessed: {
      bg: "var(--sidebar)",
      border: "var(--line)",
      color: "var(--ink)",
      badgeClass: "badge-neutral",
      icon: AlertTriangle,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
  }[cdss_risk.status] || {
    bg: "var(--sidebar)",
    border: "var(--line)",
    color: "var(--ink)",
    badgeClass: "badge-neutral",
    icon: AlertTriangle,
    title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru,
  };

  const StatusIcon = statusConfig.icon;
  const recommendationText = lang === "kz" ? cdss_risk.recommendation_kz : cdss_risk.recommendation_ru;

  const baseHipStr = isFiniteNum(summary.baseline_amin_sagh)
    ? `${summary.baseline_amin_sagh.toFixed(1)}°`
    : "—";
  const postHipStr = isFiniteNum(activePostHip) ? `${activePostHip.toFixed(1)}°` : "—";

  const hipSubtext = (() => {
    if (activeModality === "Baseline") {
      return `${baseHipStr} · ${lang === "kz" ? "Тек базалық сынама" : "Только базовая проба"}`;
    }
    if (!isFiniteNum(activeDeltaHip)) {
      return `${baseHipStr} → ${postHipStr} (${comparisonArrowLabel}) · ${
        lang === "kz" ? "Салыстыру дерегі жоқ" : "Нет пары для сравнения"
      }`;
    }
    const impact =
      activeDeltaHip <= -2.0
        ? lang === "kz"
          ? "Айқын оң нәтиже"
          : "Клинически значимо"
        : activeDeltaHip <= -1.0
        ? lang === "kz"
          ? "Орташа жақсару"
          : "Умеренный отклик"
        : lang === "kz"
        ? "Динамикасыз"
        : "Без динамики";
    return `${baseHipStr} → ${postHipStr} (${comparisonArrowLabel}) · ${impact}`;
  })();

  return (
    <section
      aria-label={lang === "kz" ? "Қауіпсіздік бағдаршамы" : "Клинический светофор"}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      {/* Top Status Banner */}
      <div
        style={{
          background: statusConfig.bg,
          border: `1px solid ${statusConfig.border}`,
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ color: statusConfig.color, marginTop: "2px", flexShrink: 0 }}>
          <StatusIcon size={20} strokeWidth={1.7} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: statusConfig.color }}>
              {statusConfig.title}
            </span>
            <span className={`badge ${statusConfig.badgeClass} tabular-nums`}>
              PCR = {pcrVal !== null ? pcrVal.toFixed(2) : "—"}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.55 }}>
            <strong>{t.recommendation}:</strong> {recommendationText}
          </p>
          {cdss_risk.status === "red" && (
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--red)", fontWeight: 500 }}>
              {lang === "kz"
                ? "Назар аударыңыз: шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз. Жүйе диагноз қоймайды (Ереже 8.2-т.)."
                : "В экстренных ситуациях вызывайте скорую помощь 103. СППР не ставит диагноз (п. 8.2 Положения)."}
            </p>
          )}
        </div>
      </div>

      {/* 4 Unified Metric Cells */}
      <div className="grid-kpi-4">
        <div className="surface" style={{ padding: "16px" }} title={t.tooltip_delta_hip}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {lang === "kz" ? "Санның жазылу өсімі" : "Разгибание бедра (ΔaMinSagH)"}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              lineHeight: 1.15,
              color: isFiniteNum(activeDeltaHip) && activeDeltaHip <= -1.0 ? "var(--teal)" : "var(--ink)",
            }}
          >
            {isFiniteNum(activeDeltaHip)
              ? `${activeDeltaHip > 0 ? `+${activeDeltaHip.toFixed(1)}` : activeDeltaHip.toFixed(1)}°`
              : "—"}
          </div>
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {hipSubtext}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px" }} title={t.tooltip_tje}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.tje_title}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: "24px",
              fontWeight: 600,
              lineHeight: 1.15,
              color:
                tjeVal === null
                  ? "var(--ink)"
                  : tjeVal <= -1.0
                  ? "var(--teal)"
                  : tjeVal > 0.5
                  ? "var(--red)"
                  : "var(--amber)",
            }}
          >
            {tjeVal !== null ? `${tjeVal > 0 ? `+${tjeVal.toFixed(1)}` : tjeVal.toFixed(1)}°` : "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {t.tje_desc}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px" }} title={t.tooltip_pcr}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.pcr_title}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              className="tabular-nums"
              style={{
                fontSize: "24px",
                fontWeight: 600,
                lineHeight: 1.15,
                color:
                  pcrVal === null
                    ? "var(--ink)"
                    : pcrVal > 0.8
                    ? "var(--red)"
                    : pcrVal >= 0.4
                    ? "var(--amber)"
                    : "var(--teal)",
              }}
            >
              {pcrVal !== null ? pcrVal.toFixed(2) : "—"}
            </span>
            {pcrVal !== null && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {pcrVal > 0.8
                  ? lang === "kz"
                    ? "Жоғары"
                    : "Высокий риск"
                  : pcrVal >= 0.4
                  ? lang === "kz"
                    ? "Орташа"
                    : "Умеренно"
                  : lang === "kz"
                  ? "Қалыпты"
                  : "В норме"}
              </span>
            )}
          </div>
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {isFiniteNum(activeDeltaPelvis)
              ? lang === "kz"
                ? `Жамбас ауытқуы: ${activeDeltaPelvis > 0 ? `+${activeDeltaPelvis.toFixed(1)}` : activeDeltaPelvis.toFixed(1)}°`
                : `Отклонение таза: ${activeDeltaPelvis > 0 ? `+${activeDeltaPelvis.toFixed(1)}` : activeDeltaPelvis.toFixed(1)}°`
              : lang === "kz"
              ? "Жамбас ауытқуы: —"
              : "Отклонение таза: —"}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px" }} title={t.tooltip_icf}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.icf_title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)" }}>b770</span>
              <span className="tabular-nums" style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>
                {icf.b770_baseline}
                {postB770 && postB770 !== "N/A" ? ` → ${postB770}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)" }}>d450</span>
              <span className="tabular-nums" style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>
                {icf.d450 === "N/A" ? (lang === "kz" ? "Бағаланбады" : "Нет кривых") : icf.d450}
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: "12px",
              color:
                isFiniteNum(activePostGps) &&
                isFiniteNum(summary.baseline_gps) &&
                activePostGps < summary.baseline_gps
                  ? "var(--teal)"
                  : "var(--muted)",
              marginTop: "6px",
            }}
          >
            {activeModality === "Baseline"
              ? lang === "kz"
                ? "Базалық сынама бойынша"
                : "Оценено по базовой пробе"
              : !isFiniteNum(activePostGps) || !isFiniteNum(summary.baseline_gps)
              ? lang === "kz"
                ? `Салыстырмалы ${activeModality} дерегі жоқ`
                : `Нет парной ${activeModality}-пробы`
              : activePostGps < summary.baseline_gps
              ? lang === "kz"
                ? "Жүріс профилі (GPS) жақсарды"
                : "Индекс походки GPS улучшился"
              : lang === "kz"
              ? "Ауытқу сақталған"
              : "Отклонение GPS сохраняется"}
          </div>
        </div>
      </div>
    </section>
  );
}
