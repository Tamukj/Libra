"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCohortAnalytics } from "@/lib/api";
import type { CohortAnalytics as CohortAnalyticsType } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { CohortAnalytics } from "@/components/CohortAnalytics";

export default function AnalyticsPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  const [stats, setStats] = useState<CohortAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getCohortAnalytics()
      .then((res) => {
        if (mounted) setStats(res);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : isKz
                ? "Когорта статистикасын жүктеу мүмкін болмады"
                : "Не удалось загрузить статистику когорты"
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
        <h1 className="page-title">{t.nav_cohort}</h1>
        <p className="page-subtitle">
          {isKz
            ? "Зерттелген пациенттер когортасы бойынша жиынтық биомеханикалық статистика."
            : "Сводная биомеханическая статистика по пациентам и циклам шага в реестре."}
        </p>
      </header>

      {loading ? (
        <div className="surface" style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--muted)" }}>
          {isKz ? "Когорта статистикасы жүктелуде..." : "Загружаем статистику когорты..."}
        </div>
      ) : error ? (
        <div className="callout callout-red" role="alert">
          <div style={{ color: "var(--red)", fontSize: "13px" }}>
            <strong>{isKz ? "Қате:" : "Ошибка:"}</strong> {error}
          </div>
        </div>
      ) : stats ? (
        <CohortAnalytics stats={stats} lang={lang} />
      ) : null}
    </div>
  );
}
