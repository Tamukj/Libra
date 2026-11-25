"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Search, AlertTriangle, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";
import { getPatients, getCohortAnalytics } from "@/lib/api";
import { Patient, CohortAnalytics } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";

type RiskFilter = "all" | "red" | "yellow" | "green";
type SideFilter = "ALL" | "LEFT" | "RIGHT";

function fmtSigned(value: number | null | undefined, digits = 2, unit = "°"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) < 0.005) return `0.00${unit}`;
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
}

function fmtNum(value: number | null | undefined, digits = 1, unit = "°"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${unit}`;
}

function fmtCm(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value <= 0) return "—";
  const cm = value < 3.0 ? value * 100 : value;
  return `${Math.round(cm)}`;
}

export default function PortalRegistryPage() {
  const { lang, t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<CohortAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pts, cohort] = await Promise.all([getPatients(), getCohortAnalytics()]);
      setPatients(pts);
      setStats(cohort);
    } catch {
      setError(
        lang === "kz"
          ? "Сервермен байланыс орнату мүмкін болмады. API қызметінің күйін тексеріңіз."
          : "Не удалось загрузить реестр пациентов. Проверьте доступность клинического API."
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const onUpdate = () => {
      loadData();
    };
    window.addEventListener("libra:patient-updated", onUpdate);
    return () => window.removeEventListener("libra:patient-updated", onUpdate);
  }, [loadData]);

  const formatClinicName = (name?: string | null) => {
    if (!name) return t.clinic_cohort_label;
    const parts = name.split(" / ");
    if (parts.length === 2) {
      return lang === "kz" ? parts[1] : parts[0];
    }
    return name;
  };

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (riskFilter !== "all" && p.status !== riskFilter) return false;
      if (sideFilter !== "ALL" && p.side !== sideFilter) return false;
      if (q) {
        const clinic = (p.clinic_name || "").toLowerCase();
        if (!p.code.toLowerCase().includes(q) && !clinic.includes(q)) return false;
      }
      return true;
    });
  }, [patients, riskFilter, sideFilter, searchQuery]);

  const summaryCounts = useMemo(() => {
    let red = 0;
    let yellow = 0;
    let green = 0;
    for (const p of patients) {
      if (p.status === "red") red += 1;
      else if (p.status === "yellow") yellow += 1;
      else if (p.status === "green") green += 1;
    }
    return { red, yellow, green };
  }, [patients]);

  const riskBadge = (status?: string) => {
    if (status === "red") {
      return (
        <span className="badge badge-red">
          <AlertTriangle size={12} strokeWidth={1.8} />
          {lang === "kz" ? "Жамбас шамадан тыс еңкеюі" : "Компенсация тазом"}
        </span>
      );
    }
    if (status === "yellow") {
      return (
        <span className="badge badge-yellow">
          {lang === "kz" ? "Бейтарап / бақылау" : "Нейтрально / наблюдение"}
        </span>
      );
    }
    if (status !== "green") {
      return (
        <span className="badge badge-neutral">
          {lang === "kz" ? "Толық дерек жоқ" : "Неполные пробы"}
        </span>
      );
    }
    return (
      <span className="badge badge-green">
        <CheckCircle2 size={12} strokeWidth={1.8} />
        {lang === "kz" ? "Шынайы оң нәтиже" : "Без перегрузки таза"}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Editorial Page Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(24px, 2.5vw, 32px)", lineHeight: 1.15 }}
          >
            {t.portal_title}
          </h1>
          <p style={{ color: "var(--secondary)", fontSize: "14px", marginTop: "6px", maxWidth: "68ch" }}>
            {t.portal_sub}
          </p>
        </div>

        <Link href="/portal/analytics" className="btn">
          <span>{t.nav_cohort}</span>
          <ArrowRight size={14} strokeWidth={1.6} />
        </Link>
      </header>

      {/* 4 Single-Metric KPI Cells */}
      <section aria-label={lang === "kz" ? "Когорта көрсеткіштері" : "Сводка по когорте"} className="grid-kpi-4">
        <div className="surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.kpi_cohort_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "26px", fontWeight: 600, color: "var(--ink)" }}>
            {stats?.total_patients ?? patients.length}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "4px" }}>
            {t.kpi_limbs_desc}
            {stats ? ` · ${stats.cycles.total} ${lang === "kz" ? "қадам" : "циклов"}` : ""}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.kpi_risk_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "26px", fontWeight: 600, color: "var(--red)" }}>
            {stats?.cdss_distribution.red ?? summaryCounts.red}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "4px" }}>
            {t.kpi_risk_desc}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.kpi_true_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "26px", fontWeight: 600, color: "var(--teal)" }}>
            {stats?.cdss_distribution.green ?? summaryCounts.green}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "4px" }}>
            {t.kpi_true_desc}
          </div>
        </div>

        <div className="surface" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {t.kpi_gps_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--ink)" }}>
            {fmtNum(stats?.averages.baseline_gps, 1)} {"→"} {fmtNum(stats?.averages.vr_gps, 1)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "4px" }}>
            {t.kpi_gps_desc}
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section
        className="surface"
        style={{
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: "360px" }}>
          <label htmlFor="patient-search" className="visually-hidden">
            {lang === "kz" ? "Пациент коды бойынша іздеу" : "Поиск по коду пациента"}
          </label>
          <Search
            size={15}
            strokeWidth={1.6}
            color="var(--muted)"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            id="patient-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === "kz" ? "Пациент коды (мыс. s61520_1)..." : "Поиск по коду (например, s61520_1)..."
            }
            style={{ width: "100%", paddingLeft: "36px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div
            role="group"
            aria-label={lang === "kz" ? "Клиникалық мәртебе бойынша сүзгі" : "Фильтр по оценке риска"}
            style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
          >
            {(
              [
                { key: "all", label: t.filter_all_label },
                { key: "red", label: t.filter_danger_label },
                { key: "green", label: t.filter_normal_label },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setRiskFilter(f.key)}
                className={`btn ${riskFilter === f.key ? "btn-primary" : ""}`}
                style={{ minBlockSize: "34px", padding: "6px 12px", fontSize: "12px" }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            aria-label={lang === "kz" ? "Зерттелген аяқ бойынша сүзгі" : "Фильтр по стороне"}
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as SideFilter)}
            style={{ minBlockSize: "34px", padding: "6px 10px", fontSize: "12px" }}
          >
            <option value="ALL">{lang === "kz" ? "Барлық жақ" : "Обе стороны"}</option>
            <option value="LEFT">{t.side_left}</option>
            <option value="RIGHT">{t.side_right}</option>
          </select>

          <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "4px" }}>
            {filteredPatients.length} / {patients.length}
          </span>
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="surface"
          style={{
            borderColor: "var(--red-border)",
            background: "var(--red-bg)",
            color: "var(--red)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span>{error}</span>
          <button type="button" onClick={loadData} className="btn">
            <RotateCcw size={14} strokeWidth={1.6} />
            {lang === "kz" ? "Қайта жүктеу" : "Повторить"}
          </button>
        </div>
      )}

      {/* Registry Table */}
      <div className="surface" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)" }}>
            {lang === "kz" ? "Пациенттер тізілімі жүктелуде..." : "Загрузка клинического реестра..."}
          </div>
        ) : filteredPatients.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <p style={{ color: "var(--secondary)" }}>
              {lang === "kz"
                ? "Таңдалған сүзгілер бойынша пациенттер табылмады."
                : "По заданным фильтрам пациенты не найдены."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRiskFilter("all");
                setSideFilter("ALL");
              }}
              className="btn"
            >
              {lang === "kz" ? "Сүзгілерді тазарту" : "Сбросить фильтры"}
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th scope="col">{lang === "kz" ? "Пациент" : "Пациент"}</th>
                  <th scope="col">{t.col_side_label}</th>
                  <th scope="col">{lang === "kz" ? "Салмақ · бой / аяқ" : "Вес · рост / нога"}</th>
                  <th scope="col">GPS ({lang === "kz" ? "Қал. → VR" : "База → VR"})</th>
                  <th scope="col">{lang === "kz" ? "Δ Сан" : "Δ Бедра"}</th>
                  <th scope="col">PCR</th>
                  <th scope="col">{lang === "kz" ? "Жамбас бағасы" : "Оценка таза"}</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    {t.col_action_label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => (
                  <tr key={p.code}>
                    <td>
                      <Link
                        href={`/portal/patients/${encodeURIComponent(p.code)}`}
                        style={{
                          fontWeight: 600,
                          fontFamily: "var(--mono)",
                          color: "var(--ink)",
                          display: "inline-block",
                        }}
                      >
                        {p.code}
                      </Link>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                        {formatClinicName(p.clinic_name)}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{p.side === "LEFT" ? t.side_left : t.side_right}</td>
                    <td className="tabular-nums" style={{ color: "var(--secondary)", whiteSpace: "nowrap" }}>
                      {typeof p.weight === "number" && Number.isFinite(p.weight) ? `${p.weight.toFixed(1)} кг` : "—"} · {fmtCm(p.height)}/{fmtCm(p.leg_length)} см
                    </td>
                    <td className="tabular-nums" style={{ whiteSpace: "nowrap" }}>
                      {fmtNum(p.baseline_gps, 1)} {"→"} {fmtNum(p.vr_gps, 1)}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        fontWeight: 600,
                        color:
                          p.delta_amin_sagh !== null && p.delta_amin_sagh !== undefined && p.delta_amin_sagh <= -1.0
                            ? "var(--teal)"
                            : "var(--ink)",
                      }}
                    >
                      {fmtSigned(p.delta_amin_sagh)}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        fontWeight: 600,
                        color: p.pcr !== null && p.pcr !== undefined && p.pcr > 0.8 ? "var(--red)" : "var(--ink)",
                      }}
                    >
                      {p.pcr !== null && p.pcr !== undefined ? p.pcr.toFixed(2) : "—"}
                    </td>
                    <td>{riskBadge(p.status)}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/portal/patients/${encodeURIComponent(p.code)}`}
                        className="btn"
                        style={{ minBlockSize: "32px", padding: "5px 12px", fontSize: "12px" }}
                      >
                        {t.btn_open_card}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
