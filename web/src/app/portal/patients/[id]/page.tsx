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
import { ArrowLeft, FileText, Sparkles, Activity, ShieldCheck, AlertCircle } from "lucide-react";

export default function PatientDossierPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id || "s61520_1";

  const { lang, setLang, t } = useLanguage();
  const [analysis, setAnalysis] = useState<PatientAnalysis | null>(null);
  const [kinematics, setKinematics] = useState<KinematicsResponse | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [an, kin, pts] = await Promise.all([
          getPatientAnalysis(id),
          getPatientKinematics(id),
          getPatients()
        ]);
        setAnalysis(an);
        setKinematics(kin);
        const p = pts.find((item) => item.code === id) || null;
        setPatient(p);
      } catch (err) {
        console.error("Failed to load patient dossier:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                {t.weight}: <strong>{patient.weight.toFixed(1)} кг</strong>, {t.height}: <strong>{patient.height.toFixed(2)} м</strong>, {t.leg_length}: <strong>{patient.leg_length.toFixed(3)} м</strong>, шкала GMFCS I–II
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
            <div className="card" style={{ padding: "16px", borderLeft: `4px solid ${analysis.ml?.responder_prediction?.is_predicted_responder ? "var(--teal)" : "var(--amber)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "750" }}>
                  <Sparkles size={16} color="var(--amber)" />
                  <span>{lang === "kz" ? "ИИ-болжам: VR-терапияға клиникалық жауап (LOO)" : "ИИ-прогноз: Клинический отклик на VR (LOO)"}</span>
                </div>
                <span className={`badge ${analysis.ml?.responder_prediction?.is_predicted_responder ? "badge-green" : "badge-yellow"}`}>
                  {analysis.ml?.responder_prediction?.is_predicted_responder ? "True Responder" : "High Compensation Risk"}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink)", fontWeight: "600", marginBottom: "4px" }}>
                {lang === "kz"
                  ? analysis.ml?.responder_prediction?.clinical_status_kz
                  : analysis.ml?.responder_prediction?.clinical_status_ru}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                {lang === "kz"
                  ? analysis.ml?.responder_prediction?.recommendation_kz
                  : analysis.ml?.responder_prediction?.recommendation_ru}
              </div>

              {/* XAI: Exact Closed-Form Linear Attributions */}
              {analysis.ml?.responder_prediction?.feature_attributions && analysis.ml.responder_prediction.feature_attributions.length > 0 && (
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>
                    {lang === "kz" ? "ИИ-түсіндірме (XAI биомеханикалық факторлар):" : "Факторы влияния модели (XAI Shapley Attribution):"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {analysis.ml.responder_prediction.feature_attributions.slice(0, 3).map((attr) => (
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
            </div>

            {/* Model 2: PCA Gait Stability & Fatigue Monitor */}
            <div className="card" style={{ padding: "16px", borderLeft: `4px solid ${analysis.ml?.pca_stability?.is_stable ? "var(--teal)" : "var(--red)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "750" }}>
                  <Activity size={16} color="var(--teal)" />
                  <span>{lang === "kz" ? "PCA қадам тұрақтылығы және шаршау детекторы" : "PCA-детектор стабильности шагов и утомления"}</span>
                </div>
                <span className={`badge ${analysis.ml?.pca_stability?.is_stable ? "badge-green" : "badge-red"}`}>
                  {analysis.ml?.pca_stability?.is_stable ? (lang === "kz" ? "Тұрақты локомоция" : "Стабильный шаг") : (lang === "kz" ? "Шаршау белгісі" : "Риск спотыкания")}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink)", fontWeight: "600", marginBottom: "4px" }}>
                {lang === "kz"
                  ? `Аномальді циклдер: ${analysis.ml?.pca_stability?.n_anomalies || 0} / ${analysis.ml?.pca_stability?.n_cycles || 0} (${((analysis.ml?.pca_stability?.anomaly_rate || 0.05) * 100).toFixed(1)}%)`
                  : `Нестабильных шагов: ${analysis.ml?.pca_stability?.n_anomalies || 0} из ${analysis.ml?.pca_stability?.n_cycles || 0} (${((analysis.ml?.pca_stability?.anomaly_rate || 0.05) * 100).toFixed(1)}%)`}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                {lang === "kz"
                  ? "Kinematic PCA бақылауы шаршау мен тепе-теңдікті жоғалту қаупін алдын ала анықтайды."
                  : "Мониторинг реконструкции кинематических кривых предотвращает спотыкания при утомлении."}
              </div>
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
          <div className="grid-split-gvs" style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "18px", alignItems: "stretch" }}>
            
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
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "VR аватар" : "VR аватар"}</th>
                      <th scope="col" style={{ padding: "10px 12px", fontWeight: 700 }}>{lang === "kz" ? "Дельта (VR - Base)" : "Дельта (VR - Base)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 650 }}>{lang === "kz" ? "Жамбас (Pelvis SagP)" : "Таз (Pelvis SagP)"}</th>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.baseline_gvs_pelvis.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.verbal_gvs_pelvis?.toFixed(1) || "-"}°</td>
                      <td style={{ padding: "10px 12px", color: "var(--red)", fontWeight: 700 }}>{analysis.summary.vr_gvs_pelvis.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px", color: "var(--red)", fontWeight: 600 }}>
                        +{analysis.summary.delta_gvs_pelvis.toFixed(1)}° {lang === "kz" ? "(Компенсация)" : "(Компенсация)"}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 650 }}>{lang === "kz" ? "Сан (Hip SagH)" : "Бедро (Hip SagH)"}</th>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.baseline_gvs_hip.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.verbal_gvs_hip?.toFixed(1) || "-"}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.vr_gvs_hip.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.delta_gvs_hip.toFixed(1)}°</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 650 }}>{lang === "kz" ? "Тізе (Knee SagK)" : "Колено (Knee SagK)"}</th>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.baseline_gvs_knee.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.verbal_gvs_knee?.toFixed(1) || "-"}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.vr_gvs_knee.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.delta_gvs_knee.toFixed(1)}°</td>
                    </tr>
                    <tr>
                      <th scope="row" style={{ padding: "10px 12px", fontWeight: 650 }}>{lang === "kz" ? "Толарсақ (Ankle SagA)" : "Стопа (Ankle SagA)"}</th>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.baseline_gvs_ankle.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.verbal_gvs_ankle?.toFixed(1) || "-"}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.vr_gvs_ankle.toFixed(1)}°</td>
                      <td style={{ padding: "10px 12px" }}>{analysis.summary.delta_gvs_ankle.toFixed(1)}°</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
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
