"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, GitCompare } from "lucide-react";
import { getPatientDiff } from "@/lib/api";
import { cleanClinicalText, fmtFixed, fmtPcr, fmtSigned } from "@/lib/format";
import { useLanguage, type Lang } from "@/lib/LanguageContext";
import type { GaitCondition, GaitDiffResponse, VisitSummary } from "@/lib/types";

interface GaitDiffViewerProps {
  patientCode: string;
  visits?: VisitSummary[];
  activeVisitKey?: string;
}

function getConditionLabel(
  condition: string,
  lang: Lang,
  fallbackLabel?: string
): string {
  const norm = condition.toLowerCase();
  if (norm === "baseline") return lang === "kz" ? "Қалыпты жүріс" : "Обычная ходьба";
  if (norm === "verbal") return lang === "kz" ? "Ауызша нұсқау" : "Голосовые инструкции";
  if (norm === "vr") return lang === "kz" ? "VR-кері байланыс" : "VR-обратная связь";
  return fallbackLabel || condition;
}

export function GaitDiffViewer({
  patientCode,
  visits = [],
  activeVisitKey,
}: GaitDiffViewerProps) {
  const { lang } = useLanguage();
  const isKz = lang === "kz";

  const hasMultipleVisits = visits.length >= 2;
  const [compareMode, setCompareMode] = useState<"within" | "cross">("within");
  const [withinSessionB, setWithinSessionB] = useState<"VR" | "Verbal">("VR");
  const [visitA, setVisitA] = useState<string>("");
  const [visitB, setVisitB] = useState<string>("");
  const [crossSessionA, setCrossSessionA] = useState<GaitCondition>("Baseline");
  const [crossSessionB, setCrossSessionB] = useState<GaitCondition>("Baseline");
  const [diff, setDiff] = useState<GaitDiffResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ code?: string } | undefined>).detail;
      if (!detail?.code || detail.code === patientCode) {
        setRefreshTick((n) => n + 1);
      }
    };
    window.addEventListener("libra:patient-updated", onUpdated);
    return () => window.removeEventListener("libra:patient-updated", onUpdated);
  }, [patientCode]);

  useEffect(() => {
    if (visits.length >= 2) {
      const oldest = visits[visits.length - 1]?.visit_key ?? visits[0].visit_key;
      const latest = activeVisitKey || visits[0].visit_key;
      setVisitA((prev) =>
        prev && visits.some((v) => v.visit_key === prev) ? prev : oldest
      );
      setVisitB((prev) => {
        if (prev && visits.some((v) => v.visit_key === prev)) return prev;
        return latest !== oldest ? latest : visits[0].visit_key;
      });
    } else if (visits.length === 1) {
      setVisitA(visits[0].visit_key);
      setVisitB(visits[0].visit_key);
      setCompareMode("within");
    }
  }, [visits, activeVisitKey]);

  useEffect(() => {
    let active = true;
    const isCross = compareMode === "cross" && hasMultipleVisits && visitA && visitB;
    const sessA = isCross ? crossSessionA : "Baseline";
    const sessB = isCross ? crossSessionB : withinSessionB;
    const vA = isCross ? visitA : activeVisitKey;
    const vB = isCross ? visitB : activeVisitKey;

    setLoading(true);
    setDiffError(null);

    getPatientDiff(patientCode, sessA, sessB, lang, vA, vB)
      .then((res) => {
        if (active) setDiff(res);
      })
      .catch((err) => {
        if (active) {
          setDiff(null);
          setDiffError(
            err instanceof Error
              ? err.message
              : isKz
                ? "Салыстыру деректері қолжетімсіз"
                : "Данные сравнения недоступны"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    patientCode,
    compareMode,
    withinSessionB,
    visitA,
    visitB,
    crossSessionA,
    crossSessionB,
    activeVisitKey,
    hasMultipleVisits,
    visits,
    refreshTick,
    lang,
    isKz,
  ]);

  const statusConfig = {
    improved: {
      callout: "callout-teal",
      badge: "badge-green",
      label: isKz ? "Оң серпін" : "Положительная динамика",
    },
    regressed: {
      callout: "callout-amber",
      badge: "badge-yellow",
      label: isKz ? "Қауіп немесе компенсация" : "Перегрузка или компенсация",
    },
    stable: {
      callout: "",
      badge: "badge-neutral",
      label: isKz ? "Өзгеріссіз" : "Стабильно",
    },
    insufficient_data: {
      callout: "callout-amber",
      badge: "badge-neutral",
      label: isKz ? "Деректер жеткіліксіз" : "Недостаточно данных",
    },
  };

  const activeStatus = diff
    ? statusConfig[diff.status as keyof typeof statusConfig] || statusConfig.stable
    : statusConfig.stable;

  const visitSelectA = visits.find((v) => v.visit_key === visitA);
  const visitSelectB = visits.find((v) => v.visit_key === visitB);
  const visitNameA = visitSelectA
    ? isKz
      ? visitSelectA.visit_label_kz || visitSelectA.visit_label
      : visitSelectA.visit_label
    : null;
  const visitNameB = visitSelectB
    ? isKz
      ? visitSelectB.visit_label_kz || visitSelectB.visit_label
      : visitSelectB.visit_label
    : null;

  return (
    <section className="surface stack-md" aria-labelledby="gait-diff-heading">
      <div className="row-between">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <GitCompare size={18} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
          <div>
            <h2 id="gait-diff-heading" className="section-title">
              {isKz ? "Динамиканы және режимдерді салыстыру" : "Сравнение динамики и режимов"}
            </h2>
            <p className="section-subtitle">
              {hasMultipleVisits
                ? isKz
                  ? "Бір визит ішіндегі сессиялар немесе уақыт бойынша сапарлар"
                  : "Сессии внутри визита или динамика между посещениями"
                : isKz
                  ? "Қалыпты жүріс пен жаттығу режимдерінің айырмашылығы"
                  : "Сопоставление обычной ходьбы с режимами обратной связи"}
            </p>
          </div>
        </div>

        <div className="cluster">
          {hasMultipleVisits && (
            <div
              className="seg-group"
              role="group"
              aria-label={isKz ? "Салыстыру ауқымы" : "Режим сравнения"}
            >
              <button
                type="button"
                className="btn seg-btn"
                aria-pressed={compareMode === "within"}
                onClick={() => setCompareMode("within")}
              >
                {isKz ? "Визит ішінде" : "Внутри визита"}
              </button>
              <button
                type="button"
                className="btn seg-btn"
                aria-pressed={compareMode === "cross"}
                onClick={() => setCompareMode("cross")}
              >
                {isKz ? "Визиттер арасында" : "Между визитами"}
              </button>
            </div>
          )}

          {compareMode === "within" && (
            <div
              className="seg-group"
              role="group"
              aria-label={isKz ? "Сессиялар жұбы" : "Пара сессий"}
            >
              <button
                type="button"
                className="btn seg-btn"
                aria-pressed={withinSessionB === "VR"}
                onClick={() => setWithinSessionB("VR")}
              >
                {isKz ? "Қалыпты → VR" : "Обычная → VR"}
              </button>
              <button
                type="button"
                className="btn seg-btn"
                aria-pressed={withinSessionB === "Verbal"}
                onClick={() => setWithinSessionB("Verbal")}
              >
                {isKz ? "Қалыпты → Ауызша" : "Обычная → Голос"}
              </button>
            </div>
          )}
        </div>
      </div>

      {compareMode === "cross" && hasMultipleVisits && (
        <div
          className="panel-inset"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--sp-3)",
            alignItems: "end",
          }}
        >
          <div className="stack-xs">
            <label htmlFor="diff-visit-a" style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>
              {isKz ? "Бастапқы визит (A)" : "Исходный визит (A)"}
            </label>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <select
                id="diff-visit-a"
                value={visitA}
                onChange={(e) => setVisitA(e.target.value)}
                style={{ flex: 1 }}
              >
                {visits.map((v) => (
                  <option key={v.visit_key} value={v.visit_key}>
                    {isKz ? v.visit_label_kz || v.visit_label : v.visit_label}
                    {v.visit_date ? ` · ${v.visit_date}` : ""}
                  </option>
                ))}
              </select>
              <select
                aria-label={isKz ? "A визитінің режимі" : "Режим визита A"}
                value={crossSessionA}
                onChange={(e) => setCrossSessionA(e.target.value as GaitCondition)}
              >
                <option value="Baseline">{isKz ? "Қалыпты" : "Обычная"}</option>
                <option value="Verbal">{isKz ? "Ауызша" : "Голос"}</option>
                <option value="VR">VR</option>
              </select>
            </div>
          </div>

          <div className="stack-xs">
            <label htmlFor="diff-visit-b" style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>
              {isKz ? "Бақылау визиті (B)" : "Контрольный визит (B)"}
            </label>
            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <select
                id="diff-visit-b"
                value={visitB}
                onChange={(e) => setVisitB(e.target.value)}
                style={{ flex: 1 }}
              >
                {visits.map((v) => (
                  <option key={v.visit_key} value={v.visit_key}>
                    {isKz ? v.visit_label_kz || v.visit_label : v.visit_label}
                    {v.visit_date ? ` · ${v.visit_date}` : ""}
                  </option>
                ))}
              </select>
              <select
                aria-label={isKz ? "B визитінің режимі" : "Режим визита B"}
                value={crossSessionB}
                onChange={(e) => setCrossSessionB(e.target.value as GaitCondition)}
              >
                <option value="Baseline">{isKz ? "Қалыпты" : "Обычная"}</option>
                <option value="Verbal">{isKz ? "Ауызша" : "Голос"}</option>
                <option value="VR">VR</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div
          className="panel-inset"
          style={{ padding: "var(--sp-5)", textAlign: "center", fontSize: "13px", color: "var(--muted)" }}
        >
          {isKz ? "Салыстыру есептелуде..." : "Рассчитываем сравнение..."}
        </div>
      ) : diffError || !diff ? (
        <div className="callout callout-amber" role="status">
          <div style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
            {diffError || (isKz ? "Бұл салыстыру үшін жеткілікті деректер жоқ." : "Недостаточно данных для выбранного сравнения.")}
          </div>
        </div>
      ) : (
        <div className="stack-md">
          <div className={`callout ${activeStatus.callout}`}>
            <div className="stack-xs" style={{ flex: 1 }}>
              <div className="row-between">
                <div className="cluster">
                  <span className={`badge ${activeStatus.badge}`}>{activeStatus.label}</span>
                  <span style={{ fontSize: "12px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: "var(--sp-1)" }}>
                    {getConditionLabel(diff.session_a, lang, diff.session_a_label)}
                    {compareMode === "cross" && visitNameA ? ` (${visitNameA})` : ""}
                    <ArrowRight size={12} strokeWidth={1.6} aria-hidden="true" />
                    {getConditionLabel(diff.session_b, lang, diff.session_b_label)}
                    {compareMode === "cross" && visitNameB ? ` (${visitNameB})` : ""}
                  </span>
                </div>

                <span className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {isKz ? "ХҚЖ b770:" : "МКФ b770:"}{" "}
                  <strong style={{ color: diff.icf_improved ? "var(--teal)" : "var(--ink)" }}>
                    {diff.icf_transition}
                  </strong>
                </span>
              </div>

              <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.55 }}>
                {cleanClinicalText(isKz ? diff.verdict_kz : diff.verdict_ru)}
              </p>
            </div>
          </div>

          <div className="hairline-grid">
            <div className="hairline-cell">
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Жалпы жүріс индексі (GPS)" : "Индекс походки (GPS)"}
              </div>
              <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)", color: diff.delta_gps !== null && diff.delta_gps < 0 ? "var(--teal)" : "var(--ink)" }}>
                {fmtSigned(diff.delta_gps, 2, "°")}
              </div>
              <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-1)" }}>
                {fmtFixed(diff.gps_a, 1, "°")} → {fmtFixed(diff.gps_b, 1, "°")}
              </div>
            </div>

            <div className="hairline-cell">
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Ауытқу индексі (GDI)" : "Индекс отклонения (GDI)"}
              </div>
              <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)", color: diff.delta_gdi !== null && diff.delta_gdi > 0 ? "var(--teal)" : "var(--ink)" }}>
                {fmtSigned(diff.delta_gdi, 1, "")}
              </div>
              <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-1)" }}>
                {fmtFixed(diff.gdi_a, 1, "")} → {fmtFixed(diff.gdi_b, 1, "")}
              </div>
            </div>

            <div className="hairline-cell">
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Шынайы буын жазылуы (TJE)" : "Истинное разгибание (TJE)"}
              </div>
              <div className="tabular-nums mono" style={{ fontSize: "20px", fontWeight: 600, marginTop: "var(--sp-1)", color: diff.tje_b !== null && diff.tje_b < -0.5 ? "var(--teal)" : "var(--ink)" }}>
                {fmtSigned(diff.tje_b, 1, "°")}
              </div>
              <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-1)" }}>
                {isKz ? "Өзгеріс:" : "Сдвиг:"} {fmtSigned(diff.delta_tje, 1, "°")}
              </div>
            </div>

            <div className="hairline-cell">
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {isKz ? "Компенсация (PCR)" : "Компенсация (PCR)"}
              </div>
              <div
                className="tabular-nums mono"
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  marginTop: "var(--sp-1)",
                  color: diff.pcr_b === null ? "var(--ink)" : diff.pcr_b > 0.8 ? "var(--amber)" : "var(--teal)",
                }}
              >
                {fmtPcr(diff.pcr_b)}
              </div>
              <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "var(--sp-1)" }}>
                {fmtPcr(diff.pcr_a)} → {fmtPcr(diff.pcr_b)}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
