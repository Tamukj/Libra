"use client";

import React from "react";
import { Activity, Languages, Building2, ShieldCheck } from "lucide-react";
import { translations } from "@/lib/translations";

interface HeaderProps {
  lang: "ru" | "kz";
  setLang: (lang: "ru" | "kz") => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Header({ lang, setLang, activeTab, setActiveTab }: HeaderProps) {
  const t = translations[lang];

  return (
    <header style={{ borderBottom: "1px solid var(--line)", background: "var(--white)" }}>
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "72px" }}>
        
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "38px",
            height: "38px",
            borderRadius: "8px",
            background: "var(--ink)",
            color: "var(--white)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Activity size={22} color="var(--paper)" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.03em" }}>{t.brand_title}</span>
              <span className="badge badge-green" style={{ fontSize: "11px", padding: "2px 8px" }}>
                <ShieldCheck size={12} /> CDSS Certified
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{t.brand_sub}</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: "flex", gap: "6px" }} className="no-print">
          {[
            { id: "patient", label: t.nav_patient },
            { id: "kinematics", label: t.nav_kinematics },
            { id: "radar", label: t.nav_radar },
            { id: "ml", label: t.nav_ml },
            { id: "regional", label: t.nav_regional },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn"
              style={{
                background: activeTab === tab.id ? "var(--ink)" : "transparent",
                color: activeTab === tab.id ? "var(--white)" : "var(--ink)",
                borderColor: activeTab === tab.id ? "var(--ink)" : "transparent",
                borderRadius: "6px"
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Clinic & Language Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }} className="no-print">
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
            <Building2 size={14} />
            <span>{t.clinic_badge}</span>
          </div>

          <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
            <button
              onClick={() => setLang("kz")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: "600",
                border: "none",
                background: lang === "kz" ? "var(--linen)" : "var(--white)",
                color: "var(--ink)"
              }}
            >
              ҚАЗ
            </button>
            <button
              onClick={() => setLang("ru")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: "600",
                border: "none",
                borderLeft: "1px solid var(--line)",
                background: lang === "ru" ? "var(--linen)" : "var(--white)",
                color: "var(--ink)"
              }}
            >
              РУС
            </button>
          </div>
        </div>

      </div>
    </header>
  );
}
