"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Lock, Database, Scale } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const THIRD_PARTY_RESOURCES = [
  {
    name: "KU Leuven CP Gait Dataset",
    license: "CC-BY-NC-SA-4.0",
    role_ru: "Открытая клиническая когорта (DOI 10.48804/JUNNWW)",
    role_kz: "Ашық клиникалық когорта (DOI 10.48804/JUNNWW)",
  },
  {
    name: "FastAPI / Pydantic / SQLAlchemy",
    license: "MIT",
    role_ru: "Клинический сервер и схема хранения",
    role_kz: "Клиникалық сервер және сақтау жүйесі",
  },
  {
    name: "scikit-learn / SciPy / NumPy",
    license: "BSD-3-Clause",
    role_ru: "Групповая валидация GroupKFold и PCA",
    role_kz: "GroupKFold валидациясы және PCA",
  },
  {
    name: "Matplotlib",
    license: "PSF / Matplotlib License",
    role_ru: "Формирование PDF-протокола выписки",
    role_kz: "PDF-шығару хаттамасын қалыптастыру",
  },
  {
    name: "python-multipart",
    license: "Apache-2.0",
    role_ru: "Загрузка клинических CSV-таблиц",
    role_kz: "Клиникалық CSV кестелерін жүктеу",
  },
  {
    name: "Next.js / React / Lucide",
    license: "MIT / ISC",
    role_ru: "Интерфейс врача и доступные компоненты",
    role_kz: "Дәрігер интерфейсі және қолжетімді элементтер",
  },
  {
    name: "Inter / Noto Serif / JetBrains Mono",
    license: "SIL OFL 1.1",
    role_ru: "Шрифты с поддержкой русского и казахского",
    role_kz: "Қазақ және орыс әріптерін қолдайтын қаріптер",
  },
];

export default function SafetyAndLimitationsPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  return (
    <div className="stack-lg">
      <header className="stack-xs">
        <Link
          href="/portal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            fontSize: "13px",
            color: "var(--muted)",
            alignSelf: "flex-start",
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} aria-hidden="true" />
          {t.back_to_registry}
        </Link>
        <h1 className="page-title">{t.nav_safety}</h1>
        <p className="page-subtitle">
          {isKz
            ? "Деректерді иесіздендіру, клиникалық қолдану шекаралары, шұғыл жағдай ескертуі және лицензиялар."
            : "Консультативный статус системы, границы клинического применения, защита персональных данных и лицензии ресурсов."}
        </p>
      </header>

      {/* Emergency & Advisory Status */}
      <section className="callout callout-amber">
        <ShieldAlert
          size={20}
          strokeWidth={1.7}
          color="var(--amber)"
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: "2px" }}
        />
        <div className="stack-xs">
          <h2 className="section-title">
            {isKz ? "Шұғыл жәрдем 103 және кеңестік мәртебе" : "Неотложная помощь 103 и консультативный статус"}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6, maxWidth: "65ch" }}>
            {isKz
              ? "Libra дербес диагноз қоймайды, дәрі тағайындамайды және стационарлық немесе амбулаториялық оңалту бағдарламасын дәрігердің орнына бекітпейді. Жедел ауырсыну, естен тану, құлап жарақаттану немесе тыныс тарылу кезінде Қазақстан Республикасында 103 нөміріне қоңырау шалыңыз."
              : "Libra является системой поддержки принятия врачебных решений: она не устанавливает медицинский диагноз, не назначает лекарственные препараты и не заменяет врача-реабилитолога. При острой боли, судорогах, падении или травме незамедлительно обращайтесь в скорую помощь по номеру 103."}
          </p>
        </div>
      </section>

      {/* Anonymization & Limitations */}
      <div className="grid-2">
        <section className="surface stack-sm">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <Lock size={17} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
            <h2 className="section-title">
              {isKz ? "Дербес деректерді қорғау (ҚР № 94-V Заңы)" : "Защита персональных данных (Закон РК № 94-V)"}
            </h2>
          </div>
          <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "65ch" }}>
            {isKz
              ? "CSV файлдарды жүктеу кезінде жүйе ЖСН, ТАӘ, телефон, мекенжай және туған күні сияқты дербес бағандарды автоматты түрде бұғаттайды. Карталар тек иесіздендірілген кодтармен (s61520_x) сақталады."
              : "При импорте CSV-таблиц сервер автоматически отклоняет файлы, содержащие персональные идентификаторы (ИИН, ФИО, телефон, адрес, дата рождения). В базе хранятся только обезличенные клинические коды."}
          </p>
        </section>

        <section className="surface stack-sm">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <Scale size={17} strokeWidth={1.6} color="var(--amber)" aria-hidden="true" />
            <h2 className="section-title">
              {isKz ? "Шешімнің негізгі шектеулері (N=29)" : "Явные ограничения методики (N=29)"}
            </h2>
          </div>
          <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "65ch" }}>
            {isKz
              ? "Болжам моделі 29 пациенттен тұратын шағын когортада (KU Leuven) калибрленген және тек бастапқы сагитталды көрсеткіштерді ескереді. Түпкілікті оңалту шешімін дәрігер пациентті тікелей қарау нәтижесінде қабылдайды."
              : "Прогностическая модель откалибрована на открытой когорте из 29 детей с ДЦП и оценивает только сагиттальную кинематику и момент бедра. Она не заменяет очный осмотр, ортопедическое тестирование и контроль спастичности."}
          </p>
        </section>
      </div>

      {/* Provenance & Third Party Table */}
      <section className="surface-flush">
        <div
          style={{
            padding: "var(--sp-4) var(--sp-5)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
          }}
        >
          <Database size={17} strokeWidth={1.6} color="var(--teal)" aria-hidden="true" />
          <h2 id="licenses-table-title" className="section-title">
            {isKz ? "Ашық дереккөздер және лицензиялар" : "Источники открытых данных и лицензии"}
          </h2>
        </div>
        <div tabIndex={0} role="region" aria-labelledby="licenses-table-title" className="table-responsive">
          <table className="clinical-table">
            <caption className="visually-hidden">
              {isKz ? "Қолданылған ашық кітапханалар мен деректер тізімі" : "Перечень открытых наборов данных и программных библиотек"}
            </caption>
            <thead>
              <tr>
                <th scope="col">{isKz ? "Ресурс" : "Компонент / набор данных"}</th>
                <th scope="col">{isKz ? "Лицензия" : "Лицензия"}</th>
                <th scope="col">{isKz ? "Қолдану мақсаты" : "Назначение в системе"}</th>
              </tr>
            </thead>
            <tbody>
              {THIRD_PARTY_RESOURCES.map((item) => (
                <tr key={item.name}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>
                    <span className="badge badge-neutral mono">{item.license}</span>
                  </td>
                  <td style={{ color: "var(--secondary)" }}>{isKz ? item.role_kz : item.role_ru}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
