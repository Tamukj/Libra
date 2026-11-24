"use client";

import React from "react";
import { Building2, Users, TrendingUp } from "lucide-react";
import { RegionalStats as RegionalStatsType } from "@/lib/types";

interface Props {
  stats: RegionalStatsType;
  lang: "ru" | "kz" | "en";
}

export function RegionalStats({ stats, lang }: Props) {
  const { country, region_abai } = stats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Intro Header */}
      <div className="card-raised">
        <h2 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "6px" }}>
          {lang === "kz"
            ? "Қазақстан Республикасы мен Абай облысының денсаулық сақтау ашық деректері"
            : "Открытые статистические данные здравоохранения Республики Казахстан и области Абай"}
        </h2>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>
          {lang === "kz" ? (
            <>
              Дереккөздер:{" "}
              <a
                href="https://stat.gov.kz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, textDecoration: "underline", color: "var(--ink)" }}
              >
                stat.gov.kz
              </a>{" "}
              (ҚР СЖРА Ұлттық статистика бюросы) және{" "}
              <a
                href="https://data.egov.kz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, textDecoration: "underline", color: "var(--ink)" }}
              >
                data.egov.kz
              </a>{" "}
              (ҚР Ашық деректер порталы).
            </>
          ) : (
            <>
              Источники:{" "}
              <a
                href="https://stat.gov.kz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, textDecoration: "underline", color: "var(--ink)" }}
              >
                stat.gov.kz
              </a>{" "}
              (Бюро национальной статистики АСПиР РК) и{" "}
              <a
                href="https://data.egov.kz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, textDecoration: "underline", color: "var(--ink)" }}
              >
                data.egov.kz
              </a>{" "}
              (Портал открытых данных РК).
            </>
          )}
        </div>
      </div>

      {/* Grid of Regional KPIs */}
      <div className="grid-problem">
        
        {/* Card 1: Republic of Kazakhstan */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Users size={18} color="var(--teal)" />
            <h3 style={{ fontSize: "14px", fontWeight: "700" }}>
              {lang === "kz" ? country.name_kz : country.name_ru}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Мүгедектігі бар балалар:" : "Дети с инвалидностью:"}
              </span>
              <strong>{country.total_children_disability.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "ЦП сал диагнозы (G80):" : "Диагноз ДЦП (G80):"}
              </span>
              <strong style={{ color: "var(--teal)" }}>{country.children_with_cp.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Жылдық бастапқы есеп:" : "Первичный учет в год:"}
              </span>
              <strong>+{country.primary_disability_annual.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Abai Region / Semey */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Building2 size={18} color="var(--amber)" />
            <h3 style={{ fontSize: "14px", fontWeight: "700" }}>
              {lang === "kz" ? region_abai.name_kz : region_abai.name_ru}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Мүгедектігі бар балалар:" : "Дети с инвалидностью:"}
              </span>
              <strong>{region_abai.children_disability.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "ЦП және ТҚА патологиясы:" : "Патологии ОДА и ДЦП:"}
              </span>
              <strong style={{ color: "var(--amber)" }}>~{region_abai.musculoskeletal_cp_children}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Оңалтумен қамту:" : "Охват реабилитацией:"}
              </span>
              <strong style={{ color: "var(--red)" }}>{region_abai.annual_coverage_pct}%</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Technological Gap & Economic Value */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <TrendingUp size={18} color="var(--teal)" />
            <h3 style={{ fontSize: "14px", fontWeight: "700" }}>
              {lang === "kz" ? "Libra жүйесінің клиникалық әсері" : "Клинический эффект системы Libra"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Семейдегі қозғалыс зертханалары:" : "Лабораторий анализа движения в Семее:"}
              </span>
              <strong style={{ color: "var(--red)", textAlign: "right" }}>
                {region_abai.labs_3d_grail_count}{" "}
                {lang === "kz" ? "(Аппаратура тапшылығы)" : "(Дефицит аппаратуры)"}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Талдау уақыты:" : "Время формирования паспорта:"}
              </span>
              <strong style={{ color: "var(--teal)", textAlign: "right" }}>
                {lang === "kz" ? "40 мин орнына 30 сек" : "30 сек вместо 40 мин"}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Консилиум хаттамасы:" : "Протокол консилиума:"}
              </span>
              <strong style={{ textAlign: "right" }}>
                {lang === "kz" ? "Damumed-ке автоматты түрде" : "Автоматически в Damumed"}
              </strong>
            </div>
          </div>
        </div>

      </div>

      {/* Rehabilitation centers in Semey */}
      <div className="card">
        <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px" }}>
          {lang === "kz" ? (
            <>
              Абай облысының бейінді балалар оңалту ұйымдары (
              <a href="https://data.egov.kz" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                data.egov.kz
              </a>
              )
            </>
          ) : (
            <>
              Действующие профильные реабилитационные организации области Абай (
              <a href="https://data.egov.kz" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                data.egov.kz
              </a>
              )
            </>
          )}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
          {region_abai.rehab_centers.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "12px", background: "var(--paper)" }}>
              <div style={{ fontWeight: "600", fontSize: "13px" }}>{c.name}</div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                {lang === "kz"
                  ? `${c.city} · Қуаты: жылына ${c.annual_capacity} бала`
                  : `${c.city} · Мощность: ${c.annual_capacity} детей в год`}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
