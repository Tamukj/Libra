"use client";

import React, { useState, useEffect } from "react";
import { getCohortAnalytics } from "@/lib/api";
import { CohortAnalytics as CohortAnalyticsType } from "@/lib/types";
import { CohortAnalytics } from "@/components/CohortAnalytics";
import { useLanguage } from "@/lib/LanguageContext";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<CohortAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang, setLang } = useLanguage();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getCohortAnalytics();
        setStats(data);
      } catch (err) {
        console.error("Failed to load cohort analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="container" style={{ paddingBlock: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", letterSpacing: "-0.025em" }}>
            {lang === "kz"
              ? "Когорта бойынша биомеханикалық аналитика"
              : "Биомеханическая аналитика когорты"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
            {lang === "kz"
              ? "Деректер базасындағы барлық пациенттер мен қадам циклдері бойынша нақты агрегаттар"
              : "Живые агрегаты по всем пациентам и циклам шага в системе (Baseline / Verbal / VR)"}
          </p>
        </div>

        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", background: "var(--white)" }}>
          <button
            onClick={() => setLang("kz")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 700,
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
              fontWeight: 700,
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
          {lang === "kz" ? "Когорта талдауы жүктелуде..." : "Загрузка аналитики когорты..."}
        </div>
      ) : stats ? (
        <CohortAnalytics stats={stats} lang={lang} />
      ) : (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          {lang === "kz" ? "Аналитиканы жүктеу қатесі." : "Ошибка загрузки аналитики когорты."}
        </div>
      )}
    </div>
  );
}
