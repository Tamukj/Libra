"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { CdssTrafficLight } from "@/components/CdssTrafficLight";
import { KinematicsChart } from "@/components/KinematicsChart";
import { RadarGvs } from "@/components/RadarGvs";
import { RegionalStats } from "@/components/RegionalStats";
import { MlValidation } from "@/components/MlValidation";
import { ReportModal } from "@/components/ReportModal";
import {
  getPatients,
  getPatientAnalysis,
  getPatientKinematics,
  getRegionalStats,
  getMLMetrics,
  uploadPatientCSV
} from "@/lib/api";
import { Patient, PatientAnalysis, KinematicsResponse, RegionalStats as RegionalStatsType, MLMetrics } from "@/lib/types";
import { translations } from "@/lib/translations";
import { UserCheck, FileText, Upload, RefreshCw } from "lucide-react";

export default function MainPage() {
  const [lang, setLang] = useState<"ru" | "kz">("ru");
  const [activeTab, setActiveTab] = useState<string>("patient");
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("s61520_1");
  
  const [analysis, setAnalysis] = useState<PatientAnalysis | null>(null);
  const [kinematics, setKinematics] = useState<KinematicsResponse | null>(null);
  const [regionalStats, setRegionalStats] = useState<RegionalStatsType | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MLMetrics | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadNotice(lang === "kz" ? "Файл импортталуда..." : "Импорт файла...");
      const res = await uploadPatientCSV(file);
      setUploadNotice(lang === "kz" ? res.message_kz : res.message_ru);
      const updatedPts = await getPatients();
      setPatients(updatedPts);
      if (res.code) {
        setSelectedCode(res.code);
      }
      setTimeout(() => setUploadNotice(null), 5000);
    } catch (err) {
      setUploadNotice(lang === "kz" ? "Жүктеу қатесі: CSV форматын тексеріңіз" : "Ошибка загрузки: проверьте формат CSV");
      setTimeout(() => setUploadNotice(null), 5000);
    }
  };

  const t = translations[lang];

  // Load initial global data
  useEffect(() => {
    async function loadInitial() {
      try {
        const [pts, reg, ml] = await Promise.all([
          getPatients(),
          getRegionalStats(),
          getMLMetrics()
        ]);
        setPatients(pts);
        setRegionalStats(reg);
        setMlMetrics(ml);

        if (pts.length > 0) {
          const defaultCode = pts.some(p => p.code === "s61520_1") ? "s61520_1" : pts[0].code;
          setSelectedCode(defaultCode);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  // Load patient specific data
  useEffect(() => {
    if (!selectedCode) return;
    async function loadPatientData() {
      try {
        const [an, kin] = await Promise.all([
          getPatientAnalysis(selectedCode),
          getPatientKinematics(selectedCode)
        ]);
        setAnalysis(an);
        setKinematics(kin);
      } catch (err) {
        console.error("Failed to load patient data:", err);
      }
    }
    loadPatientData();
  }, [selectedCode]);

  const activePatient = patients.find(p => p.code === selectedCode);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      
      {/* 1. Header */}
      <Header lang={lang} setLang={setLang} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. Main Content Canvas */}
      <main className="container" style={{ flex: 1, paddingBlock: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Patient Selection Bar */}
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={18} color="var(--teal)" />
              <span style={{ fontWeight: "600", fontSize: "13px" }}>{t.patient_select}</span>
            </div>

            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              style={{ minWidth: "160px", fontWeight: "600" }}
            >
              {patients.map((p) => (
                <option key={p.code} value={p.code}>
                  Пациент {p.code} ({p.side})
                </option>
              ))}
            </select>
          </div>

          {activePatient && (
            <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--muted)", alignItems: "center" }}>
              <div>{t.side}: <strong style={{ color: "var(--ink)" }}>{activePatient.side}</strong></div>
              <div>{t.weight}: <strong style={{ color: "var(--ink)" }}>{activePatient.weight.toFixed(1)} кг</strong></div>
              <div>{t.height}: <strong style={{ color: "var(--ink)" }}>{activePatient.height.toFixed(2)} м</strong></div>
              <div>{t.leg_length}: <strong style={{ color: "var(--ink)" }}>{activePatient.leg_length.toFixed(3)} м</strong></div>
              {analysis && (
                <span className="badge badge-green" style={{ fontSize: "11px" }}>
                  {analysis.summary.cycles_baseline + analysis.summary.cycles_vr} {t.cycles_recorded}
                </span>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ display: "flex", gap: "8px" }} className="no-print">
            <button
              onClick={() => setReportModalOpen(true)}
              className="btn btn-teal"
            >
              <FileText size={15} />
              {t.btn_report}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn"
            >
              <Upload size={15} />
              {t.btn_upload}
            </button>
          </div>

        </div>

        {/* Upload Notification Banner */}
        {uploadNotice && (
          <div style={{
            background: "var(--teal-bg)",
            border: "1px solid var(--teal-border)",
            color: "var(--teal)",
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600"
          }}>
            {uploadNotice}
          </div>
        )}

        {/* Dynamic View based on Active Tab */}
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
            Жүктелуде / Загрузка клинических данных...
          </div>
        ) : (
          <>
            {/* TAB: PATIENT OVERVIEW */}
            {activeTab === "patient" && analysis && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* CDSS Traffic Light */}
                <CdssTrafficLight analysis={analysis} lang={lang} />

                {/* Split View: Kinematics Curve (Left) + GVS Radar (Right) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "20px" }}>
                  {kinematics && <KinematicsChart data={kinematics} lang={lang} />}
                  <RadarGvs summary={analysis.summary} lang={lang} />
                </div>

              </div>
            )}

            {/* TAB: DEEP KINEMATICS */}
            {activeTab === "kinematics" && kinematics && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="card-raised">
                  <h2 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>
                    Непрерывные кривые цикла шага (0.0% – 100.0% Gait Cycle)
                  </h2>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                    Лабораторный 3D захват Vicon GRAIL (51 точка). Серый коридор — доверительный интервал нормы здоровых детей TD (±1 SD).
                  </div>
                </div>
                <KinematicsChart data={kinematics} lang={lang} />
              </div>
            )}

            {/* TAB: RADAR & GVS DEVIATIONS */}
            {activeTab === "radar" && analysis && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <RadarGvs summary={analysis.summary} lang={lang} />
                <div className="card">
                  <h3 style={{ fontSize: "15px", marginBottom: "14px" }}>Сравнение девиаций суставов по шкале Бейкера (GVS)</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                        <th style={{ padding: "8px 0" }}>Сустав</th>
                        <th>Baseline</th>
                        <th>Verbal</th>
                        <th>VR</th>
                        <th>Дельта (VR-Base)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px 0", fontWeight: "600" }}>Таз (Pelvis SagP)</td>
                        <td>{analysis.summary.baseline_gvs_pelvis.toFixed(1)}°</td>
                        <td>{analysis.summary.verbal_gvs_pelvis?.toFixed(1) || "-"}°</td>
                        <td style={{ color: "var(--red)", fontWeight: "600" }}>{analysis.summary.vr_gvs_pelvis.toFixed(1)}°</td>
                        <td style={{ color: "var(--red)" }}>+{analysis.summary.delta_gvs_pelvis.toFixed(1)}° (Компенсация)</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px 0", fontWeight: "600" }}>Бедро (Hip SagH)</td>
                        <td>{analysis.summary.baseline_gvs_hip.toFixed(1)}°</td>
                        <td>{analysis.summary.verbal_gvs_hip?.toFixed(1) || "-"}°</td>
                        <td>{analysis.summary.vr_gvs_hip.toFixed(1)}°</td>
                        <td>{analysis.summary.delta_gvs_hip > 0 ? `+${analysis.summary.delta_gvs_hip.toFixed(1)}` : analysis.summary.delta_gvs_hip.toFixed(1)}°</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px 0", fontWeight: "600" }}>Колено (Knee SagK)</td>
                        <td>{analysis.summary.baseline_gvs_knee.toFixed(1)}°</td>
                        <td>{analysis.summary.verbal_gvs_knee?.toFixed(1) || "-"}°</td>
                        <td>{analysis.summary.vr_gvs_knee.toFixed(1)}°</td>
                        <td>{analysis.summary.delta_gvs_knee > 0 ? `+${analysis.summary.delta_gvs_knee.toFixed(1)}` : analysis.summary.delta_gvs_knee.toFixed(1)}°</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px 0", fontWeight: "600" }}>Стопа (Ankle SagA)</td>
                        <td>{analysis.summary.baseline_gvs_ankle.toFixed(1)}°</td>
                        <td>{analysis.summary.verbal_gvs_ankle?.toFixed(1) || "-"}°</td>
                        <td>{analysis.summary.vr_gvs_ankle.toFixed(1)}°</td>
                        <td>{analysis.summary.delta_gvs_ankle > 0 ? `+${analysis.summary.delta_gvs_ankle.toFixed(1)}` : analysis.summary.delta_gvs_ankle.toFixed(1)}°</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: ML & ZERO-LEAKAGE VALIDATION */}
            {activeTab === "ml" && mlMetrics && (
              <MlValidation metrics={mlMetrics} lang={lang} />
            )}

            {/* TAB: REGIONAL OPEN DATA (stat.gov.kz / data.egov.kz) */}
            {activeTab === "regional" && regionalStats && (
              <RegionalStats stats={regionalStats} lang={lang} />
            )}
          </>
        )}

      </main>

      {/* 3. Clinical Report Modal */}
      {reportModalOpen && (
        <ReportModal
          patientCode={selectedCode}
          lang={lang}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {/* 4. Footer */}
      <footer style={{ borderTop: "1px solid var(--line)", background: "var(--linen)", padding: "16px 0", fontSize: "12px", color: "var(--muted)" }} className="no-print">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            AI-Sana Shakarim Solveathon: AI & Medicine-2026 · Shakarim University (Семей қ.)
          </div>
          <div>
            Лицензия датасета: CC-BY-NC-SA-4.0 (KU Leuven) · Защита персональных данных РК
          </div>
        </div>
      </footer>

    </div>
  );
}
