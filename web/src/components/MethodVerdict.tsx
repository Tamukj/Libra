"use client";

import React from "react";
import { Award, Volume2, Glasses, Footprints } from "lucide-react";
import { ModalitiesComparison, DiscreteSummary } from "@/lib/types";

interface Props {
  modalities?: ModalitiesComparison;
  summary?: DiscreteSummary;
  lang: "ru" | "kz" | "en";
}

export function MethodVerdict({ modalities, summary, lang }: Props) {
  if (!modalities) return null;

  const isVR = modalities.best_method === "VR";
  const isVerbal = modalities.best_method === "Verbal";
  const isBaseline = modalities.best_method === "Baseline";

  const title = lang === "kz" ? "Оңалту тактикасын таңдау: Baseline vs Verbal vs VR" : "Выбор тактики: Baseline vs Verbal vs VR";
  const verdictText = lang === "kz" ? modalities.verdict_kz : modalities.verdict_ru;

  // Recommended badge styling
  const badgeColor = isVR ? "var(--teal)" : isVerbal ? "#d97706" : "var(--ink)";
  const badgeBg = isVR ? "var(--teal-bg)" : isVerbal ? "var(--amber-light)" : "var(--linen)";
  const badgeBorder = isVR ? "var(--teal-border)" : isVerbal ? "var(--amber-border)" : "var(--line)";

  return (
    <div className="card-raised" style={{
      borderLeft: `4px solid ${badgeColor}`,
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      background: "var(--white)",
      padding: "18px"
    }}>
      
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            background: badgeBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: badgeColor
          }}>
            <Award size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: 0 }}>{title}</h3>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {lang === "kz" ? "Базалық жүріске қатысты биомеханика және қауіпсіздік талдауы" : "Сравнительный анализ биомеханики и безопасности относительно базовой походки"}
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
          background: badgeBg,
          border: `1px solid ${badgeBorder}`,
          color: badgeColor,
          fontWeight: 700,
          fontSize: "13px"
        }}>
          {isVR ? <Glasses size={16} /> : isVerbal ? <Volume2 size={16} /> : <Footprints size={16} />}
          <span>
            {lang === "kz" ? "Ұсынылған: " : "Рекомендовано: "}
            {isVR ? "VR Режим (Аватар)" : isVerbal ? "Verbal Режим (Голос)" : "Базовый режим (Baseline)"}
          </span>
        </div>
      </div>

      {/* Narrative Explanation */}
      <div style={{ fontSize: "13px", color: "var(--ink)", lineHeight: "1.55", background: "var(--paper)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--line)" }}>
        <strong>{lang === "kz" ? "Клиникалық қорытынды:" : "Клиническое заключение:"}</strong> {verdictText}
      </div>

      {/* 3-Way Modality Comparison Cards (Baseline, Verbal, VR) */}
      <div className="grid-verdict-split">
        
        {/* 1. Baseline Card (Control) */}
        <div style={{
          padding: "12px 14px",
          borderRadius: "6px",
          border: `1px solid ${isBaseline ? "var(--teal-border)" : "var(--line)"}`,
          background: isBaseline ? "var(--teal-bg)" : "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Footprints size={14} color="#3b82f6" />
              <span>{lang === "kz" ? "1. Қалыпты (Baseline)" : "1. Обычный (Baseline)"}</span>
            </span>
            {isBaseline ? (
              <span className="badge badge-green" style={{ fontSize: "10px" }}>{lang === "kz" ? "Басымдық" : "Приоритет"}</span>
            ) : (
              <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>{lang === "kz" ? "Бастапқы нүкте" : "Точка отсчета"}</span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", paddingTop: "6px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>TJE</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                0.0°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "Жазылу" : "Разгибание"}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {summary ? `${summary.baseline_amin_sagh.toFixed(1)}°` : (lang === "kz" ? "База" : "База")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "Жамбас еңкеюі" : "Наклон таза"}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {summary ? `${summary.baseline_gvs_pelvis.toFixed(1)}°` : (lang === "kz" ? "База" : "База")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>PCR</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px", color: "var(--muted)" }}>
                {lang === "kz" ? "База" : "База"}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Verbal Card (Speech instructions) */}
        <div style={{
          padding: "12px 14px",
          borderRadius: "6px",
          border: `1px solid ${isVerbal ? "#d97706" : "var(--line)"}`,
          background: isVerbal ? "var(--amber-light)" : "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Volume2 size={14} color="#d97706" />
              <span>{lang === "kz" ? "2. Дауыс (Verbal)" : "2. Голос (Verbal)"}</span>
            </span>
            {isVerbal && <span className="badge badge-amber" style={{ fontSize: "10px" }}>{lang === "kz" ? "Басымдық" : "Приоритет"}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", paddingTop: "6px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>TJE</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {modalities.tje_verbal > 0 ? "+" : ""}{modalities.tje_verbal.toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "Жазылу" : "Разгибание"}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {modalities.delta_hip_verbal > 0 ? "+" : ""}{modalities.delta_hip_verbal.toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "Жамбас еңкеюі" : "Наклон таза"}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {modalities.delta_pelvis_verbal > 0 ? "+" : ""}{modalities.delta_pelvis_verbal.toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>PCR</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px", color: modalities.pcr_verbal > 0.8 ? "var(--red)" : "var(--teal)" }}>
                {modalities.pcr_verbal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* 3. VR Card (Avatar visual feedback) */}
        <div style={{
          padding: "12px 14px",
          borderRadius: "6px",
          border: `1px solid ${isVR ? "var(--teal-border)" : "var(--line)"}`,
          background: isVR ? "var(--teal-bg)" : "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Glasses size={14} color="var(--teal)" />
              <span>{lang === "kz" ? "3. Көзілдірік (VR аватар)" : "3. Очки (VR аватар)"}</span>
            </span>
            {isVR && <span className="badge badge-green" style={{ fontSize: "10px" }}>{lang === "kz" ? "Басымдық" : "Приоритет"}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", paddingTop: "6px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>TJE</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {modalities.tje_vr > 0 ? "+" : ""}{modalities.tje_vr.toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "Жазылу" : "Разгибание"}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {modalities.delta_hip_vr > 0 ? "+" : ""}{modalities.delta_hip_vr.toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "Жамбас еңкеюі" : "Наклон таза"}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px" }}>
                {modalities.delta_pelvis_vr > 0 ? "+" : ""}{modalities.delta_pelvis_vr.toFixed(1)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>PCR</div>
              <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--mono)", marginTop: "2px", color: modalities.pcr_vr > 0.8 ? "var(--red)" : "var(--teal)" }}>
                {modalities.pcr_vr.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
