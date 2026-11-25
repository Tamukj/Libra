"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { PatientAnalysis, GaitCondition } from "@/lib/types";
import { translations } from "@/lib/translations";
import { isFiniteNum, fmtFixed, fmtSigned, fmtPcr, cleanClinicalText } from "@/lib/format";

interface CdssProps {
  analysis: PatientAnalysis;
  lang: "ru" | "kz";
}

export function CdssTrafficLight({ analysis, lang }: CdssProps) {
  const isKz = lang === "kz";
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
  const comparisonPairLabel =
    activeModality === "Verbal"
      ? isKz
        ? "Қалыпты → Ауызша"
        : "Обычная → Голос"
      : isKz
      ? "Қалыпты → VR"
      : "Обычная → VR";

  const statusConfig = {
    green: {
      calloutClass: "callout callout-teal",
      color: "var(--teal)",
      badgeClass: "badge-green",
      icon: CheckCircle2,
      title: isKz ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
    yellow: {
      calloutClass: "callout callout-amber",
      color: "var(--amber)",
      badgeClass: "badge-yellow",
      icon: AlertTriangle,
      title: isKz ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
    red: {
      calloutClass: "callout callout-red",
      color: "var(--red)",
      badgeClass: "badge-red",
      icon: AlertOctagon,
      title: isKz ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
    unassessed: {
      calloutClass: "callout",
      color: "var(--ink)",
      badgeClass: "badge-neutral",
      icon: AlertTriangle,
      title: isKz ? cdss_risk.label_kz : cdss_risk.label_ru,
    },
  }[cdss_risk.status] || {
    calloutClass: "callout",
    color: "var(--ink)",
    badgeClass: "badge-neutral",
    icon: AlertTriangle,
    title: isKz ? cdss_risk.label_kz : cdss_risk.label_ru,
  };

  const StatusIcon = statusConfig.icon;
  const recommendationText = cleanClinicalText(
    isKz ? cdss_risk.recommendation_kz : cdss_risk.recommendation_ru
  );

  const baseHipStr = fmtFixed(summary.baseline_amin_sagh, 1, "°");
  const postHipStr = fmtFixed(activePostHip, 1, "°");

  const hipSubtext = (() => {
    if (activeModality === "Baseline") {
      return `${baseHipStr} · ${isKz ? "Тек базалық сынама" : "Только базовая проба"}`;
    }
    if (!isFiniteNum(activeDeltaHip)) {
      return `${baseHipStr} → ${postHipStr} (${comparisonPairLabel})`;
    }
    const impact =
      activeDeltaHip <= -2.0
        ? isKz
          ? "Айқын оң нәтиже"
          : "Клинически значимо"
        : activeDeltaHip <= -1.0
        ? isKz
          ? "Орташа жақсару"
          : "Умеренный отклик"
        : isKz
        ? "Динамикасыз"
        : "Без динамики";
    return `${baseHipStr} → ${postHipStr} · ${impact}`;
  })();

  const tjeDirectionHint =
    tjeVal === null
      ? t.tje_desc
      : tjeVal <= -1.0
      ? isKz
        ? "Шынайы буын ілгерілеуі (≤ −1,0°)"
        : "Чистое улучшение сустава (≤ −1,0°)"
      : tjeVal > 0.0
      ? isKz
        ? "Жамбас еңкеюі сан нәтижесін жапты"
        : "Перекрыто передним наклоном таза"
      : isKz
      ? "Елеулі өзгеріс жоқ"
      : "Минимальное изменение";

  return (
    <section
      aria-label={isKz ? "Қауіпсіздік бағдаршамы" : "Клинический светофор"}
      className="stack-md"
    >
      <div className={statusConfig.calloutClass}>
        <div style={{ color: statusConfig.color, marginTop: "2px", flexShrink: 0 }}>
          <StatusIcon size={18} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="cluster" style={{ marginBottom: "var(--sp-1)" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: statusConfig.color }}>
              {statusConfig.title}
            </span>
            <span className={`badge ${statusConfig.badgeClass} tabular-nums mono`}>
              PCR = {fmtPcr(pcrVal)}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.55 }}>
            <strong>{t.recommendation}:</strong> {recommendationText}
          </p>
          {cdss_risk.status === "red" && (
            <p style={{ marginTop: "var(--sp-2)", fontSize: "12px", color: "var(--red)", fontWeight: 500 }}>
              {isKz
                ? "Назар аударыңыз: шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз. Жүйе кеңестік сипатта, диагноз қоймайды."
                : "В экстренных ситуациях вызывайте скорую помощь 103. Система носит консультативный характер и не ставит диагноз."}
            </p>
          )}
        </div>
      </div>

      <div className="grid-kpi-4">
        <div className="surface-compact" title={t.tooltip_delta_hip}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {isKz ? "Санның жазылу өсімі" : "Разгибание бедра в опоре"}
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
            {fmtSigned(activeDeltaHip, 1, "°")}
          </div>
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-2)" }}>
            {hipSubtext}
          </div>
        </div>

        <div className="surface-compact" title={t.tooltip_tje}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
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
            {fmtSigned(tjeVal, 1, "°")}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-2)" }}>
            {tjeDirectionHint}
          </div>
        </div>

        <div className="surface-compact" title={t.tooltip_pcr}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {t.pcr_title}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)" }}>
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
              {fmtPcr(pcrVal)}
            </span>
            {pcrVal !== null && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {pcrVal > 0.8
                  ? isKz
                    ? "Жоғары"
                    : "Высокий риск"
                  : pcrVal >= 0.4
                  ? isKz
                    ? "Орташа"
                    : "Умеренно"
                  : isKz
                  ? "Қалыпты"
                  : "В норме"}
              </span>
            )}
          </div>
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-2)" }}>
            {isFiniteNum(activeDeltaPelvis)
              ? isKz
                ? `Жамбас ауытқуы: ${fmtSigned(activeDeltaPelvis, 1, "°")}`
                : `Отклонение таза: ${fmtSigned(activeDeltaPelvis, 1, "°")}`
              : isKz
              ? "Жамбас ауытқуы: —"
              : "Отклонение таза: —"}
          </div>
        </div>

        <div className="surface-compact" title={t.tooltip_icf}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {t.icf_title}
          </div>
          <div className="stack-xs" style={{ fontSize: "13px" }}>
            <div className="kv-row">
              <span style={{ color: "var(--muted)" }}>b770</span>
              <span className="tabular-nums mono" style={{ fontWeight: 500 }}>
                {icf.b770_baseline}
                {postB770 && postB770 !== "N/A" ? ` → ${postB770}` : ""}
              </span>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--muted)" }}>d450</span>
              <span className="tabular-nums mono" style={{ fontWeight: 500 }}>
                {icf.d450 === "N/A" ? (isKz ? "Бағаланбады" : "Нет кривых") : icf.d450}
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
              marginTop: "var(--sp-2)",
            }}
          >
            {activeModality === "Baseline"
              ? isKz
                ? "Базалық сынама бойынша"
                : "Оценено по базовой пробе"
              : !isFiniteNum(activePostGps) || !isFiniteNum(summary.baseline_gps)
              ? isKz
                ? `Салыстырмалы ${activeModality} дерегі жоқ`
                : `Нет парной пробы ${activeModality}`
              : activePostGps < summary.baseline_gps
              ? isKz
                ? "Жүріс профилі (GPS) жақсарды"
                : "Индекс походки GPS улучшился"
              : isKz
              ? "Ауытқу сақталған"
              : "Отклонение GPS сохраняется"}
          </div>
        </div>
      </div>
    </section>
  );
}
