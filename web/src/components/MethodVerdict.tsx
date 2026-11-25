"use client";

import React from "react";
import { Award, Volume2, Glasses, Footprints } from "lucide-react";
import { ModalitiesComparison, DiscreteSummary } from "@/lib/types";
import { fmtFixed, fmtSigned, fmtPcr, isFiniteNum, cleanClinicalText } from "@/lib/format";

interface Props {
  modalities?: ModalitiesComparison;
  summary?: DiscreteSummary;
  lang: "ru" | "kz" | "en";
}

export function MethodVerdict({ modalities, summary, lang }: Props) {
  if (!modalities) return null;
  const isKz = lang === "kz";

  const isVR = modalities.best_method === "VR";
  const isVerbal = modalities.best_method === "Verbal";
  const isBaseline = modalities.best_method === "Baseline";

  const title = isKz
    ? "Оңалту тәсілін таңдау: Қалыпты, Ауызша және VR"
    : "Выбор тактики реабилитации: обычная ходьба, голос или VR";
  const verdictText = cleanClinicalText(isKz ? modalities.verdict_kz : modalities.verdict_ru);
  const badgeClass = isVR ? "badge-green" : isVerbal ? "badge-yellow" : "badge-neutral";

  return (
    <section className="surface stack-md" aria-label={title}>
      <div className="row-between">
        <div className="cluster" style={{ gap: "var(--sp-3)" }}>
          <Award
            size={18}
            strokeWidth={1.5}
            color={isVR ? "var(--teal)" : isVerbal ? "var(--amber)" : "var(--ink)"}
            aria-hidden="true"
          />
          <div>
            <h2 className="section-title">{title}</h2>
            <p className="section-subtitle">
              {isKz
                ? "Қалыпты жүріспен салыстырғандағы биомеханикалық тиімділік пен қауіпсіздік"
                : "Сравнение прироста разгибания бедра и стабильности таза относительно обычной ходьбы"}
            </p>
          </div>
        </div>

        <span className={`badge ${badgeClass}`} style={{ fontSize: "13px", padding: "var(--sp-2) var(--sp-3)" }}>
          {isVR ? (
            <Glasses size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : isVerbal ? (
            <Volume2 size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Footprints size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span>
            {isKz ? "Ұсынылған тәсіл: " : "Оптимальный режим: "}
            {isVR
              ? isKz
                ? "VR-жаттығу"
                : "VR-обратная связь"
              : isVerbal
              ? isKz
                ? "Ауызша нұсқау"
                : "Голосовые команды"
              : isKz
              ? "Қалыпты жаттығулар"
              : "Базовые упражнения"}
          </span>
        </span>
      </div>

      <p className="panel-inset" style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.55 }}>
        {verdictText}
      </p>

      {/* Hairline-divided 3-way comparison strip */}
      <div className="hairline-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {/* 1. Baseline */}
        <div className={`hairline-cell stack-sm ${isBaseline ? "hairline-cell-active" : ""}`}>
          <div className="row-between">
            <span className="cluster" style={{ fontSize: "13px", fontWeight: 600 }}>
              <Footprints size={14} strokeWidth={1.5} color="var(--slate-line)" aria-hidden="true" />
              <span>{isKz ? "Қалыпты жүріс" : "Обычная ходьба"}</span>
            </span>
            <span style={{ fontSize: "12px", color: isBaseline ? "var(--ink)" : "var(--muted)", fontWeight: isBaseline ? 600 : 400 }}>
              {isBaseline ? (isKz ? "Басымдық" : "Приоритет") : isKz ? "Анықтама" : "Эталон"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--sp-2)", paddingBlockStart: "var(--sp-2)", borderBlockStart: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>TJE</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>0.0°</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>{isKz ? "Сан" : "Бедро"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtFixed(summary?.baseline_amin_sagh, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>{isKz ? "Жамбас" : "Таз"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtFixed(summary?.baseline_gvs_pelvis, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>PCR</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 500, color: "var(--muted)" }}>
                {isKz ? "База" : "База"}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Verbal */}
        <div className={`hairline-cell stack-sm ${isVerbal ? "hairline-cell-warn" : ""}`}>
          <div className="row-between">
            <span className="cluster" style={{ fontSize: "13px", fontWeight: 600 }}>
              <Volume2 size={14} strokeWidth={1.5} color="var(--amber)" aria-hidden="true" />
              <span>{isKz ? "Ауызша нұсқау" : "Голосовые команды"}</span>
            </span>
            {isVerbal && <span className="badge badge-yellow">{isKz ? "Басымдық" : "Приоритет"}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--sp-2)", paddingBlockStart: "var(--sp-2)", borderBlockStart: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>TJE</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtSigned(modalities.tje_verbal, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>{isKz ? "Сан" : "Бедро"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtSigned(modalities.delta_hip_verbal, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>{isKz ? "Жамбас" : "Таз"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtSigned(modalities.delta_pelvis_verbal, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>PCR</div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color:
                    isFiniteNum(modalities.pcr_verbal) && modalities.pcr_verbal > 0.8
                      ? "var(--red)"
                      : isFiniteNum(modalities.pcr_verbal) && modalities.pcr_verbal >= 0.4
                      ? "var(--amber)"
                      : "var(--teal)",
                }}
              >
                {fmtPcr(modalities.pcr_verbal)}
              </div>
            </div>
          </div>
        </div>

        {/* 3. VR */}
        <div className={`hairline-cell stack-sm ${isVR ? "hairline-cell-active" : ""}`}>
          <div className="row-between">
            <span className="cluster" style={{ fontSize: "13px", fontWeight: 600 }}>
              <Glasses size={14} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
              <span>{isKz ? "VR-кері байланыс" : "VR-обратная связь"}</span>
            </span>
            {isVR && <span className="badge badge-green">{isKz ? "Басымдық" : "Приоритет"}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--sp-2)", paddingBlockStart: "var(--sp-2)", borderBlockStart: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>TJE</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtSigned(modalities.tje_vr, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>{isKz ? "Сан" : "Бедро"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtSigned(modalities.delta_hip_vr, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>{isKz ? "Жамбас" : "Таз"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                {fmtSigned(modalities.delta_pelvis_vr, 1, "°")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>PCR</div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color:
                    isFiniteNum(modalities.pcr_vr) && modalities.pcr_vr > 0.8
                      ? "var(--red)"
                      : isFiniteNum(modalities.pcr_vr) && modalities.pcr_vr >= 0.4
                      ? "var(--amber)"
                      : "var(--teal)",
                }}
              >
                {fmtPcr(modalities.pcr_vr)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
