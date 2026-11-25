"use client";

import React from "react";
import { BookOpen, X, Check, AlertTriangle, AlertOctagon } from "lucide-react";
import { ModalDialog } from "@/components/ModalDialog";

interface Props {
  open: boolean;
  lang: "ru" | "kz";
  onClose: () => void;
}

export function OnboardingModal({ open, lang, onClose }: Props) {
  const isKz = lang === "kz";

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="onboarding-title">
      <div className="dialog-header">
        <div className="cluster">
          <BookOpen size={18} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
          <h1 id="onboarding-title" className="section-title">
            {isKz
              ? "Биомеханика көрсеткіштері бойынша дәрігер жаднамасы"
              : "Клиническая памятка по интерпретации показателей"}
          </h1>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          aria-label={isKz ? "Жабу" : "Закрыть"}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="dialog-body stack-md" style={{ fontSize: "13px", lineHeight: 1.6 }}>
        <section className="stack-xs">
          <h2 style={{ fontSize: "14px", fontWeight: 600 }}>
            {isKz
              ? "1. Шынайы буын жазылуы (TJE) және компенсация (PCR)"
              : "1. Истинное разгибание сустава (TJE) и индекс компенсации (PCR)"}
          </h2>
          <p style={{ color: "var(--secondary)", maxWidth: "65ch" }}>
            {isKz
              ? "Бала жамбас-сан буынын тіктеу кезінде жамбасын алға еңкейту арқылы қадамды жасанды түрде ұзартуы мүмкін. TJE көрсеткіші сан бұрышының өзгерісінен жамбастың компенсаторлық еңкеюін алып тастайды, ал PCR сабақтас сегменттердің ауытқу үлесін бағалайды."
              : "При попытке выпрямить бедро ребёнок с ДЦП нередко компенсирует слабость разгибателей передним наклоном таза. Показатель TJE вычитает этот наклон из прироста бедра, а коэффициент PCR измеряет долю отклонения таза, колена и стопы."}
          </p>
        </section>

        <section className="stack-xs">
          <h2 style={{ fontSize: "14px", fontWeight: 600 }}>
            {isKz
              ? "2. Қауіпсіздік бағдаршамы (PCR және жамбас ауытқуы)"
              : "2. Пороги клинического светофора безопасности"}
          </h2>
          <div className="stack-sm">
            <div className="callout callout-teal" style={{ padding: "var(--sp-3)" }}>
              <Check size={16} color="var(--teal)" style={{ marginTop: "2px", flexShrink: 0 }} aria-hidden="true" />
              <div className="stack-xs">
                <div style={{ fontWeight: 600, color: "var(--teal)", fontSize: "13px" }}>
                  {isKz ? "Жасыл деңгей (PCR < 0,40)" : "Зелёная зона (PCR < 0,40)"}
                </div>
                <div style={{ color: "var(--ink)", fontSize: "13px" }}>
                  {isKz
                    ? "Сан буынының шынайы жазылуы 1,0° немесе одан көп, жамбас қалпы тұрақты. Таңдалған режим тиімді әрі қауіпсіз."
                    : "Истинное разгибание бедра не менее 1,0° при стабильном тазе. Режим безопасен и эффективен."}
                </div>
              </div>
            </div>

            <div className="callout callout-amber" style={{ padding: "var(--sp-3)" }}>
              <AlertTriangle size={16} color="var(--amber)" style={{ marginTop: "2px", flexShrink: 0 }} aria-hidden="true" />
              <div className="stack-xs">
                <div style={{ fontWeight: 600, color: "var(--amber)", fontSize: "13px" }}>
                  {isKz
                    ? "Сары деңгей (0,40 ≤ PCR ≤ 0,80 немесе жауап жоқ)"
                    : "Жёлтая зона (0,40 ≤ PCR ≤ 0,80 или нет динамики)"}
                </div>
                <div style={{ color: "var(--ink)", fontSize: "13px" }}>
                  {isKz
                    ? "Сабақтас буындардың орташа бейімделуі немесе буын бұрышының жеткіліксіз өзгерісі. Нұсқаушының бақылауы қажет."
                    : "Умеренная компенсация смежных сегментов или недостаточная динамика разгибания. Требуется контроль инструктора ЛФК."}
                </div>
              </div>
            </div>

            <div className="callout callout-red" style={{ padding: "var(--sp-3)" }}>
              <AlertOctagon size={16} color="var(--red)" style={{ marginTop: "2px", flexShrink: 0 }} aria-hidden="true" />
              <div className="stack-xs">
                <div style={{ fontWeight: 600, color: "var(--red)", fontSize: "13px" }}>
                  {isKz
                    ? "Қызыл деңгей (PCR > 0,80 немесе жамбас еңкеюі > +2,0°)"
                    : "Красная зона (PCR > 0,80 или наклон таза > +2,0°)"}
                </div>
                <div style={{ color: "var(--ink)", fontSize: "13px" }}>
                  {isKz
                    ? "Жамбастың патологиялық алға еңкеюі және бел гиперлордозының қаупі. VR-тренажер мақсатты бұрышын 30%-ға азайту немесе ауызша бақылауға көшу ұсынылады."
                    : "Выраженный компенсаторный наклон таза с риском поясничного гиперлордоза. Рекомендовано снижение целевого угла VR на 30% или переход на голосовые команды."}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="stack-xs">
          <h2 style={{ fontSize: "14px", fontWeight: 600 }}>
            {isKz
              ? "3. ДДҰ ХҚЖ (МКФ) кодтары және нормативтік дәліз"
              : "3. Коды МКФ ВОЗ и нормативный коридор"}
          </h2>
          <p style={{ color: "var(--secondary)", maxWidth: "65ch" }}>
            {isKz
              ? "Кинематикалық графиктердегі сұр аймақ сау балалардың нормативтік дәлізін (Schwartz 2008 ±1 SD) көрсетеді. b770 санаты Бейкер индексі (GPS) бойынша, ал d450 санаты қадам циклдерінің тұрақтылығы бойынша есептеледі."
              : "Серая полоса на графиках отражает возрастной коридор нормы здоровых детей (Schwartz 2008 ±1 SD). Категория b770 определяется по общему индексу Бейкера (GPS), а категория d450 оценивается по доле нестабильных циклов шага."}
          </p>
        </section>
      </div>

      <div className="dialog-footer">
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn btn-primary">
            {isKz ? "Түсінікті, жабу" : "Понятно, закрыть"}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
