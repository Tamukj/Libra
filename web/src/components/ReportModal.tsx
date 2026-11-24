"use client";

import React, { useState } from "react";
import { FileText, Printer, X, Check, Shield } from "lucide-react";
import { createReport } from "@/lib/api";

interface Props {
  patientCode: string;
  lang: "ru" | "kz" | "en";
  onClose: () => void;
}

export function ReportModal({ patientCode, lang: initialLang, onClose }: Props) {
  const [modalLang, setModalLang] = React.useState<"ru" | "kz" | "en">(initialLang);
  const [audience, setAudience] = useState<"doctor" | "parent">("doctor");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{ narrative: string; created_at: string; pcr: number; tje: number; icf_b770: string } | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleGenerate = async (selectedLang: "ru" | "kz" | "en", selectedAudience: "doctor" | "parent") => {
    setLoading(true);
    try {
      const res = await createReport(patientCode, selectedLang, selectedAudience);
      setReport(res);
    } catch (e) {
      alert("Ошибка генерации отчета: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    handleGenerate(modalLang, audience);
  }, [patientCode, modalLang, audience]);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(39, 36, 31, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    }}>
      <div className="card" role="dialog" aria-modal="true" style={{
        maxWidth: "760px",
        width: "100%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        boxShadow: "0 8px 24px rgba(28, 25, 23, 0.12)"
      }}>
        
        {/* Header with Audience Switcher and Language Switcher */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={20} color="var(--teal)" />
            <h2 style={{ fontSize: "16px", margin: 0 }}>
              {audience === "doctor"
                ? (modalLang === "kz" ? `Дәрігерлік қорытынды: Пациент ${patientCode}` : `Клинический протокол: Пациент ${patientCode}`)
                : (modalLang === "kz" ? `Баланың жүріс төлқұжаты: ${patientCode}` : `Паспорт походки ребенка: ${patientCode}`)}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="no-print">
            
            {/* Audience Switcher (Doctor vs Parent) */}
            <div style={{ display: "flex", background: "var(--linen)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--line)", padding: "2px" }}>
              <button
                onClick={() => setAudience("doctor")}
                style={{
                  padding: "4px 9px",
                  fontSize: "11px",
                  fontWeight: 500,
                  border: "none",
                  borderRadius: "4px",
                  background: audience === "doctor" ? "var(--ink)" : "transparent",
                  color: audience === "doctor" ? "var(--white)" : "var(--ink)",
                  cursor: "pointer"
                }}
              >
                {modalLang === "kz" ? "Дәрігерге (Damumed)" : "Врачу (Damumed)"}
              </button>
              <button
                onClick={() => setAudience("parent")}
                style={{
                  padding: "4px 9px",
                  fontSize: "11px",
                  fontWeight: 500,
                  border: "none",
                  borderRadius: "4px",
                  background: audience === "parent" ? "var(--ink)" : "transparent",
                  color: audience === "parent" ? "var(--white)" : "var(--ink)",
                  cursor: "pointer"
                }}
              >
                {modalLang === "kz" ? "Ата-анаға (Паспорт)" : "Родителям (Паспорт)"}
              </button>
            </div>

            {/* Language Switcher */}
            <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
              <button
                onClick={() => setModalLang("kz")}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: "600",
                  border: "none",
                  background: modalLang === "kz" ? "var(--linen)" : "var(--white)",
                  color: "var(--ink)",
                  cursor: "pointer"
                }}
              >
                ҚАЗ
              </button>
              <button
                onClick={() => setModalLang("ru")}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: "600",
                  border: "none",
                  borderLeft: "1px solid var(--line)",
                  background: modalLang === "ru" ? "var(--linen)" : "var(--white)",
                  color: "var(--ink)",
                  cursor: "pointer"
                }}
              >
                РУС
              </button>
            </div>

            <button onClick={onClose} aria-label="Закрыть / Жабу" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              {modalLang === "kz" ? "Хаттама жасалуда..." : "Формирование клинического протокола..."}
            </div>
          ) : report ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div style={{ background: "var(--linen)", padding: "12px", borderRadius: "6px", fontSize: "12px", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{modalLang === "kz" ? "Орталық: Семей қ. Балаларды оңалту орталығы" : "Центр: Реабилитационный центр детей г. Семей"}</span>
                <span>{modalLang === "kz" ? "Уақыты: " : "Время: "}{(() => {
                  const d = new Date(report.created_at);
                  return isNaN(d.getTime()) ? report.created_at : d.toLocaleString();
                })()}</span>
              </div>

              {/* Mandatory Section 8.4 Alert Banner: Emergency 103 Call */}
              <div style={{
                background: "var(--amber-light)",
                border: "1px solid var(--amber-border)",
                borderRadius: "6px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
                color: "var(--amber)",
                fontWeight: "600"
              }}>
                <Shield size={16} color="var(--amber)" />
                <span>
                  {modalLang === "kz"
                    ? "ШҰҒЫЛ ЖАҒДАЙДА: 103 нөміріне қоңырау шалыңыз · Libra жүйесі СППР болып табылады, диагноз қоймайды (Ереже 8.4-бабы)"
                    : "ЭКСТРЕННАЯ ПОМОЩЬ: 103 · Система Libra является СППР, не ставит диагноз и не назначает лечение (ст. 8.4 Положения)"}
                </span>
              </div>

              {/* Formatted Pre */}
              <pre style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                padding: "16px",
                fontFamily: "var(--sans)",
                fontSize: "13px",
                lineHeight: "1.7",
                whiteSpace: "pre-wrap",
                color: "var(--ink)",
                margin: 0
              }}>
                {report.narrative}
              </pre>

              <div style={{ fontSize: "11px", color: "var(--muted)", fontStyle: "italic", display: "flex", alignItems: "center", gap: "6px" }}>
                <Shield size={14} color="var(--teal)" />
                {modalLang === "kz" 
                  ? "ҚР Денсаулық сақтау министрлігінің БЦП хаттамасына және ДДҰ ХҚЖ стандартына сәйкес."
                  : "Соответствует клиническому протоколу МЗ РК «ДЦП у детей» и стандартам МКФ ВОЗ."}
              </div>

            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "10px" }} className="no-print">
          <button onClick={onClose} className="btn">
            {modalLang === "kz" ? "Жабу" : "Закрыть"}
          </button>
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer size={16} />
            {modalLang === "kz" ? "Басып шығару (PDF)" : "Печать протокола (PDF)"}
          </button>
        </div>

      </div>
    </div>
  );
}
