"use client";

import React from "react";
import { DiscreteSummary } from "@/lib/types";
import { fmtFixed, isFiniteNum } from "@/lib/format";

interface RadarProps {
  summary: DiscreteSummary;
  lang: "ru" | "kz";
}

export function RadarGvs({ summary, lang }: RadarProps) {
  const isKz = lang === "kz";
  const width = 340;
  const height = 276;
  const centerX = 170;
  const centerY = 138;
  const radius = 84;

  const axes = [
    {
      label: isKz ? "Жамбас" : "Таз",
      angle: -Math.PI / 2,
      key: "gvs_pelvis",
      anchor: "middle" as const,
      offsetX: 0,
      offsetY: -18,
    },
    {
      label: isKz ? "Сан" : "Бедро",
      angle: 0,
      key: "gvs_hip",
      anchor: "start" as const,
      offsetX: 12,
      offsetY: 0,
    },
    {
      label: isKz ? "Тізе" : "Колено",
      angle: Math.PI / 2,
      key: "gvs_knee",
      anchor: "middle" as const,
      offsetX: 0,
      offsetY: 18,
    },
    {
      label: isKz ? "Тобық" : "Стопа",
      angle: Math.PI,
      key: "gvs_ankle",
      anchor: "end" as const,
      offsetX: -12,
      offsetY: 0,
    },
  ];

  const maxGvs = 20.0;

  const getCoord = (angle: number, value: number) => {
    const val = isFiniteNum(value) ? Math.max(0, value) : 0;
    const r = (Math.min(val, maxGvs) / maxGvs) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const makePolygon = (vals: number[]) =>
    axes
      .map((ax, idx) => {
        const pt = getCoord(ax.angle, vals[idx]);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(" ");

  const normVals = [4.2, 5.0, 5.5, 4.0];
  const baseVals = [
    summary.baseline_gvs_pelvis ?? 0,
    summary.baseline_gvs_hip ?? 0,
    summary.baseline_gvs_knee ?? 0,
    summary.baseline_gvs_ankle ?? 0,
  ];
  const verbalVals = [
    summary.verbal_gvs_pelvis ?? summary.baseline_gvs_pelvis ?? 0,
    summary.verbal_gvs_hip ?? summary.baseline_gvs_hip ?? 0,
    summary.verbal_gvs_knee ?? summary.baseline_gvs_knee ?? 0,
    summary.verbal_gvs_ankle ?? summary.baseline_gvs_ankle ?? 0,
  ];
  const vrVals = [
    summary.vr_gvs_pelvis ?? 0,
    summary.vr_gvs_hip ?? 0,
    summary.vr_gvs_knee ?? 0,
    summary.vr_gvs_ankle ?? 0,
  ];

  const showVerbal = summary.has_verbal !== false && isFiniteNum(summary.verbal_gvs_pelvis);
  const showVR = summary.has_vr !== false && isFiniteNum(summary.vr_gvs_pelvis);

  const srSummary = isKz
    ? `Жамбас ${fmtFixed(summary.baseline_gvs_pelvis, 1, "°")}, Сан ${fmtFixed(summary.baseline_gvs_hip, 1, "°")}, Тізе ${fmtFixed(summary.baseline_gvs_knee, 1, "°")}, Тобық ${fmtFixed(summary.baseline_gvs_ankle, 1, "°")}`
    : `Таз ${fmtFixed(summary.baseline_gvs_pelvis, 1, "°")}, Бедро ${fmtFixed(summary.baseline_gvs_hip, 1, "°")}, Колено ${fmtFixed(summary.baseline_gvs_knee, 1, "°")}, Стопа ${fmtFixed(summary.baseline_gvs_ankle, 1, "°")}`;

  return (
    <figure className="surface stack-sm" style={{ margin: 0 }}>
      <h3 className="section-title" style={{ fontSize: "15px" }}>
        {isKz ? "Буындар ауытқуының радары (GVS)" : "Профиль отклонений суставов (GVS)"}
      </h3>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <svg
          role="img"
          aria-label={isKz ? "Буындар ауытқуының радары" : "Радар отклонений суставов"}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", maxWidth: `${width}px`, height: "auto", display: "block" }}
        >
          {[5, 10, 15, 20].map((level) => {
            const r = (level / maxGvs) * radius;
            const diagX = centerX + r * Math.cos(-Math.PI / 4) + 2;
            const diagY = centerY + r * Math.sin(-Math.PI / 4) - 2;
            return (
              <g key={level}>
                <circle cx={centerX} cy={centerY} r={r} fill="none" stroke="var(--line)" strokeDasharray="3 3" />
                <text
                  x={diagX}
                  y={diagY}
                  fontSize="10"
                  fill="var(--muted)"
                  paintOrder="stroke"
                  stroke="var(--white)"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {level}°
                </text>
              </g>
            );
          })}

          {axes.map((ax) => {
            const outer = getCoord(ax.angle, maxGvs);
            const labelX = outer.x + ax.offsetX;
            const labelY = outer.y + ax.offsetY;
            return (
              <g key={ax.key}>
                <line x1={centerX} y1={centerY} x2={outer.x} y2={outer.y} stroke="var(--line)" strokeWidth="1.2" />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={ax.anchor}
                  dominantBaseline="central"
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--ink)"
                >
                  {ax.label}
                </text>
              </g>
            );
          })}

          <polygon points={makePolygon(normVals)} fill="var(--norm-corridor)" fillOpacity="0.55" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="2 2" />
          <polygon points={makePolygon(baseVals)} fill="var(--slate-line)" fillOpacity="0.12" stroke="var(--slate-line)" strokeWidth="1.8" />
          {showVerbal && (
            <polygon points={makePolygon(verbalVals)} fill="var(--amber)" fillOpacity="0.14" stroke="var(--amber)" strokeWidth="1.8" />
          )}
          {showVR && (
            <polygon points={makePolygon(vrVals)} fill="var(--teal)" fillOpacity="0.22" stroke="var(--teal)" strokeWidth="2.2" />
          )}
        </svg>
      </div>

      <figcaption className="visually-hidden">{srSummary}</figcaption>

      <div
        className="cluster"
        style={{
          justifyContent: "center",
          gap: "var(--sp-3)",
          fontSize: "12px",
          paddingBlockStart: "var(--sp-2)",
          borderBlockStart: "1px solid var(--line)",
        }}
      >
        <div className="cluster" style={{ gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", background: "var(--slate-line)", borderRadius: "2px", display: "inline-block" }} />
          <span>{isKz ? "Қалыпты" : "Обычная"}</span>
        </div>
        {showVerbal && (
          <div className="cluster" style={{ gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--amber)", borderRadius: "2px", display: "inline-block" }} />
            <span>{isKz ? "Ауызша" : "Голос"}</span>
          </div>
        )}
        {showVR && (
          <div className="cluster" style={{ gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--teal)", borderRadius: "2px", display: "inline-block" }} />
            <span>VR</span>
          </div>
        )}
        <div className="cluster" style={{ gap: "6px" }}>
          <span style={{ width: "10px", borderTop: "1.5px dashed var(--muted)", display: "inline-block" }} />
          <span style={{ color: "var(--muted)" }}>{isKz ? "Норма (≤ 5,5°)" : "Норма (≤ 5,5°)"}</span>
        </div>
      </div>
    </figure>
  );
}
