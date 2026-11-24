"use client";

import React, { useState } from "react";
import { FileText, Printer, X, Check, Shield } from "lucide-react";
import { createReport } from "@/lib/api";

interface Props {
  patientCode: string;
  lang: "ru" | "kz";
  onClose: () => void;
}

export function ReportModal({ patientCode, lang: initialLang, onClose }: Props) {
  const [modalLang, setModalLang] = React.useState<"ru" | "kz">(initialLang);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{ narrative: string; created_at: string; pcr: number; tje: number; icf_b770: string } | null>(null);

  const handleGenerate = async (selectedLang: "ru" | "kz") => {
    setLoading(true);
    try {
      const res = await createReport(patientCode, selectedLang);
      setReport(res);
    } catch (e) {
      alert("Ошибка генерации отчета: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    handleGenerate(modalLang);
  }, [patientCode, modalLang]);

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
      <div className="card" style={{
        maxWidth: "720px",
        width: "100%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
      }}>
        
        {/* Header with Language Switcher */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={20} color="var(--teal)" />
            <h2 style={{ fontSize: "16px" }}>
              {modalLang === "kz" ? `Дәрігерлік қорытынды: Пациент ${patientCode}` : `Клинический протокол: Пациент ${patientCode}`}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="no-print">
            <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
              <button
                onClick={() => setModalLang("kz")}
                style={{
                  padding: "3px 8px",
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
                  padding: "3px 8px",
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
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              ИИ қалыптастыруда / ИИ формирует протокол...
            </div>
          ) : report ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div style={{ background: "var(--linen)", padding: "12px", borderRadius: "6px", fontSize: "12px", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{modalLang === "kz" ? "Орталық: Семей қ. Балаларды оңалту орталығы" : "Центр: Реабилитационный центр детей г. Семей"}</span>
                <span>{modalLang === "kz" ? "Уақыты: " : "Время: "}{new Date(report.created_at).toLocaleString()}</span>
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
