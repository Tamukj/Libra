"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMLMetrics } from "@/lib/api";
import type { MLMetrics } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { MlValidation } from "@/components/MlValidation";

export default function MlValidationPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMLMetrics()
      .then((res) => {
        if (mounted) setMetrics(res);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : isKz
                ? "Модель метрикаларын жүктеу мүмкін болмады"
                : "Не удалось загрузить метрики валидации"
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isKz]);

  return (
    <div className="stack-lg">
      <header className="stack-xs">
        <Link
          href="/portal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            fontSize: "13px",
            color: "var(--muted)",
            alignSelf: "flex-start",
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} aria-hidden="true" />
          {t.back_to_registry}
        </Link>
        <h1 className="page-title">{t.nav_ml}</h1>
        <p className="page-subtitle">
          {isKz
            ? "Пациент бойынша оқшауланған кросс-валидация метрикалары (деректердің ағып кетуінсіз)."
            : "Метрики кросс-валидации со строгой изоляцией по пациентам."}
        </p>
      </header>

      {loading ? (
        <div className="surface" style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--muted)" }}>
          {isKz ? "Модель валидациясы жүктелуде..." : "Загружаем метрики валидации..."}
        </div>
      ) : error ? (
        <div className="callout callout-red" role="alert">
          <div style={{ color: "var(--red)", fontSize: "13px" }}>
            <strong>{isKz ? "Қате:" : "Ошибка:"}</strong> {error}
          </div>
        </div>
      ) : metrics ? (
        <MlValidation metrics={metrics} lang={lang} />
      ) : null}
    </div>
  );
}
