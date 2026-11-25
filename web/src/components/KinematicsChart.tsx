"use client";

import React, { useState, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { KinematicsResponse, DiscreteSummary } from "@/lib/types";
import { fmtFixed } from "@/lib/format";

interface KinematicsProps {
  data: KinematicsResponse;
  summary?: DiscreteSummary;
  lang: "ru" | "kz" | "en";
}

type JointKey = "aSagH" | "aSagP" | "aSagK" | "aSagA" | "mSagH";

export function KinematicsChart({ data, summary, lang }: KinematicsProps) {
  const isKz = lang === "kz";
  const [activeJoint, setActiveJoint] = useState<JointKey>("aSagH");
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const allJointTabs: Array<{ key: JointKey; label: string }> = [
    { key: "aSagH", label: isKz ? "Сан буыны" : "Бедро" },
    { key: "aSagP", label: isKz ? "Жамбас" : "Таз" },
    { key: "aSagK", label: isKz ? "Тізе" : "Колено" },
    { key: "aSagA", label: isKz ? "Тобық" : "Стопа" },
    { key: "mSagH", label: isKz ? "Сан моменті" : "Момент бедра" },
  ];
  const jointTabs = allJointTabs.filter((tab) => Boolean(data.joints?.[tab.key]));
  const effectiveJoint = data.joints?.[activeJoint]
    ? activeJoint
    : (jointTabs[0]?.key ?? activeJoint);
  const jointData = data.joints?.[effectiveJoint];
  if (!jointData) {
    return (
      <section className="surface" style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-3)", color: "var(--muted)", fontSize: "13px" }}>
        <AlertTriangle size={18} strokeWidth={1.5} color="var(--amber)" style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
        <div>
          <strong style={{ color: "var(--ink)" }}>
            {isKz
              ? "51 нүктелі кинематикалық қисықтар жүктелмеген"
              : "51-точечные кривые цикла шага не загружены"}
          </strong>{" "}
          ·{" "}
          {isKz
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
  const padTop = 32;
  const padBottom = 36;

  const allValues = [
    ...(showBaseline && jointData.baseline ? jointData.baseline.mean : []),
    ...(showVR && jointData.vr ? jointData.vr.mean : []),
    ...(showVerbal && jointData.verbal ? jointData.verbal.mean : []),
    ...jointData.norm_td.mean.map((m, i) => m + (jointData.norm_td.std[i] || 0)),
    ...jointData.norm_td.mean.map((m, i) => m - (jointData.norm_td.std[i] || 0)),
  ].filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const isMoment = effectiveJoint === "mSagH";
  const step = isMoment ? 0.5 : 5;
  const minY = allValues.length > 0 ? Math.floor(Math.min(...allValues) / step) * step - step : -10;
  const maxY = allValues.length > 0 ? Math.ceil(Math.max(...allValues) / step) * step + step : 40;

  const scaleX = (pct: number) => padLeft + (pct / 100) * (width - padLeft - padRight);
  const scaleY = (val: number) => padTop + (1 - (val - minY) / (maxY - minY || 1)) * (height - padTop - padBottom);

  const makePath = (points: Array<number | null | undefined>) => {
    const denom = points.length > 1 ? points.length - 1 : 1;
    const cmds: string[] = [];
    let segStart = true;
    points.forEach((val, idx) => {
      if (typeof val !== "number" || !Number.isFinite(val)) {
        segStart = true;
        return;
      }
      const x = scaleX((idx / denom) * 100);
      const y = scaleY(val);
      cmds.push(`${segStart ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
      segStart = false;
    });
    return cmds.join(" ");
  };

  const stdArr = jointData.norm_td?.std || [];
  const meanArr = jointData.norm_td?.mean || [];
  const normUpper = meanArr.map((m, i) => m + (typeof stdArr[i] === "number" && Number.isFinite(stdArr[i]) ? stdArr[i] : 0));
  const normLower = meanArr.map((m, i) => m - (typeof stdArr[i] === "number" && Number.isFinite(stdArr[i]) ? stdArr[i] : 0));
  const denom = normUpper.length > 1 ? normUpper.length - 1 : 1;
  const safeScaleY = (v: number) => scaleY(typeof v === "number" && Number.isFinite(v) ? v : 0);
  const normAreaPath =
    normUpper.map((val, idx) => `${idx === 0 ? "M" : "L"} ${scaleX((idx / denom) * 100).toFixed(1)} ${safeScaleY(val).toFixed(1)}`).join(" ") +
    " " +
    normLower.slice().reverse().map((val, idx) => `L ${scaleX(((denom - idx) / denom) * 100).toFixed(1)} ${safeScaleY(val).toFixed(1)}`).join(" ") +
    " Z";

  const nPts = jointData.time_percent?.length || 51;
  const nDenom = nPts > 1 ? nPts - 1 : 1;
  const unit = jointData.unit || "°";
  const digits = isMoment ? 2 : 1;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const pct = ((relX - padLeft) / (width - padLeft - padRight)) * 100;
    const clamped = Math.max(0, Math.min(100, pct));
    const idx = nPts > 1 ? Math.round((clamped / 100) * nDenom) : 0;
    setCursorIdx(idx);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % jointTabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + jointTabs.length) % jointTabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = jointTabs.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    setActiveJoint(jointTabs[nextIdx].key);
    tabRefs.current[nextIdx]?.focus();
  };

  const midY = isMoment ? Number(((minY + maxY) / 2).toFixed(1)) : Math.round((minY + maxY) / 2);
  const activeTabId = `kin-tab-${effectiveJoint}`;
  const activePanelId = `kin-panel-${effectiveJoint}`;
  const activeIdx = cursorIdx ?? 0;

  return (
    <section
      className="surface stack-md"
      aria-label={isKz ? "Қадам циклінің кинематикасы" : "Кинематика цикла шага"}
    >
      <div className="row-between">
        <div>
          <h2 className="section-title">
            {isKz
              ? "Қадам циклінің кинематикасы мен кинетикасы (0–100%)"
              : "Кинематика и кинетика цикла шага (0–100%)"}
          </h2>
          <p className="section-subtitle">
            {isKz
              ? "Сұр дәліз — сау балалар нормасы (Schwartz 2008, ±1 SD). 0–60% тірек фазасы, 60–100% ауысу фазасы."
              : "Серый коридор — возрастная норма здоровых детей (Schwartz 2008, ±1 SD). 0–60% фаза опоры, 60–100% фаза переноса."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label={isKz ? "Буынды таңдау" : "Выбор сустава"}
          className="seg-group"
        >
          {jointTabs.map((tab, idx) => {
            const active = activeJoint === tab.key;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`kin-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`kin-panel-${tab.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveJoint(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className="seg-btn"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        className="stack-sm"
      >
        <div className="row-between" style={{ fontSize: "12px" }}>
          <div className="cluster" style={{ gap: "var(--sp-4)" }}>
            <div className="cluster" style={{ gap: "var(--sp-2)" }}>
              <span style={{ width: "12px", height: "10px", background: "var(--norm-corridor)", borderRadius: "2px", display: "inline-block" }} />
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Норма (±1 SD)" : "Норма (±1 SD)"}</span>
            </div>
            {showBaseline && (
              <div className="cluster" style={{ gap: "var(--sp-2)" }}>
                <span style={{ width: "14px", height: "2px", background: "var(--slate-line)", display: "inline-block" }} />
                <span>{isKz ? "Қалыпты жүріс" : "Обычная ходьба"}</span>
              </div>
            )}
            {showVerbal && (
              <div className="cluster" style={{ gap: "var(--sp-2)" }}>
                <span style={{ width: "14px", borderTop: "2px dashed var(--amber)", display: "inline-block" }} />
                <span>{isKz ? "Ауызша нұсқау" : "Голосовые команды"}</span>
              </div>
            )}
            {showVR && (
              <div className="cluster" style={{ gap: "var(--sp-2)" }}>
                <span style={{ width: "14px", height: "3px", background: "var(--teal)", display: "inline-block" }} />
                <span>{isKz ? "VR-режим" : "VR-режим"}</span>
              </div>
            )}
          </div>

          <div className="tabular-nums mono" style={{ fontSize: "12px", color: "var(--secondary)" }}>
            {cursorIdx !== null ? (
              <>
                <span>{Math.round((activeIdx / nDenom) * 100)}%</span>
                {showBaseline && jointData.baseline && (
                  <span> · {isKz ? "Қал." : "База"} {fmtFixed(jointData.baseline.mean[activeIdx], digits, unit)}</span>
                )}
                {showVerbal && jointData.verbal && (
                  <span> · {isKz ? "Ауыз." : "Голос"} {fmtFixed(jointData.verbal.mean[activeIdx], digits, unit)}</span>
                )}
                {showVR && jointData.vr && (
                  <span> · VR {fmtFixed(jointData.vr.mean[activeIdx], digits, unit)}</span>
                )}
                <span> · TD {fmtFixed(jointData.norm_td.mean[activeIdx], digits, unit)}</span>
              </>
            ) : (
              <span>
                {isKz
                  ? "Цикл фазасын көру үшін графикті немесе жүгірткіні жылжытыңыз"
                  : "Наведите курсор или сдвиньте ползунок для просмотра значений"}
              </span>
            )}
          </div>
        </div>

        <div tabIndex={0} role="region" aria-label={isKz ? jointData.name_kz : jointData.name_ru} className="table-responsive">
          <svg
            role="img"
            aria-label={isKz ? jointData.name_kz : jointData.name_ru}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursorIdx(null)}
            style={{ width: "100%", height: "auto", display: "block", minWidth: "560px", cursor: "crosshair" }}
          >
            <rect
              x={scaleX(60)}
              y={padTop}
              width={scaleX(100) - scaleX(60)}
              height={height - padTop - padBottom}
              fill="var(--sidebar)"
              opacity="0.5"
            />

            <text x={scaleX(30)} y={padTop - 10} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="500">
              {isKz ? "Тірек фазасы (0–60%)" : "Фаза опоры (0–60%)"}
            </text>
            <text x={scaleX(80)} y={padTop - 10} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="500">
              {isKz ? "Ауысу фазасы (60–100%)" : "Фаза переноса (60–100%)"}
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
                <text
                  x={padLeft - 8}
                  y={scaleY(val) + 4}
                  fontSize="11"
                  fill="var(--muted)"
                  textAnchor="end"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {val}{unit}
                </text>
              </g>
            ))}

            <path d={normAreaPath} fill="var(--norm-corridor)" fillOpacity="0.65" />
            <path d={makePath(jointData.norm_td.mean)} fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="3 3" />

            {showBaseline && jointData.baseline && (
              <path d={makePath(jointData.baseline.mean)} fill="none" stroke="var(--slate-line)" strokeWidth="2.0" />
            )}
            {showVerbal && jointData.verbal && (
              <path d={makePath(jointData.verbal.mean)} fill="none" stroke="var(--amber)" strokeWidth="2.0" strokeDasharray="5 3" />
            )}
            {showVR && jointData.vr && (
              <path d={makePath(jointData.vr.mean)} fill="none" stroke="var(--teal)" strokeWidth="2.6" />
            )}

            {cursorIdx !== null && (
              <line
                x1={scaleX((cursorIdx / nDenom) * 100)}
                y1={padTop}
                x2={scaleX((cursorIdx / nDenom) * 100)}
                y2={height - padBottom}
                stroke="var(--ink)"
                strokeWidth="1"
                strokeOpacity="0.45"
              />
            )}
          </svg>
        </div>

        {/* Keyboard & Touch Scrubber */}
        <div className="row-between" style={{ paddingTop: "var(--sp-1)" }}>
          <label htmlFor="kinematics-cycle-scrubber" style={{ fontSize: "12px", color: "var(--muted)" }}>
            {isKz ? "Цикл фазасы (%):" : "Позиция цикла (%):"}
          </label>
          <input
            id="kinematics-cycle-scrubber"
            type="range"
            min={0}
            max={nPts > 1 ? nPts - 1 : 0}
            value={cursorIdx ?? 0}
            onChange={(e) => setCursorIdx(Number(e.target.value))}
            aria-valuetext={`${Math.round(((cursorIdx ?? 0) / nDenom) * 100)}%`}
            style={{ flex: 1, maxWidth: "420px" }}
          />
          <span className="tabular-nums mono" style={{ fontSize: "12px", color: "var(--secondary)", minWidth: "40px", textAlign: "right" }}>
            {cursorIdx !== null ? `${Math.round((cursorIdx / nDenom) * 100)}%` : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}
