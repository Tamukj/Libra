"use client";

import React from "react";
import { DiscreteSummary } from "@/lib/types";

interface RadarProps {
  summary: DiscreteSummary;
  lang: "ru" | "kz";
}

export function RadarGvs({ summary, lang }: RadarProps) {
  const size = 320;
  const center = size / 2;
  const radius = center - 40;

  // 4 axes: Pelvis (top), Hip (right), Knee (bottom), Ankle (left)
  const axes = [
    { name: lang === "kz" ? "Таз (Pelvis)" : "Таз (Pelvis)", angle: -Math.PI / 2, key: "gvs_pelvis" },
    { name: lang === "kz" ? "Сан (Hip)" : "Бедро (Hip)", angle: 0, key: "gvs_hip" },
    { name: lang === "kz" ? "Тізе (Knee)" : "Колено (Knee)", angle: Math.PI / 2, key: "gvs_knee" },
    { name: lang === "kz" ? "Тобық (Ankle)" : "Стопа (Ankle)", angle: Math.PI, key: "gvs_ankle" }
  ];

  const maxGvs = 20.0; // scale max

  const getCoord = (angle: number, value: number) => {
    const r = (Math.min(value, maxGvs) / maxGvs) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
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
  const vrVals = [summary.vr_gvs_pelvis, summary.vr_gvs_hip, summary.vr_gvs_knee, summary.vr_gvs_ankle];
  const vbVals = summary.verbal_gvs_pelvis !== undefined
    ? [summary.verbal_gvs_pelvis, summary.verbal_gvs_hip || 0, summary.verbal_gvs_knee || 0, summary.verbal_gvs_ankle || 0]
    : baseVals;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div style={{ fontSize: "14px", fontWeight: "600", width: "100%", textAlign: "left" }}>
        {lang === "kz" ? "Буындар девиациясы радары (GVS Profile)" : "Радар девиации суставов (GVS Profile)"}
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        
        {/* Concentric Grid Circles: 5°, 10°, 15°, 20° */}
        {[5, 10, 15, 20].map((level) => {
          const r = (level / maxGvs) * radius;
          return (
            <g key={level}>
              <circle cx={center} cy={center} r={r} fill="none" stroke="var(--line)" strokeDasharray="3 3" />
              <text x={center + 4} y={center - r + 11} fontSize="9" fill="var(--muted)">
                {level}°
              </text>
            </g>
          );
        })}

        {/* Axis lines */}
        {axes.map((ax) => {
          const outer = getCoord(ax.angle, maxGvs);
          const labelPt = getCoord(ax.angle, maxGvs + 4);
          return (
            <g key={ax.key}>
              <line x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="var(--line)" strokeWidth="1.5" />
              <text
                x={labelPt.x}
                y={labelPt.y}
                fontSize="11"
                fontWeight="600"
                fill="var(--ink)"
                textAnchor={Math.abs(ax.angle) === Math.PI / 2 ? "middle" : ax.angle === 0 ? "start" : "end"}
                dominantBaseline="central"
              >
                {ax.name}
              </text>
            </g>
          );
        })}

        {/* 1. TD Norm Polygon (Gray) */}
        <polygon points={makePolygon(normVals)} fill="var(--norm-corridor)" fillOpacity="0.4" stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 2" />

        {/* 2. Baseline Polygon (Blue) */}
        <polygon points={makePolygon(baseVals)} fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="2" />

        {/* 3. Verbal Polygon (Amber) */}
        <polygon points={makePolygon(vbVals)} fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />

        {/* 4. VR Polygon (Teal/Red if compensation) */}
        <polygon points={makePolygon(vrVals)} fill="var(--teal)" fillOpacity="0.25" stroke="var(--teal)" strokeWidth="2.5" />

      </svg>

      <div style={{ fontSize: "11px", color: "var(--muted)", textAlign: "center" }}>
        Чем ближе контур к центру (серый TD) — тем ближе походка к норме.
      </div>
    </div>
  );
}
