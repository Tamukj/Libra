"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPatientAnalysis, getPatientKinematics, getPatients } from "@/lib/api";
import { Patient, PatientAnalysis, KinematicsResponse } from "@/lib/types";
import { MethodVerdict } from "@/components/MethodVerdict";
import { CdssTrafficLight } from "@/components/CdssTrafficLight";
import { KinematicsChart } from "@/components/KinematicsChart";
import { RadarGvs } from "@/components/RadarGvs";
import { ReportModal } from "@/components/ReportModal";
import { GaitDiffViewer } from "@/components/GaitDiffViewer";
import { useLanguage } from "@/lib/LanguageContext";
import { ArrowLeft, FileText, Activity, ShieldCheck, AlertCircle } from "lucide-react";

export default function PatientDossierPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id || "s61520_1";

  const { lang, setLang, t } = useLanguage();
  const [analysis, setAnalysis] = useState<PatientAnalysis | null>(null);
  const [kinematics, setKinematics] = useState<KinematicsResponse | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setApiError(null);
        const [an, kin, pts] = await Promise.all([
          getPatientAnalysis(id),
          getPatientKinematics(id),
          getPatients()
        ]);
        if (!active) return;
        setAnalysis(an);
        setKinematics(kin);
        const p = pts.find((item) => item.code === id) || null;
        setPatient(p);
      } catch (err) {
        console.error("Failed to load patient dossier:", err);
        if (active) setApiError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    const onPatientUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ code?: string }>).detail;
      if (!detail?.code || detail.code === id) {
        loadData();
      }
    };
    window.addEventListener("libra:patient-updated", onPatientUpdated);
    return () => {
      active = false;
      window.removeEventListener("libra:patient-updated", onPatientUpdated);
    };
  }, [id]);

  const fmt = (v?: number | null, fallback = "—") =>
    typeof v === "number" && !isNaN(v) && isFinite(v) ? v.toFixed(1) : fallback;

  const fmtUnit = (v?: number | null, unit = "°", signed = false) => {
    if (typeof v !== "number" || isNaN(v) || !isFinite(v)) return "—";
    const prefix = signed && v > 0 ? "+" : "";
    return `${prefix}${v.toFixed(1)}${unit}`;
  };

  const fmtDiff = (cur?: number | null, base?: number | null, unit = "°") =>
    typeof cur === "number" && isFinite(cur) && typeof base === "number" && isFinite(base)
      ? fmtUnit(cur - base, unit, true)
      : "—";

  return (
    <div className="container" style={{ paddingBlock: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
      
      {/* 1. Header Bar with Back navigation & Quick Print */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/portal" className="btn" style={{ padding: "6px 12px", fontSize: "12px" }}>
            <ArrowLeft size={14} />
            <span>{t.back_to_registry || "К реестру"}</span>
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "22px", letterSpacing: "-0.02em" }}>{t.patient_dossier_title || "Пациент"} {id}</h1>
              {patient && (
                <span className="badge badge-neutral">
                  {patient.side === "LEFT" ? (t.side_left || "Левая сторона (L)") : (t.side_right || "Правая сторона (R)")}
                </span>
              )}
            </div>
            {patient && (
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <span>{t.weight}: <strong>{patient.weight.toFixed(1)} кг</strong></span>
                <span>{t.height}: <strong>{patient.height.toFixed(2)} м</strong></span>
                <span>{t.leg_length}: <strong>{patient.leg_length.toFixed(3)} м</strong></span>
                <span>{lang === "kz" ? "Зерттелген аяқ" : "Исследуемая сторона"}: <strong>{patient.side === "LEFT" ? (lang === "kz" ? "Сол аяқ" : "Левая нога") : (lang === "kz" ? "Оң аяқ" : "Правая нога")}</strong></span>
              </div>
            )}
            {analysis?.summary && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                <span className="badge" style={{ background: "var(--linen)", borderColor: "var(--line)", color: "var(--ink)", fontSize: "11px", padding: "3px 8px" }}>
                  <strong>{lang === "kz" ? "Baseline" : "Baseline"}:</strong>&nbsp;{analysis.summary.cycles_baseline || analysis.summary.baseline_cycles || 0}&nbsp;{lang === "kz" ? "цикл" : "циклов"}
                </span>
                <span className="badge" style={{ background: "var(--amber-light)", borderColor: "var(--amber-border)", color: "#b45309", fontSize: "11px", padding: "3px 8px" }}>
                  <strong>{lang === "kz" ? "Verbal" : "Verbal"}:</strong>&nbsp;{analysis.summary.cycles_verbal || analysis.summary.verbal_cycles || 0}&nbsp;{lang === "kz" ? "цикл" : "циклов"}
                </span>
                <span className="badge" style={{ background: "var(--teal-bg)", borderColor: "var(--teal-border)", color: "var(--teal)", fontSize: "11px", padding: "3px 8px" }}>
                  <strong>{lang === "kz" ? "VR" : "VR"}:</strong>&nbsp;{analysis.summary.cycles_vr || analysis.summary.vr_cycles || 0}&nbsp;{lang === "kz" ? "цикл" : "циклов"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }} className="no-print">
          {/* Quick local language switch in dossier */}
          <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", background: "var(--white)" }}>
            <button
              onClick={() => setLang("kz")}
              style={{
                padding: "5px 10px",
                fontSize: "11px",
                fontWeight: 700,
                border: "none",
                background: lang === "kz" ? "var(--linen)" : "transparent",
                color: "var(--ink)",
                cursor: "pointer"
              }}
            >
              ҚАЗ
            </button>
            <button
              onClick={() => setLang("ru")}
              style={{
                padding: "5px 10px",
                fontSize: "11px",
                fontWeight: 700,
                border: "none",
                borderLeft: "1px solid var(--line)",
                background: lang === "ru" ? "var(--linen)" : "transparent",
                color: "var(--ink)",
                cursor: "pointer"
              }}
            >
              РУС
            </button>
          </div>

          <button onClick={() => setReportOpen(true)} className="btn btn-amber">
            <FileText size={15} />
            <span>{t.btn_damumed_protocol || "Оформить протокол Damumed"}</span>
          </button>
        </div>

      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
          {lang === "kz" ? `Пациент ${id} биомеханикалық құжаты жүктелуде...` : `Загрузка биомеханического паспорта пациента ${id}...`}
        </div>
      ) : analysis ? (
        <>
          {/* Clinical ML Responder Prediction & PCA Stability Section */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "14px"
          }}>
            {/* Model 1: Clinical VR Responder Prediction */}
            {(() => {
              const resp = analysis.ml?.responder_prediction;
              const isReliable = resp?.model_reliable !== false;
              const aucVal =
                typeof resp?.loo_roc_auc === "number" && isFinite(resp.loo_roc_auc)
                  ? resp.loo_roc_auc.toFixed(2)
                  : "—";
              const balAccVal =
                typeof resp?.loo_balanced_accuracy === "number" && isFinite(resp.loo_balanced_accuracy)
                  ? `${(resp.loo_balanced_accuracy * 100).toFixed(0)}%`
                  : null;
              const borderColor = !resp
                ? "var(--line)"
                : !isReliable
                ? "var(--amber)"
                : resp.is_predicted_responder
                ? "var(--teal)"
                : "var(--amber)";

              return (
                <div className="card" style={{ padding: "16px", borderLeft: `4px solid ${borderColor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
                      <Activity size={16} color="var(--amber)" />
                      <span>{lang === "kz" ? "VR-терапияға клиникалық жауапты бағалау (LOO)" : "Предиктивная оценка отклика на VR (LOO)"}</span>
                    </div>
                    {!resp ? (
                      <span className="badge badge-neutral">
                        {lang === "kz" ? "Деректер жоқ" : "Нет данных"}
                      </span>
                    ) : !isReliable ? (
                      <span className="badge badge-yellow">
                        {lang === "kz" ? "Эксперименттік (N=29)" : "Экспериментально (N=29)"}
                      </span>
                    ) : (
                      <span className={`badge ${resp.is_predicted_responder ? "badge-green" : "badge-yellow"}`}>
                        {resp.is_predicted_responder ? "True Responder" : "High Compensation Risk"}
                      </span>
                    )}
                  </div>

                  {!resp ? (
                    <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                      {lang === "kz"
                        ? "Бұл жазба үшін предиктивті ML-бағалау жоқ. Төмендегі нақты CDSS көрсеткіштеріне сүйеніңіз."
                        : "Предиктивная ML-оценка для данной записи отсутствует. Опирайтесь на фактические показатели CDSS ниже."}
                    </div>
                  ) : !isReliable ? (
                    <>
                      <div style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500, marginBottom: "4px" }}>
                        {lang === "kz"
                          ? `Терапияға дейінгі болжам үлкенірек когортаны қажет етеді (LOO ROC-AUC = ${aucVal}${balAccVal ? `, Bal. Acc = ${balAccVal}` : ""}).`
                          : `Дотерапевтический прогноз отклика требует расширения когорты (LOO ROC-AUC = ${aucVal}${balAccVal ? `, Bal. Acc = ${balAccVal}` : ""}).`}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                        {lang === "kz"
                          ? "Клиникалық шешімдер осы болжамға емес, төмендегі нақты CDSS бағдаршамы мен TJE / PCR индекстеріне сүйенеді."
                          : "Клинические решения опираются не на этот экспериментальный прогноз, а на фактический светофор CDSS и индексы TJE / PCR ниже."}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500, marginBottom: "4px" }}>
                        {lang === "kz" ? resp.clinical_status_kz : resp.clinical_status_ru}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                        {lang === "kz" ? resp.recommendation_kz : resp.recommendation_ru}
                      </div>
                    </>
                  )}

                  {/* Linear Feature Attributions & Cycle Signature Confidence */}
                  {resp?.feature_attributions && resp.feature_attributions.length > 0 && (
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
                      <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px" }}>
                        {!isReliable
                          ? (lang === "kz"
                              ? "Зерттеу факторлары (сызықтық үлес Z-score × β, клиникалық шешімге емес):"
                              : "Исследовательские факторы (линейный вклад Z-score × β, не для клинических решений):")
                          : (lang === "kz"
                              ? "Модель факторлары (сызықтық үлес Z-score × β):"
                              : "Факторы модели (линейный вклад Z-score × β):")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {resp.feature_attributions.slice(0, 3).map((attr) => (
                          <span
                            key={attr.feature}
                            className="badge"
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              background: attr.attribution >= 0 ? "var(--teal-bg)" : "var(--red-bg)",
                              color: attr.attribution >= 0 ? "var(--teal)" : "var(--red)",
                              borderColor: attr.attribution >= 0 ? "var(--teal-border)" : "var(--red-border)"
                            }}
                          >
                            {attr.feature}: {attr.attribution > 0 ? `+${attr.attribution}` : attr.attribution}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {typeof analysis.ml?.vr_gait_signature_confidence === "number" && (
                    <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--line)", display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--muted)" }}>
                      <span>
                        {lang === "kz"
                          ? `VR жүріс паттернінің айқындығы (GroupKFold AUC ${(analysis.ml.binary_roc_auc ?? 0.772).toFixed(3)}):`
                          : `Сигнатура VR-походки по циклам (GroupKFold AUC ${(analysis.ml.binary_roc_auc ?? 0.772).toFixed(3)}):`}
                      </span>
                      <strong className="tabular-nums" style={{ color: "var(--ink)" }}>
                        {(analysis.ml.vr_gait_signature_confidence * 100).toFixed(0)}%
                      </strong>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Model 2: PCA Gait Stability & Fatigue Monitor */}
            <div className="card" style={{ padding: "16px", borderLeft: `4px solid ${analysis.ml?.pca_stability?.is_stable ? "var(--teal)" : "var(--red)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
                  <Activity size={16} color="var(--teal)" />
                  <span>{lang === "kz" ? "PCA қадам тұрақтылығы және шаршау детекторы" : "PCA-детектор стабильности шагов и утомления"}</span>
                </div>
                <span className={`badge ${analysis.ml?.pca_stability?.is_stable ? "badge-green" : "badge-red"}`}>
                  {analysis.ml?.pca_stability?.is_stable ? (lang === "kz" ? "Тұрақты локомоция" : "Стабильный шаг") : (lang === "kz" ? "Шаршау белгісі" : "Риск спотыкания")}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink)", fontWeight: "600", marginBottom: "4px" }}>
                {lang === "kz"
                  ? `Аномальді циклдер: ${analysis.ml?.pca_stability?.n_anomalies || 0} / ${analysis.ml?.pca_stability?.n_cycles || 0} (${((analysis.ml?.pca_stability?.anomaly_rate ?? 0.0) * 100).toFixed(1)}%)`
                  : `Нестабильных шагов: ${analysis.ml?.pca_stability?.n_anomalies || 0} из ${analysis.ml?.pca_stability?.n_cycles || 0} (${((analysis.ml?.pca_stability?.anomaly_rate ?? 0.0) * 100).toFixed(1)}%)`}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                {lang === "kz"
                  ? "Kinematic PCA бақылауы шаршау мен тепе-теңдікті жоғалту қаупін алдын ала анықтайды."
                  : "Мониторинг реконструкции кинематических кривых предотвращает спотыкания при утомлении."}
              </div>
              {analysis.ml?.pca_stability?.cycles && analysis.ml.pca_stability.cycles.length > 0 && (() => {
                const cycles = analysis.ml.pca_stability!.cycles!;
                const maxSpe = Math.max(...cycles.map((c) => Math.max(c.spe, c.threshold)), 1);
                const anomalousIds = cycles.filter((c) => c.is_anomaly).map((c) => `#${c.cycle_index}`);
                return (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "6px" }}>
                      <span>{lang === "kz" ? "Әр қадам циклі (SPE / Q-статистика):" : "Профиль по отдельным циклам (SPE / Q-статистика):"}</span>
                      <span>
                        {anomalousIds.length > 0
                          ? (lang === "kz" ? `Аномалия: ${anomalousIds.join(", ")}` : `Аномалии: ${anomalousIds.join(", ")}`)
                          : (lang === "kz" ? "Барлық қадамдар шектен төмен" : "Все шаги в пределах порога")}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "30px" }}>
                      {cycles.map((c) => {
                        const pct = Math.max(15, Math.min(100, Math.round((c.spe / maxSpe) * 100)));
                        return (
                          <div
                            key={c.cycle_index}
                            title={`${lang === "kz" ? "Цикл" : "Цикл"} #${c.cycle_index}: SPE=${c.spe} (${lang === "kz" ? "шек" : "порог"} ${c.threshold})`}
                            style={{
                              flex: 1,
                              height: `${pct}%`,
                              borderRadius: "2px",
                              background: c.is_anomaly ? "var(--red)" : "var(--teal)",
                              opacity: c.is_anomaly ? 0.95 : 0.65,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 2. Verdict Banner (Baseline vs Verbal vs VR Intervention) */}
          <MethodVerdict modalities={analysis.modalities} summary={analysis.summary} lang={lang} />

          {/* 3. CDSS Traffic Light System (PCR, TJE, WHO ICF b770 / d450) */}
          <CdssTrafficLight analysis={analysis} lang={lang} />

          {/* 4. Biomechanical Git Diff (Longitudinal session tracking) */}
          <GaitDiffViewer patientCode={id} />

          {/* 5. Full-Width Kinematics Stage (0-100% gait cycle) */}
          {kinematics && <KinematicsChart data={kinematics} lang={lang} />}

          {/* 7. Balanced Integrated GVS Section: Radar on Left, Table on Right */}
          <div className="grid-split-gvs" style={{ display: "grid", gap: "18px", alignItems: "stretch" }}>
            
            {/* Radar View */}
            <RadarGvs summary={analysis.summary} lang={lang} />

            {/* Numerical Delta Table View */}
            <div className="card" style={{ display: "flex", flexDirection: "column", padding: "18px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                {lang === "kz" ? "Бейкер бойынша буын девиациясы (GVS дельтасы)" : "Клинический баланс суставов по Бейкеру (GVS дельты)"}
              </div>
              <div className="table-responsive" style={{ flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--linen)", borderBottom: "1px solid var(--line)" }}>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Буын" : "Сустав"}</th>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Қалыпты (Base)" : "Обычный (Base)"}</th>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Дауыс (Verbal)" : "Голос (Verbal)"}</th>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Дельта (Verbal - Base)" : "Дельта (Verbal - Base)"}</th>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "VR аватар" : "VR аватар"}</th>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Дельта (VR - Base)" : "Дельта (VR - Base)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 500 }}>{lang === "kz" ? "Жамбас (Pelvis SagP)" : "Таз (Pelvis SagP)"}</th>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.baseline_gvs_pelvis)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.verbal_gvs_pelvis)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_gvs_pelvis, analysis.summary.baseline_gvs_pelvis)}</td>
                      {(() => {
                        const pDelta = analysis.summary.delta_gvs_pelvis || 0;
                        const isComp = pDelta > 2.0;
                        const pelvisColor = isComp ? "var(--red)" : pDelta < -0.3 ? "var(--teal)" : "var(--ink)";
                        return (
                          <>
                            <td style={{ padding: "10px 12px", color: pelvisColor, fontWeight: 600 }}>{fmt(analysis.summary.vr_gvs_pelvis)}°</td>
                            <td style={{ padding: "10px 12px", color: pelvisColor, fontWeight: isComp ? 600 : 400 }}>
                              {pDelta > 0 ? `+${fmt(pDelta)}` : fmt(pDelta)}°
                              {isComp ? ` ${lang === "kz" ? "(Компенсация)" : "(Компенсация)"}` : ""}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 500 }}>{lang === "kz" ? "Сан (Hip SagH)" : "Бедро (Hip SagH)"}</th>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.baseline_gvs_hip)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.verbal_gvs_hip)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_gvs_hip, analysis.summary.baseline_gvs_hip)}</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.vr_gvs_hip)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.delta_gvs_hip)}°</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 500 }}>{lang === "kz" ? "Тізе (Knee SagK)" : "Колено (Knee SagK)"}</th>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.baseline_gvs_knee)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.verbal_gvs_knee)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_gvs_knee, analysis.summary.baseline_gvs_knee)}</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.vr_gvs_knee)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.delta_gvs_knee)}°</td>
                    </tr>
                    <tr>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 500 }}>{lang === "kz" ? "Толарсақ (Ankle SagA)" : "Стопа (Ankle SagA)"}</th>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.baseline_gvs_ankle)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.verbal_gvs_ankle)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_gvs_ankle, analysis.summary.baseline_gvs_ankle)}</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.vr_gvs_ankle)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.delta_gvs_ankle)}°</td>
                    </tr>
                    <tr style={{ borderTop: "2px solid var(--line)", background: "var(--linen)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Сан разгибаниесі (aMinSagH)" : "Разгибание бедра (aMinSagH)"}</th>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{fmt(analysis.summary.baseline_amin_sagh)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.summary.verbal_amin_sagh)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_amin_sagh, analysis.summary.baseline_amin_sagh)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--teal)" }}>{fmt(analysis.summary.vr_amin_sagh)}°</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: (analysis.summary.delta_amin_sagh || 0) < 0 ? "var(--teal)" : "var(--ink)" }}>
                        {fmt(analysis.summary.delta_amin_sagh)}°
                      </td>
                    </tr>
                    <tr style={{ background: "var(--linen)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Бейкер индексі (GPS_a)" : "Индекс походки Бейкера (GPS_a)"}</th>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{fmtUnit(analysis.summary.baseline_gps)}</td>
                      <td style={{ padding: "10px 12px" }}>{fmtUnit(analysis.summary.verbal_gps)}</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_gps, analysis.summary.baseline_gps)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{fmtUnit(analysis.summary.vr_gps)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{fmtUnit(analysis.summary.delta_gps)}</td>
                    </tr>
                    <tr style={{ background: "var(--paper)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {lang === "kz" ? "Сан моментінің ауысуы (pctmZeroStSagH, %)" : "Переход момента бедра (pctmZeroStSagH, %)"}
                      </th>
                      <td style={{ padding: "10px 12px" }}>{fmtUnit(analysis.summary.baseline_pctm_zero, "%")}</td>
                      <td style={{ padding: "10px 12px" }}>{fmtUnit(analysis.summary.verbal_pctm_zero, "%")}</td>
                      <td style={{ padding: "10px 12px" }}>{fmtDiff(analysis.summary.verbal_pctm_zero, analysis.summary.baseline_pctm_zero, "%")}</td>
                      <td style={{ padding: "10px 12px" }}>{fmtUnit(analysis.summary.vr_pctm_zero, "%")}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {(() => {
                          const s = analysis.summary;
                          const delta =
                            typeof s.delta_pctm_zero === "number" && isFinite(s.delta_pctm_zero)
                              ? s.delta_pctm_zero
                              : typeof s.vr_pctm_zero === "number" &&
                                isFinite(s.vr_pctm_zero) &&
                                typeof s.baseline_pctm_zero === "number" &&
                                isFinite(s.baseline_pctm_zero)
                              ? s.vr_pctm_zero - s.baseline_pctm_zero
                              : null;
                          return fmtUnit(delta, "%", true);
                        })()}
                      </td>
                    </tr>
                    <tr style={{ background: "var(--paper)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)" }}>{lang === "kz" ? "Шынайы буын жазылуы (TJE)" : "Истинное суставное разгибание (TJE)"}</th>
                      <td style={{ padding: "10px 12px" }}>0.0° (Base)</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(analysis.modalities?.tje_verbal)}°</td>
                      <td style={{ padding: "10px 12px" }}>{fmtUnit(analysis.modalities?.tje_verbal, "°", true)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--teal)" }}>{fmt((analysis.cdss_risk || analysis.cdss)?.tje)}°</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: ((analysis.cdss_risk || analysis.cdss)?.tje || 0) < 0 ? "var(--teal)" : "var(--red)" }}>
                        {(analysis.cdss_risk || analysis.cdss)?.tje?.toFixed(1) || "-"}°
                      </td>
                    </tr>
                    <tr style={{ background: "var(--paper)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)" }}>{lang === "kz" ? "Компенсация индексі (PCR)" : "Индекс компенсации таза (PCR)"}</th>
                      <td style={{ padding: "10px 12px" }}>0.00</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.modalities?.pcr_verbal?.toFixed(2) || "0.00"}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: (analysis.modalities?.pcr_verbal ?? 0) > 0.8 ? "var(--red)" : "var(--teal)" }}>
                        {(analysis.modalities?.pcr_verbal ?? 0) > 0.8 ? (lang === "kz" ? "Қауіпті" : "Опасно") : (lang === "kz" ? "Қалыпты" : "В норме")}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: ((analysis.cdss_risk || analysis.cdss)?.pcr || 0) > 0.8 ? "var(--red)" : "var(--teal)" }}>
                        {(analysis.cdss_risk || analysis.cdss)?.pcr?.toFixed(2) || "0.00"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: ((analysis.cdss_risk || analysis.cdss)?.pcr || 0) > 0.8 ? "var(--red)" : "var(--teal)" }}>
                        {((analysis.cdss_risk || analysis.cdss)?.pcr || 0) > 0.8 ? (lang === "kz" ? "Қауіпті" : "Опасно") : (lang === "kz" ? "Қалыпты" : "В норме")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      ) : apiError ? (
        <div role="alert" className="card" style={{ padding: "32px", textAlign: "center", color: "var(--red)", fontSize: "13px" }}>
          <strong>{lang === "kz" ? "Деректерді жүктеу қатесі:" : "Ошибка загрузки данных пациента:"}</strong> {apiError}
        </div>
      ) : (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          {lang === "kz" ? "Пациент жергілікті деректер қорында табылмады." : "Пациент не найден в локальной базе данных."}
        </div>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <ReportModal
          patientCode={id}
          lang={lang}
          onClose={() => setReportOpen(false)}
        />
      )}

    </div>
  );
}
