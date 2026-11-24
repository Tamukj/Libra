"use client";

import React, { useState, useEffect } from "react";
import { getMLMetrics } from "@/lib/api";
import { MLMetrics } from "@/lib/types";
import { MlValidation } from "@/components/MlValidation";
import { useLanguage } from "@/lib/LanguageContext";

export default function MlValidationPage() {
  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang, setLang } = useLanguage();

  useEffect(() => {
    async function loadMetrics() {
      try {
        const data = await getMLMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to load ML metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  return (
    <div className="container" style={{ paddingBlock: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", letterSpacing: "-0.025em" }}>
            {lang === "kz" ? "Алгоритмді тексеру әдіснамасы (GroupKFold)" : "Методология и валидация алгоритма (GroupKFold)"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
            {lang === "kz"
              ? "Деректердің ағып кетуін болдырмау үшін науқастар арасында бөлінген кросс-валидация нәтижелері."
              : "Кросс-валидация модели без смешивания шагов одного пациента между обучающей и проверочной выборками."}
          </p>
        </div>

        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", background: "var(--white)" }}>
          <button
            onClick={() => setLang("kz")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              background: lang === "kz" ? "var(--linen)" : "transparent",
              color: "var(--ink)",
              cursor: "pointer"
            }}
          >
            ҚАЗ
          </button>
          <button
            onClick={() => setLang("ru")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              borderLeft: "1px solid var(--line)",
              background: lang === "ru" ? "var(--linen)" : "transparent",
              color: "var(--ink)",
              cursor: "pointer"
            }}
          >
            РУС
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
          Загрузка метрик валидации...
        </div>
      ) : metrics ? (
        <MlValidation metrics={metrics} lang={lang} />
      ) : (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          Ошибка загрузки метрик.
        </div>
      )}

    </div>
  );
}
