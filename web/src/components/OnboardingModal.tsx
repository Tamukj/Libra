"use client";

import React from "react";
import { Compass, CheckCircle2, AlertOctagon, FileCheck, X, ArrowRight } from "lucide-react";

interface Props {
  lang: "ru" | "kz";
  onClose: () => void;
}

export function OnboardingModal({ lang, onClose }: Props) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(39, 36, 31, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    }}>
      <div className="card" style={{
        maxWidth: "640px",
        width: "100%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
      }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={20} color="var(--teal)" />
            <h2 style={{ fontSize: "16px", fontWeight: "700" }}>
              {lang === "kz" ? "Дәрігер жаднамасы: Талдауды 15 секундта қалай оқу керек" : "Памятка врачу: Как прочитать анализ походки за 15 секунд"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <X size={20} />
          </button>
        </div>

        {/* 3 Step Guide */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px", lineHeight: "1.6" }}>
          
          {/* Step 1 */}
          <div style={{ display: "flex", gap: "12px", background: "var(--paper)", padding: "14px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--teal)",
              color: "var(--white)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              flexShrink: 0
            }}>
              1
            </div>
            <div>
              <div style={{ fontWeight: "700", marginBottom: "3px" }}>
                {lang === "kz" ? "1-ҚАДАМ: Ұсынылған әдісті таңдаңыз (Verbal vs VR)" : "ШАГ 1: Посмотрите на вердикт метода (Verbal vs VR)"}
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
                {lang === "kz"
                  ? "Жоғарғы плашка бала үшін қай режим тиімді екенін бірден көрсетеді: нұсқаушының дауысы ма, әлде VR көзілдірігі ме."
                  : "Верхняя плашка сразу дает клинический вердикт: кому-то полезнее голос врача (Verbal), а кому-то визуальный аватар в очках (VR)."}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", gap: "12px", background: "var(--paper)", padding: "14px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--teal)",
              color: "var(--white)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              flexShrink: 0
            }}>
              2
            </div>
            <div>
              <div style={{ fontWeight: "700", marginBottom: "3px" }}>
                {lang === "kz" ? "2-ҚАДАМ: CDSS бағдаршамына қараңыз (Қауіпсіздік)" : "ШАГ 2: Проверьте светофор безопасности CDSS"}
              </div>
              <div style={{ margin: 0, color: "var(--muted)", fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span>🟢 <strong>{lang === "kz" ? "Жасыл (PCR < 0.4):" : "Зеленый (PCR < 0.4):"}</strong> {lang === "kz" ? "Шынайы жазылу, таз дұрыс тұр." : "Истинное разгибание, таз стабилен."}</span>
                <span>🔴 <strong>{lang === "kz" ? "Қызыл (PCR > 0.8):" : "Красный (PCR > 0.8):"}</strong> {lang === "kz" ? "Қауіп! Бала жамбасын бүгіп, белге жүк түсіруде." : "Опасно! Ребенок 'читерит' тазом, риск гиперлордоза."}</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", gap: "12px", background: "var(--paper)", padding: "14px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--teal)",
              color: "var(--white)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              flexShrink: 0
            }}>
              3
            </div>
            <div>
              <div style={{ fontWeight: "700", marginBottom: "3px" }}>
                {lang === "kz" ? "3-ҚАДАМ: Графиктер мен ДДҰ ХҚЖ (МКФ) протоколы" : "ШАГ 3: Графики и готовая выписка ВОЗ (МКФ)"}
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
                {lang === "kz"
                  ? "Сұр дәліз — қалыпты норма. Егер сарғыш сызық сұр жолақтан асып кетсе — буын бұзылған. 'Хаттаманы жүктеу' батырмасын басып, Damumed-ке шығарып алыңыз."
                  : "Серый коридор — здоровая норма. Если оранжевая линия ушла выше серого коридора — сустав перегружен. Нажмите кнопку 'Сформировать протокол' для выписки в Damumed."}
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-teal">
            {lang === "kz" ? "Бастау / Жұмысқа кірісу" : "Начать работу"}
          </button>
        </div>

      </div>
    </div>
  );
}
