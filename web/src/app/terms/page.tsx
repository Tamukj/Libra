"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";

export default function TermsPage() {
  const { lang, setLang, t } = useLanguage();
  const isKz = lang === "kz";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--white)", padding: "14px clamp(16px, 4vw, 40px)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <LibraLogo size="md" href="/" subtitle={t.brand_sub} />
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" className="btn" style={{ minBlockSize: "32px", padding: "4px 10px" }} onClick={() => setLang(isKz ? "ru" : "kz")}>
            {isKz ? "Русский" : "Қазақша"}
          </button>
          <Link href="/portal" className="btn btn-primary" style={{ minBlockSize: "32px" }}>
            {isKz ? "Кабинет" : "В кабинет"}
          </Link>
        </div>
      </header>

      <main className="container" style={{ maxWidth: "820px", paddingBlock: "40px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
          <ArrowLeft size={14} strokeWidth={1.6} />
          {isKz ? "Басты бетке оралу" : "На главную"}
        </Link>

        <article className="surface" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldAlert size={20} strokeWidth={1.6} color="var(--amber)" />
            <h1 className="font-display" style={{ fontSize: "28px" }}>
              {isKz ? "Қолдану шарттары және СППР шектеулері" : "Условия использования и ограничения СППР"}
            </h1>
          </div>

          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Libra дәрігерлік шешімдерді қолдау жүйесі (СППР) тек анықтамалық және биомеханикалық талдау мақсатында қолданылады."
              : "Программный комплекс Libra является системой поддержки принятия врачебных решений (СППР) и предназначен для анализа биомеханических параметров походки."}
          </p>

          <h2 style={{ fontSize: "17px", marginTop: "6px" }}>
            {isKz ? "1. Медициналық шектеулер" : "1. Консультативный характер выводов"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Жүйе дербес диагноз қоймайды, дәрі-дәрмек тағайындамайды және білікті дәрігер-реабилитологтың кеңесін алмастырмайды. Өмірге немесе денсаулыққа қауіп төндіретін шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз."
              : "Расчетные индексы TJE, PCR, GPS и прогнозы машинного обучения не являются диагнозом или врачебным назначением. При ухудшении состояния или острых симптомах необходимо обратиться в службу скорой помощи по номеру 103."}
          </p>

          <h2 style={{ fontSize: "17px", marginTop: "6px" }}>
            {isKz ? "2. Клиникалық жауапкершілік" : "2. Клиническая ответственность"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Пациентке жүктеме деңгейін белгілеу, VR-жаттығуларын жалғастыру немесе тоқтату жөніндегі түпкілікті шешімді емдеуші дәрігер қабылдайды."
              : "Решение о корректировке режима тренировок, дозировании нагрузки в VR-среде и выдаче выписного протокола принимает исключительно лечащий врач-реабилитолог."}
          </p>
        </article>
      </main>
    </div>
  );
}
