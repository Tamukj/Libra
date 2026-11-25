"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  X,
  Download,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Info,
} from "lucide-react";
import { ModalDialog } from "@/components/ModalDialog";
import { uploadPatientCSV, downloadCsvTemplate, getPatientVisits } from "@/lib/api";
import { CsvUploadResponse, GaitCondition, VisitSummary } from "@/lib/types";

interface Props {
  open: boolean;
  lang: "ru" | "kz";
  initialSubjectCode?: string;
  defaultVisitMode?: "new" | "existing";
  initialVisits?: VisitSummary[];
  onClose: () => void;
  onSuccess: (res: CsvUploadResponse) => void;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function visitHasCondition(visit: VisitSummary | undefined, cond: GaitCondition): boolean {
  if (!visit) return false;
  return visit.conditions.some((c) => c.toLowerCase() === cond.toLowerCase());
}

function pickLatestVisit(visits: VisitSummary[]): VisitSummary | undefined {
  return visits.find((v) => v.is_latest) ?? visits[visits.length - 1];
}

async function detectSingleSubjectFromCsv(file: File): Promise<string | null> {
  try {
    const sample = await file.slice(0, 16384).text();
    const lines = sample.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return null;
    const headerLine = lines[0];
    const sep = headerLine.includes(";") ? ";" : ",";
    const headers = headerLine.split(sep).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/_/g, ""));
    const subIdx = headers.findIndex((h) => ["subject", "patientcode", "patientid", "code", "subjectid"].includes(h));
    if (subIdx === -1) return null;
    const found = new Set<string>();
    for (let i = 1; i < Math.min(lines.length, 30); i += 1) {
      const cols = lines[i].split(sep);
      const raw = (cols[subIdx] || "").trim().replace(/^"|"$/g, "");
      if (raw && !["nan", "none", "null"].includes(raw.toLowerCase())) {
        found.add(raw);
        if (found.size > 1) return null;
      }
    }
    return found.size === 1 ? Array.from(found)[0] : null;
  } catch {
    return null;
  }
}

