"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, X, Download, AlertCircle, FileSpreadsheet } from "lucide-react";
import { uploadPatientCSV, getCsvTemplateUrl } from "@/lib/api";
import { CsvUploadResponse } from "@/lib/types";

interface Props {
  open: boolean;
  lang: "ru" | "kz";
  onClose: () => void;
  onSuccess: (res: CsvUploadResponse) => void;
}

export function UploadCsvModal({ open, lang, onClose, onSuccess }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [condition, setCondition] = useState<"Baseline" | "Verbal" | "VR">("Baseline");
  const [subjectCode, setSubjectCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(lang === "kz" ? "Алдымен CSV файлын таңдаңыз." : "Сначала выберите CSV-файл.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const res = await uploadPatientCSV(file, condition, subjectCode);
      setFile(null);
      setSubjectCode("");
      onSuccess(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        lang === "kz"
          ? `Жүктеу қатесі: ${msg}`
          : `Ошибка загрузки: ${msg}`
      );
    } finally {
      setUploading(false);
    }
  };

  const conditions: Array<{ value: "Baseline" | "Verbal" | "VR"; labelRu: string; labelKz: string }> = [
    { value: "Baseline", labelRu: "Обычная (Baseline)", labelKz: "Қалыпты (Baseline)" },
    { value: "Verbal", labelRu: "Голос (Verbal)", labelKz: "Ауызша (Verbal)" },
    { value: "VR", labelRu: "VR-режим", labelKz: "VR-режим" },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="libra-dialog dialog-narrow"
      aria-labelledby="upload-csv-title"
      onCancel={(e) => {
        if (uploading) e.preventDefault();
      }}
      onClose={() => {
        if (!uploading) onClose();
      }}
      onClick={(e) => {
        if (uploading) return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          onClose();
        }
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileSpreadsheet size={18} strokeWidth={1.6} color="var(--amber)" />
          <h1 id="upload-csv-title" style={{ fontSize: "16px", fontWeight: 600 }}>
            {lang === "kz" ? "CSV зерттеу деректерін жүктеу" : "Импорт CSV-данных обследования"}
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={uploading}
          aria-label={lang === "kz" ? "Жабу" : "Закрыть"}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
            {lang === "kz" ? "Зерттеу шарты" : "Условие пробы"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {conditions.map((c) => {
              const active = condition === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className="btn"
                  aria-pressed={active}
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    background: active ? "var(--ink)" : "var(--paper)",
                    color: active ? "var(--white)" : "var(--ink)",
                    borderColor: active ? "var(--ink)" : "var(--line-strong)",
                  }}
                >
                  {lang === "kz" ? c.labelKz : c.labelRu}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="upload-subject-code"
            style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}
          >
            {lang === "kz" ? "Пациент коды (міндетті емес)" : "Идентификатор пациента (необязательно)"}
          </label>
          <input
            id="upload-subject-code"
            type="text"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            placeholder={
              lang === "kz"
                ? "Бос қалдырсаңыз, CSV ішіндегі subject бағаны оқылады"
                : "Если оставить пустым, коды пациентов считываются из столбца subject"
            }
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            {lang === "kz"
              ? "Бір файлда бірнеше пациент болса, жүйе әрқайсысын жеке өңдейді. Дербес деректерге (Аты-жөні, ЖСН) тыйым салынады."
              : "Поддерживаются таблицы с одним или несколькими пациентами (; и запятая). Столбцы с ФИО и ИИН отклоняются (Закон РК № 94-V)."}
          </div>
        </div>

        <div>
          <label
            htmlFor="upload-csv-file"
            style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}
          >
            {lang === "kz" ? "CSV файлы" : "Файл данных (.csv)"}
          </label>
          <input
            id="upload-csv-file"
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError(null);
            }}
            style={{ width: "100%", padding: "8px", background: "var(--paper)" }}
          />
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
            {lang === "kz" ? "Үлгі CSV шаблондарды жүктеу" : "Скачать шаблоны CSV"}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a href={getCsvTemplateUrl("vicon")} download="libra_template_vicon.csv" className="btn" style={{ fontSize: "12px", padding: "6px 10px" }}>
              <Download size={14} />
              <span>Vicon / GRAIL</span>
            </a>
            <a href={getCsvTemplateUrl("imu")} download="libra_template_imu.csv" className="btn" style={{ fontSize: "12px", padding: "6px 10px" }}>
              <Download size={14} />
              <span>{lang === "kz" ? "IMU сенсорлары" : "Датчики IMU"}</span>
            </a>
            <a href={getCsvTemplateUrl("kinematics")} download="libra_template_kinematics.csv" className="btn" style={{ fontSize: "12px", padding: "6px 10px" }}>
              <Download size={14} />
              <span>{lang === "kz" ? "51-нүктелі кинематика" : "51-точечные кривые"}</span>
            </a>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: "var(--red-bg)",
              border: "1px solid var(--red-border)",
              color: "var(--red)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
          <button type="button" onClick={onClose} className="btn" disabled={uploading}>
            {lang === "kz" ? "Болдырмау" : "Отмена"}
          </button>
          <button type="submit" className="btn btn-teal" disabled={uploading || !file}>
            <Upload size={15} />
            <span>
              {uploading
                ? lang === "kz"
                  ? "Өңделуде..."
                  : "Обработка..."
                : lang === "kz"
                ? "Тізілімге жүктеу"
                : "Импортировать"}
            </span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
