"use client";

import React from "react";
import { fmtPercent } from "@/lib/format";
import type { MLMetrics } from "@/lib/types";

interface MlValidationProps {
  metrics: MLMetrics;
  lang: "ru" | "kz";
}

function mapFeatureLabel(key: string, isKz: boolean): string {
  const dict: Record<string, { ru: string; kz: string }> = {
    aMinSagH: {
      ru: "Минимальное сгибание бедра в опоре",
      kz: "Тіреудегі санның мин. бүгілуі",
    },
    GVS_aSagP: {
      ru: "Отклонение таза от нормы (GVS)",
      kz: "Жамбас ауытқуы (GVS)",
    },
    GPS_a: {
      ru: "Общий индекс походки (GPS)",
      kz: "Жалпы жүріс индексі (GPS)",
    },
    GVS_aSagH: {
      ru: "Отклонение бедра от нормы (GVS)",
      kz: "Сан ауытқуы (GVS)",
    },
    GVS_aSagK: {
      ru: "Отклонение колена от нормы (GVS)",
      kz: "Тізе ауытқуы (GVS)",
    },
    GVS_aSagA: {
      ru: "Отклонение голеностопа (GVS)",
      kz: "Тобық ауытқуы (GVS)",
    },
    pctmZeroStSagH: {
      ru: "Момент разгибания бедра в опоре",
      kz: "Тіреудегі сан жазылу моменті",
    },
    kinematic_waveforms: {
      ru: "Форма кинематических кривых",
      kz: "Кинематикалық қисық пішіні",
    },
  };
  return dict[key]?.[isKz ? "kz" : "ru"] || key;
}

