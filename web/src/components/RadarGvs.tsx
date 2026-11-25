"use client";

import React from "react";
import { DiscreteSummary } from "@/lib/types";

interface RadarProps {
  summary: DiscreteSummary;
  lang: "ru" | "kz";
}

export function RadarGvs({ summary, lang }: RadarProps) {
  const width = 360;
  const height = 290;
  const centerX = 180;
  const centerY = 148;
  const radius = 84;

  const axes = [
    {
      primary: lang === "kz" ? "Жамбас" : "Таз",
      sub: "Pelvis",
      angle: -Math.PI / 2,
      key: "gvs_pelvis",
      anchor: "middle" as const,
      offsetX: 0,
      offsetY: -22,
    },
    {
      primary: lang === "kz" ? "Сан" : "Бедро",
      sub: "Hip",
      angle: 0,
      key: "gvs_hip",
      anchor: "start" as const,
      offsetX: 12,
      offsetY: 0,
    },
    {
      primary: lang === "kz" ? "Тізе" : "Колено",
      sub: "Knee",
      angle: Math.PI / 2,
      key: "gvs_knee",
      anchor: "middle" as const,
      offsetX: 0,
      offsetY: 20,
    },
    {
      primary: lang === "kz" ? "Тобық" : "Стопа",
      sub: "Ankle",
      angle: Math.PI,
      key: "gvs_ankle",
      anchor: "end" as const,
      offsetX: -12,
      offsetY: 0,
    },
  ];

  const maxGvs = 20.0;

  const getCoord = (angle: number, value: number) => {
    const val = typeof value === "number" && isFinite(value) ? Math.max(0, value) : 0;
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

  const showVerbal = summary.has_verbal !== false && typeof summary.verbal_gvs_pelvis === "number";
  const showVR = summary.has_vr !== false && typeof summary.vr_gvs_pelvis === "number";

  return (
    <div className="surface" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "18px" }}>
      <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
        {lang === "kz" ? "Буындар ауытқуының радары (GVS)" : "Профиль отклонений суставов (GVS)"}
      </h3>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <svg
          role="img"
          aria-label={lang === "kz" ? "Буындар ауытқуының радары" : "Радар отклонений суставов"}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", maxWidth: `${width}px`, height: "auto", display: "block" }}
        >
          {/* Concentric Rings + diagonal tick labels at 45 deg so they never overlap Pelvis label */}
          {[5, 10, 15, 20].map((level) => {
            const r = (level / maxGvs) * radius;
            const diagX = centerX + r * Math.cos(-Math.PI / 4) + 3;
            const diagY = centerY + r * Math.sin(-Math.PI / 4) - 2;
            return (
              <g key={level}>
                <circle cx={centerX} cy={centerY} r={r} fill="none" stroke="var(--line)" strokeDasharray="3 3" />
                <text x={diagX} y={diagY} fontSize="10" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
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
                <text x={labelX} y={labelY} textAnchor={ax.anchor} dominantBaseline="central">
                  <tspan x={labelX} dy="-0.35em" fontSize="12" fontWeight="600" fill="var(--ink)">
                    {ax.primary}
                  </tspan>
                  <tspan x={labelX} dy="1.2em" fontSize="10" fontWeight="400" fill="var(--muted)">
                    {ax.sub}
                  </tspan>
                </text>
              </g>
            );
          })}

          <polygon points={makePolygon(normVals)} fill="var(--norm-corridor)" fillOpacity="0.4" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 2" />
          <polygon points={makePolygon(baseVals)} fill="var(--blue)" fillOpacity="0.12" stroke="var(--blue)" strokeWidth="1.8" />
          {showVerbal && (
            <polygon points={makePolygon(verbalVals)} fill="var(--amber)" fillOpacity="0.14" stroke="var(--amber)" strokeWidth="1.8" />
          )}
          {showVR && (
            <polygon points={makePolygon(vrVals)} fill="var(--teal)" fillOpacity="0.22" stroke="var(--teal)" strokeWidth="2.2" />
          )}
        </svg>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", fontSize: "12px", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", background: "var(--blue)", borderRadius: "2px", display: "inline-block" }} />
          <span>{lang === "kz" ? "Қалыпты" : "Обычная"}</span>
        </div>
        {showVerbal && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--amber)", borderRadius: "2px", display: "inline-block" }} />
            <span>{lang === "kz" ? "Ауызша" : "Голос"}</span>
          </div>
        )}
        {showVR && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--teal)", borderRadius: "2px", display: "inline-block" }} />
            <span>VR</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "10px", height: "0px", borderTop: "1.5px dashed #64748b", display: "inline-block" }} />
          <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Норма (TD ≤ 5,5°)" : "Норма (TD ≤ 5,5°)"}</span>
        </div>
      </div>
    </div>
  );
}
