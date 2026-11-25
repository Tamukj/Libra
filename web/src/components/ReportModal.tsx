"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileText, Printer, X, Shield, Download } from "lucide-react";
import { createReport, downloadReportPdf } from "@/lib/api";

interface Props {
  open: boolean;
  patientCode: string;
  lang: "ru" | "kz";
  onClose: () => void;
}

export function ReportModal({ open, patientCode, lang: initialLang, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [modalLang, setModalLang] = useState<"ru" | "kz">(initialLang);
  const [audience, setAudience] = useState<"doctor" | "parent">("doctor");
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    narrative: string;
    created_at: string;
    pcr: number;
    tje: number;
    icf_b770: string;
  } | null>(null);

  useEffect(() => {
    setModalLang(initialLang);
  }, [initialLang]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function generate() {
      setLoading(true);
      setReportError(null);
      try {
        const res = await createReport(patientCode, modalLang, audience);
        if (active) setReport(res);
      } catch (e) {
        if (active) {
          setReportError(e instanceof Error ? e.message : String(e));
          setReport(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    generate();
    return () => {
      active = false;
    };
  }, [open, patientCode, modalLang, audience]);

  const formattedDate = (() => {
    if (!report?.created_at) return "";
    const d = new Date(report.created_at);
    if (isNaN(d.getTime())) return report.created_at;
    return d.toLocaleString(modalLang === "kz" ? "kk-KZ" : "ru-RU");
  })();

  return (
    <dialog
      ref={dialogRef}
      className="libra-dialog"
      aria-labelledby="report-modal-title"
      onClose={onClose}
      onClick={(e) => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          onClose();
        }
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText size={18} strokeWidth={1.6} color="var(--teal)" />
          <h1 id="report-modal-title" style={{ fontSize: "16px", fontWeight: 600 }}>
            {audience === "doctor"
              ? modalLang === "kz"
                ? `Дәрігерлік хаттама · ${patientCode}`
                : `Клинический протокол · ${patientCode}`
              : modalLang === "kz"
              ? `Баланың жүріс төлқұжаты · ${patientCode}`
              : `Паспорт походки ребенка · ${patientCode}`}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }} className="no-print">
          <div style={{ display: "inline-flex", background: "var(--sidebar)", borderRadius: "8px", border: "1px solid var(--line)", padding: "2px" }}>
            <button
              type="button"
              onClick={() => setAudience("doctor")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 500,
                border: "none",
                borderRadius: "6px",
                background: audience === "doctor" ? "var(--ink)" : "transparent",
                color: audience === "doctor" ? "var(--white)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              {modalLang === "kz" ? "Дәрігерге" : "Врачу"}
            </button>
            <button
              type="button"
              onClick={() => setAudience("parent")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 500,
                border: "none",
                borderRadius: "6px",
                background: audience === "parent" ? "var(--ink)" : "transparent",
                color: audience === "parent" ? "var(--white)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              {modalLang === "kz" ? "Ата-анаға" : "Родителям"}
            </button>
          </div>

          <div style={{ display: "inline-flex", border: "1px solid var(--line-strong)", borderRadius: "8px", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setModalLang("ru")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: modalLang === "ru" ? 600 : 500,
                border: "none",
                background: modalLang === "ru" ? "var(--sidebar)" : "var(--white)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              РУС
            </button>
            <button
              type="button"
              onClick={() => setModalLang("kz")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: modalLang === "kz" ? 600 : 500,
                border: "none",
                borderInlineStart: "1px solid var(--line)",
                background: modalLang === "kz" ? "var(--sidebar)" : "var(--white)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              ҚАЗ
            </button>
          </div>

          <button type="button" onClick={onClose} aria-label={modalLang === "kz" ? "Жабу" : "Закрыть"} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
            {modalLang === "kz" ? "Хаттама дайындалуда..." : "Формирование заключения..."}
          </div>
        ) : reportError ? (
          <div role="alert" style={{ padding: "16px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: "8px", color: "var(--red)", fontSize: "13px" }}>
            <strong>{modalLang === "kz" ? "Қате:" : "Ошибка формирования:"}</strong> {reportError}
          </div>
        ) : report ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
              <span>{modalLang === "kz" ? "Libra СППР · Жүріс биомеханикасының есебі" : "Libra СППР · Протокол биомеханики походки"}</span>
              <span className="tabular-nums">{formattedDate}</span>
            </div>

            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
                fontFamily: "var(--sans)",
                fontSize: "13px",
                lineHeight: 1.65,
                whiteSpace: "pre-line",
                color: "var(--ink)",
              }}
            >
              {report.narrative}
            </div>

            <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={14} color="var(--teal)" />
              <span>
                {modalLang === "kz"
                  ? "Шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз. Қорытынды емдеуші дәрігердің растауына жатады."
                  : "В экстренных ситуациях звоните 103. Окончательное решение принимает лечащий врач."}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer actions */}
      <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "8px" }} className="no-print">
        {pdfError && (
          <div role="alert" style={{ fontSize: "12px", color: "var(--red)", fontWeight: 500 }}>
            {pdfError}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} className="btn">
            {modalLang === "kz" ? "Жабу" : "Закрыть"}
          </button>
          <button
            type="button"
            onClick={async () => {
              setPdfLoading(true);
              setPdfError(null);
              try {
                await downloadReportPdf(patientCode, modalLang, audience);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setPdfError(modalLang === "kz" ? `PDF жүктеу қатесі: ${msg}` : `Ошибка выгрузки PDF: ${msg}`);
              } finally {
                setPdfLoading(false);
              }
            }}
            disabled={pdfLoading}
            className="btn btn-teal"
          >
            <Download size={15} />
            <span>
              {pdfLoading
                ? modalLang === "kz"
                  ? "PDF дайындалуда..."
                  : "Подготовка PDF..."
                : modalLang === "kz"
                ? "PDF есепті жүктеу"
                : "Скачать отчёт PDF"}
            </span>
          </button>
          <button type="button" onClick={() => window.print()} className="btn btn-primary">
            <Printer size={15} />
            <span>{modalLang === "kz" ? "Басып шығару" : "Печать"}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
