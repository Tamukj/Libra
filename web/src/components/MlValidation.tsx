"use client";

import React from "react";
import { ShieldCheck, BarChart3, CheckCircle, Database } from "lucide-react";
import { MLMetrics } from "@/lib/types";

interface Props {
  metrics: MLMetrics;
  lang: "ru" | "kz" | "en";
}

export function MlValidation({ metrics, lang }: Props) {
  const featureLabels: Record<string, string> = {
    aMinSagH: lang === "kz" ? "Санның жазылуы (aMinSagH)" : "Разгибание бедра (aMinSagH)",
    GVS_aSagP: lang === "kz" ? "Жамбас девиациясы (GVS Pelvis)" : "Девиация таза (GVS Pelvis)",
    GPS_a: lang === "kz" ? "Жалпы жүріс индексі (GPS)" : "Суммарный индекс (GPS)",
    GVS_aSagH: lang === "kz" ? "Сан девиациясы (GVS Hip)" : "Девиация бедра (GVS Hip)",
    GVS_aSagK: lang === "kz" ? "Тізе девиациясы (GVS Knee)" : "Девиация колена (GVS Knee)",
    GVS_aSagA: lang === "kz" ? "Тобық девиациясы (GVS Ankle)" : "Девиация стопы (GVS Ankle)"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Leak-Free Architecture Shield Banner */}
      <div className="card-raised" style={{ borderLeft: "4px solid var(--teal)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <ShieldCheck size={22} color="var(--teal)" />
          <h2 style={{ fontSize: "16px", fontWeight: "700" }}>
            {lang === "kz" ? "GroupKFold негізіндегі таза машиналық оқыту протоколы" : "Протокол машинного обучения без Data Leakage (GroupKFold)"}
          </h2>
        </div>
        <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: "1.6" }}>
          В биомедицине случайный сплит строк (`train_test_split`) дает <strong>ложные 95-99% точности</strong> из-за запоминания антропометрии ребенка.
          Наша модель валидирована по стандарту <strong>GroupKFold (k={metrics.n_splits}) строго по {metrics.n_subjects} пациентам</strong>:
          шаги одного ребенка никогда не попадают одновременно в обучение и тест!
        </p>
      </div>

      {/* 4 Quantitative Validation Metrics */}
      <div className="grid-kpi-4">
        
        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
            Balanced Accuracy
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--teal)", marginTop: "4px" }}>
            {(metrics.balanced_accuracy * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {lang === "kz" ? "Шынайы клиникалық дәлдік" : "Честная клиническая точность"}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
            ROC-AUC Score
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--teal)", marginTop: "4px" }}>
            {metrics.roc_auc.toFixed(3)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {lang === "kz" ? "Жоғары ажырату қабілеті" : "Высокая дискриминативность"}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
            Sensitivity (Sens)
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--ink)", marginTop: "4px" }}>
            {(metrics.sensitivity * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {lang === "kz" ? "Нақты VR-эффектісін анықтау" : "Выявление истинного VR-эффекта"}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
            Specificity (Spec)
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--ink)", marginTop: "4px" }}>
            {(metrics.specificity * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {lang === "kz" ? "Жалған тағайындаудан қорғау" : "Защита от ложного назначения"}
          </div>
        </div>

      </div>

      {/* Feature Importances Bar Chart */}
      <div className="card">
        <h3 style={{ fontSize: "15px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <BarChart3 size={18} />
          {lang === "kz" ? "Биомеханикалық белгілер маңыздылығы (Feature Importance)" : "Клиническая важность биомеханических маркеров (Feature Importance)"}
        </h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Object.entries(metrics.feature_importances)
            .sort((a, b) => b[1] - a[1])
            .map(([feat, imp]) => {
              const pct = (imp * 100).toFixed(1);
              return (
                <div key={feat} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ fontWeight: "600" }}>{featureLabels[feat] || feat}</span>
                    <span style={{ color: "var(--muted)" }}>{pct}%</span>
                  </div>
                  <div style={{ height: "8px", background: "var(--linen)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: feat === "aMinSagH" ? "var(--teal)" : feat === "GVS_aSagP" ? "var(--amber)" : "var(--ink)",
                        borderRadius: "4px"
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
