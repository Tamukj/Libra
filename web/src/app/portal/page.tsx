"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, AlertTriangle, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";
import { getPatients, getCohortAnalytics } from "@/lib/api";
import { Patient, CohortAnalytics } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { fmtFixed, fmtSigned, fmtPcr, fmtCm, fmtVisitCount, isFiniteNum } from "@/lib/format";

type RiskFilter = "all" | "red" | "yellow" | "green" | "unassessed";
type SideFilter = "ALL" | "LEFT" | "RIGHT";

export default function PortalRegistryPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<CohortAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setLoadError(false);
    try {
      const [pts, cohort] = await Promise.all([
        getPatients(controller.signal),
        getCohortAnalytics(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setPatients(pts);
      setStats(cohort);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError" || controller.signal.aborted) return;
      setLoadError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const onUpdate = () => loadData();
    window.addEventListener("libra:patient-updated", onUpdate);
    return () => {
      abortRef.current?.abort();
      window.removeEventListener("libra:patient-updated", onUpdate);
    };
  }, [loadData]);

  const formatSide = (side?: Patient["side"] | null) => {
    if (side === "LEFT") return t.side_left;
    if (side === "RIGHT") return t.side_right;
    return t.side_unspecified;
  };

  const formatAnthro = (p: Patient) => {
    const weightStr = isFiniteNum(p.weight) ? `${p.weight.toFixed(1)} кг` : "—";
    const heightCm = fmtCm(p.height, false);
    const legCm = fmtCm(p.leg_length, false);
    const lengthStr = heightCm === "—" && legCm === "—" ? "—" : `${heightCm}/${legCm} см`;
    if (weightStr === "—" && lengthStr === "—") return "—";
    return `${weightStr} · ${lengthStr}`;
  };

  const formatCustomClinic = (name?: string | null) => {
    if (!name || name.includes("KU Leuven")) return null;
    const parts = name.split(" / ");
    return parts.length === 2 ? (isKz ? parts[1] : parts[0]) : name;
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
          <AlertTriangle size={12} strokeWidth={1.6} aria-hidden="true" />
          <span>{isKz ? "Жамбас компенсациясы" : "Компенсация тазом"}</span>
        </span>
      );
    }
    if (status === "yellow") {
      return (
        <span className="badge badge-yellow">
          {isKz ? "Бейтарап / бақылау" : "Нейтрально / наблюдение"}
        </span>
      );
    }
    if (status !== "green") {
      return (
        <span className="badge badge-neutral">
          {isKz ? "Толық дерек жоқ" : "Неполные пробы"}
        </span>
      );
    }
    return (
      <span className="badge badge-green">
        <CheckCircle2 size={12} strokeWidth={1.6} aria-hidden="true" />
        <span>{isKz ? "Шынайы оң нәтиже" : "Без перегрузки таза"}</span>
      </span>
    );
  };

  return (
    <div className="stack-lg">
      <header className="row-end">
        <div>
          <h1 className="page-title">{t.portal_title}</h1>
          <p className="page-subtitle">{t.portal_sub}</p>
        </div>

        <Link href="/portal/analytics" className="btn">
          <span>{t.nav_cohort}</span>
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </header>

      <section aria-label={isKz ? "Когорта көрсеткіштері" : "Сводка по когорте"} className="grid-kpi-4">
        <div className="surface-compact">
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {t.kpi_cohort_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1.1, color: "var(--ink)" }}>
            {stats?.total_patients ?? patients.length}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "var(--sp-1)" }}>
            {t.kpi_limbs_desc}
            {stats ? ` · ${stats.cycles.total} ${isKz ? "қадам" : "циклов"}` : ""}
          </div>
        </div>

        <div className="surface-compact">
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {t.kpi_risk_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1.1, color: "var(--red)" }}>
            {stats?.cdss_distribution.red ?? summaryCounts.red}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "var(--sp-1)" }}>
            {t.kpi_risk_desc}
          </div>
        </div>

        <div className="surface-compact">
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {t.kpi_true_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1.1, color: "var(--teal)" }}>
            {stats?.cdss_distribution.green ?? summaryCounts.green}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "var(--sp-1)" }}>
            {t.kpi_true_desc}
          </div>
        </div>

        <div className="surface-compact">
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
            {t.kpi_gps_title}
          </div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: 600, lineHeight: 1.2, color: "var(--ink)" }}>
            {fmtFixed(stats?.averages.baseline_gps, 1, "°")} → {fmtFixed(stats?.averages.vr_gps, 1, "°")}
          </div>
          <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "var(--sp-1)" }}>
            {t.kpi_gps_desc}
          </div>
        </div>
      </section>

      <section className="surface-compact row-between">
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: "360px" }}>
          <label htmlFor="patient-search" className="visually-hidden">
            {isKz ? "Пациент коды бойынша іздеу" : "Поиск по коду пациента"}
          </label>
          <Search
            size={16}
            strokeWidth={1.5}
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
            placeholder={isKz ? "Пациент коды, мысалы s61520_1" : "Код пациента, например s61520_1"}
            style={{ width: "100%", paddingLeft: "36px" }}
          />
        </div>

        <div className="cluster">
          <div
            role="group"
            aria-label={isKz ? "Клиникалық мәртебе бойынша сүзгі" : "Фильтр по оценке риска"}
            className="cluster"
            style={{ gap: "var(--sp-1)" }}
          >
            {(
              [
                { key: "all", label: t.filter_all_label },
                { key: "red", label: t.filter_danger_label },
                { key: "yellow", label: isKz ? "Бақылау" : "Под наблюдением" },
                { key: "green", label: t.filter_normal_label },
                { key: "unassessed", label: isKz ? "Бағаланбаған" : "Без оценки" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={riskFilter === f.key}
                onClick={() => setRiskFilter(f.key)}
                className={`btn btn-sm ${riskFilter === f.key ? "btn-primary" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            aria-label={isKz ? "Зерттелген аяқ бойынша сүзгі" : "Фильтр по стороне"}
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as SideFilter)}
            style={{ minBlockSize: "32px", padding: "var(--sp-1) var(--sp-3)", fontSize: "12px" }}
          >
            <option value="ALL">{isKz ? "Барлық жақ" : "Обе стороны"}</option>
            <option value="LEFT">{t.side_left}</option>
            <option value="RIGHT">{t.side_right}</option>
          </select>

          <span className="tabular-nums mono" style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "var(--sp-1)" }}>
            {filteredPatients.length} / {patients.length}
          </span>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="callout callout-red row-between" style={{ color: "var(--red)" }}>
          <span>
            {isKz
              ? "Сервермен байланыс орнату мүмкін болмады. API қызметінің күйін тексеріңіз."
              : "Не удалось загрузить реестр пациентов. Проверьте доступность клинического сервера."}
          </span>
          <button type="button" onClick={() => loadData()} className="btn btn-sm">
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{isKz ? "Қайта жүктеу" : "Повторить"}</span>
          </button>
        </div>
      )}

      <div className="surface-flush">
        {loading ? (
          <div style={{ padding: "var(--sp-12) var(--sp-6)", textAlign: "center", color: "var(--muted)" }}>
            {isKz ? "Пациенттер тізілімі жүктелуде..." : "Загрузка клинического реестра..."}
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="stack-sm" style={{ padding: "var(--sp-12) var(--sp-6)", textAlign: "center", alignItems: "center" }}>
            <p style={{ color: "var(--secondary)" }}>
              {isKz
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
              {isKz ? "Сүзгілерді тазарту" : "Сбросить фильтры"}
            </button>
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-labelledby="registry-table-caption" className="table-responsive">
            <table className="clinical-table">
              <caption id="registry-table-caption" className="visually-hidden">
                {t.portal_title}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{isKz ? "Пациент" : "Пациент"}</th>
                  <th scope="col">{t.col_side_label}</th>
                  <th scope="col">{isKz ? "Салмақ · бой / аяқ" : "Вес · рост / нога"}</th>
                  <th scope="col">GPS ({isKz ? "Қал. → VR" : "База → VR"})</th>
                  <th scope="col">{isKz ? "Δ Сан жазылуы" : "Δ Бедра"}</th>
                  <th scope="col">PCR</th>
                  <th scope="col">{isKz ? "Жамбас бағасы" : "Оценка таза"}</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    {t.col_action_label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => {
                  const customClinic = formatCustomClinic(p.clinic_name);
                  const hasExtraVisits = (p.visit_count ?? 1) > 1;
                  return (
                    <tr key={p.code}>
                      <td>
                        <Link
                          href={`/portal/patients/${encodeURIComponent(p.code)}`}
                          className="mono"
                          style={{ fontWeight: 600, color: "var(--ink)", display: "inline-block" }}
                        >
                          {p.code}
                        </Link>
                        {(customClinic || hasExtraVisits) && (
                          <div className="cluster" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", gap: "var(--sp-2)" }}>
                            {customClinic && <span>{customClinic}</span>}
                            {hasExtraVisits && (
                              <span className="badge badge-neutral tabular-nums">
                                {fmtVisitCount(p.visit_count!, lang)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatSide(p.side)}</td>
                      <td className="tabular-nums" style={{ color: "var(--secondary)", whiteSpace: "nowrap" }}>
                        {formatAnthro(p)}
                      </td>
                      <td className="tabular-nums" style={{ whiteSpace: "nowrap" }}>
                        {fmtFixed(p.baseline_gps, 1, "°")} → {fmtFixed(p.vr_gps, 1, "°")}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{
                          fontWeight: 600,
                          color:
                            isFiniteNum(p.delta_amin_sagh) && p.delta_amin_sagh <= -1.0
                              ? "var(--teal)"
                              : "var(--ink)",
                        }}
                      >
                        {fmtSigned(p.delta_amin_sagh, 2, "°")}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{
                          fontWeight: 600,
                          color: isFiniteNum(p.pcr) && p.pcr > 0.8 ? "var(--red)" : "var(--ink)",
                        }}
                      >
                        {fmtPcr(p.pcr)}
                      </td>
                      <td>{riskBadge(p.status)}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/portal/patients/${encodeURIComponent(p.code)}`}
                          className="btn btn-sm"
                        >
                          {t.btn_open_card}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
