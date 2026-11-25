"use client";

import React from "react";
import { Award, Volume2, Glasses, Footprints } from "lucide-react";
import { ModalitiesComparison, DiscreteSummary } from "@/lib/types";

interface Props {
  modalities?: ModalitiesComparison;
  summary?: DiscreteSummary;
  lang: "ru" | "kz";
}

export function MethodVerdict({ modalities, summary, lang }: Props) {
  if (!modalities) return null;

  const isVR = modalities.best_method === "VR";
  const isVerbal = modalities.best_method === "Verbal";
  const isBaseline = modalities.best_method === "Baseline";

  const title =
    lang === "kz"
      ? "Оңалту тәсілін таңдау: Қалыпты, Ауызша және VR"
      : "Выбор тактики реабилитации: обычная ходьба, голос или VR";
  const verdictText = lang === "kz" ? modalities.verdict_kz : modalities.verdict_ru;

  const badgeClass = isVR ? "badge-green" : isVerbal ? "badge-yellow" : "badge-neutral";

  const fmt = (val: number | null | undefined, digits = 1, signed = false) => {
    if (typeof val !== "number" || !isFinite(val)) return "—";
    const prefix = signed && val > 0 ? "+" : "";
    return `${prefix}${val.toFixed(digits)}`;
  };

  return (
    <section className="surface" aria-label={title} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Award size={18} strokeWidth={1.6} color={isVR ? "var(--teal)" : isVerbal ? "var(--amber)" : "var(--ink)"} />
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>{title}</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              {lang === "kz"
                ? "Қалыпты жүріспен салыстырғандағы биомеханикалық тиімділік пен қауіпсіздік"
                : "Сравнение эффективности разгибания бедра и безопасности таза относительно обычной ходьбы"}
            </p>
          </div>
        </div>

        <span className={`badge ${badgeClass}`} style={{ fontSize: "13px", padding: "6px 12px" }}>
          {isVR ? <Glasses size={15} /> : isVerbal ? <Volume2 size={15} /> : <Footprints size={15} />}
          <span>
            {lang === "kz" ? "Ұсынылған тәсіл: " : "Оптимальный режим: "}
            {isVR
              ? lang === "kz"
                ? "VR-жаттығу"
                : "VR-обратная связь"
              : isVerbal
              ? lang === "kz"
                ? "Ауызша нұсқау"
                : "Голосовые команды"
              : lang === "kz"
              ? "Қалыпты жаттығулар"
              : "Базовые упражнения"}
          </span>
        </span>
      </div>

      <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.55, padding: "12px 14px", borderRadius: "8px", background: "var(--paper)", border: "1px solid var(--line)" }}>
        {verdictText}
      </p>

      {/* 3-way structured modality table/grid */}
      <div className="grid-verdict-split">
        {/* 1. Baseline */}
        <div
          style={{
            padding: "14px",
            borderRadius: "8px",
            border: `1px solid ${isBaseline ? "var(--line-strong)" : "var(--line)"}`,
            background: isBaseline ? "var(--sidebar)" : "var(--paper)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              <Footprints size={14} color="var(--blue)" />
              <span>{lang === "kz" ? "1. Қалыпты жүріс" : "1. Обычная ходьба"}</span>
            </span>
            <span style={{ fontSize: "11px", color: isBaseline ? "var(--ink)" : "var(--muted)", fontWeight: isBaseline ? 600 : 400 }}>
              {isBaseline ? (lang === "kz" ? "Басымдық" : "Приоритет") : lang === "kz" ? "Анықтама" : "Эталон"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>TJE</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>0.0°</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{lang === "kz" ? "Сан" : "Бедро"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {summary ? `${fmt(summary.baseline_amin_sagh)}°` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{lang === "kz" ? "Жамбас" : "Таз"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {summary ? `${fmt(summary.baseline_gvs_pelvis)}°` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>PCR</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 500, color: "var(--muted)", marginTop: "2px" }}>
                {lang === "kz" ? "База" : "База"}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Verbal */}
        <div
          style={{
            padding: "14px",
            borderRadius: "8px",
            border: `1px solid ${isVerbal ? "var(--amber-border)" : "var(--line)"}`,
            background: isVerbal ? "var(--amber-bg)" : "var(--paper)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              <Volume2 size={14} color="var(--amber)" />
              <span>{lang === "kz" ? "2. Ауызша нұсқау" : "2. Голосовые команды"}</span>
            </span>
            {isVerbal && <span className="badge badge-yellow">{lang === "kz" ? "Басымдық" : "Приоритет"}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>TJE</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {fmt(modalities.tje_verbal, 1, true)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{lang === "kz" ? "Сан" : "Бедро"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {fmt(modalities.delta_hip_verbal, 1, true)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{lang === "kz" ? "Жамбас" : "Таз"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {fmt(modalities.delta_pelvis_verbal, 1, true)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>PCR</div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  marginTop: "2px",
                  color:
                    typeof modalities.pcr_verbal === "number" && modalities.pcr_verbal > 0.8
                      ? "var(--red)"
                      : typeof modalities.pcr_verbal === "number" && modalities.pcr_verbal >= 0.4
                      ? "var(--amber)"
                      : "var(--teal)",
                }}
              >
                {fmt(modalities.pcr_verbal, 2)}
              </div>
            </div>
          </div>
        </div>

        {/* 3. VR */}
        <div
          style={{
            padding: "14px",
            borderRadius: "8px",
            border: `1px solid ${isVR ? "var(--teal-border)" : "var(--line)"}`,
            background: isVR ? "var(--teal-bg)" : "var(--paper)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              <Glasses size={14} color="var(--teal)" />
              <span>{lang === "kz" ? "3. VR-кері байланыс" : "3. VR-обратная связь"}</span>
            </span>
            {isVR && <span className="badge badge-green">{lang === "kz" ? "Басымдық" : "Приоритет"}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>TJE</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {fmt(modalities.tje_vr, 1, true)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{lang === "kz" ? "Сан" : "Бедро"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {fmt(modalities.delta_hip_vr, 1, true)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{lang === "kz" ? "Жамбас" : "Таз"}</div>
              <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>
                {fmt(modalities.delta_pelvis_vr, 1, true)}°
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>PCR</div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  marginTop: "2px",
                  color:
                    typeof modalities.pcr_vr === "number" && modalities.pcr_vr > 0.8
                      ? "var(--red)"
                      : typeof modalities.pcr_vr === "number" && modalities.pcr_vr >= 0.4
                      ? "var(--amber)"
                      : "var(--teal)",
                }}
              >
                {fmt(modalities.pcr_vr, 2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
