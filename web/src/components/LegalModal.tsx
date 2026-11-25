"use client";

import React, { useEffect, useRef } from "react";
import { Scale, CheckCircle2, X } from "lucide-react";

interface Props {
  open: boolean;
  lang: "ru" | "kz";
  onClose: () => void;
}

export function LegalModal({ open, lang, onClose }: Props) {
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
      aria-labelledby="legal-modal-title"
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Scale size={18} strokeWidth={1.6} color="var(--teal)" />
          <h1 id="legal-modal-title" style={{ fontSize: "16px", fontWeight: 600 }}>
            {lang === "kz" ? "Құқықтық негіз және қауіпсіздік" : "Правовая база и безопасность"}
          </h1>
        </div>
        <button type="button" onClick={onClose} aria-label={lang === "kz" ? "Жабу" : "Закрыть"} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px", lineHeight: 1.6 }}>
        <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle2 size={15} color="var(--teal)" />
            <span>{lang === "kz" ? "Ашық деректер (CC-BY-NC-SA 4.0)" : "Открытые научные данные (CC-BY-NC-SA 4.0)"}</span>
          </div>
          <p style={{ color: "var(--secondary)" }}>
            {lang === "kz"
              ? "KU Leuven зертханасының ашық педиатриялық когортасы (De Mulder et al., 2024, DOI 10.48804/JUNNWW)."
              : "Открытый педиатрический набор данных походки при ДЦП KU Leuven (De Mulder et al., 2024, DOI 10.48804/JUNNWW)."}
          </p>
        </div>

        <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle2 size={15} color="var(--teal)" />
            <span>{lang === "kz" ? "ҚР «Дербес деректер туралы» Заңы (№ 94-V)" : "Закон РК «О персональных данных и их защите» (№ 94-V)"}</span>
          </div>
          <p style={{ color: "var(--secondary)" }}>
            {lang === "kz"
              ? "Барлық жазбалар иесіздендірілген. CSV жүктеу кезінде Аты-жөні, ЖСН, мекенжай және байланыс бағандары автоматты түрде бұғатталады."
              : "Все записи деперсонализированы. При импорте CSV автоматически отклоняются столбцы с ФИО, ИИН, адресом, телефоном и датой рождения."}
          </p>
        </div>

        <div style={{ padding: "14px", background: "var(--amber-bg)", borderRadius: "8px", border: "1px solid var(--amber-border)" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--amber)" }}>
            {lang === "kz" ? "Дәрігерлік жауапкершілік және 103 (8.2-т.)" : "Статус СППР и экстренная помощь 103 (п. 8.2)"}
          </div>
          <p style={{ color: "var(--ink)" }}>
            {lang === "kz"
              ? "Libra диагноз қоймайды және дәрілік препараттар тағайындамайды. Қауіпті жағдайларда дәрігерге немесе 103 жедел жәрдем қызметіне хабарласыңыз."
              : "Libra является системой поддержки принятия врачебных решений, не ставит диагноз и не назначает лечение. При ухудшении состояния обратитесь к врачу или звоните 103."}
          </p>
        </div>
      </div>

      <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} className="btn btn-primary">
          {lang === "kz" ? "Жабу" : "Закрыть"}
        </button>
      </div>
    </dialog>
  );
}
