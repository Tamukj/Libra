"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";

export default function PrivacyPage() {
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
            <Lock size={20} strokeWidth={1.6} color="var(--teal)" />
            <h1 className="font-display" style={{ fontSize: "28px" }}>
              {isKz ? "Дербес деректерді қорғау саясаты" : "Политика конфиденциальности и обезличивания"}
            </h1>
          </div>

          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Libra жүйесі Қазақстан Республикасының «Дербес деректер және оларды қорғау туралы» № 94-V Заңының талаптарын сақтайды."
              : "Клиническая платформа Libra работает с соблюдением требований Закона Республики Казахстан от 21 мая 2013 года № 94-V «О персональных данных и их защите»."}
          </p>

          <h2 style={{ fontSize: "17px", marginTop: "6px" }}>
            {isKz ? "1. Сәйкестендіргіштерді бұғаттау" : "1. Автоматическая блокировка персональных данных"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "CSV форматындағы деректерді жүктеу барысында жүйе ЖСН, ТАӘ, телефон, пошта, туған күні және мекенжай бағандарын тексереді және олар анықталған жағдайда жүктеуді тоқтатады."
              : "На стороне сервера реализован строгий контроль схемы CSV: таблицы со столбцами, содержащими ФИО, ИИН, телефон, адрес, e-mail или дату рождения, отклоняются до сохранения в базу данных."}
          </p>

          <h2 style={{ fontSize: "17px", marginTop: "6px" }}>
            {isKz ? "2. Ашық ғылыми деректер" : "2. Открытый источник данных когорты"}
          </h2>
          <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.65 }}>
            {isKz
              ? "Демонстрациялық когорта KU Leuven Clinical Movement Analysis Laboratory ашық деректеріне (DOI: 10.48804/JUNNWW, CC-BY-NC-SA-4.0 лицензиясы) негізделген."
              : "Эталонная клиническая когорта основана на деидентифицированном наборе KU Leuven Clinical Movement Analysis Laboratory (DOI: 10.48804/JUNNWW, лицензия CC-BY-NC-SA-4.0)."}
          </p>
        </article>
      </main>
    </div>
  );
}
