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
import { uploadPatientCSV, getCsvTemplateUrl, getPatientVisits } from "@/lib/api";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(
        lang === "kz" ? "Алдымен CSV файлын таңдаңыз." : "Сначала выберите CSV-файл."
      );
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
      setError(lang === "kz" ? `Жүктеу қатесі: ${msg}` : `Ошибка загрузки: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const conditions: Array<{ value: GaitCondition; labelRu: string; labelKz: string }> = [
    { value: "Baseline", labelRu: "Обычная (Baseline)", labelKz: "Қалыпты (Baseline)" },
    { value: "Verbal", labelRu: "Голос (Verbal)", labelKz: "Ауызша (Verbal)" },
    { value: "VR", labelRu: "VR-режим", labelKz: "VR-режим" },
  ];

  const selectedVisitObj = existingVisits.find((v) => v.visit_key === selectedVisitKey);
  const willOverwriteCondition =
    visitMode === "existing" && visitHasCondition(selectedVisitObj, condition);

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
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        ) {
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
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            padding: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: "20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
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
                  onClick={() => handleConditionChange(c.value)}
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
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "6px",
            }}
          >
            {lang === "kz" ? "Пациент коды (міндетті емес)" : "Идентификатор пациента (необязательно)"}
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

        {/* Visit / Session Longitudinal Controls */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
              <Calendar size={14} strokeWidth={1.6} color="var(--teal)" />
              <span>{lang === "kz" ? "Визит / Сессия" : "Визит / Сессия"}</span>
            </div>
            {visitsLoading && (
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                {lang === "kz" ? "Тексерілуде..." : "Поиск визитов..."}
              </span>
            )}
          </div>

          {existingVisits.length > 0 && (
            <div
              role="group"
              aria-label={lang === "kz" ? "Визит режимі" : "Режим сохранения визита"}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}
            >
              <button
                type="button"
                aria-pressed={visitMode === "new"}
                onClick={() => {
                  setModeManuallyChosen(true);
                  setVisitMode("new");
                }}
                className="btn"
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  whiteSpace: "normal",
                  lineHeight: 1.25,
                  background: visitMode === "new" ? "var(--ink)" : "var(--white)",
                  color: visitMode === "new" ? "var(--white)" : "var(--ink)",
                  borderColor: visitMode === "new" ? "var(--ink)" : "var(--line-strong)",
                }}
              >
                {lang === "kz"
                  ? "Жаңа визит (бұрынғы CSV сақталады)"
                  : "Новый визит (сохранить прошлые CSV)"}
              </button>
              <button
                type="button"
                aria-pressed={visitMode === "existing"}
                onClick={() => {
                  setModeManuallyChosen(true);
                  setVisitMode("existing");
                }}
                className="btn"
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  whiteSpace: "normal",
                  lineHeight: 1.25,
                  background: visitMode === "existing" ? "var(--ink)" : "var(--white)",
                  color: visitMode === "existing" ? "var(--white)" : "var(--ink)",
                  borderColor: visitMode === "existing" ? "var(--ink)" : "var(--line-strong)",
                }}
              >
                {lang === "kz" ? "Бар визитқа қосу" : "Добавить к существующему визиту"}
              </button>
            </div>
          )}

          {visitMode === "new" || existingVisits.length === 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <div>
                <label
                  htmlFor="upload-visit-date"
                  style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}
                >
                  {lang === "kz" ? "Визит күні" : "Дата визита"}
                </label>
                <input
                  id="upload-visit-date"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label
                  htmlFor="upload-visit-label"
                  style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}
                >
                  {lang === "kz" ? "Визит атауы (міндетті емес)" : "Название визита (необязательно)"}
                </label>
                <input
                  id="upload-visit-label"
                  type="text"
                  value={visitLabel}
                  onChange={(e) => setVisitLabel(e.target.value)}
                  placeholder={
                    lang === "kz" ? "Мысалы: Қайталау курсы (3 ай)" : "Повторный курс (3 мес)"
                  }
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label
                  htmlFor="upload-existing-visit"
                  style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}
                >
                  {lang === "kz" ? "Мақсатты визит" : "Выберите визит пациента"}
                </label>
                <select
                  id="upload-existing-visit"
                  value={selectedVisitKey}
                  onChange={(e) => setSelectedVisitKey(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {existingVisits.map((v) => {
                    const label = lang === "kz" && v.visit_label_kz ? v.visit_label_kz : v.visit_label;
                    const condsText = v.conditions.length > 0 ? v.conditions.join(" / ") : "—";
                    return (
                      <option key={v.visit_key} value={v.visit_key}>
                        {label} {v.visit_date ? `(${v.visit_date})` : ""} · [{condsText}]
                      </option>
                    );
                  })}
                </select>
              </div>
              <div
                style={{
                  fontSize: "11.5px",
                  lineHeight: 1.45,
                  padding: "8px 10px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  background: willOverwriteCondition ? "var(--amber-bg)" : "var(--teal-bg)",
                  border: `1px solid ${willOverwriteCondition ? "var(--amber-border)" : "var(--teal-border)"}`,
                  color: willOverwriteCondition ? "var(--amber)" : "var(--teal)",
                }}
              >
                <Info size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>
                  {willOverwriteCondition
                    ? lang === "kz"
                      ? `Бұл визитта «${condition}» сынамасы бұрыннан бар — жаңа файл оны жаңартады.`
                      : `В этом визите уже есть проба ${condition} — загрузка обновит её.`
                    : lang === "kz"
                    ? `Таңдалған визитқа «${condition}» сынамасы қосылады (бұрынғы сынамалар сақталады).`
                    : `Добавит пробу ${condition} к выбранному визиту (существующие пробы сохранятся).`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="upload-csv-file"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "6px",
            }}
          >
            {lang === "kz" ? "CSV файлы" : "Файл данных (.csv)"}
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
            <a
              href={getCsvTemplateUrl("vicon")}
              download="libra_template_vicon.csv"
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
            >
              <Download size={14} />
              <span>Vicon / GRAIL</span>
            </a>
            <a
              href={getCsvTemplateUrl("imu")}
              download="libra_template_imu.csv"
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
            >
              <Download size={14} />
              <span>{lang === "kz" ? "IMU сенсорлары" : "Датчики IMU"}</span>
            </a>
            <a
              href={getCsvTemplateUrl("kinematics")}
              download="libra_template_kinematics.csv"
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
            >
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

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            paddingTop: "12px",
            borderTop: "1px solid var(--line)",
          }}
        >
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
