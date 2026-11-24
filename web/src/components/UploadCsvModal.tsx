"use client";

import React, { useState, useEffect } from "react";
import { Upload, X, Download, AlertCircle, FileSpreadsheet } from "lucide-react";
import { uploadPatientCSV, getCsvTemplateUrl } from "@/lib/api";
import { CsvUploadResponse } from "@/lib/types";

interface Props {
  lang: "ru" | "kz" | "en";
  onClose: () => void;
  onSuccess: (res: CsvUploadResponse) => void;
}

export function UploadCsvModal({ lang, onClose, onSuccess }: Props) {
  const [condition, setCondition] = useState<"Baseline" | "Verbal" | "VR">("Baseline");
  const [subjectCode, setSubjectCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, uploading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(lang === "kz" ? "Алдымен CSV файлын таңдаңыз." : "Сначала выберите CSV файл.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const res = await uploadPatientCSV(file, condition, subjectCode);
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
    { value: "Baseline", labelRu: "Baseline (Базовая)", labelKz: "Baseline (Базалық)" },
    { value: "Verbal", labelRu: "Verbal (Голос)", labelKz: "Verbal (Дауыс)" },
    { value: "VR", labelRu: "VR (Аватар)", labelKz: "VR (Аватар)" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(39, 36, 31, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-csv-title"
        style={{
          maxWidth: "540px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--white)",
          boxShadow: "0 8px 24px rgba(28, 25, 23, 0.14)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileSpreadsheet size={20} color="var(--amber)" />
            <h2 id="upload-csv-title" style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
              {lang === "kz" ? "CSV сессиясын жүктеу" : "Загрузка CSV сессии"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label={lang === "kz" ? "Жабу" : "Закрыть"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Condition selector */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "6px",
              }}
            >
              {lang === "kz" ? "Зерттеу шарты (Condition)" : "Условие сессии (Condition)"}
            </label>
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
                      padding: "8px 10px",
                      fontSize: "12px",
                      background: active ? "var(--ink)" : "var(--paper)",
                      color: active ? "var(--white)" : "var(--ink)",
                      borderColor: active ? "var(--ink)" : "var(--line)",
                    }}
                  >
                    {lang === "kz" ? c.labelKz : c.labelRu}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional patient code */}
          <div>
            <label
              htmlFor="upload-subject-code"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "6px",
              }}
            >
              {lang === "kz" ? "Пациент коды (міндетті емес)" : "Код пациента (необязательно)"}
            </label>
            <input
              id="upload-subject-code"
              type="text"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder={
                lang === "kz"
                  ? "Мысалы: s61520_30 (бос қалдырсаңыз CSV/файл атынан оқылады)"
                  : "Например: s61520_30 (пусто — возьмётся из CSV или имени файла)"
              }
              style={{ width: "100%" }}
            />
          </div>

          {/* File input */}
          <div>
            <label
              htmlFor="upload-csv-file"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "6px",
              }}
            >
              {lang === "kz" ? "CSV файлы (.csv)" : "Файл данных (.csv)"}
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

          {/* Sample templates */}
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
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
              {lang === "kz" ? "Үлгі CSV шаблондарды жүктеп алу:" : "Скачать образцы CSV-шаблонов:"}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <a
                href={getCsvTemplateUrl("vicon")}
                download="libra_template_vicon.csv"
                className="btn"
                style={{ fontSize: "12px", padding: "6px 10px" }}
              >
                <Download size={14} />
                <span>Vicon/GRAIL CSV</span>
              </a>
              <a
                href={getCsvTemplateUrl("imu")}
                download="libra_template_imu.csv"
                className="btn"
                style={{ fontSize: "12px", padding: "6px 10px" }}
              >
                <Download size={14} />
                <span>
                  {lang === "kz"
                    ? "IMU / Поза камерасы (жеңілдетілген)"
                    : "IMU / Камера позы (упрощённый формат)"}
                </span>
              </a>
              <a
                href={getCsvTemplateUrl("kinematics")}
                download="libra_template_kinematics.csv"
                className="btn"
                style={{ fontSize: "12px", padding: "6px 10px" }}
              >
                <Download size={14} />
                <span>
                  {lang === "kz"
                    ? "51-нүктелі кинематика (толық қисықтар)"
                    : "51-точечная кинематика (кривые цикла)"}
                </span>
              </a>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              style={{
                background: "var(--red-bg)",
                border: "1px solid var(--red-border)",
                color: "var(--red)",
                borderRadius: "6px",
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

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              paddingTop: "8px",
              borderTop: "1px solid var(--line)",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={onClose} className="btn" disabled={uploading}>
              {lang === "kz" ? "Болдырмау" : "Отмена"}
            </button>
            <button type="submit" className="btn btn-amber" disabled={uploading || !file}>
              <Upload size={15} />
              <span>
                {uploading
                  ? lang === "kz"
                    ? "Жүктелуде..."
                    : "Загрузка..."
                  : lang === "kz"
                  ? "Тізілімге жүктеу"
                  : "Загрузить в реестр"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
