"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { PatientAnalysis } from "@/lib/types";
import { translations } from "@/lib/translations";

interface CdssProps {
  analysis: PatientAnalysis;
  lang: "ru" | "kz";
}

export function CdssTrafficLight({ analysis, lang }: CdssProps) {
  const t = translations[lang];
  const cdss_risk = analysis.cdss_risk || analysis.cdss || {
    status: "yellow" as const,
    pcr: 0.0,
    tje: 0.0,
    label_ru: "Оценка данных",
    label_kz: "Деректерді бағалау",
    recommendation_ru: "Ожидание результатов биомеханического анализа.",
    recommendation_kz: "Биомеханикалық талдау нәтижелерін күту.",
  };

  const { summary, icf } = analysis;
  const safeTje = typeof cdss_risk.tje === "number" && isFinite(cdss_risk.tje) ? cdss_risk.tje : 0.0;
  const safePcr = typeof cdss_risk.pcr === "number" && isFinite(cdss_risk.pcr) ? cdss_risk.pcr : 0.0;

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

  return (
    <section aria-label={lang === "kz" ? "Қауіпсіздік бағдаршамы" : "Клинический светофор"} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
              PCR = {safePcr.toFixed(2)}
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
              color: typeof summary.delta_amin_sagh === "number" && summary.delta_amin_sagh <= -1.0 ? "var(--teal)" : "var(--ink)",
            }}
          >
            {typeof summary.delta_amin_sagh === "number" && isFinite(summary.delta_amin_sagh)
              ? `${summary.delta_amin_sagh > 0 ? `+${summary.delta_amin_sagh.toFixed(1)}` : summary.delta_amin_sagh.toFixed(1)}°`
              : "—"}
          </div>
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {typeof summary.baseline_amin_sagh === "number" ? `${summary.baseline_amin_sagh.toFixed(1)}°` : "—"} →{" "}
            {typeof summary.vr_amin_sagh === "number" ? `${summary.vr_amin_sagh.toFixed(1)}°` : "—"} ·{" "}
            {typeof summary.delta_amin_sagh !== "number" || !isFinite(summary.delta_amin_sagh)
              ? lang === "kz"
                ? "VR сынамасы жоқ"
                : "Нет VR-пробы"
              : summary.delta_amin_sagh <= -2.0
              ? lang === "kz"
                ? "Айқын оң нәтиже"
                : "Клинически значимо"
              : summary.delta_amin_sagh <= -1.0
              ? lang === "kz"
                ? "Орташа жақсару"
                : "Умеренный отклик"
              : lang === "kz"
              ? "Динамикасыз"
              : "Без динамики"}
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
              color: safeTje <= -1.0 ? "var(--teal)" : safeTje > 0.5 ? "var(--red)" : "var(--amber)",
            }}
          >
            {safeTje > 0 ? `+${safeTje.toFixed(1)}` : safeTje.toFixed(1)}°
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
                color: safePcr > 0.8 ? "var(--red)" : safePcr >= 0.4 ? "var(--amber)" : "var(--teal)",
              }}
            >
              {safePcr.toFixed(2)}
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {safePcr > 0.8
                ? lang === "kz"
                  ? "Жоғары"
                  : "Высокий риск"
                : safePcr >= 0.4
                ? lang === "kz"
                  ? "Орташа"
                  : "Умеренно"
                : lang === "kz"
                ? "Қалыпты"
                : "В норме"}
            </span>
          </div>
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {typeof summary.delta_gvs_pelvis === "number" && isFinite(summary.delta_gvs_pelvis)
              ? lang === "kz"
                ? `Жамбас ауытқуы: ${summary.delta_gvs_pelvis > 0 ? `+${summary.delta_gvs_pelvis.toFixed(1)}` : summary.delta_gvs_pelvis.toFixed(1)}°`
                : `Отклонение таза: ${summary.delta_gvs_pelvis > 0 ? `+${summary.delta_gvs_pelvis.toFixed(1)}` : summary.delta_gvs_pelvis.toFixed(1)}°`
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
                {icf.b770_baseline} → {icf.b770_vr}
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
                typeof summary.vr_gps === "number" &&
                typeof summary.baseline_gps === "number" &&
                summary.vr_gps < summary.baseline_gps
                  ? "var(--teal)"
                  : "var(--muted)",
              marginTop: "6px",
            }}
          >
            {typeof summary.vr_gps !== "number" || typeof summary.baseline_gps !== "number"
              ? lang === "kz"
                ? "Салыстырмалы VR дерегі жоқ"
                : "Нет парной VR-пробы"
              : summary.vr_gps < summary.baseline_gps
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
