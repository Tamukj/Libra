"use client";

import React from "react";
import { ShieldCheck, Scale, FileText, CheckCircle2, X } from "lucide-react";

interface Props {
  lang: "ru" | "kz" | "en";
  onClose: () => void;
}

export function LegalModal({ lang, onClose }: Props) {
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
      background: "rgba(39, 36, 31, 0.6)",
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
        display: "flex",
        flexDirection: "column",
        background: "var(--white)",
        boxShadow: "0 8px 24px rgba(28, 25, 23, 0.12)"
      }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Scale size={20} color="var(--teal)" />
            <h2 style={{ fontSize: "16px", fontWeight: "700" }}>
              {lang === "kz" ? "Құқықтық негіз, этика және стандарттар" : "Правовая база, этика и стандарты соответствия"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Закрыть / Жабу" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", fontSize: "13px", lineHeight: "1.6", color: "var(--ink)", paddingRight: "6px" }}>
          
          {/* Card 1: License */}
          <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{ fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="var(--teal)" />
              {lang === "kz" ? "1. Деректер лицензиясы (CC-BY-NC-SA 4.0)" : "1. Лицензия открытых данных (CC-BY-NC-SA 4.0)"}
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {lang === "kz"
                ? "Деректер жинағы KU Leuven (Бельгия) биомеханика зертханасының халықаралық ашық ғылыми лицензиясы бойынша ұсынылған. Коммерциялық емес ғылыми мақсаттарда пайдалануға толық рұқсат етілген."
                : "Датасет предоставлен лабораторией анализа движения KU Leuven (Бельгия) под международной открытой исследовательской лицензией Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International."}
            </p>
          </div>

          {/* Card 2: Personal Data Law RK */}
          <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{ fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="var(--teal)" />
              {lang === "kz" ? "2. ҚР «Дербес деректер туралы» Заңы (№ 94-V)" : "2. Закон РК «О персональных данных и их защите» (№ 94-V)"}
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {lang === "kz"
                ? "Барлық жазбалар 100% иесіздендірілген. Базада пациенттердің аты-жөні, ЖСН, бет биометриясы немесе жеке басын анықтауға мүмкіндік беретін ақпарат жоқ. Жүйе тек псевдонимделген кодтармен жұмыс істейді."
                : "Все записи на 100% деперсонализированы. В базе данных отсутствуют ФИО, ИИН, биометрические данные лица или геолокация. Система оперирует исключительно анонимными научными идентификаторами (subject code)."}
            </p>
          </div>

          {/* Card 3: WHO ICF */}
          <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{ fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="var(--teal)" />
              {lang === "kz" ? "3. ДДҰ ХҚЖ (МКФ / WHO ICF) Стандарттары" : "3. Стандарты ВОЗ (МКФ / ICF Classification)"}
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {lang === "kz"
                ? "Дүниежүзілік денсаулық сақтау ұйымының b770 (жүріс стереотипі) және d450 (жүру және қозғалу) санаттарына сәйкес бағаланады. Бұл Damumed және медициналық-әлеуметтік сараптамаға (МӘС) тікелей біріктіруге мүмкіндік береді."
                : "Клиническое профилирование выполняется строго по Международной классификации функционирования, ограничений жизнедеятельности и здоровья (МКФ ВОЗ) — категории b770 (функции стереотипа походки) и d450 (ходьба)."}
            </p>
          </div>

          {/* Card 4: CDSS Human in the Loop */}
          <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <div style={{ fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} color="var(--teal)" />
              {lang === "kz" ? "4. Дәрігер бақылауындағы этика (Human-in-the-Loop)" : "4. Этика врачебного контроля (Human-in-the-Loop)"}
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {lang === "kz"
                ? "Libra жүйесі дәрігерді алмастырмайды, тек шешім қабылдауды қолдау құралы (CDSS) ретінде қызмет етеді. Барлық тактикалық ұсыныстар емдеуші дәрігердің клиникалық тексеруіне жатады."
                : "Платформа Libra не заменяет врача, а выполняет роль системы поддержки принятия врачебных решений (CDSS). Окончательное клиническое решение о назначении или отмене VR-терапии принимает врач-реабилитолог."}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-teal">
            {lang === "kz" ? "Түсінікті / Жабу" : "Понятно / Закрыть"}
          </button>
        </div>

      </div>
    </div>
  );
}
