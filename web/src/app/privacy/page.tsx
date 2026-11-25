"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { LanguageSwitch, LargeFontButton, useLargeFontPreference } from "@/components/PageControls";
import { useLanguage } from "@/lib/LanguageContext";

export default function PrivacyPage() {
  const { lang, t } = useLanguage();
  const { largeFont } = useLargeFontPreference();
  const isKz = lang === "kz";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }} data-a11y-large={largeFont ? "1" : "0"}>
      <a href="#main-content" className="skip-link visually-hidden">
        {isKz ? "Негізгі мазмұнға өту" : "Перейти к содержимому"}
      </a>
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

      <main id="main-content" tabIndex={-1} className="container stack-md" style={{ maxWidth: "820px", paddingBlock: "var(--sp-8)" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--muted)", alignSelf: "flex-start" }}>
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          <span>{isKz ? "Басты бетке оралу" : "На главную"}</span>
        </Link>

        <article className="surface stack-md" style={{ padding: "var(--sp-6)" }}>
          <div className="cluster" style={{ gap: "var(--sp-3)" }}>
            <Lock size={20} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
            <h1 className="page-title" style={{ fontSize: "28px" }}>
              {isKz ? "Дербес деректерді қорғау саясаты" : "Политика конфиденциальности и обезличивания"}
            </h1>
          </div>

          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Libra жүйесі Қазақстан Республикасының «Дербес деректер және оларды қорғау туралы» № 94-V Заңының талаптарын сақтайды."
              : "Клиническая платформа Libra работает с соблюдением требований Закона Республики Казахстан от 21 мая 2013 года № 94-V «О персональных данных и их защите»."}
          </p>

          <h2 className="section-title" style={{ marginTop: "var(--sp-2)" }}>
            {isKz ? "1. Сәйкестендіргіштерді бұғаттау" : "1. Автоматическая блокировка персональных данных"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "CSV форматындағы деректерді жүктеу барысында жүйе ЖСН, ТАӘ, телефон, пошта, туған күні және мекенжай бағандарын тексереді және олар анықталған жағдайда жүктеуді тоқтатады."
              : "На стороне сервера реализован контроль схемы CSV: таблицы со столбцами или значениями, содержащими ФИО, ИИН, телефон, адрес, электронную почту или дату рождения, отклоняются до сохранения в базу данных."}
          </p>

          <h2 className="section-title" style={{ marginTop: "var(--sp-2)" }}>
            {isKz ? "2. Ашық ғылыми деректер" : "2. Открытый источник данных когорты"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Демонстрациялық когорта KU Leuven Clinical Movement Analysis Laboratory ашық деректеріне (DOI: 10.48804/JUNNWW, CC-BY-NC-SA-4.0 лицензиясы) негізделген."
              : "Эталонная клиническая когорта основана на обезличенном наборе KU Leuven Clinical Movement Analysis Laboratory (DOI: 10.48804/JUNNWW, лицензия CC-BY-NC-SA-4.0)."}
          </p>
        </article>
      </main>
    </div>
  );
}
