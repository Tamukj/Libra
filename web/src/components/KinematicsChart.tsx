"use client";

import React, { useState } from "react";
import { KinematicsResponse } from "@/lib/types";
import { translations } from "@/lib/translations";

interface KinematicsProps {
  data: KinematicsResponse;
  lang: "ru" | "kz";
}

export function KinematicsChart({ data, lang }: KinematicsProps) {
  const t = translations[lang];
  const [activeJoint, setActiveJoint] = useState<"aSagH" | "aSagP" | "aSagK" | "aSagA">("aSagH");

  const jointData = data.joints[activeJoint];
  if (!jointData) return null;

  const jointNames = {
    aSagH: lang === "kz" ? "Сан (Hip) - Бүгілу/Жазылу" : "Бедро (Hip) - Сгибание/Разгибание",
    aSagP: lang === "kz" ? "Жамбас (Pelvis) - Еңкею" : "Таз (Pelvis) - Наклон вперед/назад",
    aSagK: lang === "kz" ? "Тізе (Knee) - Бүгілу/Жазылу" : "Колено (Knee) - Сгибание/Разгибание",
    aSagA: lang === "kz" ? "Тобық (Ankle) - Бүгілу" : "Голеностоп (Ankle) - Сгибание",
  };

  const width = 800;
  const height = 340;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 30;
  const padBottom = 40;

  // Determine min & max values for scale
  const allValues = [
    ...jointData.baseline.mean,
    ...jointData.vr.mean,
    ...jointData.verbal.mean,
    ...jointData.norm_td.mean.map((m, i) => m + jointData.norm_td.std[i]),
    ...jointData.norm_td.mean.map((m, i) => m - jointData.norm_td.std[i]),
  ];
  const minY = Math.floor(Math.min(...allValues) / 5) * 5 - 5;
  const maxY = Math.ceil(Math.max(...allValues) / 5) * 5 + 5;

  const scaleX = (pct: number) => padLeft + (pct / 100) * (width - padLeft - padRight);
  const scaleY = (val: number) => padTop + (1 - (val - minY) / (maxY - minY)) * (height - padTop - padBottom);

  // Generate SVG path for a curve
  const makePath = (points: number[]) => {
    return points
      .map((val, idx) => {
        const x = scaleX((idx / 50) * 100);
        const y = scaleY(val);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Generate SVG area for Norm TD corridor (+/- 1 SD)
  const normUpper = jointData.norm_td.mean.map((m, i) => m + jointData.norm_td.std[i]);
  const normLower = jointData.norm_td.mean.map((m, i) => m - jointData.norm_td.std[i]);
  const normAreaPath =
    normUpper.map((val, idx) => `${idx === 0 ? "M" : "L"} ${scaleX((idx / 50) * 100).toFixed(1)} ${scaleY(val).toFixed(1)}`).join(" ") +
    " " +
    normLower.reverse().map((val, idx) => `L ${scaleX(((50 - idx) / 50) * 100).toFixed(1)} ${scaleY(val).toFixed(1)}`).join(" ") +
    " Z";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      
      {/* Joint Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["aSagH", "aSagP", "aSagK", "aSagA"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setActiveJoint(key)}
              className="btn"
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                background: activeJoint === key ? "var(--ink)" : "var(--paper)",
                color: activeJoint === key ? "var(--white)" : "var(--ink)",
                borderColor: activeJoint === key ? "var(--ink)" : "var(--line)"
              }}
            >
              {jointNames[key]}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "14px", fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "12px", height: "12px", background: "var(--norm-corridor)", borderRadius: "2px", opacity: 0.6 }} />
            <span>{t.norm_legend}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "14px", height: "3px", background: "#3b82f6" }} />
            <span>{t.baseline_legend}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "14px", height: "3px", background: "var(--teal)" }} />
            <span>{t.vr_legend}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "14px", height: "3px", background: "#f59e0b" }} />
            <span>{t.verbal_legend}</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => (
            <g key={pct}>
              <line
                x1={scaleX(pct)}
                y1={padTop}
                x2={scaleX(pct)}
                y2={height - padBottom}
                stroke="var(--line)"
                strokeDasharray="3 3"
              />
              <text x={scaleX(pct)} y={height - padBottom + 16} fontSize="11" fill="var(--muted)" textAnchor="middle">
                {pct}%
              </text>
            </g>
          ))}

          {/* Stance / Swing Phase Boundary at 60% GC */}
          <line
            x1={scaleX(60)}
            y1={padTop}
            x2={scaleX(60)}
            y2={height - padBottom}
            stroke="var(--muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x={scaleX(30)} y={padTop - 8} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="600">
            Опора (Stance 0–60%)
          </text>
          <text x={scaleX(80)} y={padTop - 8} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="600">
            Перенос (Swing 60–100%)
          </text>

          {/* Y Axis Ticks */}
          {[minY, Math.round((minY + maxY) / 2), maxY].map((val) => (
            <g key={val}>
              <line
                x1={padLeft}
                y1={scaleY(val)}
                x2={width - padRight}
                y2={scaleY(val)}
                stroke="var(--line)"
                strokeDasharray="2 2"
              />
              <text x={padLeft - 8} y={scaleY(val) + 4} fontSize="11" fill="var(--muted)" textAnchor="end">
                {val}°
              </text>
            </g>
          ))}

          {/* 1. Shaded Norm Corridor */}
          <path d={normAreaPath} fill="var(--norm-corridor)" fillOpacity="0.45" />

          {/* 2. Norm TD Mean Line */}
          <path d={makePath(jointData.norm_td.mean)} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* 3. Baseline Mean Line (Blue) */}
          <path d={makePath(jointData.baseline.mean)} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

          {/* 4. Verbal Mean Line (Amber) */}
          <path d={makePath(jointData.verbal.mean)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 3" />

          {/* 5. VR Mean Line (Teal) */}
          <path d={makePath(jointData.vr.mean)} fill="none" stroke="var(--teal)" strokeWidth="3" />

        </svg>
      </div>

    </div>
  );
}
