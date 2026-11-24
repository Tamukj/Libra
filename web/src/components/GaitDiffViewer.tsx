"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { getPatientDiff } from "@/lib/api";
import { GaitDiffResponse } from "@/lib/types";
import { GitCompare, TrendingUp, TrendingDown, ArrowRight, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface Props {
  patientCode: string;
}

export function GaitDiffViewer({ patientCode }: Props) {
  const { lang } = useLanguage();
  const [diff, setDiff] = useState<GaitDiffResponse | null>(null);
  const [sessionB, setSessionB] = useState<"VR" | "Verbal">("VR");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDiff() {
      setLoading(true);
      try {
        const res = await getPatientDiff(patientCode, "Baseline", sessionB);
        setDiff(res);
      } catch (err) {
        console.error("Failed to load patient diff:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDiff();
  }, [patientCode, sessionB]);

  return (
    <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      
      {/* Header with Comparison Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <GitCompare size={20} color="var(--teal)" />
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              {lang === "kz" ? "Биомеханикалық Дифф (Git Diff динамикасы)" : "Биомеханический Diff динамики лечения"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "2px 0 0" }}>
              {lang === "kz"
                ? "Базалық күй мен реабилитация курсынан кейінгі өзгерістерді салыстыру"
                : "Лонгитюдное сопоставление сессий: прирост TJE, устранение наклона таза и сдвиг МКФ ВОЗ"}
            </p>
          </div>
        </div>

        {/* Target Session Toggle */}
        <div style={{ display: "inline-flex", background: "var(--linen)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <button
            onClick={() => setSessionB("VR")}
            className="btn"
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 650,
              border: "none",
              borderRadius: "6px",
              background: sessionB === "VR" ? "var(--ink)" : "transparent",
              color: sessionB === "VR" ? "var(--white)" : "var(--ink)"
            }}
          >
            {lang === "kz" ? "Baseline → VR (Көру кері байланысы)" : "Baseline → VR (Зрительная ОС)"}
          </button>
          <button
            onClick={() => setSessionB("Verbal")}
            className="btn"
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 650,
              border: "none",
              borderRadius: "6px",
              background: sessionB === "Verbal" ? "var(--ink)" : "transparent",
              color: sessionB === "Verbal" ? "var(--white)" : "var(--ink)"
            }}
          >
            {lang === "kz" ? "Baseline → Verbal (Дауыс нұсқауы)" : "Baseline → Verbal (Голосовая ОС)"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
          {lang === "kz" ? "Сессиялар арасындағы дифф есептелуде..." : "Расчет биомеханического диффа между сессиями..."}
        </div>
      ) : diff ? (
        <>
          {/* Main Git-Like Status Ribbon */}
          <div style={{
            padding: "14px 16px",
            borderRadius: "8px",
            background: diff.status === "improved" ? "var(--teal-bg)" : (diff.status === "regressed" ? "var(--red-bg)" : "var(--amber-bg)"),
            border: `1px solid ${diff.status === "improved" ? "var(--teal-border)" : (diff.status === "regressed" ? "var(--red-border)" : "var(--amber-border)")}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {diff.status === "improved" ? (
                <CheckCircle2 size={22} color="var(--teal)" />
              ) : diff.status === "regressed" ? (
                <ShieldAlert size={22} color="var(--red)" />
              ) : (
                <AlertTriangle size={22} color="var(--amber)" />
              )}
              <div>
                <div style={{ fontSize: "14px", fontWeight: 750, color: "var(--ink)" }}>
                  {diff.status === "improved"
                    ? (lang === "kz" ? "ОҢ ДИНАМИКА: КЛИНИКАЛЫҚ ПРОГРЕСС" : "ПОЛОЖИТЕЛЬНАЯ ДИНАМИКА: ИСТИННЫЙ ПРОГРЕСС")
                    : diff.status === "regressed"
                    ? (lang === "kz" ? "ЕСКЕРТУ: ПАТОЛОГИЯЛЫҚ КОМПЕНСАЦИЯ ӨСТІ" : "ВНИМАНИЕ: РОСТ ПАТОЛОГИЧЕСКОЙ КОМПЕНСАЦИИ")
                    : (lang === "kz" ? "ТҰРАҚТЫ ДВИГАТЕЛЬДІ СТАТУС" : "СТАБИЛЬНЫЙ ДВИГАТЕЛЬНЫЙ СТАТУС")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  {lang === "kz" ? diff.verdict_kz : diff.verdict_ru}
                </div>
              </div>
            </div>

            {/* WHO ICF Transition Badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              borderRadius: "6px",
              background: "var(--white)",
              border: "1px solid var(--line)",
              fontSize: "12px",
              fontWeight: 700
            }}>
              <span style={{ color: "var(--muted)" }}>МКФ b770:</span>
              <span style={{ color: "var(--red)" }}>{diff.icf_a}</span>
              <ArrowRight size={13} color="var(--muted)" />
              <span style={{ color: diff.icf_improved ? "var(--teal)" : "var(--ink)" }}>{diff.icf_b}</span>
              {diff.icf_improved && (
                <span className="badge badge-green" style={{ fontSize: "10px", padding: "1px 6px" }}>
                  {lang === "kz" ? "+1 санат" : "+1 уровень"}
                </span>
              )}
            </div>
          </div>

          {/* 4 Quantitative Git-Diff Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            
            {/* 1. GDI Index */}
            <div style={{ padding: "12px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                {lang === "kz" ? "Сагитталды GDI индексі" : "Индекс походки GDI (0-100)"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "4px 0" }}>
                <span style={{ fontSize: "20px", fontWeight: 750, color: "var(--ink)" }}>{diff.gdi_b.toFixed(0)}</span>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>/ 100</span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: diff.delta_gdi >= 0 ? "var(--teal)" : "var(--red)",
                  marginLeft: "auto"
                }}>
                  {diff.delta_gdi >= 0 ? `+${diff.delta_gdi.toFixed(1)}` : `${diff.delta_gdi.toFixed(1)}`}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {lang === "kz" ? `Бастапқы: ${diff.gdi_a.toFixed(0)} ұпай` : `Базовый: ${diff.gdi_a.toFixed(0)} баллов`}
              </div>
            </div>

            {/* 2. True Joint Extension (TJE) */}
            <div style={{ padding: "12px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                {lang === "kz" ? "Шынайы буын жазылуы (TJE)" : "Истинное разгибание (TJE)"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "4px 0" }}>
                <span style={{ fontSize: "20px", fontWeight: 750, color: "var(--ink)" }}>{diff.tje_b.toFixed(1)}°</span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: diff.tje_b < 0 ? "var(--teal)" : "var(--amber)",
                  marginLeft: "auto"
                }}>
                  {diff.delta_tje.toFixed(1)}°
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {lang === "kz" ? "Жамбас ауытқуынсыз" : "Без наклона таза"}
              </div>
            </div>

            {/* 3. Pathological Compensation Ratio (PCR) */}
            <div style={{ padding: "12px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                {lang === "kz" ? "Компенсация коэфф. (PCR)" : "Коэфф. компенсации (PCR)"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "4px 0" }}>
                <span style={{ fontSize: "20px", fontWeight: 750, color: diff.pcr_b > 0.8 ? "var(--red)" : "var(--teal)" }}>
                  {diff.pcr_b.toFixed(2)}
                </span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: diff.pcr_b > 0.8 ? "var(--red)" : "var(--teal)",
                  marginLeft: "auto"
                }}>
                  {diff.pcr_b > 0.8
                    ? (lang === "kz" ? "Қауіп (>0.8)" : "Риск (>0.8)")
                    : (lang === "kz" ? "Қалыпты (<0.8)" : "Норма (<0.8)")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {lang === "kz" ? "Шекті мән: 0.80" : "Порог риска: 0.80"}
              </div>
            </div>

            {/* 4. Gait Profile Score (GPS) */}
            <div style={{ padding: "12px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                {lang === "kz" ? "Жүріс девиациясы (GPS)" : "Девиация шага (GPS)"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "4px 0" }}>
                <span style={{ fontSize: "20px", fontWeight: 750, color: "var(--ink)" }}>{diff.gps_b.toFixed(1)}°</span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: diff.delta_gps < 0 ? "var(--teal)" : "var(--red)",
                  marginLeft: "auto"
                }}>
                  {diff.delta_gps < 0 ? `${diff.delta_gps.toFixed(1)}°` : `+${diff.delta_gps.toFixed(1)}°`}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {lang === "kz" ? `Бастапқы: ${diff.gps_a.toFixed(1)}°` : `Базовый: ${diff.gps_a.toFixed(1)}°`}
              </div>
            </div>

          </div>
        </>
      ) : null}

    </div>
  );
}
