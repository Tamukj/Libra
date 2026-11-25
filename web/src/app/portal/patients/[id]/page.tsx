"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, RotateCcw, Info, Calendar, Plus } from "lucide-react";
import { getPatientAnalysis, getPatientKinematics, getPatients } from "@/lib/api";
import { Patient, PatientAnalysis, KinematicsResponse, VisitSummary } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { CdssTrafficLight } from "@/components/CdssTrafficLight";
import { MethodVerdict } from "@/components/MethodVerdict";
import { KinematicsChart } from "@/components/KinematicsChart";
import { RadarGvs } from "@/components/RadarGvs";
import { GaitDiffViewer } from "@/components/GaitDiffViewer";
import { ReportModal } from "@/components/ReportModal";

const DRIVER_LABELS: Record<string, { ru: string; kz: string }> = {
  baseline_pelvis_tilt: { ru: "Исходный наклон таза", kz: "Бастапқы жамбас еңкеюі" },
  baseline_gvs_pelvis: { ru: "Отклонение профиля таза (GVS)", kz: "Жамбас профилінің ауытқуы (GVS)" },
  baseline_gvs_knee: { ru: "Отклонение коленного сустава (GVS)", kz: "Тізе буынының ауытқуы (GVS)" },
  baseline_amin_sagh: { ru: "Дефицит разгибания бедра", kz: "Сан жазылуының тапшылығы" },
  baseline_gps: { ru: "Исходный индекс походки (GPS)", kz: "Бастапқы жүріс индексі (GPS)" },
  baseline_gdi: { ru: "Индекс отклонения походки (GDI)", kz: "Жүріс ауытқу индексі (GDI)" },
  baseline_pctm_zero: { ru: "Время сгибания бедра > 0°", kz: "Сан бүгілу уақыты > 0°" },
  leg_length: { ru: "Длина нижней конечности", kz: "Аяқ ұзындығы" },
};

function isFiniteNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fmtSigned(value: number | null | undefined, digits = 2, unit = "°"): string {
  if (!isFiniteNum(value)) return "—";
  if (Math.abs(value) < 0.005) return `0.00${unit}`;
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
}

function fmtCm(value: number | null | undefined): string {
  if (!isFiniteNum(value) || value <= 0) return "—";
  const cm = value < 3.0 ? value * 100 : value;
  return `${Math.round(cm)} см`;
}

function fmtDeg(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNum(value)) return "—";
  return `${value.toFixed(digits)}°`;
}

function fmtScalar(value: number | null | undefined, digits = 1): string {
  if (!isFiniteNum(value)) return "—";
  return value.toFixed(digits);
}

function shortConditionLabel(cond: string): string {
  const c = cond.toLowerCase();
  if (c === "baseline") return "Base";
  if (c === "verbal") return "Verb";
  if (c === "vr") return "VR";
  return cond;
}

function visitStatusDotColor(status: VisitSummary["status"]): string {
  if (status === "green") return "var(--teal)";
  if (status === "yellow") return "var(--amber)";
  if (status === "red") return "var(--red)";
  return "var(--muted)";
}

function diffNumbers(post: number | null | undefined, base: number | null | undefined): number | null {
  if (!isFiniteNum(post) || !isFiniteNum(base)) return null;
  return post - base;
}

function PatientDossierContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientCode = decodeURIComponent(String(params?.id || "s61520_1"));
  const visitParam = searchParams.get("visit") || undefined;
  const { lang, t } = useLanguage();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [analysis, setAnalysis] = useState<PatientAnalysis | null>(null);
  const [kinematics, setKinematics] = useState<KinematicsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const loadDossier = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ana, kin, list] = await Promise.all([
        getPatientAnalysis(patientCode, visitParam),
        getPatientKinematics(patientCode, visitParam),
        getPatients(),
      ]);
      setAnalysis(ana);
      setKinematics(kin);
      setPatients(list);
    } catch {
      setError(
        lang === "kz"
          ? `«${patientCode}» пациентінің деректерін жүктеу мүмкін болмады.`
          : `Не удалось загрузить карту пациента «${patientCode}». Проверьте код пациента и доступность сервера.`
      );
    } finally {
      setLoading(false);
    }
  }, [patientCode, visitParam, lang]);

  useEffect(() => {
    loadDossier();
    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<{ code?: string; visit_key?: string }>).detail;
      if (detail?.code && detail.code !== patientCode) return;
      if (detail?.visit_key && detail.visit_key !== visitParam) {
        return;
      }
      loadDossier();
    };
    window.addEventListener("libra:patient-updated", onUpdate);
    return () => window.removeEventListener("libra:patient-updated", onUpdate);
  }, [loadDossier, patientCode, visitParam]);

  if (loading) {
    return (
      <div className="surface" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
        {lang === "kz" ? "Клиникалық карта жүктелуде..." : "Загрузка клинической карты пациента..."}
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="surface" role="alert" style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "flex-start" }}>
        <p style={{ color: "var(--red)", fontWeight: 500 }}>{error || "Данные не найдены"}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/portal" className="btn">
            <ArrowLeft size={14} strokeWidth={1.6} />
            {t.back_to_registry}
          </Link>
          <button type="button" onClick={loadDossier} className="btn btn-primary">
            <RotateCcw size={14} strokeWidth={1.6} />
            {lang === "kz" ? "Қайталау" : "Повторить"}
          </button>
        </div>
      </div>
    );
  }

  const s = analysis.summary;
  const visits = analysis.visits ?? [];
  const activeVisit =
    analysis.active_visit ??
    visits.find((v) => v.visit_key === visitParam) ??
    visits.find((v) => v.is_latest) ??
    visits[0];
  const selectedVisit = visitParam || activeVisit?.visit_key;

  const cdss = analysis.cdss || analysis.cdss_risk;
  const responder = analysis.ml.responder_prediction;
  const pca = analysis.ml.pca_stability;

  const baseCycles = s.baseline_cycles ?? s.cycles_baseline ?? 0;
  const verbalCycles = s.verbal_cycles ?? s.cycles_verbal ?? 0;
  const vrCycles = s.vr_cycles ?? s.cycles_vr ?? 0;

  const hasVr = Boolean(s.has_vr || vrCycles > 0 || isFiniteNum(s.vr_gps) || isFiniteNum(s.vr_amin_sagh));
  const hasVerbal = Boolean(s.has_verbal || verbalCycles > 0 || isFiniteNum(s.verbal_gps) || isFiniteNum(s.verbal_amin_sagh));
  const activePostLabel = hasVr ? "VR" : hasVerbal ? "Verbal" : null;

  const postIcfB770 = analysis.icf.b770_post || analysis.icf.b770_vr;
  const sideLabel =
    s.side === "LEFT" ? t.side_left : s.side === "RIGHT" ? t.side_right : t.side_unspecified;

  const pickDelta = (
    vrDelta: number | null | undefined,
    vrVal: number | null | undefined,
    vbVal: number | null | undefined,
    baseVal: number | null | undefined
  ) => {
    if (hasVr) return isFiniteNum(vrDelta) ? vrDelta : diffNumbers(vrVal, baseVal);
    if (hasVerbal) return diffNumbers(vbVal, baseVal);
    return null;
  };

  const hipActiveDelta = hasVr
    ? isFiniteNum(s.delta_amin_sagh)
      ? s.delta_amin_sagh
      : diffNumbers(s.vr_amin_sagh, s.baseline_amin_sagh)
    : hasVerbal
    ? isFiniteNum(s.active_delta_amin_sagh)
      ? s.active_delta_amin_sagh
      : diffNumbers(s.verbal_amin_sagh, s.baseline_amin_sagh)
    : null;

  const jointSummaryRows = [
    {
      label: lang === "kz" ? "Жүріс индексі (GPS)" : "Индекс профиля походки (GPS)",
      base: fmtDeg(s.baseline_gps),
      verbal: fmtDeg(s.verbal_gps),
      vr: fmtDeg(s.vr_gps),
      delta: pickDelta(s.delta_gps, s.vr_gps, s.verbal_gps, s.baseline_gps),
      betterNegative: true,
    },
    {
      label: lang === "kz" ? "Ауытқу индексі (GDI)" : "Индекс отклонения (GDI)",
      base: fmtScalar(s.baseline_gdi, 1),
      verbal: fmtScalar(s.verbal_gdi, 1),
      vr: fmtScalar(s.vr_gdi, 1),
      delta: pickDelta(s.delta_gdi, s.vr_gdi, s.verbal_gdi, s.baseline_gdi),
      betterNegative: false,
      unit: "",
    },
    {
      label: lang === "kz" ? "Жамбас еңкеюі (GVS)" : "Таз, сагиттальный профиль (GVS)",
      base: fmtDeg(s.baseline_gvs_pelvis),
      verbal: fmtDeg(s.verbal_gvs_pelvis),
      vr: fmtDeg(s.vr_gvs_pelvis),
      delta: pickDelta(s.delta_gvs_pelvis, s.vr_gvs_pelvis, s.verbal_gvs_pelvis, s.baseline_gvs_pelvis),
      betterNegative: true,
    },
    {
      label: lang === "kz" ? "Сан буыны (GVS)" : "Бедро, профиль отклонения (GVS)",
      base: fmtDeg(s.baseline_gvs_hip),
      verbal: fmtDeg(s.verbal_gvs_hip),
      vr: fmtDeg(s.vr_gvs_hip),
      delta: pickDelta(s.delta_gvs_hip, s.vr_gvs_hip, s.verbal_gvs_hip, s.baseline_gvs_hip),
      betterNegative: true,
    },
    {
      label: lang === "kz" ? "Тізе буыны (GVS)" : "Колено, профиль отклонения (GVS)",
      base: fmtDeg(s.baseline_gvs_knee),
      verbal: fmtDeg(s.verbal_gvs_knee),
      vr: fmtDeg(s.vr_gvs_knee),
      delta: pickDelta(s.delta_gvs_knee, s.vr_gvs_knee, s.verbal_gvs_knee, s.baseline_gvs_knee),
      betterNegative: true,
    },
    {
      label: lang === "kz" ? "Тобық буыны (GVS)" : "Голеностоп (GVS Стопы)",
      base: fmtDeg(s.baseline_gvs_ankle),
      verbal: fmtDeg(s.verbal_gvs_ankle),
      vr: fmtDeg(s.vr_gvs_ankle),
      delta: pickDelta(s.delta_gvs_ankle, s.vr_gvs_ankle, s.verbal_gvs_ankle, s.baseline_gvs_ankle),
      betterNegative: true,
    },
    {
      label: lang === "kz" ? "Санның жазылуы (aMinSagH)" : "Мин. сгибание бедра в опоре (aMinSagH)",
      base: fmtDeg(s.baseline_amin_sagh),
      verbal: fmtDeg(s.verbal_amin_sagh),
      vr: fmtDeg(s.vr_amin_sagh),
      delta: hipActiveDelta,
      betterNegative: true,
    },
  ];

  const handleOpenNewVisit = () => {
    window.dispatchEvent(
      new CustomEvent("libra:open-upload", {
        detail: {
          subjectCode: patientCode,
          defaultVisitMode: "new",
          visits,
        },
      })
    );
  };

  const vrConfidence = analysis.ml.vr_gait_signature_confidence;
  const predictedCondition =
    analysis.ml.predicted_condition ??
    (isFiniteNum(vrConfidence) ? (analysis.ml.is_vr_discriminative ? "VR" : "Baseline") : null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Breadcrumb & Patient Switcher Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/portal" className="btn" style={{ minBlockSize: "34px", padding: "6px 12px" }}>
            <ArrowLeft size={14} strokeWidth={1.6} />
            {t.back_to_registry}
          </Link>

          {patients.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="patient-switcher" style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Пациентті ауыстыру:" : "Переключить карту:"}
              </label>
              <select
                id="patient-switcher"
                value={patientCode}
                onChange={(e) => router.push(`/portal/patients/${encodeURIComponent(e.target.value)}`)}
                style={{ minBlockSize: "34px", fontFamily: "var(--mono)", fontSize: "13px" }}
              >
                {patients.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} · {p.side === "LEFT" ? "L" : p.side === "RIGHT" ? "R" : "—"}
                    {(p.visit_count ?? 1) > 1 ? ` (${p.visit_count})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="btn btn-primary"
        >
          <FileText size={15} strokeWidth={1.7} />
          {t.btn_clinical_protocol}
        </button>
      </div>

      {/* Longitudinal Visit / Session Selector Bar */}
      <section
        className="surface"
        aria-label={lang === "kz" ? "Пациент визиттері" : "Визиты и сессии пациента"}
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--secondary)",
              marginRight: "4px",
            }}
          >
            <Calendar size={14} strokeWidth={1.6} color="var(--teal)" />
            <span>{lang === "kz" ? "Визиттер:" : "Визиты:"}</span>
          </div>

          {visits.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {visits.map((v) => {
                const isSelected = selectedVisit === v.visit_key;
                const label =
                  lang === "kz" && v.visit_label_kz ? v.visit_label_kz : v.visit_label;
                const condSummary =
                  v.conditions.length > 0
                    ? v.conditions.map(shortConditionLabel).join(" · ")
                    : "—";

                return (
                  <button
                    key={v.visit_key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      router.push(
                        `/portal/patients/${encodeURIComponent(patientCode)}?visit=${encodeURIComponent(
                          v.visit_key
                        )}`
                      )
                    }
                    className="btn"
                    style={{
                      minBlockSize: "34px",
                      padding: "5px 11px",
                      fontSize: "12px",
                      gap: "7px",
                      background: isSelected ? "var(--ink)" : "var(--paper)",
                      color: isSelected ? "var(--white)" : "var(--ink)",
                      borderColor: isSelected ? "var(--ink)" : "var(--line-strong)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: visitStatusDotColor(v.status),
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    {v.visit_date && (
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: "11px",
                          opacity: isSelected ? 0.85 : 0.72,
                        }}
                      >
                        {v.visit_date}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--mono)",
                        opacity: isSelected ? 0.9 : 0.75,
                      }}
                    >
                      [{condSummary}]
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {s.visit_label || (lang === "kz" ? "Бастапқы тексеру" : "Текущее обследование")}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleOpenNewVisit}
          className="btn btn-teal"
          style={{ minBlockSize: "34px", padding: "6px 12px", fontSize: "12px" }}
        >
          <Plus size={14} strokeWidth={1.8} />
          <span>{lang === "kz" ? "Жаңа визит (CSV)" : "Новый визит (CSV)"}</span>
        </button>
      </section>

      {/* Patient Demographic Header */}
      <section className="surface" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1 className="font-display" style={{ fontSize: "clamp(24px, 2.5vw, 32px)", lineHeight: 1.15 }}>
              {t.patient_dossier_title}{" "}
              <span style={{ fontFamily: "var(--mono)" }}>{s.subject}</span>
            </h1>
            <p style={{ color: "var(--secondary)", fontSize: "13px", marginTop: "6px" }}>
              {t.clinic_cohort_label}
              {activeVisit
                ? ` · ${
                    lang === "kz" && activeVisit.visit_label_kz
                      ? activeVisit.visit_label_kz
                      : activeVisit.visit_label
                  }${activeVisit.visit_date ? ` (${activeVisit.visit_date})` : ""}`
                : ""}
              {" · "}
              {t.icf_b770}: {analysis.icf.b770_baseline}
              {postIcfB770 && postIcfB770 !== "N/A" ? ` → ${postIcfB770}` : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span className="badge badge-neutral tabular-nums">
              {t.condition_baseline}: {baseCycles}
            </span>
            {verbalCycles > 0 && (
              <span className="badge badge-neutral tabular-nums">
                {t.condition_verbal}: {verbalCycles}
              </span>
            )}
            {vrCycles > 0 && (
              <span className="badge badge-green tabular-nums">
                {t.condition_vr}: {vrCycles}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{t.side}</div>
            <div style={{ fontWeight: 600, marginTop: "2px" }}>{sideLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{t.weight}</div>
            <div className="tabular-nums" style={{ fontWeight: 600, marginTop: "2px" }}>
              {isFiniteNum(s.weight) ? `${s.weight.toFixed(1)} кг` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{t.height}</div>
            <div className="tabular-nums" style={{ fontWeight: 600, marginTop: "2px" }}>
              {fmtCm(s.height)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>{t.leg_length}</div>
            <div className="tabular-nums" style={{ fontWeight: 600, marginTop: "2px" }}>
              {fmtCm(s.leg_length)}
            </div>
          </div>
        </div>

        {(s.anthropometry_estimated || s.side_estimated) && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Info size={13} strokeWidth={1.6} />
            <span>{t.not_filled_in_csv}</span>
          </div>
        )}
      </section>

      {/* Primary CDSS Risk & TJE/PCR Assessment */}
      <CdssTrafficLight analysis={{ ...analysis, cdss }} lang={lang} />

      {/* Baseline vs Verbal vs VR Comparison */}
      <MethodVerdict modalities={analysis.modalities} summary={s} lang={lang} />

      {/* Joint Angles & Hip Moment Curves */}
      {kinematics && <KinematicsChart data={kinematics} summary={s} lang={lang} />}

      {/* GVS Gait Profile Radar & Deviations Table */}
      <section className="grid-split-gvs">
        <RadarGvs summary={s} lang={lang} />

        <div className="surface" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
              {lang === "kz"
                ? "Негізгі буын көрсеткіштері (Қалып · Ауызша · VR)"
                : "Сводка по суставам: показатели GVS и GPS"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
              {lang === "kz"
                ? `Теріс Δ ауытқудың азайып, қадамның нормаға жақындағанын білдіреді${
                    activePostLabel ? ` (${activePostLabel} − Қалыпты)` : ""
                  }`
                : `Отрицательное Δ для GPS и GVS означает уменьшение отклонений и приближение к норме${
                    activePostLabel ? ` (${activePostLabel} − База)` : ""
                  }`}
            </p>
          </div>
          <div className="table-responsive">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th scope="col">{lang === "kz" ? "Көрсеткіш" : "Параметр"}</th>
                  <th scope="col">{lang === "kz" ? "Қалыпты" : "Обычная"}</th>
                  <th scope="col">{lang === "kz" ? "Ауызша" : "Голос"}</th>
                  <th scope="col">VR</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {jointSummaryRows.map((row) => {
                  const improved =
                    row.delta !== null &&
                    (row.betterNegative ? row.delta <= -0.3 : row.delta >= 1.0);
                  const worsened =
                    row.delta !== null &&
                    (row.betterNegative ? row.delta >= 0.8 : row.delta <= -2.0);
                  return (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500 }}>{row.label}</td>
                      <td className="tabular-nums" style={{ color: "var(--secondary)" }}>
                        {row.base}
                      </td>
                      <td className="tabular-nums" style={{ color: "var(--secondary)" }}>
                        {row.verbal}
                      </td>
                      <td className="tabular-nums" style={{ fontWeight: 500 }}>
                        {row.vr}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          color: improved ? "var(--teal)" : worsened ? "var(--red)" : "var(--ink)",
                        }}
                      >
                        {fmtSigned(row.delta, row.unit === "" ? 1 : 2, row.unit ?? "°")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Session Comparison Between Conditions and Visits */}
      <GaitDiffViewer
        patientCode={patientCode}
        visits={visits}
        activeVisitKey={selectedVisit}
      />

      {/* AI Diagnostics: ConditionClassifier + VRResponderPredictor + PCA Stability */}
      <section
        aria-label={lang === "kz" ? "ЖИ диагностикасы" : "Диагностика моделей ИИ"}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        {/* 1. Condition Classifier */}
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                {lang === "kz"
                  ? "Жүріс режимін жіктеу (ConditionClassifier)"
                  : "Классификатор режима (ConditionClassifier)"}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                {lang === "kz"
                  ? "Таңдалған сессиядағы VR-паттернді тану"
                  : "Вероятность VR-паттерна походки для оцениваемой пробы"}
              </p>
            </div>
            {predictedCondition && (
              <span className={`badge ${predictedCondition === "VR" ? "badge-green" : "badge-neutral"}`}>
                {predictedCondition === "VR"
                  ? lang === "kz"
                    ? "VR-паттерн"
                    : "VR-паттерн"
                  : lang === "kz"
                  ? "Baseline-паттерн"
                  : "Базовый паттерн"}
              </span>
            )}
          </div>

          <div
            style={{
              background: "var(--sidebar)",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--secondary)" }}>
              {lang === "kz" ? "VR-қолтаңба сенімділігі" : "Уверенность VR-профиля"}
            </span>
            <span className="tabular-nums" style={{ fontSize: "18px", fontWeight: 600 }}>
              {isFiniteNum(vrConfidence) ? `${(vrConfidence * 100).toFixed(0)}%` : "—"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Бағаланған сынама" : "Оцениваемая проба"}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>
                {analysis.ml.active_condition_evaluated || "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Модель болжамы" : "Предсказанный класс"}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>
                {predictedCondition || "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: "var(--muted)" }}>
                {lang === "kz" ? "Модель ROC-AUC (GroupKFold)" : "Модель ROC-AUC (GroupKFold)"}
              </span>
              <span className="tabular-nums" style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>
                {isFiniteNum(analysis.ml.binary_roc_auc)
                  ? analysis.ml.binary_roc_auc.toFixed(3)
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Responder Model */}
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                {lang === "kz" ? "VR-терапияға жауап болжамы (ИИ)" : "Прогноз ответа на VR-терапию (ИИ)"}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                {lang === "kz"
                  ? "Тек бастапқы клиникалық деректер бойынша LOO-калибрлеу"
                  : "Калибровка LOO только по исходным показателям ходьбы"}
              </p>
            </div>
            {responder && (
              <span className={`badge ${responder.is_predicted_responder ? "badge-green" : "badge-yellow"}`}>
                {lang === "kz" ? responder.clinical_status_kz : responder.clinical_status_ru}
              </span>
            )}
          </div>

          {responder ? (
            <>
              <div
                style={{
                  background: "var(--sidebar)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "13px", color: "var(--secondary)" }}>
                  {lang === "kz" ? "Шынайы бейімделу ықтималдығы" : "Вероятность истинного ответа без перегрузки"}
                </span>
                <span className="tabular-nums" style={{ fontSize: "18px", fontWeight: 600 }}>
                  {(responder.responder_probability * 100).toFixed(0)}%
                </span>
              </div>

              <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                {lang === "kz" ? responder.recommendation_kz : responder.recommendation_ru}
              </p>

              {responder.feature_attributions && responder.feature_attributions.length > 0 && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>
                    {lang === "kz" ? "Болжамға негізгі әсер еткен факторлар:" : "Ключевые исходные факторы прогноза:"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {responder.feature_attributions.slice(0, 4).map((attr) => {
                      const labelObj = DRIVER_LABELS[attr.feature];
                      const fname = labelObj ? (lang === "kz" ? labelObj.kz : labelObj.ru) : attr.feature;
                      const isPositive = attr.direction === "fosters_responder";
                      return (
                        <div
                          key={attr.feature}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ color: "var(--secondary)" }}>{fname}</span>
                          <span
                            className="tabular-nums"
                            style={{ fontWeight: 600, color: isPositive ? "var(--teal)" : "var(--amber)" }}
                          >
                            {isPositive
                              ? lang === "kz"
                                ? "Оң фактор"
                                : "Поддерживает ответ"
                              : lang === "kz"
                              ? "Риск факторы"
                              : "Риск компенсации"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {responder.model_reliable === false && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--amber)",
                    background: "var(--amber-bg)",
                    border: "1px solid var(--amber-border)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                >
                  {lang === "kz"
                    ? `Модель шағын іріктемеде тексерілген (LOO теңгерімделген дәлдігі ${((responder.loo_balanced_accuracy ?? 0) * 100).toFixed(0)}%). Қорытынды шешімді тек дәрігер қабылдайды.`
                    : `Модель калибрована на малой выборке (LOO точность ${((responder.loo_balanced_accuracy ?? 0) * 100).toFixed(0)}%). Окончательная оценка остается за врачом.`}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                background: "var(--sidebar)",
                borderRadius: "8px",
                padding: "16px",
                fontSize: "13px",
                color: "var(--secondary)",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <Info size={16} strokeWidth={1.6} color="var(--muted)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                {lang === "kz"
                  ? "Терапияға дейінгі болжам үшін осы визитта Baseline сынамасы болуы қажет."
                  : "Для дотерапевтического прогноза отклика загрузите пробу Baseline в этот визит."}
              </span>
            </div>
          )}
        </div>

        {/* 3. PCA Cycle Stability */}
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                {lang === "kz" ? "Қадам циклдерінің тұрақтылығы (PCA)" : "Стабильность циклов ходьбы (PCA)"}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                {lang === "kz"
                  ? `Ауытқыған қадам циклдерінің үлесі (${analysis.ml.active_condition_evaluated || "VR"})`
                  : `Доля нестандартных циклов шага (${analysis.ml.active_condition_evaluated || "VR"})`}
              </p>
            </div>
            {pca && pca.has_curves !== false && pca.is_stable !== null && (
              <span className={`badge ${pca.is_stable ? "badge-green" : "badge-yellow"}`}>
                {pca.is_stable
                  ? lang === "kz"
                    ? "Тұрақты жүріс"
                    : "Стереотип стабилен"
                  : lang === "kz"
                  ? "Қадам ауытқуы байқалады"
                  : "Вариативность циклов"}
              </span>
            )}
          </div>

          {!pca || pca.has_curves === false || !pca.cycles || pca.cycles.length === 0 ? (
            <div
              style={{
                background: "var(--sidebar)",
                borderRadius: "8px",
                padding: "16px",
                fontSize: "13px",
                color: "var(--secondary)",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <Info size={16} strokeWidth={1.6} color="var(--muted)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                {lang === "kz"
                  ? "Бұл тексеру үшін циклдер бойынша толық қисықтар берілмеген; дискретті биомеханикалық көрсеткіштер негізінде бағаланды."
                  : "Для данного обследования загружены дискретные показатели; покадровые кривые каждого цикла шага отсутствуют."}
              </span>
            </div>
          ) : (
            <>
              <div
                style={{
                  background: "var(--sidebar)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "13px", color: "var(--secondary)" }}>
                  {lang === "kz"
                    ? `Ауытқыған циклдер: ${pca.n_anomalies} / ${pca.n_cycles}`
                    : `Нестандартных циклов: ${pca.n_anomalies} из ${pca.n_cycles}`}
                </span>
                <span className="tabular-nums" style={{ fontSize: "18px", fontWeight: 600 }}>
                  {pca.anomaly_rate !== null
                    ? `${(pca.anomaly_rate <= 1 ? pca.anomaly_rate * 100 : pca.anomaly_rate).toFixed(0)}%`
                    : "—"}
                </span>
              </div>

              <div
                role="img"
                aria-label={
                  lang === "kz"
                    ? "Қадам циклдерінің ауытқу профилі"
                    : "График стабильности отдельных циклов шага"
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(pca.cycles.length, 32)}, minmax(4px, 1fr))`,
                  gap: "4px",
                  alignItems: "end",
                  height: "92px",
                  padding: "10px 12px",
                  background: "var(--paper)",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                }}
              >
                {pca.cycles.slice(0, 32).map((c) => {
                  const ratio = c.threshold > 0 ? Math.min(2.2, c.spe / c.threshold) : 0.4;
                  const pct = Math.max(14, Math.round((ratio / 2.2) * 100));
                  return (
                    <div
                      key={c.cycle_index}
                      title={`${lang === "kz" ? "Цикл" : "Цикл"} ${c.cycle_index}: ${
                        c.is_anomaly
                          ? lang === "kz"
                            ? "норма шегінен тыс"
                            : "выход за порог нормы"
                          : lang === "kz"
                          ? "тұрақты"
                          : "в пределах нормы"
                      }`}
                      style={{
                        height: `${pct}%`,
                        borderRadius: "3px 3px 0 0",
                        background: c.is_anomaly ? "var(--amber)" : "var(--teal)",
                        opacity: c.is_anomaly ? 0.95 : 0.65,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--teal)" }} />
                  {lang === "kz" ? "Тұрақты қадам" : "Стабильный шаг"}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--amber)" }} />
                  {lang === "kz" ? "95% шегінен ауытқу" : "Отклонение выше 95% порога"}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* WHO ICF & Regulatory Safety Footer Card */}
      <section className="surface-muted" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
            {t.icf_title}: {t.icf_b770} ({analysis.icf.b770_baseline}
            {postIcfB770 && postIcfB770 !== "N/A" ? ` → ${postIcfB770}` : ""}) ·{" "}
            {t.icf_d450}: {analysis.icf.d450}
          </div>
          <p style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "4px" }}>
            {t.emergency_banner}
          </p>
        </div>
        <Link href="/portal/safety" className="btn" style={{ minBlockSize: "34px", fontSize: "12px" }}>
          {t.nav_safety}
        </Link>
      </section>

      <ReportModal
        open={reportOpen}
        patientCode={patientCode}
        visitKey={selectedVisit}
        lang={lang}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

export default function PatientDossierPage() {
  return (
    <Suspense
      fallback={
        <div className="surface" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          Загрузка клинической карты пациента...
        </div>
      }
    >
      <PatientDossierContent />
    </Suspense>
  );
}
