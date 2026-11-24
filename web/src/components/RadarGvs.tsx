"use client";

import React from "react";
import { DiscreteSummary } from "@/lib/types";

interface RadarProps {
  summary: DiscreteSummary;
  lang: "ru" | "kz" | "en";
}

export function RadarGvs({ summary, lang }: RadarProps) {
  // Calibrated dimensions with generous breathing margins for 100% visible axis labels
  const width = 310;
  const height = 240;
  const centerX = 155;
  const centerY = 120;
  const radius = 64;

  // 4 axes: Pelvis (top), Hip (right), Knee (bottom), Ankle (left)
  const axes = [
    {
      primary: lang === "kz" ? "Таз" : "Таз",
      sub: "Pelvis",
      angle: -Math.PI / 2,
      key: "gvs_pelvis",
      anchor: "middle" as const,
      offsetX: 0,
      offsetY: -12
    },
    {
      primary: lang === "kz" ? "Сан" : "Бедро",
      sub: "Hip",
      angle: 0,
      key: "gvs_hip",
      anchor: "start" as const,
      offsetX: 8,
      offsetY: 0
    },
    {
      primary: lang === "kz" ? "Тізе" : "Колено",
      sub: "Knee",
      angle: Math.PI / 2,
      key: "gvs_knee",
      anchor: "middle" as const,
      offsetX: 0,
      offsetY: 16
    },
    {
      primary: lang === "kz" ? "Тобық" : "Стопа",
      sub: "Ankle",
      angle: Math.PI,
      key: "gvs_ankle",
      anchor: "end" as const,
      offsetX: -8,
      offsetY: 0
    }
  ];

  const maxGvs = 20.0;

  const getCoord = (angle: number, value: number) => {
    const val = typeof value === "number" && !isNaN(value) ? Math.max(0, value) : 0;
    const r = (Math.min(val, maxGvs) / maxGvs) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle)
    };
  };

  const makePolygon = (vals: number[]) => {
    return axes
      .map((ax, idx) => {
        const pt = getCoord(ax.angle, vals[idx]);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Values order: Pelvis, Hip, Knee, Ankle
  const normVals = [4.2, 5.0, 5.5, 4.0];
  const baseVals = [summary.baseline_gvs_pelvis, summary.baseline_gvs_hip, summary.baseline_gvs_knee, summary.baseline_gvs_ankle];
  const verbalVals = [
    summary.verbal_gvs_pelvis ?? summary.baseline_gvs_pelvis,
    summary.verbal_gvs_hip ?? summary.baseline_gvs_hip,
    summary.verbal_gvs_knee ?? summary.baseline_gvs_knee,
    summary.verbal_gvs_ankle ?? summary.baseline_gvs_ankle
  ];
  const vrVals = [summary.vr_gvs_pelvis, summary.vr_gvs_hip, summary.vr_gvs_knee, summary.vr_gvs_ankle];

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "18px" }}>
      
      {/* Title */}
      <div style={{ fontSize: "14px", fontWeight: 700, width: "100%", textAlign: "left" }}>
        {lang === "kz" ? "Буын девиациясы радары (GVS)" : "Радар девиации по Бейкеру (GVS)"}
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <svg
          width="100%"
          height="auto"
          viewBox={`0 0 ${width} ${height}`}
          style={{ maxWidth: `${width}px`, display: "block", overflow: "visible" }}
        >
          
          {/* Concentric Grid Circles: 5°, 10°, 15°, 20° */}
          {[5, 10, 15, 20].map((level) => {
            const r = (level / maxGvs) * radius;
            return (
              <g key={level}>
                <circle cx={centerX} cy={centerY} r={r} fill="none" stroke="var(--line)" strokeDasharray="3 3" />
                <text x={centerX + 3} y={centerY - r + 8} fontSize="10" fill="var(--muted)">
                  {level}°
                </text>
              </g>
            );
          })}

          {/* Axis lines and positioned two-line labels */}
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
                >
                  <tspan x={labelX} dy={ax.offsetY < 0 ? "-0.4em" : ax.offsetY > 0 ? "0.2em" : "-0.4em"} fontSize="11" fontWeight="700" fill="var(--ink)">
                    {ax.primary}
                  </tspan>
                  <tspan x={labelX} dy="1.15em" fontSize="9" fontWeight="500" fill="var(--muted)">
                    ({ax.sub})
                  </tspan>
                </text>
              </g>
            );
          })}

          {/* 1. TD Norm Polygon (Corridor) */}
          <polygon points={makePolygon(normVals)} fill="var(--norm-corridor)" fillOpacity="0.4" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 2" />

          {/* 2. Baseline Polygon (Blue) */}
          <polygon points={makePolygon(baseVals)} fill="#3b82f6" fillOpacity="0.12" stroke="#3b82f6" strokeWidth="1.8" />

          {/* 3. Verbal Polygon (Amber / Orange) */}
          <polygon points={makePolygon(verbalVals)} fill="#d97706" fillOpacity="0.14" stroke="#d97706" strokeWidth="1.8" />

          {/* 4. VR Polygon (Teal) */}
          <polygon points={makePolygon(vrVals)} fill="var(--teal)" fillOpacity="0.22" stroke="var(--teal)" strokeWidth="2.2" />

        </svg>
      </div>

      {/* Clinical Legend: Base, Verbal, VR, Norm */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px", fontSize: "11px", paddingTop: "4px", borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "8px", height: "8px", background: "#3b82f6", borderRadius: "2px", display: "inline-block" }} />
          <span>{lang === "kz" ? "Бастапқы (Base)" : "Обычный (Base)"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "8px", height: "8px", background: "#d97706", borderRadius: "2px", display: "inline-block" }} />
          <span>{lang === "kz" ? "Дауыс (Verbal)" : "Голос (Verbal)"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "8px", height: "8px", background: "var(--teal)", borderRadius: "2px", display: "inline-block" }} />
          <span>{lang === "kz" ? "VR аватар" : "VR аватар"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "0px", borderTop: "1.5px dashed #64748b", display: "inline-block" }} />
          <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Норма (TD)" : "Норма (TD)"}</span>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "var(--muted)", textAlign: "center", lineHeight: "1.4" }}>
        {lang === "kz"
          ? "Орталық тор — сау балалардың нормасы (TD ≤ 5.5°)."
          : "Центр сетки — физиологическая норма (TD ≤ 5.5°)."}
      </div>
    </div>
  );
}
