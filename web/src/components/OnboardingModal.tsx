"use client";

import React, { useEffect, useRef } from "react";
import { BookOpen, X, Check, AlertTriangle, AlertOctagon } from "lucide-react";

interface Props {
  open: boolean;
  lang: "ru" | "kz";
  onClose: () => void;
}

export function OnboardingModal({ open, lang, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="libra-dialog"
      aria-labelledby="onboarding-title"
      onClose={onClose}
      onClick={(e) => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          onClose();
        }
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <BookOpen size={18} strokeWidth={1.6} color="var(--teal)" />
          <h1 id="onboarding-title" style={{ fontSize: "16px", fontWeight: 600 }}>
            {lang === "kz"
              ? "Биомеханика көрсеткіштері бойынша дәрігер жаднамасы"
              : "Клиническая памятка по интерпретации показателей"}
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
          aria-label={lang === "kz" ? "Жабу" : "Закрыть"}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", fontSize: "13px", lineHeight: 1.6 }}>
        <section>
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>
            {lang === "kz" ? "1. Шынайы буын жазылуы (TJE) және компенсация (PCR)" : "1. Истинное разгибание сустава (TJE) и индекс компенсации (PCR)"}
          </h2>
          <p style={{ color: "var(--secondary)" }}>
            {lang === "kz"
              ? "Бала жамбас-сан буынын тіктеу кезінде жамбасын алға еңкейту арқылы қадамды жасанды түрде ұзартуы мүмкін. TJE көрсеткіші сан бұрышының өзгерісінен жамбастың компенсаторлық еңкеюін алып тастайды, ал PCR сабақтас сегменттердің ауытқу үлесін бағалайды."
              : "При попытке выпрямить бедро ребенок с ДЦП нередко компенсирует слабость разгибателей передним наклоном таза. Показатель TJE вычитает этот наклон из прироста бедра, а коэффициент PCR измеряет долю отклонения таза, колена и стопы."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
            {lang === "kz" ? "2. Қауіпсіздік бағдаршамы (PCR және жамбас ауытқуы)" : "2. Пороги клинического светофора безопасности"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px", background: "var(--teal-bg)", border: "1px solid var(--teal-border)", borderRadius: "8px" }}>
              <Check size={16} color="var(--teal)" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: "var(--teal)", fontSize: "13px" }}>
                  {lang === "kz" ? "Жасыл деңгей (PCR < 0,40)" : "Зелёная зона (PCR < 0,40)"}
                </div>
                <div style={{ color: "var(--ink)", fontSize: "12.5px", marginTop: "2px" }}>
                  {lang === "kz"
                    ? "Шынайы буын жазылуы (ΔaMinSagH ≤ -1,0°), жамбас қалпы тұрақты. Таңдалған режим тиімді әрі қауіпсіз."
                    : "Истинное разгибание бедра (ΔaMinSagH ≤ −1,0°) при стабильном тазе. Режим безопасен и эффективен."}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "8px" }}>
              <AlertTriangle size={16} color="var(--amber)" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: "var(--amber)", fontSize: "13px" }}>
                  {lang === "kz" ? "Сары деңгей (0,40 ≤ PCR ≤ 0,80 немесе жауап жоқ)" : "Жёлтая зона (0,40 ≤ PCR ≤ 0,80 или отсутствие отклика)"}
                </div>
                <div style={{ color: "var(--ink)", fontSize: "12.5px", marginTop: "2px" }}>
                  {lang === "kz"
                    ? "Сабақтас буындардың орташа бейімделуі немесе буын бұрышының жеткіліксіз өзгерісі. Нұсқаушының бақылауы қажет."
                    : "Умеренная компенсация смежных сегментов или недостаточная динамика разгибания. Требуется очный контроль инструктора ЛФК."}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: "8px" }}>
              <AlertOctagon size={16} color="var(--red)" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: "var(--red)", fontSize: "13px" }}>
                  {lang === "kz" ? "Қызыл деңгей (PCR > 0,80 немесе ΔGVS жамбас > +2,0°)" : "Красная зона (PCR > 0,80 или ΔGVS таза > +2,0°)"}
                </div>
                <div style={{ color: "var(--ink)", fontSize: "12.5px", marginTop: "2px" }}>
                  {lang === "kz"
                    ? "Жамбастың патологиялық алға еңкеюі және бел гиперлордозының қаупі. VR-тренажер мақсатты бұрышын 30%-ға азайту немесе ауызша бақылауға көшу ұсынылады."
                    : "Выраженный компенсаторный наклон таза с риском поясничного гиперлордоза. Показано снижение целевого угла VR на 30% либо переход на голосовые команды."}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>
            {lang === "kz" ? "3. ДДҰ ХҚЖ (МКФ) кодтары және нормативтік дәліз" : "3. Коды МКФ ВОЗ и нормативный коридор"}
          </h2>
          <p style={{ color: "var(--secondary)" }}>
            {lang === "kz"
              ? "Кинематикалық графиктердегі сұр аймақ сау балалардың нормативтік дәлізін (Schwartz 2008 ±1 SD) көрсетеді. b770 санаты Бейкер индексі (GPS) бойынша, ал d450 санаты қадам циклдерінің тұрақтылығы бойынша есептеледі."
              : "Серая полоса на графиках отражает возрастной коридор нормы здоровых детей (Schwartz 2008 ±1 SD). Категория b770 определяется по общему индексу Бейкера (GPS), а категория d450 оценивается по доле нестабильных циклов шага."}
          </p>
        </section>
      </div>

      <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} className="btn btn-primary">
          {lang === "kz" ? "Түсінікті, жабу" : "Понятно, закрыть"}
        </button>
      </div>
    </dialog>
  );
}
