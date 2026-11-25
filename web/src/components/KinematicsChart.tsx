"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { KinematicsResponse, DiscreteSummary } from "@/lib/types";

interface KinematicsProps {
  data: KinematicsResponse;
  summary?: DiscreteSummary;
  lang: "ru" | "kz";
}

type JointKey = "aSagH" | "aSagP" | "aSagK" | "aSagA" | "mSagH";

export function KinematicsChart({ data, summary, lang }: KinematicsProps) {
  const [activeJoint, setActiveJoint] = useState<JointKey>("aSagH");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const jointTabs: Array<{ key: JointKey; label: string }> = [
    { key: "aSagH", label: lang === "kz" ? "Сан буыны" : "Бедро" },
    { key: "aSagP", label: lang === "kz" ? "Жамбас" : "Таз" },
    { key: "aSagK", label: lang === "kz" ? "Тізе" : "Колено" },
    { key: "aSagA", label: lang === "kz" ? "Тобық" : "Стопа" },
    ...(data.joints?.mSagH
      ? [{ key: "mSagH" as const, label: lang === "kz" ? "Сан моменті" : "Момент бедра" }]
      : []),
  ];

  const jointData = data.joints?.[activeJoint] || data.joints?.aSagH;
  if (!jointData) {
    return (
      <section className="surface" style={{ display: "flex", alignItems: "flex-start", gap: "10px", color: "var(--muted)", fontSize: "13px" }}>
        <AlertTriangle size={17} color="var(--amber)" style={{ flexShrink: 0, marginTop: "2px" }} />
        <div>
          <strong style={{ color: "var(--ink)" }}>
            {lang === "kz"
              ? "51 нүктелі кинематикалық қисықтар жүктелмеген"
              : "51-точечные кривые цикла шага не загружены"}
          </strong>{" "}
          ·{" "}
          {lang === "kz"
            ? "Бұл пациент үшін тек дискретті көрсеткіштер сақталған. Графикті көру үшін толық кинематикалық CSV файлын жүктеңіз."
            : "Для этого пациента сохранены только дискретные показатели. Загрузите CSV с кривыми цикла шага, чтобы построить график без подмены данных."}
        </div>
      </section>
    );
  }

  const avail = data.available_conditions;
  const showBaseline = (avail ? avail.includes("Baseline") : summary?.has_baseline !== false) && Boolean(jointData.baseline);
  const showVerbal = (avail ? avail.includes("Verbal") : summary?.has_verbal !== false) && Boolean(jointData.verbal);
  const showVR = (avail ? avail.includes("VR") : summary?.has_vr !== false) && Boolean(jointData.vr);

  const width = 880;
  const height = 340;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 30;
  const padBottom = 36;

  const allValues = [
    ...(showBaseline && jointData.baseline ? jointData.baseline.mean : []),
    ...(showVR && jointData.vr ? jointData.vr.mean : []),
    ...(showVerbal && jointData.verbal ? jointData.verbal.mean : []),
    ...jointData.norm_td.mean.map((m, i) => m + (jointData.norm_td.std[i] || 0)),
    ...jointData.norm_td.mean.map((m, i) => m - (jointData.norm_td.std[i] || 0)),
  ].filter((v): v is number => typeof v === "number" && !isNaN(v) && isFinite(v));

  const isMoment = activeJoint === "mSagH";
  const step = isMoment ? 0.5 : 5;
  const minY = allValues.length > 0 ? Math.floor(Math.min(...allValues) / step) * step - step : -10;
  const maxY = allValues.length > 0 ? Math.ceil(Math.max(...allValues) / step) * step + step : 40;

  const scaleX = (pct: number) => padLeft + (pct / 100) * (width - padLeft - padRight);
  const scaleY = (val: number) => padTop + (1 - (val - minY) / (maxY - minY || 1)) * (height - padTop - padBottom);

  const makePath = (points: number[]) => {
    const denom = points.length > 1 ? points.length - 1 : 1;
    return points
      .map((val, idx) => {
        const safeVal = typeof val === "number" && isFinite(val) ? val : 0;
        const x = scaleX((idx / denom) * 100);
        const y = scaleY(safeVal);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const stdArr = jointData.norm_td?.std || [];
  const meanArr = jointData.norm_td?.mean || [];
  const normUpper = meanArr.map((m, i) => m + (typeof stdArr[i] === "number" && isFinite(stdArr[i]) ? stdArr[i] : 0));
  const normLower = meanArr.map((m, i) => m - (typeof stdArr[i] === "number" && isFinite(stdArr[i]) ? stdArr[i] : 0));
  const denom = normUpper.length > 1 ? normUpper.length - 1 : 1;
  const safeScaleY = (v: number) => scaleY(typeof v === "number" && isFinite(v) ? v : 0);
  const normAreaPath =
    normUpper.map((val, idx) => `${idx === 0 ? "M" : "L"} ${scaleX((idx / denom) * 100).toFixed(1)} ${safeScaleY(val).toFixed(1)}`).join(" ") +
    " " +
    normLower.slice().reverse().map((val, idx) => `L ${scaleX(((denom - idx) / denom) * 100).toFixed(1)} ${safeScaleY(val).toFixed(1)}`).join(" ") +
    " Z";

  const nPts = jointData.time_percent?.length || 51;
  const unit = jointData.unit || "°";
  const digits = isMoment ? 2 : 1;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const pct = ((relX - padLeft) / (width - padLeft - padRight)) * 100;
    const clamped = Math.max(0, Math.min(100, pct));
    const idx = Math.round((clamped / 100) * (nPts - 1));
    setHoverIdx(idx);
  };

  const midY = isMoment ? Number(((minY + maxY) / 2).toFixed(1)) : Math.round((minY + maxY) / 2);

  return (
    <section className="surface" aria-label={lang === "kz" ? "Қадам циклінің кинематикасы" : "Кинематика цикла шага"} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
            {lang === "kz" ? "Қадам циклінің кинематикасы мен кинетикасы (0–100%)" : "Кинематика и кинетика цикла шага (0–100%)"}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
            {lang === "kz"
              ? "Сұр аймақ — жасы бойынша нормативтік дәліз (Schwartz 2008, ±1 SD). 0–60% тірек фазасы, 60–100% ауысу фазасы."
              : "Серый коридор — возрастная норма здоровых детей (Schwartz 2008, ±1 SD). 0–60% фаза опоры, 60–100% фаза переноса."}
          </p>
        </div>

        {/* Joint Selector */}
        <div role="tablist" aria-label={lang === "kz" ? "Буынды таңдау" : "Выбор сустава"} style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {jointTabs.map((tab) => {
            const active = activeJoint === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveJoint(tab.key)}
                className="btn"
                style={{
                  minBlockSize: "32px",
                  fontSize: "12px",
                  padding: "4px 12px",
                  background: active ? "var(--ink)" : "var(--paper)",
                  color: active ? "var(--white)" : "var(--ink)",
                  borderColor: active ? "var(--ink)" : "var(--line-strong)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend & Live Cursor Readout */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", fontSize: "12px" }}>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "12px", height: "10px", background: "var(--norm-corridor)", borderRadius: "2px", opacity: 0.7 }} />
            <span style={{ color: "var(--secondary)" }}>{lang === "kz" ? "Норма (±1 SD)" : "Норма (±1 SD)"}</span>
          </div>
          {showBaseline && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "14px", height: "2px", background: "var(--blue)" }} />
              <span>{lang === "kz" ? "Қалыпты жүріс" : "Обычная ходьба"}</span>
            </div>
          )}
          {showVerbal && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "14px", height: "2px", background: "var(--amber)" }} />
              <span>{lang === "kz" ? "Ауызша нұсқау" : "Голосовые команды"}</span>
            </div>
          )}
          {showVR && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "14px", height: "2.5px", background: "var(--teal)" }} />
              <span>{lang === "kz" ? "VR-режим" : "VR-режим"}</span>
            </div>
          )}
        </div>

        <div className="tabular-nums" style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--secondary)" }}>
          {hoverIdx !== null ? (
            <>
              <span>{Math.round((hoverIdx / (nPts - 1)) * 100)}%</span>
              {showBaseline && jointData.baseline && (
                <span> · Base {(jointData.baseline.mean[hoverIdx] ?? 0).toFixed(digits)}{unit}</span>
              )}
              {showVerbal && jointData.verbal && (
                <span> · Verbal {(jointData.verbal.mean[hoverIdx] ?? 0).toFixed(digits)}{unit}</span>
              )}
              {showVR && jointData.vr && (
                <span> · VR {(jointData.vr.mean[hoverIdx] ?? 0).toFixed(digits)}{unit}</span>
              )}
              <span> · TD {(jointData.norm_td.mean[hoverIdx] ?? 0).toFixed(digits)}{unit}</span>
            </>
          ) : (
            <span>
              {lang === "kz"
                ? "Нақты бұрыштарды көру үшін графикке меңзерді апарыңыз"
                : "Наведите курсор на график для просмотра значений по циклу"}
            </span>
          )}
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="table-responsive">
        <svg
          role="img"
          aria-label={lang === "kz" ? jointData.name_kz : jointData.name_ru}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          style={{ width: "100%", height: "auto", display: "block", minWidth: "560px", cursor: "crosshair" }}
        >
          <rect
            x={scaleX(60)}
            y={padTop}
            width={scaleX(100) - scaleX(60)}
            height={height - padTop - padBottom}
            fill="var(--sidebar)"
            opacity="0.45"
          />

          <text x={scaleX(30)} y={padTop - 10} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="500">
            {lang === "kz" ? "Тірек фазасы (0–60%)" : "Фаза опоры (0–60%)"}
          </text>
          <text x={scaleX(80)} y={padTop - 10} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="500">
            {lang === "kz" ? "Ауысу фазасы (60–100%)" : "Фаза переноса (60–100%)"}
          </text>

          <line
            x1={scaleX(60)}
            y1={padTop}
            x2={scaleX(60)}
            y2={height - padBottom}
            stroke="var(--line-strong)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />

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
              <text x={scaleX(pct)} y={height - padBottom + 18} fontSize="11" fill="var(--muted)" textAnchor="middle">
                {pct}%
              </text>
            </g>
          ))}

          {[minY, midY, maxY].map((val) => (
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
                {val}{unit}
              </text>
            </g>
          ))}

          <path d={normAreaPath} fill="var(--norm-corridor)" fillOpacity="0.45" />
          <path d={makePath(jointData.norm_td.mean)} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />

          {showBaseline && jointData.baseline && (
            <path d={makePath(jointData.baseline.mean)} fill="none" stroke="var(--blue)" strokeWidth="2.2" />
          )}
          {showVerbal && jointData.verbal && (
            <path d={makePath(jointData.verbal.mean)} fill="none" stroke="var(--amber)" strokeWidth="2.0" strokeDasharray="5 3" />
          )}
          {showVR && jointData.vr && (
            <path d={makePath(jointData.vr.mean)} fill="none" stroke="var(--teal)" strokeWidth="2.6" />
          )}

          {hoverIdx !== null && (
            <line
              x1={scaleX((hoverIdx / (nPts - 1)) * 100)}
              y1={padTop}
              x2={scaleX((hoverIdx / (nPts - 1)) * 100)}
              y2={height - padBottom}
              stroke="var(--ink)"
              strokeWidth="1"
              strokeOpacity="0.45"
            />
          )}
        </svg>
      </div>
    </section>
  );
}
