"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Upload,
  BrainCircuit,
  Activity,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { getPatientAnalysis, getPatientKinematics } from "@/lib/api";
import type {
  DiscreteSummary,
  KinematicsResponse,
  PatientAnalysis,
  VisitSummary,
} from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { cleanClinicalText, fmtCm, fmtFixed, fmtPercent, fmtSigned, isFiniteNum } from "@/lib/format";
import { CdssTrafficLight } from "@/components/CdssTrafficLight";
import { MethodVerdict } from "@/components/MethodVerdict";
import { KinematicsChart } from "@/components/KinematicsChart";
import { RadarGvs } from "@/components/RadarGvs";
import { GaitDiffViewer } from "@/components/GaitDiffViewer";
import { ReportModal } from "@/components/ReportModal";

const DRIVER_LABELS: Record<string, { ru: string; kz: string }> = {
  GPS_a: {
    ru: "Общий индекс походки (GPS)",
    kz: "Жалпы жүріс индексі (GPS)",
  },
  baseline_gps: {
    ru: "Базовый индекс походки (GPS)",
    kz: "Бастапқы жүріс индексі (GPS)",
  },
  GVS_aSagP: {
    ru: "Отклонение таза (GVS)",
    kz: "Жамбас ауытқуы (GVS)",
  },
  baseline_gvs_pelvis: {
    ru: "Отклонение таза (GVS)",
    kz: "Жамбас ауытқуы (GVS)",
  },
  GVS_aSagH: {
    ru: "Отклонение бедра (GVS)",
    kz: "Сан ауытқуы (GVS)",
  },
  baseline_gvs_hip: {
    ru: "Отклонение бедра (GVS)",
    kz: "Сан ауытқуы (GVS)",
  },
  GVS_aSagK: {
    ru: "Отклонение колена (GVS)",
    kz: "Тізе ауытқуы (GVS)",
  },
  baseline_gvs_knee: {
    ru: "Отклонение колена (GVS)",
    kz: "Тізе ауытқуы (GVS)",
  },
  GVS_aSagA: {
    ru: "Отклонение стопы (GVS)",
    kz: "Тобық ауытқуы (GVS)",
  },
  baseline_gvs_ankle: {
    ru: "Отклонение стопы (GVS)",
    kz: "Тобық ауытқуы (GVS)",
  },
  aMinSagH: {
    ru: "Мин. сгибание бедра в опоре",
    kz: "Тіреудегі санның мин. бүгілуі",
  },
  baseline_amin_sagh: {
    ru: "Мин. сгибание бедра в опоре",
    kz: "Тіреудегі санның мин. бүгілуі",
  },
  pelvis_mean: {
    ru: "Средний наклон таза",
    kz: "Жамбастың орташа еңкеюі",
  },
  baseline_pelvis_tilt: {
    ru: "Средний наклон таза",
    kz: "Жамбастың орташа еңкеюі",
  },
  hip_rom: {
    ru: "Амплитуда сгибания бедра",
    kz: "Сан буынының қозғалыс амплитудасы",
  },
  baseline_hip_rom: {
    ru: "Амплитуда сгибания бедра",
    kz: "Сан буынының қозғалыс амплитудасы",
  },
  weight: {
    ru: "Масса тела (кг)",
    kz: "Дене салмағы (кг)",
  },
  height: {
    ru: "Рост пациента",
    kz: "Пациент бойы",
  },
  LegLength: {
    ru: "Длина нижней конечности",
    kz: "Аяқ ұзындығы",
  },
};

function shortConditionLabel(cond: string, isKz: boolean): string {
  const c = cond.toLowerCase();
  if (c === "baseline") return isKz ? "Қал." : "База";
  if (c === "verbal") return isKz ? "Ауыз." : "Голос";
  if (c === "vr") return "VR";
  return cond;
}

