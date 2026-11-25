"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { getPatientDiff } from "@/lib/api";
import { GaitCondition, GaitDiffResponse, VisitSummary } from "@/lib/types";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowLeftRight,
} from "lucide-react";

interface Props {
  patientCode: string;
  visits?: VisitSummary[];
  activeVisitKey?: string;
}

const ALL_CONDITIONS: GaitCondition[] = ["Baseline", "Verbal", "VR"];

function pickBestCondition(
  conditions: string[],
  preferred?: GaitCondition
): GaitCondition {
  const norm = new Set(conditions.map((c) => c.toLowerCase()));
  if (preferred && norm.has(preferred.toLowerCase())) return preferred;
  if (norm.has("vr")) return "VR";
  if (norm.has("verbal")) return "Verbal";
  if (norm.has("baseline")) return "Baseline";
  return preferred ?? "Baseline";
}

function getVisitConditions(visit?: VisitSummary): GaitCondition[] {
  if (!visit || visit.conditions.length === 0) return ALL_CONDITIONS;
  const matched = ALL_CONDITIONS.filter((cond) =>
    visit.conditions.some((c) => c.toLowerCase() === cond.toLowerCase())
  );
  return matched.length > 0 ? matched : ALL_CONDITIONS;
}

function formatVisitOption(v: VisitSummary, lang: "ru" | "kz"): string {
  const label = lang === "kz" && v.visit_label_kz ? v.visit_label_kz : v.visit_label;
  return v.visit_date ? `${label} (${v.visit_date})` : label;
}

