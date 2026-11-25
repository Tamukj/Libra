"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { LanguageSwitch, LargeFontButton } from "@/components/PageControls";
import { useLanguage } from "@/lib/LanguageContext";

export default function TermsPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      <header className="site-header" style={{ background: "var(--white)" }}>
        <div className="container site-header-inner">
          <LibraLogo size="md" href="/" subtitle={t.brand_sub} />
          <div className="cluster">
            <LanguageSwitch compact />
            <LargeFontButton />
            <Link href="/portal" className="btn btn-primary btn-sm">
              {isKz ? "Кабинет" : "В кабинет"}
            </Link>
          </div>
        </div>
      </header>

      <main className="container stack-md" style={{ maxWidth: "820px", paddingBlock: "var(--sp-8)" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--muted)", alignSelf: "flex-start" }}>
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          <span>{isKz ? "Басты бетке оралу" : "На главную"}</span>
        </Link>

        <article className="surface stack-md" style={{ padding: "var(--sp-6)" }}>
          <div className="cluster" style={{ gap: "var(--sp-3)" }}>
            <ShieldAlert size={20} strokeWidth={1.5} color="var(--amber)" aria-hidden="true" />
            <h1 className="page-title" style={{ fontSize: "28px" }}>
              {isKz ? "Қолдану шарттары және СППР шектеулері" : "Условия использования и ограничения СППР"}
            </h1>
          </div>

          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Libra дәрігерлік шешімдерді қолдау жүйесі (СППР) тек анықтамалық және биомеханикалық талдау мақсатында қолданылады."
              : "Программный комплекс Libra является системой поддержки принятия врачебных решений (СППР) и предназначен для анализа биомеханических параметров походки."}
          </p>

          <h2 className="section-title" style={{ marginTop: "var(--sp-2)" }}>
            {isKz ? "1. Медициналық шектеулер" : "1. Консультативный характер выводов"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Жүйе дербес диагноз қоймайды, дәрі-дәрмек тағайындамайды және білікті дәрігер-реабилитологтың кеңесін алмастырмайды. Өмірге немесе денсаулыққа қауіп төндіретін шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз."
              : "Расчётные индексы TJE, PCR, GPS и прогнозы моделей не являются диагнозом или врачебным назначением. При ухудшении состояния или острых симптомах необходимо обратиться в службу скорой помощи по номеру 103."}
          </p>

          <h2 className="section-title" style={{ marginTop: "var(--sp-2)" }}>
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
