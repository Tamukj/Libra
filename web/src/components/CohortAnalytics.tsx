"use client";

import React from "react";
import { fmtCm, fmtFixed, fmtPcr, fmtSigned } from "@/lib/format";
import type { CohortAnalytics as CohortAnalyticsType } from "@/lib/types";

interface CohortAnalyticsProps {
  stats: CohortAnalyticsType;
  lang: "ru" | "kz" | "en";
}

function sharePercent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function CohortAnalytics({ stats, lang }: CohortAnalyticsProps) {
  const isKz = lang === "kz";
  const cdss = stats.cdss_distribution;
  const assessedTotal = cdss.green + cdss.yellow + cdss.red;
  const unassessedCount =
    stats.unassessed_patients ?? Math.max(0, stats.total_patients - assessedTotal);
  const methodTotal =
    stats.best_method_distribution.VR +
    stats.best_method_distribution.Verbal +
    stats.best_method_distribution.Baseline;

  const localizedSourceName =
    stats.source.doi === "10.48804/JUNNWW"
      ? isKz
        ? "KU Leuven ашық балалар БЦП когортасы және жүктелген клиникалық CSV кестелері"
        : "Открытая когорта детей с ДЦП (KU Leuven) и загруженные клинические таблицы CSV"
      : stats.source.name;

  const cdssRows = [
    {
      key: "green",
      label: isKz ? "Қауіпсіз прогресс (жамбас компенсациясынсыз)" : "Истинный прогресс в VR (без перегрузки)",
      val: cdss.green,
      color: "var(--teal)",
    },
    {
      key: "yellow",
      label: isKz ? "Компенсация қаупі (PCR > 0,80 немесе жамбас > +2°)" : "Риск компенсации (PCR > 0,80 или таз > +2,0°)",
      val: cdss.yellow,
      color: "var(--amber)",
    },
    {
      key: "red",
      label: isKz ? "Басым таз компенсациясы (жүктемені азайту)" : "Выраженный завал таза (требует коррекции)",
      val: cdss.red,
      color: "var(--red)",
    },
    ...(unassessedCount > 0
      ? [
          {
            key: "unassessed",
            label: isKz ? "Тек бір сессия жүктелген (салыстыру жоқ)" : "Неполный профиль (одна сессия, без VR-сравнения)",
            val: unassessedCount,
            color: "var(--muted)",
          },
        ]
      : []),
  ];

  const methodRows = [
    {
      label: isKz ? "VR-кері байланыс тиімдірек" : "VR-обратная связь",
      val: stats.best_method_distribution.VR,
      color: "var(--teal)",
    },
    {
      label: isKz ? "Ауызша нұсқау тиімдірек" : "Голосовые инструкции",
      val: stats.best_method_distribution.Verbal,
      color: "var(--slate-line)",
    },
    {
      label: isKz ? "Қалыпты жүріс тиімдірек" : "Обычная ходьба (базовая)",
      val: stats.best_method_distribution.Baseline,
      color: "var(--amber)",
    },
  ];

  return (
    <div className="stack-lg">
      {/* Cohort Provenance Strip */}
      <section className="surface-muted stack-xs">
        <div className="row-between">
          <div>
            <h2 className="section-title">{localizedSourceName}</h2>
            <p className="section-subtitle">{stats.source.citation}</p>
          </div>
          <div className="cluster">
            <span className="badge badge-neutral mono">DOI: {stats.source.doi}</span>
            <span className="badge badge-green">{stats.source.license}</span>
          </div>
        </div>
      </section>

      {/* Top 3 Summaries */}
      <div className="grid-3">
        <section className="surface stack-sm">
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            {isKz ? "Пациенттер және циклдер" : "Когорта и циклы шага"}
          </div>
          <div className="font-display tabular-nums" style={{ fontSize: "34px", color: "var(--ink)" }}>
            {stats.total_patients}
          </div>
          <div className="kv-list" style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--sp-3)", color: "var(--secondary)" }}>
            <div className="kv-row">
              <span>{isKz ? "Жиынтық қадам циклдері:" : "Всего циклов шага:"}</span>
              <strong className="tabular-nums">{stats.cycles.total}</strong>
            </div>
            <div className="kv-row">
              <span>{isKz ? "Қалыпты / Ауызша / VR:" : "База / Голос / VR:"}</span>
              <span className="tabular-nums">
                {stats.cycles.baseline} / {stats.cycles.verbal} / {stats.cycles.vr}
              </span>
            </div>
            <div className="kv-row">
              <span>{isKz ? "Сол (L) / Оң (R):" : "Левая (L) / Правая (R):"}</span>
              <span className="tabular-nums">
                {stats.side_distribution.LEFT} / {stats.side_distribution.RIGHT}
              </span>
            </div>
          </div>
        </section>

        <section className="surface stack-sm">
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            {isKz ? "Когорта бойынша орташа мәндер" : "Средние показатели по когорте"}
          </div>
          <div className="kv-list" style={{ marginTop: "var(--sp-1)" }}>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Қалыпты GPS:" : "Базовый GPS:"}</span>
              <strong className="tabular-nums mono">{fmtFixed(stats.averages.baseline_gps, 2, "°")}</strong>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Ауызша нұсқау GPS:" : "GPS (Голос):"}</span>
              <strong className="tabular-nums mono">{fmtFixed(stats.averages.verbal_gps, 2, "°")}</strong>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "VR-терапия GPS:" : "GPS (VR):"}</span>
              <strong className="tabular-nums mono" style={{ color: "var(--teal)" }}>
                {fmtFixed(stats.averages.vr_gps, 2, "°")}
              </strong>
            </div>
            <div className="kv-row" style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--sp-2)", marginTop: "var(--sp-1)" }}>
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Орташа Δ Сан:" : "Средний Δ Бедро:"}</span>
              <strong className="tabular-nums mono" style={{ color: "var(--teal)" }}>
                {fmtSigned(stats.averages.delta_amin_sagh, 2, "°")}
              </strong>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Шынайы жазылу (TJE):" : "Истинное разгибание (TJE):"}</span>
              <strong className="tabular-nums mono">{fmtSigned(stats.averages.tje_vr, 2, "°")}</strong>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Орташа PCR (VR):" : "Средний PCR (VR):"}</span>
              <strong className="tabular-nums mono">{fmtPcr(stats.averages.pcr_vr)}</strong>
            </div>
          </div>
        </section>

        <section className="surface stack-sm">
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            {isKz ? "Антропометриялық ауқым" : "Антропометрические границы"}
          </div>
          <div className="kv-list" style={{ marginTop: "var(--sp-1)" }}>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Салмақ (мин – макс):" : "Масса тела (мин – макс):"}</span>
              <strong className="tabular-nums">
                {fmtFixed(stats.anthropometrics.weight_min, 1)} – {fmtFixed(stats.anthropometrics.weight_max, 1)} {isKz ? "кг" : "кг"}
              </strong>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Бой (мин – макс):" : "Рост (мин – макс):"}</span>
              <strong className="tabular-nums">
                {fmtCm(stats.anthropometrics.height_min, false)} – {fmtCm(stats.anthropometrics.height_max)}
              </strong>
            </div>
            <div className="kv-row">
              <span style={{ color: "var(--secondary)" }}>{isKz ? "Аяқ ұзындығы:" : "Длина ноги:"}</span>
              <strong className="tabular-nums">
                {fmtCm(stats.anthropometrics.leg_length_min, false)} – {fmtCm(stats.anthropometrics.leg_length_max)}
              </strong>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "auto", lineHeight: 1.45 }}>
            {isKz
              ? "Салыстыру шкаласы: дені сау балалардағы қалыпты GPS ≤ 5,5°."
              : "Клинический ориентир: нормальный индекс походки у здоровых детей до 5,5°."}
          </p>
        </section>
      </div>

      {/* Distributions */}
      <div className="grid-2">
        <section className="surface stack-md">
          <div>
            <h2 className="section-title">
              {isKz ? "СППР тәуекел санаттары бойынша бөлінуі" : "Распределение по рискам перегрузки"}
            </h2>
            <p className="section-subtitle">
              {isKz ? "Когорта бойынша жамбас компенсациясын сүзгілеу" : "Стратификация когорты по тазовой компенсации в VR"}
            </p>
          </div>
          <div className="stack-md">
            {cdssRows.map((item) => {
              const pct = sharePercent(item.val, stats.total_patients);
              return (
                <div key={item.key} className="stack-xs">
                  <div className="kv-row" style={{ fontSize: "13px" }}>
                    <span style={{ color: "var(--ink)" }}>{item.label}</span>
                    <strong className="tabular-nums">
                      {item.val} ({pct}%)
                    </strong>
                  </div>
                  <div className="meter-track" aria-hidden="true">
                    <div className="meter-fill" style={{ width: `${pct}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface stack-md">
          <div>
            <h2 className="section-title">
              {isKz ? "Режимдер бойынша үздік нәтиже" : "Наилучший клинический режим"}
            </h2>
            <p className="section-subtitle">
              {isKz
                ? "Қай режимде жамбасты ауытқытпай сан жазылуы көбірек болды"
                : "Какой режим дал наибольшее разгибание бедра с поправкой на наклон таза"}
            </p>
          </div>
          <div className="stack-md">
            {methodRows.map((item) => {
              const pct = sharePercent(item.val, methodTotal);
              return (
                <div key={item.label} className="stack-xs">
                  <div className="kv-row" style={{ fontSize: "13px" }}>
                    <span style={{ color: "var(--ink)" }}>{item.label}</span>
                    <strong className="tabular-nums">
                      {item.val} ({pct}%)
                    </strong>
                  </div>
                  <div className="meter-track" aria-hidden="true">
                    <div className="meter-fill" style={{ width: `${pct}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
