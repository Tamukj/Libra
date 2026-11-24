"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, AlertOctagon, TrendingDown, ShieldAlert, Award, HelpCircle } from "lucide-react";
import { PatientAnalysis } from "@/lib/types";
import { translations } from "@/lib/translations";

interface CdssProps {
  analysis: PatientAnalysis;
  lang: "ru" | "kz";
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
      bg: "var(--amber-bg)",
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
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      
      {/* Top Banner: Traffic Light Status */}
      <div style={{
        background: statusConfig.bg,
        border: `1px solid ${statusConfig.border}`,
        borderRadius: "8px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "14px"
      }}>
        <div style={{ color: statusConfig.color, marginTop: "2px" }}>
          <StatusIcon size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "15px", fontWeight: "700", color: statusConfig.color }}>
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

      {/* 4 Quantitative Biomarker Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        
        {/* Metric 1: Delta aMinSagH (Target) */}
        <div className="card" style={{ padding: "16px" }} title={t.tooltip_delta_hip || "Угол минимального сагиттального разгибания бедра."}>
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{lang === "kz" ? "Санның жазылуы (aMinSagH)" : "Разгибание бедра (aMinSagH)"}</span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "24px", fontWeight: "700", color: summary.delta_amin_sagh <= -1.0 ? "var(--teal)" : "var(--muted)" }}>
              {summary.delta_amin_sagh > 0 ? `+${summary.delta_amin_sagh.toFixed(1)}` : summary.delta_amin_sagh.toFixed(1)}°
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              ({summary.baseline_amin_sagh.toFixed(1)}° → {summary.vr_amin_sagh.toFixed(1)}°)
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {summary.delta_amin_sagh <= -2.0 ? "🟢 MCID достигнут" : "⚪ Нет прогресса"}
          </div>
        </div>

        {/* Metric 2: True Joint Extension (TJE) */}
        <div className="card" style={{ padding: "16px" }} title={t.tooltip_tje}>
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{t.tje_title}</span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "24px", fontWeight: "700", color: cdss_risk.tje <= -1.0 ? "var(--teal)" : "var(--amber)" }}>
              {cdss_risk.tje > 0 ? `+${cdss_risk.tje.toFixed(1)}` : cdss_risk.tje.toFixed(1)}°
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {t.tje_desc}
          </div>
        </div>

        {/* Metric 3: Pathological Compensation Ratio (PCR) */}
        <div className="card" style={{ padding: "16px" }} title={t.tooltip_pcr}>
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{t.pcr_title}</span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "24px", fontWeight: "700", color: cdss_risk.pcr > 0.8 ? "var(--red)" : cdss_risk.pcr >= 0.4 ? "var(--amber)" : "var(--teal)" }}>
              {cdss_risk.pcr.toFixed(2)}
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {cdss_risk.pcr > 0.8 ? "Критично" : cdss_risk.pcr >= 0.4 ? "Умеренно" : "Норма"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            Таз: {summary.delta_gvs_pelvis > 0 ? `+${summary.delta_gvs_pelvis.toFixed(1)}` : summary.delta_gvs_pelvis.toFixed(1)}° девиации
          </div>
        </div>

        {/* Metric 4: WHO ICF Status */}
        <div className="card" style={{ padding: "16px" }} title={t.tooltip_icf}>
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{t.icf_title}</span>
            <HelpCircle size={13} color="var(--muted)" style={{ cursor: "help" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span>{t.icf_b770}:</span>
              <strong>{icf.b770_baseline} → {icf.b770_vr}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span>{t.icf_d450}:</span>
              <strong>{icf.d450}</strong>
            </div>
          </div>
          <div style={{ fontSize: "11px", color: "var(--teal)", marginTop: "4px" }}>
            {summary.vr_gps < summary.baseline_gps ? "🟢 GPS улучшен" : "🔴 GPS ухудшен (компенсация)"}
          </div>
        </div>

      </div>

    </div>
  );
}