function buildJointRows(summary: DiscreteSummary, isKz: boolean) {
  return [
    {
      segment: isKz ? "Таз (еңкеюі, GVS)" : "Таз (откл. GVS)",
      base: summary.baseline_gvs_pelvis,
      verbal: summary.verbal_gvs_pelvis,
      vr: summary.vr_gvs_pelvis,
      delta: summary.delta_gvs_pelvis,
      unit: "°",
      digits: 1,
      lowerBetter: true,
    },
    {
      segment: isKz ? "Сан буыны (GVS)" : "Бедро (откл. GVS)",
      base: summary.baseline_gvs_hip,
      verbal: summary.verbal_gvs_hip,
      vr: summary.vr_gvs_hip,
      delta: summary.delta_gvs_hip,
      unit: "°",
      digits: 1,
      lowerBetter: true,
    },
    {
      segment: isKz ? "Сан мин. бүгілуі" : "Мин. сгибание бедра",
      base: summary.baseline_amin_sagh,
      verbal: summary.verbal_amin_sagh,
      vr: summary.vr_amin_sagh,
      delta: summary.delta_amin_sagh,
      unit: "°",
      digits: 1,
      lowerBetter: true,
    },
    {
      segment: isKz ? "Тізе буыны (GVS)" : "Колено (откл. GVS)",
      base: summary.baseline_gvs_knee,
      verbal: summary.verbal_gvs_knee,
      vr: summary.vr_gvs_knee,
      delta: summary.delta_gvs_knee,
      unit: "°",
      digits: 1,
      lowerBetter: true,
    },
    {
      segment: isKz ? "Тобық (GVS)" : "Стопа (откл. GVS)",
      base: summary.baseline_gvs_ankle,
      verbal: summary.verbal_gvs_ankle,
      vr: summary.vr_gvs_ankle,
      delta: summary.delta_gvs_ankle,
      unit: "°",
      digits: 1,
      lowerBetter: true,
    },
    {
      segment: isKz ? "Жалпы индекс (GPS)" : "Общий индекс (GPS)",
      base: summary.baseline_gps,
      verbal: summary.verbal_gps,
      vr: summary.vr_gps,
      delta: summary.delta_gps,
      unit: "°",
      digits: 2,
      lowerBetter: true,
    },
    ...(isFiniteNum(summary.baseline_gdi) || isFiniteNum(summary.vr_gdi)
      ? [
          {
            segment: isKz ? "Гармония индексі (GDI)" : "Индекс гармонии (GDI)",
            base: summary.baseline_gdi,
            verbal: summary.verbal_gdi,
            vr: summary.vr_gdi,
            delta: summary.delta_gdi,
            unit: "",
            digits: 1,
            lowerBetter: false,
          },
        ]
      : []),
  ];
}

