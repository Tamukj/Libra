"use client";

import React from "react";
import { Users, Activity, ShieldCheck, Database } from "lucide-react";
import { CohortAnalytics as CohortAnalyticsType } from "@/lib/types";

interface Props {
  stats: CohortAnalyticsType;
  lang: "ru" | "kz";
}

export function CohortAnalytics({ stats, lang }: Props) {
  const isKz = lang === "kz";
  const fmt = (v: number | null, unit = "") =>
    typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}${unit}` : "—";

  const totalCdss =
    stats.cdss_distribution.green +
    stats.cdss_distribution.yellow +
    stats.cdss_distribution.red;

  const totalMethods =
    stats.best_method_distribution.VR +
    stats.best_method_distribution.Verbal +
    stats.best_method_distribution.Baseline;

  const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Provenance Strip */}
      <div className="surface-muted">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Database size={16} strokeWidth={1.6} color="var(--teal)" />
          <h2 style={{ fontSize: "15px", fontWeight: 600 }}>
            {isKz
              ? "Когорта дерекқоры бойынша нақты агрегаттар"
              : "Живая статистика по когорте и загруженным обследованиям"}
          </h2>
        </div>
        <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
          {isKz ? "Ашық дереккөз: " : "Открытый источник данных: "}
          <strong>{stats.source.name}</strong> ({stats.source.citation}, DOI{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{stats.source.doi}</span>,{" "}
          {isKz ? "лицензия" : "лицензия"}{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{stats.source.license}</span>).
        </p>
      </div>

      {/* 3 Primary Breakdown Cards */}
      <div className="grid-problem">
        {/* 1. Cohort Volume */}
        <div className="surface">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Users size={16} strokeWidth={1.6} color="var(--teal)" />
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>
              {isKz ? "Когорта көлемі мен циклдер" : "Объём выборки и циклы шага"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Пациенттер саны" : "Пациентов в реестре"}</span>
              <strong className="tabular-nums">{stats.total_patients}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Барлық қадам циклі" : "Всего циклов шага"}</span>
              <strong className="tabular-nums" style={{ color: "var(--teal)" }}>
                {stats.cycles.total.toLocaleString(isKz ? "kk-KZ" : "ru-RU")}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {isKz ? "Қалыпты / Ауызша / VR" : "Обычная / Голос / VR"}
              </span>
              <strong className="tabular-nums">
                {stats.cycles.baseline} / {stats.cycles.verbal} / {stats.cycles.vr}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Зерттелген аяқ (Сол / Оң)" : "Сторона (Левая / Правая)"}</span>
              <strong className="tabular-nums">
                {stats.side_distribution.LEFT} / {stats.side_distribution.RIGHT}
              </strong>
            </div>
          </div>
        </div>

        {/* 2. CDSS & Modality Stratification */}
        <div className="surface">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <ShieldCheck size={16} strokeWidth={1.6} color="var(--amber)" />
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>
              {isKz ? "Қауіпсіздік стратификациясы (VR)" : "Распределение рисков в VR"}
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            {[
              {
                label: isKz ? "Жасыл (Шынайы прогресс)" : "Зелёный (истинный прогресс)",
                count: stats.cdss_distribution.green,
                color: "var(--teal)",
              },
              {
                label: isKz ? "Сары (Бейімделу / жауапсыз)" : "Жёлтый (адаптация / без отклика)",
                count: stats.cdss_distribution.yellow,
                color: "var(--amber)",
              },
              {
                label: isKz ? "Қызыл (Жамбас компенсациясы)" : "Красный (компенсация тазом)",
                count: stats.cdss_distribution.red,
                color: "var(--red)",
              },
            ].map((row) => {
              const p = pct(row.count, totalCdss);
              return (
                <div key={row.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--muted)" }}>{row.label}</span>
                    <strong className="tabular-nums" style={{ color: row.color }}>
                      {row.count} ({p}%)
                    </strong>
                  </div>
                  <div style={{ height: "6px", background: "var(--sidebar)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p}%`, background: row.color, borderRadius: "4px" }} />
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>
                {isKz ? "Тиімді тәсіл (VR / Ауызша / База)" : "Оптимально (VR / Голос / База)"}
              </span>
              <strong className="tabular-nums">
                {stats.best_method_distribution.VR} / {stats.best_method_distribution.Verbal} / {stats.best_method_distribution.Baseline}
                {totalMethods > 0 ? "" : ""}
              </strong>
            </div>
          </div>
        </div>

        {/* 3. Cohort Averages */}
        <div className="surface">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Activity size={16} strokeWidth={1.6} color="var(--teal)" />
            <h3 style={{ fontSize: "14px", fontWeight: 600 }}>
              {isKz ? "Когорта бойынша орташа мәндер" : "Средние значения по когорте"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {isKz ? "GPS (Қалыпты / Ауызша / VR)" : "GPS (Обычная / Голос / VR)"}
              </span>
              <strong className="tabular-nums">
                {fmt(stats.averages.baseline_gps, "°")} / {fmt(stats.averages.verbal_gps, "°")} / {fmt(stats.averages.vr_gps, "°")}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {isKz ? "Орташа ΔaMinSagH (VR)" : "Среднее ΔaMinSagH (VR)"}
              </span>
              <strong className="tabular-nums">{fmt(stats.averages.delta_amin_sagh, "°")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {isKz ? "Орташа TJE / PCR (VR)" : "Средние TJE / PCR (VR)"}
              </span>
              <strong className="tabular-nums">
                {fmt(stats.averages.tje_vr, "°")} / {fmt(stats.averages.pcr_vr)}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>
                {isKz ? "Салмақ / Бой ауқымы" : "Диапазон веса / роста"}
              </span>
              <strong className="tabular-nums">
                {stats.anthropometrics.weight_min ?? "—"}–{stats.anthropometrics.weight_max ?? "—"} кг ·{" "}
                {stats.anthropometrics.height_min ?? "—"}–{stats.anthropometrics.height_max ?? "—"} м
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
