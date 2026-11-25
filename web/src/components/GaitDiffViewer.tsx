"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { getPatientDiff } from "@/lib/api";
import { GaitDiffResponse } from "@/lib/types";
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldAlert, ArrowLeftRight } from "lucide-react";

interface Props {
  patientCode: string;
}

export function GaitDiffViewer({ patientCode }: Props) {
  const fmtFixed = (v: number | null | undefined, d = 1, unit = "") =>
    typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : "—";
  const fmtDiffSigned = (v: number | null | undefined, d = 1, unit = "") =>
    typeof v === "number" && Number.isFinite(v) ? `${v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d)}${unit}` : "—";
  const { lang } = useLanguage();
  const [diff, setDiff] = useState<GaitDiffResponse | null>(null);
  const [sessionB, setSessionB] = useState<"VR" | "Verbal">("VR");
  const [loading, setLoading] = useState(true);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDiff() {
      setLoading(true);
      setDiffError(null);
      try {
        const res = await getPatientDiff(patientCode, "Baseline", sessionB, lang);
        if (active) setDiff(res);
      } catch (err) {
        if (active) {
          setDiff(null);
          setDiffError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDiff();
    return () => {
      active = false;
    };
  }, [patientCode, sessionB, lang]);

  return (
    <section className="surface" aria-label={lang === "kz" ? "Режимдер арасындағы динамика" : "Динамика между пробами"} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ArrowLeftRight size={18} strokeWidth={1.6} color="var(--teal)" />
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
              {lang === "kz" ? "Зерттеу режимдері арасындағы клиникалық динамика" : "Динамика показателей между пробами обследования"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              {lang === "kz"
                ? "Қалыпты жүріс пен кері байланыс сынамасы арасындағы GDI, GPS, TJE, PCR және МКФ өзгерістері"
                : "Сопоставление исходного стереотипа с пробой обратной связи по индексам GDI, GPS, TJE, PCR и МКФ ВОЗ"}
            </p>
          </div>
        </div>

        <div style={{ display: "inline-flex", background: "var(--sidebar)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <button
            type="button"
            onClick={() => setSessionB("VR")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 500,
              border: "none",
              borderRadius: "6px",
              background: sessionB === "VR" ? "var(--ink)" : "transparent",
              color: sessionB === "VR" ? "var(--white)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {lang === "kz" ? "Қалыпты → VR" : "Обычная → VR"}
          </button>
          <button
            type="button"
            onClick={() => setSessionB("Verbal")}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 500,
              border: "none",
              borderRadius: "6px",
              background: sessionB === "Verbal" ? "var(--ink)" : "transparent",
              color: sessionB === "Verbal" ? "var(--white)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {lang === "kz" ? "Қалыпты → Ауызша" : "Обычная → Голос"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
          {lang === "kz" ? "Салыстырмалы көрсеткіштер есептелуде..." : "Расчёт динамики показателей..."}
        </div>
      ) : diff ? (
        <>
          {/* Clean status strip (flat, no nested pill card) */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              background:
                diff.status === "improved"
                  ? "var(--teal-bg)"
                  : diff.status === "regressed"
                  ? "var(--red-bg)"
                  : "var(--amber-bg)",
              border: `1px solid ${
                diff.status === "improved"
                  ? "var(--teal-border)"
                  : diff.status === "regressed"
                  ? "var(--red-border)"
                  : "var(--amber-border)"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {diff.status === "improved" ? (
                <CheckCircle2 size={18} color="var(--teal)" />
              ) : diff.status === "regressed" ? (
                <ShieldAlert size={18} color="var(--red)" />
              ) : (
                <AlertTriangle size={18} color="var(--amber)" />
              )}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  {diff.status === "improved"
                    ? lang === "kz"
                      ? "Оң динамика"
                      : "Положительная динамика"
                    : diff.status === "regressed"
                    ? lang === "kz"
                      ? "Жамбас компенсациясының өсуі"
                      : "Рост патологической компенсации"
                    : lang === "kz"
                    ? "Тұрақты қозғалыс статусы"
                    : "Стабильный двигательный статус"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "2px" }}>
                  {lang === "kz" ? diff.verdict_kz : diff.verdict_ru}
                </div>
              </div>
            </div>

            <div className="tabular-nums" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontFamily: "var(--mono)", fontWeight: 500 }}>
              <span style={{ color: "var(--muted)" }}>МКФ b770:</span>
              <span>{diff.icf_a}</span>
              <ArrowRight size={13} color="var(--muted)" />
              <span style={{ color: diff.icf_improved ? "var(--teal)" : "var(--ink)", fontWeight: 600 }}>{diff.icf_b}</span>
            </div>
          </div>

          {/* 4-column hairline-separated comparison row (not nested cards!) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "1px",
              background: "var(--line)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Жүріс индексі (GDI)" : "Индекс походки (GDI)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 600 }}>{fmtFixed(diff.gdi_b, 0)}</span>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>/ 100</span>
                <span style={{ fontSize: "12px", fontWeight: 600, marginLeft: "auto", color: (diff.delta_gdi ?? 0) >= 0 ? "var(--teal)" : "var(--red)" }}>
                  {fmtDiffSigned(diff.delta_gdi, 1)}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {lang === "kz" ? `Бастапқы: ${fmtFixed(diff.gdi_a, 0)}` : `Исходно: ${fmtFixed(diff.gdi_a, 0)}`}
              </div>
            </div>

            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Шынайы жазылу (TJE)" : "Истинное разгибание (TJE)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 600 }}>{fmtDiffSigned(diff.tje_b, 1, "°")}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, marginLeft: "auto", color: (diff.tje_b ?? 0) < 0 ? "var(--teal)" : "var(--amber)" }}>
                  {fmtDiffSigned(diff.delta_tje, 1, "°")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {lang === "kz" ? "Жамбасты ескере отырып" : "С поправкой на таз"}
              </div>
            </div>

            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Компенсация (PCR)" : "Компенсация (PCR)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 600, color: (diff.pcr_b ?? 0) > 0.8 ? "var(--red)" : (diff.pcr_b ?? 0) >= 0.4 ? "var(--amber)" : "var(--teal)" }}>
                  {fmtFixed(diff.pcr_b, 2)}
                </span>
                <span style={{ fontSize: "11px", fontWeight: 600, marginLeft: "auto", color: (diff.pcr_b ?? 0) > 0.8 ? "var(--red)" : (diff.pcr_b ?? 0) >= 0.4 ? "var(--amber)" : "var(--teal)" }}>
                  {typeof diff.pcr_b !== "number"
                    ? "—"
                    : diff.pcr_b > 0.8
                    ? lang === "kz"
                      ? "Қауіп"
                      : "Риск"
                    : diff.pcr_b >= 0.4
                    ? lang === "kz"
                      ? "Орташа"
                      : "Умеренно"
                    : lang === "kz"
                    ? "Қалыпты"
                    : "Норма"}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {lang === "kz" ? "Қауіп шегі: 0,80" : "Порог риска: 0,80"}
              </div>
            </div>

            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Жүріс девиациясы (GPS)" : "Индекс девиации (GPS)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 600 }}>{fmtFixed(diff.gps_b, 1, "°")}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, marginLeft: "auto", color: (diff.delta_gps ?? 0) < 0 ? "var(--teal)" : "var(--red)" }}>
                  {fmtDiffSigned(diff.delta_gps, 1, "°")}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {lang === "kz" ? `Бастапқы: ${fmtFixed(diff.gps_a, 1, "°")}` : `Исходно: ${fmtFixed(diff.gps_a, 1, "°")}`}
              </div>
            </div>
          </div>
        </>
      ) : diffError ? (
        <div style={{ padding: "14px", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--muted)", fontSize: "13px" }}>
          {lang === "kz"
            ? `Салыстыру үшін ${sessionB === "VR" ? "VR" : "ауызша нұсқау"} сынамасы жүктелмеген.`
            : `Проба (${sessionB === "VR" ? "VR" : "голосовые инструкции"}) для данного пациента не записана.`}
        </div>
      ) : null}
    </section>
  );
}