function PcaCycleChart({
  cycles,
  isKz,
}: {
  cycles: Array<{
    cycle_index: number;
    spe: number;
    threshold: number;
    is_anomaly: boolean;
  }>;
  isKz: boolean;
}) {
  const width = 420;
  const height = 148;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxSpe = Math.max(...cycles.map((c) => c.spe), cycles[0]?.threshold ?? 1, 0.01) * 1.15;
  const thr = cycles[0]?.threshold ?? 0;
  const thrY = padT + plotH - (Math.min(thr, maxSpe) / maxSpe) * plotH;
  const barStep = plotW / Math.max(1, cycles.length);
  const barW = Math.max(4, Math.min(26, barStep * 0.68));

  return (
    <figure style={{ margin: 0 }} className="stack-xs">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={
          isKz
            ? "Қадам циклдері бойынша PCA ауытқу бағанының графигі"
            : "График отклонений циклов шага по модели PCA"
        }
      >
        <line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke="var(--line-strong)" />

        {thr > 0 && (
          <>
            <line
              x1={padL}
              y1={thrY}
              x2={width - padR}
              y2={thrY}
              stroke="var(--amber)"
              strokeDasharray="4 4"
              strokeWidth={1.3}
            />
            <text
              x={width - padR}
              y={Math.max(11, thrY - 4)}
              textAnchor="end"
              fontSize="10"
              fill="var(--amber)"
              fontWeight={600}
            >
              95%
            </text>
          </>
        )}

        {cycles.map((c, idx) => {
          const h = Math.max(3, (c.spe / maxSpe) * plotH);
          const x = padL + idx * barStep + (barStep - barW) / 2;
          const y = padT + plotH - h;
          return (
            <g key={c.cycle_index}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={c.is_anomaly ? "var(--amber)" : "var(--teal)"}
                opacity={c.is_anomaly ? 0.92 : 0.78}
              >
                <title>
                  {isKz ? `Цикл #${c.cycle_index + 1}` : `Цикл #${c.cycle_index + 1}`}: {c.spe.toFixed(2)} (порог {c.threshold.toFixed(2)})
                </title>
              </rect>
              {cycles.length <= 16 && (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {c.cycle_index + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption style={{ fontSize: "12px", color: "var(--muted)", display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
        <span>● <span style={{ color: "var(--teal)", fontWeight: 500 }}>{isKz ? "Тұрақты цикл" : "Стабильный цикл"}</span></span>
        <span>● <span style={{ color: "var(--amber)", fontWeight: 500 }}>{isKz ? "Шектен тыс (95% шегі)" : "Выход за порог 95%"}</span></span>
      </figcaption>
    </figure>
  );
}

function PatientDossierContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  const patientCode = decodeURIComponent(String(params?.id || "s61520_1"));
  const visitParam = searchParams?.get("visit") || undefined;

  const [analysis, setAnalysis] = useState<PatientAnalysis | null>(null);
  const [kinematics, setKinematics] = useState<KinematicsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const loadPatient = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ana, kin] = await Promise.all([
        getPatientAnalysis(patientCode, visitParam),
        getPatientKinematics(patientCode, visitParam),
      ]);
      setAnalysis(ana);
      setKinematics(kin);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isKz
            ? "Пациент деректерін жүктеу мүмкін болмады"
            : "Не удалось загрузить карту пациента"
      );
    } finally {
      setLoading(false);
    }
  }, [patientCode, visitParam, isKz]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  useEffect(() => {
    const onUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ code?: string } | undefined>).detail;
      if (!detail?.code || detail.code === patientCode) {
        loadPatient();
      }
    };
    window.addEventListener("libra:patient-updated", onUpdated);
    return () => window.removeEventListener("libra:patient-updated", onUpdated);
  }, [patientCode, loadPatient]);

  if (loading) {
    return (
      <div className="surface" style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--muted)" }}>
        {isKz ? `${patientCode} картасы жүктелуде...` : `Загружаем карту пациента ${patientCode}...`}
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="stack-md">
        <Link
          href="/portal"
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "13px", color: "var(--muted)" }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t.back_to_registry}
        </Link>
        <div className="callout callout-red" role="alert">
          <div style={{ color: "var(--red)", fontSize: "13px" }}>
            <strong>{isKz ? "Қате:" : "Ошибка:"}</strong> {error || (isKz ? "Пациент табылмады" : "Пациент не найден")}
          </div>
        </div>
      </div>
    );
  }

  const { summary, visits = [], ml } = analysis;
  const activeVisitKey = analysis.active_visit?.visit_key || summary.visit_key;

  const sideLabel =
    summary.side === "LEFT"
      ? t.side_left
      : summary.side === "RIGHT"
        ? t.side_right
        : t.side_unspecified;

  const totalBase = summary.baseline_cycles ?? summary.cycles_baseline ?? 0;
  const totalVerbal = summary.verbal_cycles ?? summary.cycles_verbal ?? 0;
  const totalVr = summary.vr_cycles ?? summary.cycles_vr ?? 0;
  const jointRows = buildJointRows(summary, isKz);

  const openAddVisit = (mode: "new" | "existing") => {
    window.dispatchEvent(
      new CustomEvent("libra:open-upload", {
        detail: {
          subjectCode: patientCode,
          defaultVisitMode: mode,
          visits,
        },
      })
    );
  };

  return (
    <div className="stack-lg">
      {/* Header & Controls */}
      <header className="stack-md">
        <Link
          href="/portal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            fontSize: "13px",
            color: "var(--muted)",
            alignSelf: "flex-start",
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} aria-hidden="true" />
          {t.back_to_registry}
        </Link>

        <div className="row-end">
          <div className="stack-xs">
            <div className="cluster">
              <h1 className="page-title">{t.patient_dossier_title} {patientCode}</h1>
              <span className="badge badge-neutral">
                {sideLabel}
                {summary.side_estimated ? (isKz ? " · болжамды" : " · по походке") : ""}
              </span>
            </div>

            <div className="cluster" style={{ fontSize: "13px", color: "var(--secondary)", gap: "var(--sp-4)" }}>
              <span>
                {t.weight}: <strong className="tabular-nums">{fmtFixed(summary.weight, 1, " кг")}</strong>
              </span>
              <span>
                {t.height}: <strong className="tabular-nums">{fmtCm(summary.height)}</strong>
              </span>
              <span>
                {t.leg_length}: <strong className="tabular-nums">{fmtCm(summary.leg_length)}</strong>
              </span>
              {summary.anthropometry_estimated && (
                <span className="badge badge-yellow">
                  {isKz ? "Антропометрия бағдарлы (CSV-де жоқ)" : "Антропометрия ориентировочная (нет в CSV)"}
                </span>
              )}
            </div>

            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {t.cycles_recorded}:{" "}
              <span className="tabular-nums" style={{ color: "var(--ink)", fontWeight: 500 }}>
                {isKz ? "Қалыпты" : "База"} {totalBase} · {isKz ? "Ауызша" : "Голос"} {totalVerbal} · VR {totalVr}
              </span>
            </div>
          </div>

          <div className="cluster">
            <button
              type="button"
              onClick={() => openAddVisit("new")}
              className="btn"
            >
              <Upload size={15} aria-hidden="true" />
              <span>{isKz ? "Визит қосу (CSV)" : "Добавить визит"}</span>
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="btn btn-teal"
            >
              <FileText size={15} aria-hidden="true" />
              <span>{t.btn_clinical_protocol}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Longitudinal Visits Selector (wraps cleanly on 375px mobile) */}
      {visits.length > 0 && (
        <section className="surface-compact stack-sm" aria-label={isKz ? "Визиттер тарихы" : "История визитов"}>
          <div className="row-between">
            <div className="cluster" style={{ fontSize: "12px", fontWeight: 600, color: "var(--secondary)" }}>
              <Calendar size={14} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
              <span>
                {isKz ? "Қарау визиті" : "Визиты наблюдения"} ({visits.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => openAddVisit("existing")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--teal)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isKz ? "+ Осы визитқа сынама қосу" : "+ Дополнить визит"}
            </button>
          </div>

          <div className="visit-list" role="group" aria-label={isKz ? "Визит таңдау" : "Выбор визита"}>
            {visits.map((v: VisitSummary) => {
              const isSelected = activeVisitKey === v.visit_key;
              const label = isKz ? v.visit_label_kz || v.visit_label : v.visit_label;
              const condText = v.conditions.map((c) => shortConditionLabel(c, isKz)).join(" · ");
              const dotColor =
                v.status === "green"
                  ? isSelected ? "#5eead4" : "var(--teal)"
                  : v.status === "yellow"
                    ? isSelected ? "#fcd34d" : "var(--amber)"
                    : v.status === "red"
                      ? isSelected ? "#fca5a5" : "var(--red)"
                      : "var(--muted)";
              return (
                <button
                  key={v.visit_key}
                  type="button"
                  className="visit-chip"
                  aria-pressed={isSelected}
                  onClick={() =>
                    router.push(
                      `/portal/patients/${encodeURIComponent(patientCode)}?visit=${encodeURIComponent(v.visit_key)}`
                    )
                  }
                >
                  <span style={{ color: dotColor, fontSize: "10px" }} aria-hidden="true">●</span>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  {v.visit_date && (
                    <span className="tabular-nums" style={{ opacity: 0.78 }}>
                      {v.visit_date}
                    </span>
                  )}
                  {condText && (
                    <span style={{ opacity: 0.78 }}>· {condText}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 1. Primary CDSS Decision Card */}
      <CdssTrafficLight analysis={analysis} lang={lang} />

      {/* 2. Three-way Method Verdict */}
      <MethodVerdict modalities={analysis.modalities} summary={summary} lang={lang} />

      {/* 3. Gait Profile Score Radar + Joint Metrics Table */}
      <div className="grid-split-gvs">
        <RadarGvs summary={summary} lang={lang} />

        <section className="surface-flush" aria-labelledby="joint-table-title">
          <div style={{ padding: "var(--sp-4) var(--sp-5)", borderBottom: "1px solid var(--line)" }}>
            <h2 id="joint-table-title" className="section-title">
              {isKz ? "Буындар бойынша сандық көрсеткіштер" : "Количественные параметры по сегментам"}
            </h2>
            <p className="section-subtitle">
              {isKz
                ? "Қалыпты жүріс, ауызша нұсқау және VR кезіндегі бұрыштар"
                : "Отклонение от возрастной нормы (GVS/GPS) и сгибание бедра в опоре"}
            </p>
          </div>
          <div tabIndex={0} role="region" aria-labelledby="joint-table-title" className="table-responsive">
            <table className="clinical-table">
              <caption className="visually-hidden">
                {isKz
                  ? "Буын сегменттері бойынша қалыпты, ауызша және VR мәндері"
                  : "Показатели по сегментам в обычной ходьбе, при голосовых командах и VR"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{isKz ? "Сегмент" : "Сегмент"}</th>
                  <th scope="col" style={{ textAlign: "right" }}>{isKz ? "Қалыпты" : "Обычная"}</th>
                  <th scope="col" style={{ textAlign: "right" }}>{isKz ? "Ауызша" : "Голос"}</th>
                  <th scope="col" style={{ textAlign: "right" }}>VR</th>
                  <th scope="col" style={{ textAlign: "right" }}>{isKz ? "Δ (VR − База)" : "Δ (VR − База)"}</th>
                </tr>
              </thead>
              <tbody>
                {jointRows.map((row) => {
                  const hasDelta = isFiniteNum(row.delta);
                  const improved =
                    hasDelta &&
                    (row.lowerBetter ? row.delta! < -0.2 : row.delta! > 0.5);
                  const worsened =
                    hasDelta &&
                    (row.lowerBetter ? row.delta! > 1.0 : row.delta! < -2.0);

                  return (
                    <tr key={row.segment}>
                      <td style={{ fontWeight: 500 }}>{row.segment}</td>
                      <td className="tabular-nums mono" style={{ textAlign: "right", color: "var(--secondary)" }}>
                        {fmtFixed(row.base, row.digits, row.unit)}
                      </td>
                      <td className="tabular-nums mono" style={{ textAlign: "right", color: "var(--secondary)" }}>
                        {fmtFixed(row.verbal, row.digits, row.unit)}
                      </td>
                      <td className="tabular-nums mono" style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmtFixed(row.vr, row.digits, row.unit)}
                      </td>
                      <td
                        className="tabular-nums mono"
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          color: improved ? "var(--teal)" : worsened ? "var(--amber)" : "var(--ink)",
                        }}
                      >
                        {fmtSigned(row.delta, row.digits, row.unit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 4. Kinematics Waveforms */}
      {kinematics && (
        <div className="stack-sm">
          {kinematics.is_surrogate && (
            <div className="callout callout-amber" style={{ padding: "var(--sp-3) var(--sp-4)", fontSize: "12px" }}>
              <ShieldAlert size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
              <span>
                {isKz
                  ? "Назар аударыңыз: бұл жүктелген файлда 51-нүктелі қисықтар жоқ, график дискретті мәндер бойынша қалпына келтірілді."
                  : "В этом файле отсутствуют полные 51-точечные кривые; профиль реконструирован по дискретным углам."}
              </span>
            </div>
          )}
          <KinematicsChart data={kinematics} summary={summary} lang={lang} />
        </div>
      )}

      {/* 5. Gait Diff (Within visit & Across visits) */}
      <GaitDiffViewer
        patientCode={patientCode}
        visits={visits}
        activeVisitKey={activeVisitKey}
      />

      {/* 6. Predictive Models & PCA Stability */}
      <section className="stack-md" aria-labelledby="ai-diagnostics-heading">
        <div className="cluster">
          <BrainCircuit size={18} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
          <h2 id="ai-diagnostics-heading" className="section-title">
            {isKz
              ? "Болжамдық модельдер және цикл тұрақтылығы"
              : "Прогностическая аналитика и стабильность шага"}
          </h2>
        </div>

        <div className="grid-2">
          {/* Left: Pattern discrimination + Responder forecast */}
          <div className="stack-md">
            <section className="surface stack-sm">
              <div className="row-between">
                <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                  {isKz ? "Жүріс режимін жіктеу" : "Классификация режима шага"}
                </h3>
                {isFiniteNum(ml.vr_gait_signature_confidence) && (
                  <span className={`badge ${ml.is_vr_discriminative ? "badge-green" : "badge-neutral"}`}>
                    {fmtPercent(ml.vr_gait_signature_confidence, true, 0)}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                {isFiniteNum(ml.vr_gait_signature_confidence)
                  ? ml.is_vr_discriminative
                    ? isKz
                      ? `Белсенді режим (${ml.active_condition_evaluated || "VR"}) қалыпты жүрістен айқын ерекшеленеді.`
                      : `Двигательный паттерн в режиме ${ml.active_condition_evaluated || "VR"} достоверно отличается от обычной ходьбы.`
                    : isKz
                      ? "Қалыпты жүріс пен жаттығу режимі арасында айқын кинематикалық айырмашылық анықталмады."
                      : "Явного кинематического сдвига относительно обычной ходьбы модель не зафиксировала."
                  : isKz
                    ? "Салыстыру үшін екі сессия дерегі жеткіліксіз."
                    : "Для классификации требуются данные минимум по двум режимам."}
              </p>
              {isFiniteNum(ml.binary_roc_auc) && (
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {isKz ? "Тексеру сапасы (ROC-AUC):" : "Качество классификации (ROC-AUC):"}{" "}
                  <strong className="tabular-nums">{fmtPercent(ml.binary_roc_auc, true, 1)}</strong>
                </div>
              )}
            </section>

            {ml.responder_prediction && (
              <section className="surface stack-md">
                <div className="row-between">
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                      {isKz ? "VR-терапияға жауап болжамы (ЖИ)" : "Прогноз ответа на VR-терапию"}
                    </h3>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      {isKz
                        ? ml.responder_prediction.clinical_status_kz
                        : ml.responder_prediction.clinical_status_ru}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      ml.responder_prediction.is_predicted_responder ? "badge-green" : "badge-yellow"
                    }`}
                  >
                    {fmtPercent(ml.responder_prediction.responder_probability, true, 0)}
                  </span>
                </div>

                {ml.responder_prediction.model_reliable === false && (
                  <div className="callout callout-amber" style={{ padding: "var(--sp-3)", fontSize: "12px" }}>
                    <HelpCircle size={14} color="var(--amber)" style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
                    <span>
                      {isKz
                        ? "Болжам шағын когортада (N=29) есептелген — клиникалық бағдар ретінде ғана пайдаланыңыз."
                        : "Модель откалибрована на когорте N=29 — используйте оценку как ориентир вместе с осмотром."}
                    </span>
                  </div>
                )}

                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {cleanClinicalText(
                    isKz
                      ? ml.responder_prediction.recommendation_kz
                      : ml.responder_prediction.recommendation_ru
                  )}
                </p>

                {ml.responder_prediction.feature_attributions &&
                  ml.responder_prediction.feature_attributions.length > 0 && (
                    <div className="stack-xs" style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--sp-3)" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                        {isKz ? "Шешімге әсер еткен факторлар:" : "Ключевые факторы прогноза:"}
                      </div>
                      <div className="stack-xs">
                        {ml.responder_prediction.feature_attributions.slice(0, 5).map((attr) => {
                          const label = DRIVER_LABELS[attr.feature]?.[isKz ? "kz" : "ru"] || attr.feature;
                          const isPositive = attr.direction === "fosters_responder";
                          return (
                            <div key={attr.feature} className="kv-row" style={{ fontSize: "12px" }}>
                              <span style={{ color: "var(--secondary)" }}>{label}</span>
                              <span
                                className="tabular-nums"
                                style={{
                                  fontWeight: 500,
                                  color: isPositive ? "var(--teal)" : "var(--amber)",
                                }}
                              >
                                {isPositive
                                  ? isKz ? "Жауапқа ықпал етеді" : "Способствует отклику"
                                  : isKz ? "Тәуекел факторы" : "Фактор риска"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </section>
            )}
          </div>

          {/* Right: PCA Cycle Stability */}
          <section className="surface stack-md">
            <div className="row-between">
              <div className="cluster">
                <Activity size={17} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
                <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                  {isKz ? "Қадам циклдерінің тұрақтылығы" : "Стабильность циклов шага (PCA)"}
                </h3>
              </div>
              {ml.pca_stability && isFiniteNum(ml.pca_stability.anomaly_rate) && (
                <span className={`badge ${ml.pca_stability.is_stable ? "badge-green" : "badge-yellow"}`}>
                  {ml.pca_stability.n_anomalies} / {ml.pca_stability.n_cycles}{" "}
                  {isKz ? "ауытқу" : "нестабильных"}
                </span>
              )}
            </div>

            {ml.pca_stability &&
            ml.pca_stability.has_curves !== false &&
            ml.pca_stability.cycles &&
            ml.pca_stability.cycles.length > 0 ? (
              <div className="stack-md">
                <PcaCycleChart cycles={ml.pca_stability.cycles} isKz={isKz} />
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {ml.pca_stability.is_stable
                    ? isKz
                      ? "Пациенттің жүріс циклдері тұрақты — кенет сүріну немесе компенсациялық бұзылыстар сирек кездеседі."
                      : "Циклы шага воспроизводимы и стабильны — случайные сбои стереотипа минимальны."
                    : isKz
                      ? "Қадам циклдері арасында ауытқу үлесі жоғары, бұл шаршауды немесе тұрақсыздықты көрсетуі мүмкін."
                      : "Повышенная вариабельность от шага к шагу — возможна утомляемость или поиск компенсаторной опоры."}
                </p>
              </div>
            ) : (
              <div className="panel-inset" style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.55 }}>
                {isKz
                  ? "Циклдер тұрақтылығын талдау үшін 51-нүктелі кинематикалық қисықтар қажет."
                  : "Для пошагового анализа стабильности требуются 51-точечные кривые цикла шага."}
              </div>
            )}
          </section>
        </div>
      </section>

      <ReportModal
        open={reportOpen}
        patientCode={patientCode}
        visitKey={activeVisitKey}
        lang={lang}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

export default function PatientDetailPage() {
  return (
    <Suspense fallback={<div className="surface" style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--muted)" }}>Loading...</div>}>
      <PatientDossierContent />
    </Suspense>
  );
}
