"use client";

import React from "react";
import { Building2, Users, Clock, AlertCircle, FileText, TrendingUp } from "lucide-react";
import { RegionalStats as RegionalStatsType } from "@/lib/types";

interface Props {
  stats: RegionalStatsType;
  lang: "ru" | "kz";
}

export function RegionalStats({ stats, lang }: Props) {
  const { country, region_abai } = stats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Intro Header */}
      <div className="card-raised">
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "6px" }}>
          {lang === "kz" ? "Қазақстан және Абай облысының денсаулық сақтау ашық деректері" : "Открытые данные здравоохранения Республики Казахстан и области Абай"}
        </h2>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>
          Дереккөздер: <strong>stat.gov.kz</strong> (ҚР СЖРА Ұлттық статистика бюросы) және <strong>data.egov.kz</strong> (ҚР Ашық деректер порталы).
        </div>
      </div>

      {/* Grid of Regional KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        
        {/* Card 1: Republic of Kazakhstan */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Users size={18} color="var(--teal)" />
            <h3 style={{ fontSize: "14px" }}>{country.name_ru}</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Дети с инвалидностью:</span>
              <strong>{country.total_children_disability.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Диагноз ДЦП (G80):</span>
              <strong style={{ color: "var(--teal)" }}>{country.children_with_cp.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Первичный учет в год:</span>
              <strong>+{country.primary_disability_annual.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Abai Region / Semey */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Building2 size={18} color="var(--amber)" />
            <h3 style={{ fontSize: "14px" }}>{region_abai.name_ru}</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Дети с инвалидностью:</span>
              <strong>{region_abai.children_disability.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>ДЦП и патологии ОДА:</span>
              <strong style={{ color: "var(--amber)" }}>~{region_abai.musculoskeletal_cp_children}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Охват реабилитацией:</span>
              <strong style={{ color: "var(--red)" }}>{region_abai.annual_coverage_pct}% (Дефицит)</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Technological Gap & Economic Value */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <TrendingUp size={18} color="var(--teal)" />
            <h3 style={{ fontSize: "14px" }}>Эффект внедрения GaitAI</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>3D лабораторий в Семее:</span>
              <strong style={{ color: "var(--red)" }}>0 (GRAIL только в Астане)</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Время анализа сессии:</span>
              <strong style={{ color: "var(--teal)" }}>30 сек вместо 40 мин</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Очередь на курс:</span>
              <strong>Сокращение на 30%</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Rehabilitation centers in Semey */}
      <div className="card">
        <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>
          Действующие профильные реабилитационные центры области Абай (data.egov.kz)
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {region_abai.rehab_centers.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "12px", background: "var(--paper)" }}>
              <div style={{ fontWeight: "600", fontSize: "13px" }}>{c.name}</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                г. {c.city} · Мощность: {c.annual_capacity} детей/год
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