export function GaitDiffViewer({
  patientCode,
  visits = [],
  activeVisitKey,
}: Props) {
  const fmtFixed = (v: number | null | undefined, d = 1, unit = "") =>
    typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : "—";
  const fmtDiffSigned = (v: number | null | undefined, d = 1, unit = "") =>
    typeof v === "number" && Number.isFinite(v)
      ? `${v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d)}${unit}`
      : "—";

  const { lang } = useLanguage();
  const hasMultipleVisits = visits.length >= 2;

  const activeVisit = useMemo(
    () =>
      visits.find((v) => v.visit_key === activeVisitKey) ??
      visits.find((v) => v.is_latest) ??
      visits[0],
    [visits, activeVisitKey]
  );

  const [compareMode, setCompareMode] = useState<"within" | "cross">("within");
  const [withinSessionB, setWithinSessionB] = useState<"VR" | "Verbal">("VR");

  const [visitA, setVisitA] = useState<string>("");
  const [visitB, setVisitB] = useState<string>("");
  const [crossSessionA, setCrossSessionA] = useState<GaitCondition>("VR");
  const [crossSessionB, setCrossSessionB] = useState<GaitCondition>("VR");

  const [diff, setDiff] = useState<GaitDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeVisit) return;
    const conds = activeVisit.conditions.map((c) => c.toLowerCase());
    if (!conds.includes("vr") && conds.includes("verbal")) {
      setWithinSessionB("Verbal");
    } else if (conds.includes("vr")) {
      setWithinSessionB("VR");
    }
  }, [activeVisit]);

  useEffect(() => {
    if (visits.length < 2) {
      setCompareMode("within");
      setVisitA("");
      setVisitB("");
      return;
    }

    const latestVisit =
      visits.find((v) => v.visit_key === activeVisitKey) ??
      visits.find((v) => v.is_latest) ??
      visits[visits.length - 1];

    const otherVisits = visits.filter((v) => v.visit_key !== latestVisit.visit_key);
    const earlierVisit = otherVisits[0] ?? visits[0];

    setVisitA((prev) =>
      visits.some((v) => v.visit_key === prev) ? prev : earlierVisit.visit_key
    );
    setVisitB((prev) =>
      visits.some((v) => v.visit_key === prev) ? prev : latestVisit.visit_key
    );

    const shared = ALL_CONDITIONS.slice()
      .reverse()
      .find(
        (c) =>
          earlierVisit.conditions.some((vc) => vc.toLowerCase() === c.toLowerCase()) &&
          latestVisit.conditions.some((vc) => vc.toLowerCase() === c.toLowerCase())
      );
    setCrossSessionA(pickBestCondition(earlierVisit.conditions, shared));
    setCrossSessionB(pickBestCondition(latestVisit.conditions, shared));
  }, [visits, activeVisitKey]);

  const visitObjA = useMemo(
    () => visits.find((v) => v.visit_key === visitA),
    [visits, visitA]
  );
  const visitObjB = useMemo(
    () => visits.find((v) => v.visit_key === visitB),
    [visits, visitB]
  );

  const condOptionsA = useMemo(() => getVisitConditions(visitObjA), [visitObjA]);
  const condOptionsB = useMemo(() => getVisitConditions(visitObjB), [visitObjB]);

  useEffect(() => {
    let active = true;
    async function loadDiff() {
      if (compareMode === "cross" && (!visitA || !visitB)) {
        return;
      }
      setLoading(true);
      setDiffError(null);
      try {
        const res =
          compareMode === "cross"
            ? await getPatientDiff(
                patientCode,
                crossSessionA,
                crossSessionB,
                lang,
                visitA,
                visitB
              )
            : await getPatientDiff(
                patientCode,
                "Baseline",
                withinSessionB,
                lang,
                activeVisitKey,
                activeVisitKey
              );
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
  }, [
    patientCode,
    lang,
    compareMode,
    withinSessionB,
    activeVisitKey,
    visitA,
    visitB,
    crossSessionA,
    crossSessionB,
  ]);

  const handleVisitAChange = (nextKey: string) => {
    setVisitA(nextKey);
    const nextVisit = visits.find((v) => v.visit_key === nextKey);
    if (nextVisit) {
      setCrossSessionA(pickBestCondition(nextVisit.conditions, crossSessionB));
    }
  };

  const handleVisitBChange = (nextKey: string) => {
    setVisitB(nextKey);
    const nextVisit = visits.find((v) => v.visit_key === nextKey);
    if (nextVisit) {
      setCrossSessionB(pickBestCondition(nextVisit.conditions, crossSessionA));
    }
  };

  return (
    <section
      className="surface"
      aria-label={lang === "kz" ? "Режимдер арасындағы динамика" : "Динамика между пробами"}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ArrowLeftRight size={18} strokeWidth={1.6} color="var(--teal)" />
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
              {compareMode === "cross"
                ? lang === "kz"
                  ? "Визиттер арасындағы клиникалық динамика"
                  : "Сравнение показателей между визитами"
                : lang === "kz"
                ? "Зерттеу режимдері арасындағы клиникалық динамика"
                : "Динамика показателей между пробами обследования"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              {compareMode === "cross"
                ? lang === "kz"
                  ? "Екі визиттегі GDI, GPS, TJE, PCR және МКФ мәндерін салыстыру"
                  : "Сопоставление GDI, GPS, TJE, PCR и МКФ ВОЗ между двумя датами обследования"
                : lang === "kz"
                ? "Қалыпты жүріс пен кері байланыс сынамасы арасындағы GDI, GPS, TJE, PCR және МКФ өзгерістері"
                : "Сопоставление исходного стереотипа с пробой обратной связи по индексам GDI, GPS, TJE, PCR и МКФ ВОЗ"}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label={lang === "kz" ? "Салыстыру режимі" : "Режим сравнения"}
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: "2px",
            background: "var(--sidebar)",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
          }}
        >
          <button
            type="button"
            aria-pressed={compareMode === "within" && withinSessionB === "VR"}
            onClick={() => {
              setCompareMode("within");
              setWithinSessionB("VR");
            }}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 500,
              border: "none",
              borderRadius: "6px",
              background:
                compareMode === "within" && withinSessionB === "VR"
                  ? "var(--ink)"
                  : "transparent",
              color:
                compareMode === "within" && withinSessionB === "VR"
                  ? "var(--white)"
                  : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {lang === "kz" ? "Қалыпты → VR" : "Обычная → VR"}
          </button>
          <button
            type="button"
            aria-pressed={compareMode === "within" && withinSessionB === "Verbal"}
            onClick={() => {
              setCompareMode("within");
              setWithinSessionB("Verbal");
            }}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 500,
              border: "none",
              borderRadius: "6px",
              background:
                compareMode === "within" && withinSessionB === "Verbal"
                  ? "var(--ink)"
                  : "transparent",
              color:
                compareMode === "within" && withinSessionB === "Verbal"
                  ? "var(--white)"
                  : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {lang === "kz" ? "Қалыпты → Ауызша" : "Обычная → Голос"}
          </button>
          {hasMultipleVisits && (
            <button
              type="button"
              aria-pressed={compareMode === "cross"}
              onClick={() => setCompareMode("cross")}
              style={{
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 500,
                border: "none",
                borderRadius: "6px",
                background: compareMode === "cross" ? "var(--ink)" : "transparent",
                color: compareMode === "cross" ? "var(--white)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              {lang === "kz" ? "Визиттерді салыстыру" : "Сравнение визитов"}
            </button>
          )}
        </div>
      </div>

      {compareMode === "cross" && hasMultipleVisits && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "8px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <label
              htmlFor="diff-visit-a"
              style={{ fontSize: "12px", fontWeight: 600, color: "var(--secondary)" }}
            >
              {lang === "kz" ? "Визит А:" : "Визит А:"}
            </label>
            <select
              id="diff-visit-a"
              value={visitA}
              onChange={(e) => handleVisitAChange(e.target.value)}
              style={{ minBlockSize: "34px", padding: "4px 10px", fontSize: "12px" }}
            >
              {visits.map((v) => (
                <option key={v.visit_key} value={v.visit_key}>
                  {formatVisitOption(v, lang)}
                </option>
              ))}
            </select>
            <select
              aria-label={lang === "kz" ? "А сынамасы" : "Проба А"}
              value={crossSessionA}
              onChange={(e) => setCrossSessionA(e.target.value as GaitCondition)}
              style={{ minBlockSize: "34px", padding: "4px 10px", fontSize: "12px" }}
            >
              {condOptionsA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight size={15} color="var(--muted)" aria-hidden="true" />

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <label
              htmlFor="diff-visit-b"
              style={{ fontSize: "12px", fontWeight: 600, color: "var(--secondary)" }}
            >
              {lang === "kz" ? "Визит Б:" : "Визит Б:"}
            </label>
            <select
              id="diff-visit-b"
              value={visitB}
              onChange={(e) => handleVisitBChange(e.target.value)}
              style={{ minBlockSize: "34px", padding: "4px 10px", fontSize: "12px" }}
            >
              {visits.map((v) => (
                <option key={v.visit_key} value={v.visit_key}>
                  {formatVisitOption(v, lang)}
                </option>
              ))}
            </select>
            <select
              aria-label={lang === "kz" ? "Б сынамасы" : "Проба Б"}
              value={crossSessionB}
              onChange={(e) => setCrossSessionB(e.target.value as GaitCondition)}
              style={{ minBlockSize: "34px", padding: "4px 10px", fontSize: "12px" }}
            >
              {condOptionsB.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
          {lang === "kz" ? "Салыстырмалы көрсеткіштер есептелуде..." : "Расчёт динамики показателей..."}
        </div>
      ) : diff ? (
        <>
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
                  {compareMode === "cross" && (
                    <span style={{ fontWeight: 400, color: "var(--secondary)", marginLeft: "6px" }}>
                      ({diff.session_a_label} → {diff.session_b_label})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "var(--secondary)", marginTop: "2px" }}>
                  {lang === "kz" ? diff.verdict_kz : diff.verdict_ru}
                </div>
              </div>
            </div>

            <div
              className="tabular-nums"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontFamily: "var(--mono)",
                fontWeight: 500,
              }}
            >
              <span style={{ color: "var(--muted)" }}>МКФ b770:</span>
              <span>{diff.icf_a}</span>
              <ArrowRight size={13} color="var(--muted)" />
              <span style={{ color: diff.icf_improved ? "var(--teal)" : "var(--ink)", fontWeight: 600 }}>
                {diff.icf_b}
              </span>
            </div>
          </div>

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
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    marginLeft: "auto",
                    color: (diff.delta_gdi ?? 0) >= 0 ? "var(--teal)" : "var(--red)",
                  }}
                >
                  {fmtDiffSigned(diff.delta_gdi, 1)}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {compareMode === "cross"
                  ? `А: ${fmtFixed(diff.gdi_a, 0)}`
                  : lang === "kz"
                  ? `Бастапқы: ${fmtFixed(diff.gdi_a, 0)}`
                  : `Исходно: ${fmtFixed(diff.gdi_a, 0)}`}
              </div>
            </div>

            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Шынайы жазылу (TJE)" : "Истинное разгибание (TJE)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 600 }}>{fmtDiffSigned(diff.tje_b, 1, "°")}</span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    marginLeft: "auto",
                    color: (diff.tje_b ?? 0) < 0 ? "var(--teal)" : "var(--amber)",
                  }}
                >
                  {fmtDiffSigned(diff.delta_tje, 1, "°")}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {compareMode === "cross"
                  ? `А: ${fmtDiffSigned(diff.tje_a, 1, "°")}`
                  : lang === "kz"
                  ? "Жамбасты ескере отырып"
                  : "С поправкой на таз"}
              </div>
            </div>

            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Компенсация (PCR)" : "Компенсация (PCR)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    color:
                      (diff.pcr_b ?? 0) > 0.8
                        ? "var(--red)"
                        : (diff.pcr_b ?? 0) >= 0.4
                        ? "var(--amber)"
                        : "var(--teal)",
                  }}
                >
                  {fmtFixed(diff.pcr_b, 2)}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    marginLeft: "auto",
                    color:
                      (diff.pcr_b ?? 0) > 0.8
                        ? "var(--red)"
                        : (diff.pcr_b ?? 0) >= 0.4
                        ? "var(--amber)"
                        : "var(--teal)",
                  }}
                >
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
              <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {compareMode === "cross"
                  ? `А: ${fmtFixed(diff.pcr_a, 2)} · Δ ${fmtDiffSigned(diff.delta_pcr, 2)}`
                  : lang === "kz"
                  ? "Қауіп шегі: 0,80"
                  : "Порог риска: 0,80"}
              </div>
            </div>

            <div style={{ padding: "14px", background: "var(--paper)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "Жүріс девиациясы (GPS)" : "Индекс девиации (GPS)"}
              </div>
              <div className="tabular-nums" style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 600 }}>{fmtFixed(diff.gps_b, 1, "°")}</span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    marginLeft: "auto",
                    color: (diff.delta_gps ?? 0) < 0 ? "var(--teal)" : "var(--red)",
                  }}
                >
                  {fmtDiffSigned(diff.delta_gps, 1, "°")}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {compareMode === "cross"
                  ? `А: ${fmtFixed(diff.gps_a, 1, "°")}`
                  : lang === "kz"
                  ? `Бастапқы: ${fmtFixed(diff.gps_a, 1, "°")}`
                  : `Исходно: ${fmtFixed(diff.gps_a, 1, "°")}`}
              </div>
            </div>
          </div>
        </>
      ) : diffError ? (
        <div
          style={{
            padding: "14px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            color: "var(--muted)",
            fontSize: "13px",
          }}
        >
          {compareMode === "cross"
            ? lang === "kz"
              ? `Таңдалған визиттер (${crossSessionA} → ${crossSessionB}) үшін салыстырмалы деректер табылмады.`
              : `Для выбранной пары визитов (${crossSessionA} → ${crossSessionB}) данные одной из проб отсутствуют.`
            : lang === "kz"
            ? `Салыстыру үшін ${withinSessionB === "VR" ? "VR" : "ауызша нұсқау"} сынамасы жүктелмеген.`
            : `Проба (${withinSessionB === "VR" ? "VR" : "голосовые инструкции"}) для данного визита не записана.`}
        </div>
      ) : null}
    </section>
  );
}
