"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getMLMetrics } from "@/lib/api";
import { MLMetrics } from "@/lib/types";
import { MlValidation } from "@/components/MlValidation";
import { useLanguage } from "@/lib/LanguageContext";

export default function MlValidationPage() {
  const { lang, t } = useLanguage();
  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMLMetrics();
      setMetrics(data);
    } catch {
      setError(
        lang === "kz"
          ? "Валидация метрикаларын жүктеу мүмкін болмады."
          : "Не удалось загрузить метрики валидации моделей ИИ."
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header>
        <Link
          href="/portal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--muted)",
            marginBottom: "8px",
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} />
          {t.back_to_registry}
        </Link>
        <h1 className="font-display" style={{ fontSize: "clamp(24px, 2.5vw, 32px)", lineHeight: 1.15 }}>
          {t.nav_ml}
        </h1>
        <p style={{ color: "var(--secondary)", fontSize: "14px", marginTop: "6px", maxWidth: "70ch" }}>
          {lang === "kz"
            ? "Науқастар бойынша қатаң бөлінген GroupKFold (5 фолд) кросс-валидациясы, PCA-тұрақтылық детекторы және бастапқы жауап болжамы."
            : "Строгая перекрестная проверка GroupKFold по субъектам, многомерный контроль стабильности цикла и честная калибровка прогноза ответа."}
        </p>
      </header>

      {loading ? (
        <div className="surface" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          {lang === "kz" ? "Модель көрсеткіштері жүктелуде..." : "Загрузка метрик валидации..."}
        </div>
      ) : error || !metrics ? (
        <div className="surface" role="alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "var(--red)" }}>{error}</span>
          <button type="button" onClick={load} className="btn">
            <RotateCcw size={14} strokeWidth={1.6} />
            {lang === "kz" ? "Қайталау" : "Повторить"}
          </button>
        </div>
      ) : (
        <MlValidation metrics={metrics} lang={lang} />
      )}
    </div>
  );
}
