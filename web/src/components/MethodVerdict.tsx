"use client";

import React from "react";
import { Award, Volume2, Glasses, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { ModalitiesComparison } from "@/lib/types";

interface Props {
  modalities?: ModalitiesComparison;
  lang: "ru" | "kz";
}

export function MethodVerdict({ modalities, lang }: Props) {
  if (!modalities) return null;

  const isVR = modalities.best_method === "VR";
  const isVerbal = modalities.best_method === "Verbal";

  const title = lang === "kz" ? "Оңалту әдісін таңдау: Голос терапевта vs VR аватар" : "Выбор тактики: Инструкции терапевта (Verbal) vs Очки (VR)";
  const verdictText = lang === "kz" ? modalities.verdict_kz : modalities.verdict_ru;

  return (
    <div className="card-raised" style={{
      borderLeft: isVR ? "4px solid var(--teal)" : "4px solid var(--amber)",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      background: "var(--white)"
    }}>
      
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            background: isVR ? "var(--teal-bg)" : "var(--amber-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isVR ? "var(--teal)" : "var(--amber)"
          }}>
            <Award size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: 0 }}>{title}</h3>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {lang === "kz" ? "Биомеханикалық және қауіпсіздік салыстырмалы талдауы" : "Сравнительный анализ чистой биомеханики и безопасности"}
            </span>
          </div>
        </div>

        {/* Big Recommended Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 14px",
          borderRadius: "6px",
          background: isVR ? "var(--teal-bg)" : "var(--amber-bg)",
          border: `1px solid ${isVR ? "var(--teal-border)" : "var(--amber-border)"}`,
          color: isVR ? "var(--teal)" : "var(--amber)",
          fontWeight: "700",
          fontSize: "13px"
        }}>
          {isVR ? <Glasses size={16} /> : <Volume2 size={16} />}
          <span>
            {lang === "kz" ? "Ұсынылған: " : "Рекомендовано: "}
            {isVR ? "VR Режим" : isVerbal ? "Verbal Режим (Голос)" : "Базалық"}
          </span>
        </div>
      </div>

      {/* Narrative Explanation */}
      <div style={{ fontSize: "13px", color: "var(--ink)", lineHeight: "1.6", background: "var(--paper)", padding: "12px 16px", borderRadius: "6px", border: "1px solid var(--line)" }}>
        <strong>{lang === "kz" ? "Клиникалық қорытынды:" : "Клиническое заключение:"}</strong> {verdictText}
      </div>

      {/* Side-by-side comparison cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        
        {/* Verbal Card */}
        <div style={{
          padding: "12px 14px",
          borderRadius: "6px",
          border: `1px solid ${isVerbal ? "var(--teal-border)" : "var(--line)"}`,
          background: isVerbal ? "var(--teal-bg)" : "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
              <Volume2 size={14} color="#16a34a" /> Verbal (Словесный)
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>TJE: {modalities.tje_verbal > 0 ? "+" : ""}{modalities.tje_verbal.toFixed(1)}°</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Разгибание: {modalities.delta_hip_verbal.toFixed(1)}°</span>
            <span>Таз: {modalities.delta_pelvis_verbal > 0 ? "+" : ""}{modalities.delta_pelvis_verbal.toFixed(1)}°</span>
            <span>PCR: {modalities.pcr_verbal.toFixed(2)}</span>
          </div>
        </div>

        {/* VR Card */}
        <div style={{
          padding: "12px 14px",
          borderRadius: "6px",
          border: `1px solid ${isVR ? "var(--teal-border)" : "var(--line)"}`,
          background: isVR ? "var(--teal-bg)" : "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
              <Glasses size={14} color="#d97706" /> VR (Виртуальная реальность)
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>TJE: {modalities.tje_vr > 0 ? "+" : ""}{modalities.tje_vr.toFixed(1)}°</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Разгибание: {modalities.delta_hip_vr.toFixed(1)}°</span>
            <span>Таз: {modalities.delta_pelvis_vr > 0 ? "+" : ""}{modalities.delta_pelvis_vr.toFixed(1)}°</span>
            <span>PCR: {modalities.pcr_vr.toFixed(2)}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