export function UploadCsvModal({
  open,
  lang,
  initialSubjectCode = "",
  defaultVisitMode,
  initialVisits,
  onClose,
  onSuccess,
}: Props) {
  const isKz = lang === "kz";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchSeqRef = useRef(0);

  const [condition, setCondition] = useState<GaitCondition>("Baseline");
  const [subjectCode, setSubjectCode] = useState("");
  const [detectedSubject, setDetectedSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingVisits, setExistingVisits] = useState<VisitSummary[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitMode, setVisitMode] = useState<"new" | "existing">("new");
  const [modeManuallyChosen, setModeManuallyChosen] = useState(false);
  const [selectedVisitKey, setSelectedVisitKey] = useState("");
  const [visitDate, setVisitDate] = useState<string>(getTodayIsoDate);
  const [visitLabel, setVisitLabel] = useState("");

  const applyVisitsResolution = useCallback(
    (
      visits: VisitSummary[],
      activeCond: GaitCondition,
      explicitMode?: "new" | "existing",
      respectManual = false
    ) => {
      setExistingVisits(visits);
      const latest = pickLatestVisit(visits);
      if (latest) {
        setSelectedVisitKey((prev) =>
          visits.some((v) => v.visit_key === prev) ? prev : latest.visit_key
        );
      } else {
        setSelectedVisitKey("");
      }

      if (visits.length === 0) {
        setVisitMode("new");
        return;
      }

      if (respectManual) return;

      if (explicitMode === "new") {
        setVisitMode("new");
      } else if (visitHasCondition(latest, activeCond)) {
        setVisitMode("new");
      } else if (explicitMode === "existing") {
        setVisitMode("existing");
      } else {
        setVisitMode("existing");
      }
    },
    []
  );

  const fetchVisitsForCode = useCallback(
    async (rawCode: string, activeCond: GaitCondition, respectManual: boolean) => {
      const code = rawCode.trim();
      const seq = ++fetchSeqRef.current;
      if (!code) {
        setExistingVisits([]);
        setSelectedVisitKey("");
        setVisitMode("new");
        setVisitsLoading(false);
        return;
      }
      setVisitsLoading(true);
      try {
        const res = await getPatientVisits(code);
        if (seq !== fetchSeqRef.current) return;
        applyVisitsResolution(
          res.visits || [],
          activeCond,
          code === initialSubjectCode.trim() ? defaultVisitMode : undefined,
          respectManual
        );
      } catch {
        if (seq !== fetchSeqRef.current) return;
        setExistingVisits([]);
        setSelectedVisitKey("");
        setVisitMode("new");
      } finally {
        if (seq === fetchSeqRef.current) {
          setVisitsLoading(false);
        }
      }
    },
    [applyVisitsResolution, defaultVisitMode, initialSubjectCode]
  );

  useEffect(() => {
    if (!open) return;
    const trimmed = initialSubjectCode.trim();
    setSubjectCode(trimmed);
    setDetectedSubject("");
    setFile(null);
    setError(null);
    setVisitDate(getTodayIsoDate());
    setVisitLabel("");
    setModeManuallyChosen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (initialVisits && initialVisits.length > 0) {
      applyVisitsResolution(initialVisits, condition, defaultVisitMode, false);
    } else if (trimmed) {
      fetchVisitsForCode(trimmed, condition, false);
    } else {
      setExistingVisits([]);
      setSelectedVisitKey("");
      setVisitMode("new");
    }
    // Intentionally initialize once per modal open / prefill target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSubjectCode, defaultVisitMode, initialVisits]);

  useEffect(() => {
    if (!open) return;
    const trimmed = subjectCode.trim() || detectedSubject.trim();
    if (!trimmed) {
      fetchSeqRef.current += 1;
      setExistingVisits([]);
      setSelectedVisitKey("");
      setVisitMode("new");
      setVisitsLoading(false);
      return;
    }
    if (
      trimmed === initialSubjectCode.trim() &&
      initialVisits &&
      initialVisits.length > 0
    ) {
      applyVisitsResolution(initialVisits, condition, defaultVisitMode, modeManuallyChosen);
      return;
    }
    const timer = setTimeout(() => {
      fetchVisitsForCode(trimmed, condition, modeManuallyChosen);
    }, 320);
    return () => clearTimeout(timer);
  }, [
    open,
    subjectCode,
    detectedSubject,
    condition,
    modeManuallyChosen,
    initialSubjectCode,
    initialVisits,
    defaultVisitMode,
    applyVisitsResolution,
    fetchVisitsForCode,
  ]);

  const handleConditionChange = (nextCond: GaitCondition) => {
    setCondition(nextCond);
    if (!modeManuallyChosen && existingVisits.length > 0) {
      if (defaultVisitMode === "new") {
        setVisitMode("new");
      } else {
        const latest = pickLatestVisit(existingVisits);
        setVisitMode(visitHasCondition(latest, nextCond) ? "new" : "existing");
        if (latest) setSelectedVisitKey(latest.visit_key);
      }
    }
  };

  const handleClose = () => {
    if (!uploading) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(isKz ? "Алдымен CSV файлын таңдаңыз." : "Сначала выберите CSV-файл.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const visitOptions =
        visitMode === "existing" && existingVisits.length > 0 && selectedVisitKey
          ? { visitKey: selectedVisitKey }
          : {
              visitKey: "new",
              visitLabel: visitLabel.trim() || undefined,
              visitDate: visitDate || undefined,
            };

      const res = await uploadPatientCSV(file, condition, subjectCode, visitOptions);
      setFile(null);
      setSubjectCode("");
      setVisitLabel("");
      onSuccess(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(isKz ? `Жүктеу қатесі: ${msg}` : `Ошибка загрузки: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const conditions: Array<{ value: GaitCondition; labelRu: string; labelKz: string }> = [
    { value: "Baseline", labelRu: "Обычная", labelKz: "Қалыпты" },
    { value: "Verbal", labelRu: "Голос", labelKz: "Ауызша" },
    { value: "VR", labelRu: "VR-режим", labelKz: "VR-режим" },
  ];

  const selectedVisitObj = existingVisits.find((v) => v.visit_key === selectedVisitKey);
  const willOverwriteCondition =
    visitMode === "existing" && visitHasCondition(selectedVisitObj, condition);

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      labelledBy="upload-csv-title"
      narrow
      dismissible={!uploading}
    >
      <div className="dialog-header">
        <div className="cluster">
          <FileSpreadsheet size={18} strokeWidth={1.6} color="var(--amber)" aria-hidden="true" />
          <h1 id="upload-csv-title" className="section-title">
            {isKz ? "CSV зерттеу деректерін жүктеу" : "Импорт CSV-данных обследования"}
          </h1>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={handleClose}
          disabled={uploading}
          aria-label={isKz ? "Жабу" : "Закрыть"}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="dialog-body stack-md">
        <div className="stack-xs">
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
            {isKz ? "Зерттеу шарты" : "Условие пробы"}
          </div>
          <div
            className="seg-group"
            role="group"
            aria-label={isKz ? "Зерттеу шарты" : "Условие пробы"}
            style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {conditions.map((c) => (
              <button
                key={c.value}
                type="button"
                className="seg-btn"
                aria-pressed={condition === c.value}
                onClick={() => handleConditionChange(c.value)}
              >
                {isKz ? c.labelKz : c.labelRu}
              </button>
            ))}
          </div>
        </div>

        <div className="stack-xs">
          <label
            htmlFor="upload-subject-code"
            style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}
          >
            {isKz ? "Пациент коды (міндетті емес)" : "Код пациента (необязательно)"}
          </label>
          <input
            id="upload-subject-code"
            type="text"
            value={subjectCode}
            onChange={(e) => {
              setSubjectCode(e.target.value);
              setModeManuallyChosen(false);
            }}
            onBlur={() => {
              if (subjectCode.trim()) {
                fetchVisitsForCode(subjectCode, condition, modeManuallyChosen);
              }
            }}
            placeholder={
              isKz
                ? "Бос қалдырсаңыз, CSV ішіндегі subject бағаны оқылады"
                : "Если оставить пустым, коды считаются из столбца subject"
            }
          />
          <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
            {isKz
              ? "Бір файлда бірнеше пациент болса, әрқайсысы бөлек өңделеді. Дербес деректерге (Аты-жөні, ЖСН) тыйым салынады."
              : "Поддерживаются таблицы с разделителем «;» и «,». Столбцы с ФИО и ИИН отклоняются (Закон РК № 94-V)."}
          </p>
        </div>

        {/* Visit / Session Longitudinal Controls */}
        <div className="panel-inset stack-sm">
          <div className="row-between">
            <div className="cluster" style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
              <Calendar size={14} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
              <span>{isKz ? "Визит және динамика" : "Визит и динамика"}</span>
            </div>
            {visitsLoading && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Тексерілуде..." : "Поиск визитов..."}
              </span>
            )}
          </div>

          {existingVisits.length > 0 && (
            <div
              className="seg-group"
              role="group"
              aria-label={isKz ? "Визит режимі" : "Режим сохранения визита"}
              style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr" }}
            >
              <button
                type="button"
                className="seg-btn"
                aria-pressed={visitMode === "new"}
                onClick={() => {
                  setModeManuallyChosen(true);
                  setVisitMode("new");
                }}
              >
                {isKz ? "Жаңа визит" : "Новый визит"}
              </button>
              <button
                type="button"
                className="seg-btn"
                aria-pressed={visitMode === "existing"}
                onClick={() => {
                  setModeManuallyChosen(true);
                  setVisitMode("existing");
                }}
              >
                {isKz ? "Бар визитқа қосу" : "К текущему визиту"}
              </button>
            </div>
          )}

          {visitMode === "new" || existingVisits.length === 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--sp-3)" }}>
              <div className="stack-xs">
                <label htmlFor="upload-visit-date" style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {isKz ? "Визит күні" : "Дата визита"}
                </label>
                <input
                  id="upload-visit-date"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>
              <div className="stack-xs">
                <label htmlFor="upload-visit-label" style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {isKz ? "Визит атауы (міндетті емес)" : "Название (необязательно)"}
                </label>
                <input
                  id="upload-visit-label"
                  type="text"
                  value={visitLabel}
                  onChange={(e) => setVisitLabel(e.target.value)}
                  placeholder={isKz ? "Қайталау курсы (3 ай)" : "Повторный курс (3 мес)"}
                />
              </div>
            </div>
          ) : (
            <div className="stack-xs">
              <label htmlFor="upload-existing-visit" style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Мақсатты визит" : "Выберите визит пациента"}
              </label>
              <select
                id="upload-existing-visit"
                value={selectedVisitKey}
                onChange={(e) => setSelectedVisitKey(e.target.value)}
              >
                {existingVisits.map((v) => {
                  const label = isKz && v.visit_label_kz ? v.visit_label_kz : v.visit_label;
                  const condsText = v.conditions.length > 0 ? v.conditions.join(" / ") : "—";
                  return (
                    <option key={v.visit_key} value={v.visit_key}>
                      {label} {v.visit_date ? `(${v.visit_date})` : ""} · [{condsText}]
                    </option>
                  );
                })}
              </select>

              <div
                className={`callout ${willOverwriteCondition ? "callout-amber" : "callout-teal"}`}
                style={{ padding: "var(--sp-2) var(--sp-3)", fontSize: "12px", marginTop: "var(--sp-1)" }}
              >
                <Info
                  size={14}
                  color={willOverwriteCondition ? "var(--amber)" : "var(--teal)"}
                  style={{ flexShrink: 0, marginTop: "2px" }}
                  aria-hidden="true"
                />
                <span>
                  {willOverwriteCondition
                    ? isKz
                      ? `Бұл визитта «${condition}» сынамасы бұрыннан бар — жаңа файл оны жаңартады.`
                      : `В этом визите уже есть проба ${condition} — загрузка обновит её.`
                    : isKz
                      ? `Таңдалған визитқа «${condition}» сынамасы қосылады (бұрынғы сынамалар сақталады).`
                      : `Добавит пробу ${condition} к выбранному визиту (существующие пробы сохранятся).`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="stack-xs">
          <label htmlFor="upload-csv-file" style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
            {isKz ? "CSV файлы" : "Файл данных (.csv)"}
          </label>
          <input
            ref={fileInputRef}
            id="upload-csv-file"
            type="file"
            accept=".csv"
            onChange={(e) => {
              const chosen = e.target.files?.[0] || null;
              setFile(chosen);
              setError(null);
              if (!chosen) {
                setDetectedSubject("");
                return;
              }
              if (!subjectCode.trim()) {
                detectSingleSubjectFromCsv(chosen).then((detected) => {
                  setDetectedSubject(detected || "");
                  if (detected) {
                    fetchVisitsForCode(detected, condition, modeManuallyChosen);
                  }
                });
              }
            }}
            style={{
              padding: "var(--sp-2)",
              background: "var(--paper)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--r-md)",
            }}
          />
        </div>

        <div className="panel-inset stack-xs">
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
            {isKz ? "Үлгі CSV шаблондарды жүктеу" : "Скачать шаблоны CSV"}
          </div>
          <div className="cluster">
            {(
              [
                { fmt: "vicon", label: "Vicon / GRAIL" },
                { fmt: "imu", label: isKz ? "IMU сенсорлары" : "Датчики IMU" },
                { fmt: "kinematics", label: isKz ? "51-нүктелі кинематика" : "51-точечные кривые" },
              ] as const
            ).map(({ fmt, label }) => (
              <button
                key={fmt}
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    await downloadCsvTemplate(fmt);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                <Download size={14} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="callout callout-red" role="alert" style={{ padding: "var(--sp-3)" }}>
            <AlertCircle size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
            <span style={{ color: "var(--red)", fontSize: "12px" }}>{error}</span>
          </div>
        )}

        <div className="cluster" style={{ justifyContent: "flex-end", paddingTop: "var(--sp-3)", borderTop: "1px solid var(--line)" }}>
          <button type="button" onClick={handleClose} className="btn" disabled={uploading}>
            {isKz ? "Болдырмау" : "Отмена"}
          </button>
          <button type="submit" className="btn btn-teal" disabled={uploading || !file}>
            <Upload size={15} aria-hidden="true" />
            <span>
              {uploading
                ? isKz
                  ? "Өңделуде..."
                  : "Обработка..."
                : isKz
                  ? "Тізілімге жүктеу"
                  : "Импортировать"}
            </span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
