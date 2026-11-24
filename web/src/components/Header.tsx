"use client";

import React from "react";
import { Activity, Languages, Building2, ShieldCheck, HelpCircle, Scale } from "lucide-react";
import { translations } from "@/lib/translations";

interface HeaderProps {
  lang: "ru" | "kz" | "en";
  setLang: (lang: "ru" | "kz" | "en") => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenGuide?: () => void;
  onOpenLegal?: () => void;
}

export function Header({ lang, setLang, activeTab, setActiveTab, onOpenGuide, onOpenLegal }: HeaderProps) {
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

        {/* Clinic & Language Switcher & Quick Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="no-print">
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="btn"
              style={{ fontSize: "11px", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
              title={t.nav_guide}
            >
              <HelpCircle size={13} color="var(--teal)" />
              <span>{lang === "kz" ? "Жаднама" : "Памятка"}</span>
            </button>
          )}

          {onOpenLegal && (
            <button
              onClick={onOpenLegal}
              className="btn"
              style={{ fontSize: "11px", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
              title={t.nav_legal}
            >
              <Scale size={13} color="var(--muted)" />
              <span>{lang === "kz" ? "Құқық" : "Право"}</span>
            </button>
          )}

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
