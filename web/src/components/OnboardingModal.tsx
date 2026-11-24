"use client";

import React from "react";
import { BookOpen, X, Check, AlertTriangle, AlertOctagon } from "lucide-react";

interface Props {
  lang: "ru" | "kz" | "en";
  onClose: () => void;
}

export function OnboardingModal({ lang, onClose }: Props) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(28, 25, 23, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    }}>
      <div className="card" role="dialog" aria-modal="true" style={{
        maxWidth: "680px",
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.15)",
        padding: "28px"
      }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <BookOpen size={18} color="var(--amber)" />
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
                {lang === "kz" ? "Биомеханика параметрлерін түсіндіру клиникалық регламенті" : "Клинический регламент интерпретации параметров биомеханики"}
              </h2>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "12px", margin: 0 }}>
              {lang === "kz"
                ? "ЦП сал ауруы бар балаларды оңалту кезіндегі CDSS жүйесінің анықтамалық нұсқаулығы"
                : "Справочное руководство CDSS при двигательной реабилитации детей с церебральным параличом"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clinical Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", fontSize: "13px", lineHeight: "1.6" }}>
          
          {/* Section 1: Modality choice */}
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "6px", padding: "14px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "4px", color: "var(--ink)" }}>
              {lang === "kz" ? "1. Оңалту тактикасын таңдау (Verbal vs VR)" : "1. Выбор тактики реабилитации (Verbal vs VR)"}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "12px", margin: 0 }}>
              {lang === "kz"
                ? "Жүйе нұсқаушының вербалды командалары мен VR виртуалды ортасының биомеханикалық әсерін салыстырады. Ұсыныс таздың тұрақтылығы мен буындардың анатомиялық жазылу деңгейіне негізделеді."
                : "Система сопоставляет отклик на голосовые команды терапевта (Verbal) и погружение в виртуальную среду (VR). Выбор определяется стабильностью таза и истинным объемом движений в суставах."}
            </p>
          </div>

          {/* Section 2: CDSS Safety Matrix */}
          <div>
            <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              {lang === "kz" ? "2. CDSS қауіпсіздік критерийлері (PCR коэффициенті)" : "2. Критерии безопасности CDSS (Индекс компенсации PCR)"}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "var(--teal-bg)", border: "1px solid var(--teal-border)", borderRadius: "6px" }}>
                <Check size={16} color="var(--teal)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: "700", color: "var(--teal)", fontSize: "12px" }}>
                    {lang === "kz" ? "PCR < 0.40 — Қауіпсіз биомеханика (Норма)" : "PCR < 0.40 — Физиологическая норма"}
                  </div>
                  <div style={{ color: "var(--ink)", fontSize: "12px" }}>
                    {lang === "kz"
                      ? "Шынайы жазылу (TJE ≤ -1.0°), таз орнықты. VR ортасында оңалтуды жалғастыруға рұқсат етіледі."
                      : "Истинное разгибание бедра (TJE ≤ -1.0°), наклон таза не превышает допустимых значений. Тренировки в VR безопасны."}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "var(--amber-light)", border: "1px solid var(--amber-border)", borderRadius: "6px" }}>
                <AlertTriangle size={16} color="var(--amber)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: "700", color: "var(--amber)", fontSize: "12px" }}>
                    {lang === "kz" ? "0.40 ≤ PCR ≤ 0.80 — Орташа қауіп" : "0.40 ≤ PCR ≤ 0.80 — Умеренная компенсация"}
                  </div>
                  <div style={{ color: "var(--ink)", fontSize: "12px" }}>
                    {lang === "kz"
                      ? "Шамалы таз деформациясы байқалады. Инструктор бақылауымен жаттығу ұсынылады."
                      : "Выявлен частичный наклон таза. Рекомендован очный контроль инструктора ЛФК для коррекции осанки."}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: "6px" }}>
                <AlertOctagon size={16} color="var(--red)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: "700", color: "var(--red)", fontSize: "12px" }}>
                    {lang === "kz" ? "PCR > 0.80 — Патологиялық компенсация қаупі" : "PCR > 0.80 — Критическая компенсация таза"}
                  </div>
                  <div style={{ color: "var(--ink)", fontSize: "12px" }}>
                    {lang === "kz"
                      ? "Таз алға тым қатты еңкейген (ΔSagP > 4°). Бел омыртқасының гиперлордоз қаупі бар. VR тоқтатылып, вербалды режимге ауысу керек."
                      : "Патологический передний наклон таза (ΔSagP > 4°). Риск поясничного гиперлордоза. Показана отмена VR и переход на инструкции терапевта (Verbal)."}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section 3: Normative corridors & Damumed export */}
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "6px", padding: "14px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "4px", color: "var(--ink)" }}>
              {lang === "kz" ? "3. Нормативтік дәліздер және Damumed интеграциясы" : "3. Нормативные коридоры и выгрузка в МИС Damumed"}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "12px", margin: 0 }}>
              {lang === "kz"
                ? "Сұр аймақ — сау балалардың (TD) қозғалыс дәлізі. Барлық көрсеткіштер ДДҰ ХҚЖ (МКФ b770 және d450) кодтары бойынша жіктеліп, консилиум хаттамасына жинақталады."
                : "Серый диапазон на графиках обозначает коридор физиологической нормы TD. Отклонения сопоставляются со шкалами ВОЗ МКФ (b770 стереотип походки, d450 ходьба) и переносятся в итоговый протокол."}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: "8px 18px", fontSize: "13px" }}>
            {lang === "kz" ? "Түсінікті, жабу" : "Понятно, закрыть"}
          </button>
        </div>

      </div>
    </div>
  );
}
