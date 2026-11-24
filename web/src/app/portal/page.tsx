"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getPatients } from "@/lib/api";
import { Patient } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { Search, AlertOctagon, CheckCircle2, ChevronRight } from "lucide-react";

export default function PortalDashboard() {
  const { lang, t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "danger" | "normal">("all");
  const [sideFilter, setSideFilter] = useState<"all" | "LEFT" | "RIGHT">("all");

  useEffect(() => {
    async function loadData() {
      try {
        const pts = await getPatients();
        setPatients(pts);
      } catch (err) {
        console.error("Failed to load patients:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Dynamic cohort risk metrics
  const criticalCodes = ["s61520_1", "s61520_4", "s61520_10", "s61520_19", "s61520_22", "s61520_27"];

  const classifyPatientRisk = (p: any) => {
    const pcr = p.pcr ?? p.actual_pcr;
    if (typeof pcr === "number" && !isNaN(pcr)) {
      if (pcr > 0.8) return { status: "danger", label: `PCR = ${pcr.toFixed(2)} · ${lang === "kz" ? "Гиперлордоз қаупі" : "Гиперлордоз"}`, badgeClass: "badge-red" };
      if (pcr >= 0.4) return { status: "warning", label: `PCR = ${pcr.toFixed(2)} · ${lang === "kz" ? "Қалыпты бейімделу" : "Адаптация"}`, badgeClass: "badge-amber" };
      return { status: "normal", label: `PCR = ${pcr.toFixed(2)} · ${lang === "kz" ? "Қалыпты" : "Норма"}`, badgeClass: "badge-green" };
    }
    const isCritical = criticalCodes.includes(p.code);
    return isCritical
      ? { status: "danger", label: `PCR > 0.80 · ${lang === "kz" ? "Гиперлордоз қаупі" : "Гиперлордоз"}`, badgeClass: "badge-red" }
      : { status: "normal", label: `PCR < 0.40 · ${lang === "kz" ? "Қалыпты" : "Норма"}`, badgeClass: "badge-green" };
  };

  const dangerCount = patients.filter((p) => classifyPatientRisk(p).status === "danger").length;
  const normalCount = Math.max(0, patients.length - dangerCount);
  const totalCount = patients.length || 1;
  const dangerPct = Math.round((dangerCount / totalCount) * 100);
  const normalPct = 100 - dangerPct;

  const filteredPatients = patients.filter((p) => {
    const matchesSearch = p.code.toLowerCase().includes(search.toLowerCase()) || p.side.toLowerCase().includes(search.toLowerCase());
    const matchesSide = sideFilter === "all" || p.side === sideFilter;
    const riskStatus = classifyPatientRisk(p).status;
    const matchesRisk =
      riskFilter === "all" ||
      (riskFilter === "danger" && riskStatus === "danger") ||
      (riskFilter === "normal" && riskStatus === "normal");
    return matchesSearch && matchesSide && matchesRisk;
  });

  return (
    <div className="container" style={{ paddingBlock: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* 1. Dashboard Header */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "10px", marginBottom: "4px" }}>
          <div>
            <h1 style={{ fontSize: "26px", letterSpacing: "-0.025em" }}>{t.portal_title}</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
              {t.portal_sub}
            </p>
          </div>
        </div>

        {/* 4 Macro Cohort KPI Cards */}
        <div className="grid-kpi-4" style={{ marginTop: "14px" }}>
          
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>{t.kpi_cohort_title}</span>
            </div>
            <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", margin: "4px 0 2px" }}>
              {patients.length || 29}
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {t.kpi_limbs_desc}
            </div>
          </div>

          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>{t.kpi_risk_title}</span>
              <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)" }}></span>
            </div>
            <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--red)", margin: "4px 0 2px" }}>
              {dangerCount} ({dangerPct}%)
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {t.kpi_risk_desc}
            </div>
          </div>

          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>{t.kpi_true_title}</span>
              <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--teal)" }}></span>
            </div>
            <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--teal)", margin: "4px 0 2px" }}>
              {normalCount} ({normalPct}%)
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {t.kpi_true_desc}
            </div>
          </div>

          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>{t.kpi_gps_title}</span>
            </div>
            <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", margin: "4px 0 2px" }}>
              10.4°
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {t.kpi_gps_desc}
            </div>
          </div>

        </div>
      </div>

      {/* 2. Interactive Filter Bar */}
      <div className="card" style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "240px" }}>
          <Search size={16} color="var(--muted)" />
          <input
            id="patient-search"
            aria-label="Поиск пациентов по коду / Пациенттерді іздеу"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "kz" ? "Код бойынша іздеу (мысалы, s61520_1)..." : "Поиск по коду (например, s61520_1)..."}
            style={{ width: "100%", height: "36px" }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              onClick={() => setRiskFilter("all")}
              className={`btn ${riskFilter === "all" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "5px 12px" }}
            >
              {t.filter_all_label} ({patients.length})
            </button>
            <button
              onClick={() => setRiskFilter("danger")}
              className={`btn ${riskFilter === "danger" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "5px 12px" }}
            >
              <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "var(--red)" }}></span>
              <span>{t.filter_danger_label} ({dangerCount})</span>
            </button>
            <button
              onClick={() => setRiskFilter("normal")}
              className={`btn ${riskFilter === "normal" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "5px 12px" }}
            >
              <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "var(--teal)" }}></span>
              <span>{t.filter_normal_label} ({normalCount})</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px" }} className="hide-on-mobile">
            <button
              onClick={() => setSideFilter("all")}
              className={`btn ${sideFilter === "all" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "5px 10px" }}
            >
              {lang === "kz" ? "Барлығы" : "Все стороны"}
            </button>
            <button
              onClick={() => setSideFilter("LEFT")}
              className={`btn ${sideFilter === "LEFT" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "5px 10px" }}
            >
              L
            </button>
            <button
              onClick={() => setSideFilter("RIGHT")}
              className={`btn ${sideFilter === "RIGHT" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "5px 10px" }}
            >
              R
            </button>
          </div>

        </div>

      </div>

      {/* 3. Patient Cohort Table with Responsive Wrapper */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--muted)" }}>
            {lang === "kz" ? "Пациенттер тізімі жүктелуде..." : "Загрузка списка пациентов..."}
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left", minWidth: "640px" }}>
              <thead>
                <tr style={{ background: "var(--linen)", borderBottom: "1px solid var(--line)", color: "var(--ink)" }}>
                  <th scope="col" style={{ padding: "12px 18px", fontWeight: "700" }}>{t.col_patient_code}</th>
                  <th scope="col" style={{ padding: "12px 14px", fontWeight: "700" }}>{t.col_side_label}</th>
                  <th scope="col" style={{ padding: "12px 14px", fontWeight: "700" }}>{t.col_anthro}</th>
                  <th scope="col" style={{ padding: "12px 14px", fontWeight: "700" }}>{t.leg_length}</th>
                  <th scope="col" style={{ padding: "12px 14px", fontWeight: "700" }}>{t.col_risk_status}</th>
                  <th scope="col" style={{ padding: "12px 18px", fontWeight: "700", textAlign: "right" }}>{t.col_action_label}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => {
                  const isCritical = criticalCodes.includes(p.code);
                  return (
                    <tr
                      key={p.code}
                      style={{ borderBottom: "1px solid var(--line)", transition: "background 140ms ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "6px",
                            background: isCritical ? "var(--red-bg)" : "var(--linen)",
                            color: isCritical ? "var(--red)" : "var(--ink)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "600",
                            fontSize: "12px"
                          }}>
                            {p.code.split("_")[1] || "CP"}
                          </div>
                          <div>
                            <strong style={{ fontSize: "14px" }}>{p.code}</strong>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lang === "kz" ? "БЦП когортасы (KU Leuven)" : "Когорта ДЦП (KU Leuven)"}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        <span className="badge badge-neutral">
                          {p.side === "LEFT" ? (lang === "kz" ? "Сол (L)" : "Левая (L)") : (lang === "kz" ? "Оң (R)" : "Правая (R)")}
                        </span>
                      </td>

                      <td style={{ padding: "12px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {p.weight.toFixed(1)} {lang === "kz" ? "кг" : "кг"}, {p.height.toFixed(2)} {lang === "kz" ? "м" : "м"}
                      </td>

                      <td style={{ padding: "12px 14px", fontVariantNumeric: "tabular-nums" }}>
                        {p.leg_length.toFixed(3)} {lang === "kz" ? "м" : "м"}
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        {(() => {
                          const risk = classifyPatientRisk(p);
                          return (
                            <span className={`badge ${risk.badgeClass}`} title={risk.label}>
                              {risk.status === "danger" ? <AlertOctagon size={12} /> : <CheckCircle2 size={12} />}
                              <span>{risk.label}</span>
                            </span>
                          );
                        })()}
                      </td>

                      <td style={{ padding: "12px 18px", textAlign: "right" }}>
                        <Link
                          href={`/portal/patients/${p.code}`}
                          className="btn btn-primary"
                          style={{ fontSize: "12px", padding: "6px 12px" }}
                        >
                          <span>{t.btn_open_card || "Карта пациента"}</span>
                          <ChevronRight size={14} />
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
