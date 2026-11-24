"use client";

import React from "react";
import { Users, Activity, ShieldCheck, Database } from "lucide-react";
import { CohortAnalytics as CohortAnalyticsType } from "@/lib/types";

interface Props {
  stats: CohortAnalyticsType;
  lang: "ru" | "kz" | "en";
}

export function CohortAnalytics({ stats, lang }: Props) {
  const isKz = lang === "kz";
  const fmt = (v: number | null, unit = "") =>
    typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}${unit}` : "—";

  const totalCdss =
    stats.cdss_distribution.green +
    stats.cdss_distribution.yellow +
    stats.cdss_distribution.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Dataset Provenance */}
      <div className="card-raised">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Database size={18} color="var(--teal)" />
          <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
            {isKz
              ? "Когорта деректерінен тікелей есептелген жиынтық статистика"
              : "Живая аналитика по реальной когорте и загруженным CSV-сессиям"}
          </h2>
        </div>
        <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.55 }}>
          {isKz ? "Негізгі ашық дереккөз: " : "Открытый источник данных: "}
          <strong>{stats.source.name}</strong> ({stats.source.citation}, DOI:{" "}
          <code>{stats.source.doi}</code>, {isKz ? "лицензия" : "лицензия"}{" "}
          <code>{stats.source.license}</code>).
        </div>
      </div>

      {/* Top 3 Live Breakdown Cards */}
      <div className="grid-problem">
        {/* Card 1: Cohort & Cycles */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Users size={18} color="var(--teal)" />
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
              {isKz ? "Когорта көлемі мен циклдер" : "Объём когорты и циклы шага"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Барлық пациенттер:" : "Всего пациентов:"}</span>
              <strong>{stats.total_patients}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Барлық қадам циклі:" : "Всего циклов шага:"}</span>
              <strong style={{ color: "var(--teal)" }}>{stats.cycles.total.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Baseline / Verbal / VR:</span>
              <strong className="tabular-nums">
                {stats.cycles.baseline} / {stats.cycles.verbal} / {stats.cycles.vr}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Зерттелген аяқ (L / R):" : "Сторона (LEFT / RIGHT):"}</span>
              <strong>
                {stats.side_distribution.LEFT} / {stats.side_distribution.RIGHT}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: CDSS Risk Distribution */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <ShieldCheck size={18} color="var(--amber)" />
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
              {isKz ? "CDSS бағдаршамы бойынша бөлу" : "Стратификация риска CDSS (VR)"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Жасыл (Шынайы прогресс):" : "Зелёный (True Responder):"}</span>
              <strong style={{ color: "var(--teal)" }}>
                {stats.cdss_distribution.green} ({totalCdss ? Math.round((stats.cdss_distribution.green / totalCdss) * 100) : 0}%)
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Сары (Бейімделу / жауапсыз):" : "Жёлтый (Адаптация / нет отклика):"}</span>
              <strong style={{ color: "var(--amber)" }}>
                {stats.cdss_distribution.yellow} ({totalCdss ? Math.round((stats.cdss_distribution.yellow / totalCdss) * 100) : 0}%)
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Қызыл (Жамбас компенсациясы):" : "Красный (Компенсация таза):"}</span>
              <strong style={{ color: "var(--red)" }}>
                {stats.cdss_distribution.red} ({totalCdss ? Math.round((stats.cdss_distribution.red / totalCdss) * 100) : 0}%)
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px", borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Оңтайлы әдіс (VR / Verbal / Base):" : "Оптимально (VR / Verbal / Base):"}</span>
              <strong>
                {stats.best_method_distribution.VR} / {stats.best_method_distribution.Verbal} / {stats.best_method_distribution.Baseline}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 3: Cohort Biomechanical Averages */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Activity size={18} color="var(--teal)" />
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
              {isKz ? "Орташа биомеханикалық көрсеткіштер" : "Средние показатели по когорте"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>GPS (Baseline / Verbal / VR):</span>
              <strong className="tabular-nums">
                {fmt(stats.averages.baseline_gps, "°")} / {fmt(stats.averages.verbal_gps, "°")} / {fmt(stats.averages.vr_gps, "°")}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Орташа ΔaMinSagH (VR):" : "Средняя ΔaMinSagH (VR):"}</span>
              <strong>{fmt(stats.averages.delta_amin_sagh, "°")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Орташа TJE / PCR (VR):" : "Средние TJE / PCR (VR):"}</span>
              <strong>
                {fmt(stats.averages.tje_vr, "°")} / {fmt(stats.averages.pcr_vr)}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px", borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>{isKz ? "Салмақ / Бой диапазоны:" : "Диапазон веса / роста:"}</span>
              <strong>
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
