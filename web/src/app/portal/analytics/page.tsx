"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getCohortAnalytics } from "@/lib/api";
import { CohortAnalytics as CohortAnalyticsType } from "@/lib/types";
import { CohortAnalytics } from "@/components/CohortAnalytics";
import { useLanguage } from "@/lib/LanguageContext";

export default function CohortAnalyticsPage() {
  const { lang, t } = useLanguage();
  const [stats, setStats] = useState<CohortAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCohortAnalytics();
      setStats(data);
    } catch {
      setError(
        lang === "kz"
          ? "Когорта талдауының деректерін жүктеу мүмкін болмады."
          : "Не удалось загрузить аналитику когорты."
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
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
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
            {t.nav_cohort}
          </h1>
          <p style={{ color: "var(--secondary)", fontSize: "14px", marginTop: "6px", maxWidth: "68ch" }}>
            {lang === "kz"
              ? "KU Leuven ашық зерттеу когортасы бойынша жамбас компенсациясы, үздік әдіс және орташа биомеханикалық көрсеткіштер."
              : "Сводное распределение компенсации таза, выбор ведущего метода и антропометрия открытой когорты KU Leuven."}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="surface" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          {lang === "kz" ? "Когорта статистикасы есептелуде..." : "Загрузка статистики когорты..."}
        </div>
      ) : error || !stats ? (
        <div className="surface" role="alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "var(--red)" }}>{error}</span>
          <button type="button" onClick={load} className="btn">
            <RotateCcw size={14} strokeWidth={1.6} />
            {lang === "kz" ? "Қайталау" : "Повторить"}
          </button>
        </div>
      ) : (
        <CohortAnalytics stats={stats} lang={lang} />
      )}
    </div>
  );
}