export function MlValidation({ metrics, lang }: MlValidationProps) {
  const isKz = lang === "kz";

  const mainKpis = [
    {
      label: isKz ? "Теңдестірілген дәлдік" : "Точность различия VR и базы",
      val: fmtPercent(metrics.balanced_accuracy, true, 1),
      sub: isKz
        ? `VR және қалыпты режим (${metrics.n_splits} фолд)`
        : `Базовая модель, ${metrics.n_splits} фолдов`,
    },
    {
      label: isKz ? "Бөлу сапасы (ROC-AUC)" : "Качество разделения (ROC-AUC)",
      val: fmtPercent(metrics.roc_auc, true, 1),
      sub: isKz ? "Ажырату қабілеті" : "Площадь под ROC-кривой",
    },
    {
      label: isKz ? "Сезімталдық (VR)" : "Чувствительность к VR",
      val: fmtPercent(metrics.sensitivity, true, 1),
      sub: isKz ? "VR-жүрісті тану" : "Доля распознанных VR-циклов",
    },
    {
      label: isKz ? "Спецификалық (Қалыпты)" : "Специфичность к базе",
      val: fmtPercent(metrics.specificity, true, 1),
      sub: isKz ? "Қалыпты жүрісті ажырату" : "Отсутствие ложных срабатываний",
    },
  ];

  const sortedFeatures = Object.entries(metrics.feature_importances || {})
    .sort(([, a], [, b]) => b - a);
  const maxImp = sortedFeatures.length > 0 ? Math.max(...sortedFeatures.map(([, v]) => v), 0.01) : 1;

  return (
    <div className="stack-lg">
      {/* Validation Protocol Banner */}
      <section className="surface-muted stack-xs">
        <div className="row-between">
          <div>
            <h2 className="section-title">
              {isKz
                ? "Пациент бойынша оқшауланған тексеру хаттамасы"
                : "Кросс-валидация с изоляцией по пациентам"}
            </h2>
            <p className="section-subtitle" style={{ maxWidth: "70ch" }}>
              {isKz
                ? "Бір баланың барлық қадам циклдері тек оқу немесе тек тексеру тобына түседі, сондықтан деректердің ағып кетуіне жол берілмейді."
                : "Все циклы шага одного ребёнка попадают строго в один разрез проверки — это исключает утечку данных между тренировкой и тестом."}
            </p>
          </div>
          <div className="cluster">
            <span className="badge badge-green">
              {isKz ? `Пациенттер: ${metrics.n_subjects}` : `Пациентов: ${metrics.n_subjects}`}
            </span>
            <span className="badge badge-neutral">
              {isKz ? `Циклдер: ${metrics.n_cycles}` : `Циклов шага: ${metrics.n_cycles}`}
            </span>
          </div>
        </div>
      </section>

      {/* Main 4 KPIs */}
      <div className="grid-kpi-4">
        {mainKpis.map((item) => (
          <div key={item.label} className="surface stack-xs">
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{item.label}</div>
            <div className="font-display tabular-nums" style={{ fontSize: "30px", color: "var(--ink)" }}>
              {item.val}
            </div>
            <div style={{ fontSize: "12px", color: "var(--secondary)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Multi-model Details */}
      <div className="grid-2">
        {/* Left: 3-class + PCA Stability */}
        <div className="stack-lg">
          {metrics.three_class && (
            <section className="surface stack-md">
              <div className="row-between">
                <div>
                  <h2 className="section-title">
                    {isKz ? "Үш режимді жіктеу (Қалыпты / Ауызша / VR)" : "Различение трёх режимов ходьбы"}
                  </h2>
                  <p className="section-subtitle">
                    {isKz ? "Обычная, ауызша нұсқау және VR-кері байланыс" : "Обычная ходьба, голосовые инструкции и VR"}
                  </p>
                </div>
                <span className="badge badge-neutral">
                  {metrics.three_class.n_cycles} {isKz ? "цикл" : "циклов"}
                </span>
              </div>

              <div className="hairline-grid">
                <div className="hairline-cell">
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "Теңдестірілген дәлдік" : "Сбалансированная точность"}
                  </div>
                  <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)" }}>
                    {fmtPercent(metrics.three_class.balanced_accuracy, true, 1)}
                  </div>
                </div>
                <div className="hairline-cell">
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "Макро F1 көрсеткіші" : "Сводная оценка (Macro F1)"}
                  </div>
                  <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)" }}>
                    {fmtPercent(metrics.three_class.f1_macro, true, 1)}
                  </div>
                </div>
                {typeof metrics.three_class.roc_auc === "number" && (
                  <div className="hairline-cell">
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>ROC-AUC</div>
                    <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)" }}>
                      {fmtPercent(metrics.three_class.roc_auc, true, 1)}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {metrics.pca_validation && (
            <section className="surface stack-md">
              <div>
                <h2 className="section-title">
                  {isKz ? "Қадам тұрақтылығын бақылау (PCA)" : "Модель стабильности цикла шага (PCA)"}
                </h2>
                <p className="section-subtitle">
                  {isKz
                    ? "Тәуелсіз фолдтар бойынша ауытқу деңгейін тексеру"
                    : "Доля нестандартных циклов при проверке на неиспользованных пациентах"}
                </p>
              </div>

              <div className="hairline-grid">
                <div className="hairline-cell">
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "Қалыпты жүрістегі ауытқу" : "Аномалии в обычной ходьбе"}
                  </div>
                  <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)" }}>
                    {fmtPercent(metrics.pca_validation.oof_baseline_anomaly_rate, true, 1)}
                  </div>
                </div>
                <div className="hairline-cell hairline-cell-active">
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "VR режиміндегі ығысу" : "Сдвиг в VR (распознано как новое)"}
                  </div>
                  <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, color: "var(--teal)", marginTop: "var(--sp-1)" }}>
                    {fmtPercent(metrics.pca_validation.vr_anomaly_rate, true, 1)}
                  </div>
                </div>
              </div>

              <div className="stack-xs">
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {isKz ? "Қиылыспалы тексеру фолдтары бойынша үлес:" : "Доля по фолдам проверки:"}
                </div>
                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  {metrics.pca_validation.fold_rates.map((r, i) => (
                    <div
                      key={i}
                      className="panel-inset"
                      style={{ flex: 1, textAlign: "center", padding: "var(--sp-2)" }}
                    >
                      <div className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                        {fmtPercent(r, true, 0)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        #{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right: Responder Prediction + Feature Importances */}
        <div className="stack-lg">
          {metrics.vr_responder && (
            <section className="surface stack-md">
              <div className="row-between">
                <div>
                  <h2 className="section-title">
                    {isKz ? "VR-терапияға жауап болжамы" : "Прогноз отклика на VR-терапию"}
                  </h2>
                  <p className="section-subtitle">
                    {isKz
                      ? `Әр пациентті жеке шығарып тексеру (N=${metrics.vr_responder.n_subjects})`
                      : `Попациентная проверка на N=${metrics.vr_responder.n_subjects} клинических случаях`}
                  </p>
                </div>
                <span className="badge badge-green">
                  {isKz
                    ? `${metrics.vr_responder.n_responders} жауап · ${metrics.vr_responder.n_compensators} компенсация`
                    : `${metrics.vr_responder.n_responders} с откликом · ${metrics.vr_responder.n_compensators} без`}
                </span>
              </div>

              <div className="hairline-grid">
                <div className="hairline-cell">
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "Теңдестірілген дәлдік" : "Сбалансированная точность"}
                  </div>
                  <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)" }}>
                    {fmtPercent(metrics.vr_responder.balanced_accuracy, true, 1)}
                  </div>
                </div>
                <div className="hairline-cell">
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>ROC-AUC</div>
                  <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)" }}>
                    {fmtPercent(metrics.vr_responder.roc_auc, true, 1)}
                  </div>
                </div>
              </div>

              {(metrics.vr_responder.note || metrics.vr_responder.note_kz) && (
                <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.55 }}>
                  {isKz
                    ? metrics.vr_responder.note_kz || metrics.vr_responder.note
                    : metrics.vr_responder.note}
                </p>
              )}
            </section>
          )}

          <section className="surface stack-md">
            <div>
              <h2 className="section-title">
                {isKz ? "Модель шешіміне әсер ететін параметрлер" : "Вес клинических параметров в модели"}
              </h2>
              <p className="section-subtitle">
                {isKz
                  ? "Кинематикалық белгілердің салыстырмалы үлесі"
                  : "Вклад биомеханических показателей в итоговую оценку"}
              </p>
            </div>
            <div className="stack-sm">
              {sortedFeatures.map(([key, val]) => {
                const relWidth = (val / maxImp) * 100;
                return (
                  <div key={key} className="stack-xs">
                    <div className="kv-row" style={{ fontSize: "13px" }}>
                      <span style={{ color: "var(--ink)" }}>{mapFeatureLabel(key, isKz)}</span>
                      <strong className="tabular-nums mono">{fmtPercent(val, true, 1)}</strong>
                    </div>
                    <div className="meter-track" aria-hidden="true">
                      <div className="meter-fill" style={{ width: `${relWidth}%`, background: "var(--teal)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
