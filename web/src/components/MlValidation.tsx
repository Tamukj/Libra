"use client";

import React from "react";
import { ShieldCheck, BarChart3 } from "lucide-react";
import { MLMetrics } from "@/lib/types";

interface Props {
  metrics: MLMetrics;
  lang: "ru" | "kz";
}

export function MlValidation({ metrics, lang }: Props) {
  const isKz = lang === "kz";

  const featureLabels: Record<string, string> = {
    aMinSagH: isKz ? "Санның жазылу бұрышы (aMinSagH)" : "Минимальный угол сгибания бедра (aMinSagH)",
    GVS_aSagP: isKz ? "Жамбас ауытқуы (GVS Таз)" : "Отклонение наклона таза (GVS Таза)",
    GPS_a: isKz ? "Жүріс профилі индексі (GPS)" : "Общий индекс профиля походки (GPS)",
    GVS_aSagH: isKz ? "Сан ауытқуы (GVS Сан)" : "Отклонение кинематики бедра (GVS Бедра)",
    GVS_aSagK: isKz ? "Тізе ауытқуы (GVS Тізе)" : "Отклонение кинематики колена (GVS Колена)",
    GVS_aSagA: isKz ? "Тобық ауытқуы (GVS Тобық)" : "Отклонение кинематики стопы (GVS Стопы)",
    pctmZeroStSagH: isKz ? "Сан моментінің ауысу сәті (pctmZeroStSagH)" : "Момент смены разгибателя бедра (pctmZeroStSagH)",
    kinematic_waveforms: isKz ? "Кинематикалық қисық сипаттамалары (0–100% цикл)" : "Характеристики кинематических кривых (0–100% цикла)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Subject-isolation methodology statement */}
      <div className="surface-muted">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <ShieldCheck size={18} strokeWidth={1.6} color="var(--teal)" />
          <h2 style={{ fontSize: "15px", fontWeight: 600 }}>
            {isKz
              ? "Пациенттер бойынша қатаң бөлу (GroupKFold, деректер ағып кетуінсіз)"
              : "Строгое разделение выборки по пациентам (GroupKFold)"}
          </h2>
        </div>
        <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.6 }}>
          {isKz ? (
            <>
              Қадам циклдерін кездейсоқ араластыру (<span style={{ fontFamily: "var(--mono)" }}>train_test_split</span>)
              үлгінің нақты баланың антропометриясын жаттап алуына байланысты <strong>жалған 95–99% дәлдік</strong> береді.
              Libra моделі <strong>{metrics.n_subjects} пациент ({metrics.n_cycles} цикл) бойынша GroupKFold (k={metrics.n_splits})</strong> әдісімен
              тексерілді: бір пациенттің қадамдары оқыту және тексеру топтарына ешқашан бірге түспейді.
            </>
          ) : (
            <>
              Случайное разбиение отдельных шагов (<span style={{ fontFamily: "var(--mono)" }}>train_test_split</span>) завышает
              метрики до <strong>ложных 95–99%</strong> за счёт запоминания индивидуальной походки ребёнка.
              Модель Libra проверена методом <strong>GroupKFold (k={metrics.n_splits}) по {metrics.n_subjects} пациентам ({metrics.n_cycles} циклов)</strong>:
              все циклы одного участника попадают либо только в обучение, либо только в проверку.
            </>
          )}
        </p>
      </div>

      {/* 4 Primary Validation Metrics */}
      <div className="grid-kpi-4">
        <div className="surface" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {isKz ? "Теңгерімді дәлдік" : "Сбалансированная точность"}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, color: "var(--teal)", marginTop: "6px", lineHeight: 1.1 }}>
            {(metrics.balanced_accuracy * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {isKz ? "Пациентаралық бағалау" : "Межсубъектная проверка"}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {isKz ? "ROC-AUC көрсеткіші" : "Площадь под ROC-кривой"}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, color: "var(--teal)", marginTop: "6px", lineHeight: 1.1 }}>
            {metrics.roc_auc.toFixed(3)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {isKz ? "VR мен базаны ажырату" : "Различение VR и обычной ходьбы"}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {isKz ? "Сезімталдық" : "Чувствительность"}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginTop: "6px", lineHeight: 1.1 }}>
            {(metrics.sensitivity * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {isKz ? "VR-әсерін анықтау" : "Выявление VR-паттерна"}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {isKz ? "Спецификалық" : "Специфичность"}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginTop: "6px", lineHeight: 1.1 }}>
            {(metrics.specificity * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {isKz ? "Базалық жүрісті тану" : "Отсечение ложных срабатываний"}
          </div>
        </div>
      </div>

      {/* 3-Class Classification */}
      {metrics.three_class && (
        <div className="surface">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
              {isKz
                ? "Үш режимді жіктеу (Қалыпты, Ауызша, VR)"
                : "Трёхклассовая классификация режимов (Обычная, Голос, VR)"}
            </h3>
            <span className="badge badge-neutral tabular-nums">
              {isKz
                ? `${metrics.three_class.n_cycles} цикл · ${metrics.three_class.n_subjects} пациент · k=${metrics.three_class.n_splits}`
                : `${metrics.three_class.n_cycles} циклов · ${metrics.three_class.n_subjects} пациентов · k=${metrics.three_class.n_splits}`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px 14px" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Теңгерімді дәлдік (3 класс)" : "Сбалансированная точность (3 класса)"}
              </div>
              <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--teal)", marginTop: "4px" }}>
                {(metrics.three_class.balanced_accuracy * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                {isKz ? "Кездейсоқ деңгей: 33,3%" : "Случайный порог: 33,3%"}
              </div>
            </div>
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px 14px" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Макро-орташа F1" : "Макро-средняя F1-мера"}
              </div>
              <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--ink)", marginTop: "4px" }}>
                {(metrics.three_class.f1_macro * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                {isKz ? "Үш режим бойынша теңгерім" : "Баланс точности и полноты"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PCA Stability & Pre-therapy Responder Predictor */}
      {(metrics.pca_validation || metrics.vr_responder) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {metrics.pca_validation && (
            <div className="surface">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                  {isKz ? "Қадам тұрақтылығын бақылау (PCA)" : "Детектор нестабильности шага (PCA)"}
                </h3>
                <span className="badge badge-neutral tabular-nums">
                  k={metrics.pca_validation.n_splits} · {metrics.pca_validation.n_subjects} {isKz ? "пациент" : "пациентов"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "Қалыпты жүріс (фолдтардан тыс)" : "Обычная ходьба (кросс-валидация)"}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--ink)", marginTop: "4px" }}>
                    {(metrics.pca_validation.oof_baseline_anomaly_rate * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "VR-дегі аномальді циклдер" : "Нестабильные шаги в VR"}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--amber)", marginTop: "4px" }}>
                    {(metrics.pca_validation.vr_anomaly_rate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {metrics.vr_responder && (
            <div className="surface">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                  {isKz ? "Терапияға дейінгі болжам (LOO, N=29)" : "Дотерапевтический прогноз отклика (LOO, N=29)"}
                </h3>
                <span className="badge badge-neutral tabular-nums">
                  {metrics.vr_responder.n_responders} / {metrics.vr_responder.n_compensators}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {isKz ? "Теңгерімді дәлдік (LOO)" : "Точность LOO"}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--teal)", marginTop: "4px" }}>
                    {(metrics.vr_responder.balanced_accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>ROC-AUC (LOO)</div>
                  <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--amber)", marginTop: "4px" }}>
                    {Number.isFinite(metrics.vr_responder.roc_auc) ? metrics.vr_responder.roc_auc.toFixed(3) : "—"}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "10px", lineHeight: 1.5 }}>
                {isKz
                  ? metrics.vr_responder.note_kz ||
                    "N=29 когортасындағы LOO-валидация. Клиникалық қолдану алдында когортаны кеңейту қажет."
                  : metrics.vr_responder.note ||
                    "Валидация на малой когорте (N=29). Перед клиническим применением требуется расширение выборки."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Feature Importances */}
      <div className="surface">
        <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <BarChart3 size={16} strokeWidth={1.6} color="var(--teal)" />
          <span>{isKz ? "Биомеханикалық көрсеткіштердің маңыздылығы" : "Значимость биомеханических признаков модели"}</span>
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Object.entries(metrics.feature_importances)
            .sort((a, b) => b[1] - a[1])
            .map(([feat, imp]) => {
              const pctVal = (imp * 100).toFixed(1);
              return (
                <div key={feat} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ fontWeight: 500 }}>{featureLabels[feat] || feat}</span>
                    <span className="tabular-nums" style={{ color: "var(--muted)" }}>{pctVal}%</span>
                  </div>
                  <div style={{ height: "8px", background: "var(--sidebar)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pctVal}%`,
                        background: feat === "kinematic_waveforms" || feat === "aMinSagH" ? "var(--teal)" : feat === "GVS_aSagP" ? "var(--amber)" : "var(--ink)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
