"use client";

import React, { useState } from "react";
import { KinematicsResponse } from "@/lib/types";

interface KinematicsProps {
  data: KinematicsResponse;
  lang: "ru" | "kz" | "en";
}

export function KinematicsChart({ data, lang }: KinematicsProps) {
  const [activeJoint, setActiveJoint] = useState<"aSagH" | "aSagP" | "aSagK" | "aSagA">("aSagH");

  const jointData = data.joints[activeJoint];
  if (!jointData) return null;

  const jointTabs = [
    { key: "aSagH" as const, label: lang === "kz" ? "Сан (Hip)" : "Бедро (Hip)" },
    { key: "aSagP" as const, label: lang === "kz" ? "Жамбас (Pelvis)" : "Таз (Pelvis)" },
    { key: "aSagK" as const, label: lang === "kz" ? "Тізе (Knee)" : "Колено (Knee)" },
    { key: "aSagA" as const, label: lang === "kz" ? "Тобық (Ankle)" : "Голеностоп (Ankle)" },
  ];

  const width = 860;
  const height = 320;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 26;
  const padBottom = 34;

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
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "18px" }}>
      
      {/* Controls Bar: Joint Tabs on Left, Legend on Right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        
        {/* Joint Selector Pills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {jointTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveJoint(tab.key)}
              className="btn"
              style={{
                fontSize: "12px",
                padding: "5px 12px",
                background: activeJoint === tab.key ? "var(--ink)" : "var(--paper)",
                color: activeJoint === tab.key ? "var(--white)" : "var(--ink)",
                borderColor: activeJoint === tab.key ? "var(--ink)" : "var(--line)",
                fontWeight: 650
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--ink)", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "12px", height: "10px", background: "var(--norm-corridor)", borderRadius: "2px", opacity: 0.65 }} />
            <span>{lang === "kz" ? "TD нормасы (±1 SD, Schwartz 2008)" : "Схематическая норма TD (±1 SD, Schwartz 2008)"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "14px", height: "2.5px", background: "#3b82f6" }} />
            <span>{lang === "kz" ? "Қалыпты қадам (Base)" : "Обычный шаг (Base)"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "14px", height: "2.5px", background: "var(--teal)" }} />
            <span>{lang === "kz" ? "VR аватары" : "VR аватар"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "14px", height: "2.5px", background: "#f59e0b" }} />
            <span>{lang === "kz" ? "Дауыс (Verbal)" : "Голос (Verbal)"}</span>
          </div>
        </div>

      </div>

      {/* Clean Clinical Guide Strip (Zero AI Emoji Slop) */}
      <div style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        padding: "7px 12px",
        borderRadius: "6px",
        fontSize: "11.5px",
        color: "var(--muted)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px"
      }}>
        <span>
          {lang === "kz"
            ? "Сұр аймақ — әдебиеттік нормативтік дәліз (Schwartz 2008 ±1 SD). Сарғыш сызықтың (VR) нормадан жоғары шығуы — биомеханикалық компенсация."
            : "Серый коридор — литературный нормативный диапазон здоровых детей (Schwartz 2008 ±1 SD). Отклонение линии VR выше серого диапазона указывает на компенсаторную нагрузку."}
        </span>
        <span style={{ fontWeight: 650, color: "var(--ink)" }}>{lang === "kz" ? "0%–60% Тіреу · 60%–100% Ауысу" : "0%–60% Опора · 60%–100% Перенос"}</span>
      </div>

      {/* SVG Canvas */}
      <div className="table-responsive">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", minWidth: "600px" }}>
          
          {/* Phase 60% Background Tint for Swing */}
          <rect
            x={scaleX(60)}
            y={padTop}
            width={scaleX(100) - scaleX(60)}
            height={height - padTop - padBottom}
            fill="var(--linen)"
            opacity="0.3"
          />

          {/* Stance / Swing Labels */}
          <text x={scaleX(30)} y={padTop - 8} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="600">
            {lang === "kz" ? "ОПОРА (0%–60%)" : "ФАЗА ОПОРЫ (0%–60%)"}
          </text>
          <text x={scaleX(80)} y={padTop - 8} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="600">
            {lang === "kz" ? "ПЕРЕНОС (60%–100%)" : "ФАЗА ПЕРЕНОСА (60%–100%)"}
          </text>

          {/* Stance / Swing Boundary Line */}
          <line
            x1={scaleX(60)}
            y1={padTop}
            x2={scaleX(60)}
            y2={height - padBottom}
            stroke="var(--line)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Grid Lines and X axis ticks */}
          {[0, 25, 50, 75, 100].map((pct) => (
            <g key={pct}>
              <line
                x1={scaleX(pct)}
                y1={padTop}
                x2={scaleX(pct)}
                y2={height - padBottom}
                stroke="var(--line)"
                strokeDasharray="2 3"
              />
              <text x={scaleX(pct)} y={height - padBottom + 16} fontSize="11" fill="var(--muted)" textAnchor="middle">
                {pct}%
              </text>
            </g>
          ))}

          {/* Y Axis Grid and Labels */}
          {[minY, Math.round((minY + maxY) / 2), maxY].map((val) => (
            <g key={val}>
              <line
                x1={padLeft}
                y1={scaleY(val)}
                x2={width - padRight}
                y2={scaleY(val)}
                stroke="var(--line)"
                strokeDasharray="2 3"
              />
              <text x={padLeft - 8} y={scaleY(val) + 4} fontSize="11" fill="var(--muted)" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
                {val}°
              </text>
            </g>
          ))}

          {/* 1. Shaded Norm Corridor */}
          <path d={normAreaPath} fill="var(--norm-corridor)" fillOpacity="0.45" />

          {/* 2. Norm TD Mean Line */}
          <path d={makePath(jointData.norm_td.mean)} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* 3. Baseline Mean Line (Blue) */}
          <path d={makePath(jointData.baseline.mean)} fill="none" stroke="#3b82f6" strokeWidth="2.2" />

          {/* 4. Verbal Mean Line (Amber) */}
          <path d={makePath(jointData.verbal.mean)} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 2" />

          {/* 5. VR Mean Line (Teal) */}
          <path d={makePath(jointData.vr.mean)} fill="none" stroke="var(--teal)" strokeWidth="2.6" />

        </svg>
      </div>

    </div>
  );
}
