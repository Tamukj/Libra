"use client";

import React, { useState, useEffect } from "react";
import { getRegionalStats } from "@/lib/api";
import { RegionalStats as RegionalStatsType } from "@/lib/types";
import { RegionalStats } from "@/components/RegionalStats";
import { useLanguage } from "@/lib/LanguageContext";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<RegionalStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang, setLang } = useLanguage();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getRegionalStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load regional statistics:", err);
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
              ? "Балалар церебралды сал ауруының эпидемиологиясы: Қазақстан және Абай облысы"
              : "Эпидемиология детского церебрального паралича: Казахстан и область Абай"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
            {lang === "kz"
              ? "ҚР Ұлттық статистика бюросы (stat.gov.kz) және Денсаулық сақтау министрлігінің ашық деректері (data.egov.kz)"
              : "Агрегированные показатели Бюро национальной статистики АСПиР РК (stat.gov.kz) и открытых данных Минздрава РК (data.egov.kz)"}
          </p>
        </div>

        {/* Local language switch for regional report */}
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
          Загрузка статистических данных...
        </div>
      ) : stats ? (
        <RegionalStats stats={stats} lang={lang} />
      ) : (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          Ошибка загрузки статистических сведений.
        </div>
      )}

    </div>
  );
}
