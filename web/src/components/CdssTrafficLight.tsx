"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, AlertOctagon, HelpCircle } from "lucide-react";
import { PatientAnalysis } from "@/lib/types";
import { translations } from "@/lib/translations";

interface CdssProps {
  analysis: PatientAnalysis;
  lang: "ru" | "kz" | "en";
}

export function CdssTrafficLight({ analysis, lang }: CdssProps) {
  const t = translations[lang];
  const { cdss_risk, summary, icf } = analysis;

  const statusConfig = {
    green: {
      bg: "var(--teal-bg)",
      border: "var(--teal-border)",
      color: "var(--teal)",
      badgeClass: "badge-green",
      icon: CheckCircle2,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru
    },
    yellow: {
      bg: "var(--amber-light)",
      border: "var(--amber-border)",
      color: "var(--amber)",
      badgeClass: "badge-yellow",
      icon: AlertTriangle,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru
    },
    red: {
      bg: "var(--red-bg)",
      border: "var(--red-border)",
      color: "var(--red)",
      badgeClass: "badge-red",
      icon: AlertOctagon,
      title: lang === "kz" ? cdss_risk.label_kz : cdss_risk.label_ru
    }
  }[cdss_risk.status];

  const StatusIcon = statusConfig.icon;
  const recommendationText = lang === "kz" ? cdss_risk.recommendation_kz : cdss_risk.recommendation_ru;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      
      {/* Top Banner: Traffic Light Status */}
      <div style={{
        background: statusConfig.bg,
        border: `1px solid ${statusConfig.border}`,
        borderRadius: "8px",
        padding: "14px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px"
      }}>
        <div style={{ color: statusConfig.color, marginTop: "2px", flexShrink: 0 }}>
          <StatusIcon size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: 750, color: statusConfig.color }}>
              {statusConfig.title}
            </span>
            <span className={`badge ${statusConfig.badgeClass}`}>
              PCR = {cdss_risk.pcr.toFixed(2)}
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "var(--ink)", lineHeight: "1.5" }}>
            <strong>{t.recommendation}:</strong> {recommendationText}
          </div>
        </div>
      </div>

      {/* 4 Quantitative Biomarker Cards with Disciplined Spacing */}
      <div className="grid-kpi-4">
        
        {/* Metric 1: Delta aMinSagH (Target) */}
        <div className="card" style={{ padding: "14px 16px" }} title={t.tooltip_delta_hip || "Угол минимального сагиттального разгибания бедра."}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 650, textTransform: "uppercase", color: "var(--muted)" }}>
              {lang === "kz" ? "Санның жазылуы" : "Разгибание бедра"}
            </span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 750, color: summary.delta_amin_sagh <= -1.0 ? "var(--teal)" : "var(--muted)", margin: "4px 0 2px" }}>
            {summary.delta_amin_sagh > 0 ? `+${summary.delta_amin_sagh.toFixed(1)}` : summary.delta_amin_sagh.toFixed(1)}°
            <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted)", marginLeft: "6px" }}>
              ({summary.baseline_amin_sagh.toFixed(1)}° → {summary.vr_amin_sagh.toFixed(1)}°)
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
            {summary.delta_amin_sagh <= -2.0
              ? (lang === "kz" ? "Күйі: MCID қол жеткізілді" : "Статус: MCID достигнут")
              : (lang === "kz" ? "Күйі: динамикасыз" : "Статус: без динамики")}
          </div>
        </div>

        {/* Metric 2: True Joint Extension (TJE) */}
        <div className="card" style={{ padding: "14px 16px" }} title={t.tooltip_tje}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 650, textTransform: "uppercase", color: "var(--muted)" }}>
              {t.tje_title}
            </span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 750, color: cdss_risk.tje <= -1.0 ? "var(--teal)" : "var(--amber)", margin: "4px 0 2px" }}>
            {cdss_risk.tje > 0 ? `+${cdss_risk.tje.toFixed(1)}` : cdss_risk.tje.toFixed(1)}°
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
            {t.tje_desc}
          </div>
        </div>

        {/* Metric 3: Pathological Compensation Ratio (PCR) */}
        <div className="card" style={{ padding: "14px 16px" }} title={t.tooltip_pcr}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 650, textTransform: "uppercase", color: "var(--muted)" }}>
              {t.pcr_title}
            </span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "4px 0 2px" }}>
            <span style={{ fontSize: "22px", fontWeight: 750, color: cdss_risk.pcr > 0.8 ? "var(--red)" : cdss_risk.pcr >= 0.4 ? "var(--amber)" : "var(--teal)" }}>
              {cdss_risk.pcr.toFixed(2)}
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {cdss_risk.pcr > 0.8
                ? (lang === "kz" ? "Қауіпті" : "Критично")
                : cdss_risk.pcr >= 0.4
                ? (lang === "kz" ? "Орташа" : "Умеренно")
                : (lang === "kz" ? "Қалыпты" : "Норма")}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
            {lang === "kz"
              ? `Жамбас: ${summary.delta_gvs_pelvis > 0 ? `+${summary.delta_gvs_pelvis.toFixed(1)}` : summary.delta_gvs_pelvis.toFixed(1)}° ауытқу`
              : `Таз: ${summary.delta_gvs_pelvis > 0 ? `+${summary.delta_gvs_pelvis.toFixed(1)}` : summary.delta_gvs_pelvis.toFixed(1)}° /* lang === "kz" */ девиации`}
          </div>
        </div>

        {/* Metric 4: WHO ICF Status */}
        <div className="card" style={{ padding: "14px 16px" }} title={t.tooltip_icf}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 650, textTransform: "uppercase", color: "var(--muted)" }}>
              {t.icf_title}
            </span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", margin: "4px 0 2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ color: "var(--muted)" }}>b770:</span>
              <strong style={{ fontFamily: "var(--mono)" }}>{icf.b770_baseline} → {icf.b770_vr}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ color: "var(--muted)" }}>d450:</span>
              <strong style={{ fontFamily: "var(--mono)" }}>{icf.d450}</strong>
            </div>
          </div>
          <div style={{ fontSize: "11px", color: summary.vr_gps < summary.baseline_gps ? "var(--teal)" : "var(--red)" }}>
            {summary.vr_gps < summary.baseline_gps
              ? (lang === "kz" ? "GPS жақсарды" : "GPS улучшен")
              : (lang === "kz" ? "Ауытқу ұлғайды" : "Девиация увеличена")}
          </div>
        </div>

      </div>

    </div>
  );
}
