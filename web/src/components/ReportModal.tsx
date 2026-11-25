"use client";

import React, { useState, useEffect } from "react";
import { FileText, Printer, X, Shield, Download } from "lucide-react";
import { ModalDialog } from "@/components/ModalDialog";
import { createReport, downloadReportPdf } from "@/lib/api";
import { cleanClinicalText } from "@/lib/format";

interface Props {
  open: boolean;
  patientCode: string;
  visitKey?: string;
  lang: "ru" | "kz" | "en";
  onClose: () => void;
}

export function ReportModal({
  open,
  patientCode,
  visitKey,
  lang: initialLang,
  onClose,
}: Props) {
  const [modalLang, setModalLang] = useState<"ru" | "kz">(initialLang === "kz" ? "kz" : "ru");
  const [audience, setAudience] = useState<"doctor" | "parent">("doctor");
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    narrative: string;
    created_at: string;
    pcr: number | null;
    tje: number | null;
    icf_b770: string;
  } | null>(null);

  useEffect(() => {
    setPdfError(null);
  }, [open, patientCode, visitKey]);

  useEffect(() => {
    setModalLang(initialLang === "kz" ? "kz" : "ru");
  }, [initialLang]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function generate() {
      setLoading(true);
      setReportError(null);
      try {
        const res = await createReport(patientCode, modalLang, audience, visitKey);
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
  }, [open, patientCode, modalLang, audience, visitKey]);

  const formattedDate = (() => {
    if (!report?.created_at) return "";
    const d = new Date(report.created_at);
    if (Number.isNaN(d.getTime())) return report.created_at;
    return d.toLocaleString(modalLang === "kz" ? "kk-KZ" : "ru-RU");
  })();

  const isKz = modalLang === "kz";

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="report-modal-title">
      <div className="dialog-header">
        <div className="cluster">
          <FileText size={18} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
          <h1 id="report-modal-title" className="section-title">
            {audience === "doctor"
              ? isKz
                ? `Дәрігерлік хаттама · ${patientCode}`
                : `Клинический протокол · ${patientCode}`
              : isKz
                ? `Баланың жүріс төлқұжаты · ${patientCode}`
                : `Паспорт походки ребёнка · ${patientCode}`}
          </h1>
        </div>

        <div className="cluster no-print">
          <div
            className="seg-group"
            role="group"
            aria-label={isKz ? "Есеп адресаты" : "Адресат отчёта"}
          >
            <button
              type="button"
              className="seg-btn"
              onClick={() => setAudience("doctor")}
              aria-pressed={audience === "doctor"}
            >
              {isKz ? "Дәрігерге" : "Врачу"}
            </button>
            <button
              type="button"
              className="seg-btn"
              onClick={() => setAudience("parent")}
              aria-pressed={audience === "parent"}
            >
              {isKz ? "Ата-анаға" : "Родителям"}
            </button>
          </div>

          <div
            className="seg-group"
            role="group"
            aria-label={isKz ? "Хаттама тілі" : "Язык отчёта"}
          >
            <button
              type="button"
              className="seg-btn seg-btn-light"
              onClick={() => setModalLang("ru")}
              aria-pressed={modalLang === "ru"}
            >
              РУС
            </button>
            <button
              type="button"
              className="seg-btn seg-btn-light"
              onClick={() => setModalLang("kz")}
              aria-pressed={modalLang === "kz"}
            >
              ҚАЗ
            </button>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label={isKz ? "Жабу" : "Закрыть"}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="dialog-body">
        {loading ? (
          <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--muted)" }}>
            {isKz ? "Хаттама дайындалуда..." : "Формирование заключения..."}
          </div>
        ) : reportError ? (
          <div className="callout callout-red" role="alert">
            <div style={{ color: "var(--red)", fontSize: "13px" }}>
              <strong>{isKz ? "Қате:" : "Ошибка формирования:"}</strong> {reportError}
            </div>
          </div>
        ) : report ? (
          <div className="stack-md">
            <div className="row-between" style={{ fontSize: "12px", color: "var(--muted)" }}>
              <span>
                {isKz
                  ? "Libra СППР · Жүріс биомеханикасының есебі"
                  : "Libra СППР · Протокол биомеханики походки"}
              </span>
              <span className="tabular-nums">{formattedDate}</span>
            </div>

            <div
              className="panel-inset"
              style={{
                padding: "var(--sp-4)",
                fontSize: "13px",
                lineHeight: 1.65,
                whiteSpace: "pre-line",
                color: "var(--ink)",
              }}
            >
              {cleanClinicalText(report.narrative)}
            </div>

            <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
              <Shield size={14} color="var(--teal)" aria-hidden="true" />
              <span>
                {isKz
                  ? "Шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз. Қорытынды емдеуші дәрігердің растауына жатады."
                  : "В экстренных ситуациях звоните 103. Окончательное решение принимает лечащий врач."}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="dialog-footer no-print">
        {pdfError && (
          <div role="alert" style={{ fontSize: "12px", color: "var(--red)", fontWeight: 500 }}>
            {pdfError}
          </div>
        )}
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn">
            {isKz ? "Жабу" : "Закрыть"}
          </button>
          <button
            type="button"
            onClick={async () => {
              setPdfLoading(true);
              setPdfError(null);
              try {
                await downloadReportPdf(patientCode, modalLang, audience, visitKey);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setPdfError(isKz ? `PDF жүктеу қатесі: ${msg}` : `Ошибка выгрузки PDF: ${msg}`);
              } finally {
                setPdfLoading(false);
              }
            }}
            disabled={pdfLoading}
            className="btn btn-teal"
          >
            <Download size={15} aria-hidden="true" />
            <span>
              {pdfLoading
                ? isKz
                  ? "PDF дайындалуда..."
                  : "Подготовка PDF..."
                : isKz
                  ? "PDF есепті жүктеу"
                  : "Скачать отчёт PDF"}
            </span>
          </button>
          <button type="button" onClick={() => window.print()} className="btn btn-primary">
            <Printer size={15} aria-hidden="true" />
            <span>{isKz ? "Басып шығару" : "Печать"}</span>
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
