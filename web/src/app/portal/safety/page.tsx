"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Lock, Database, Scale } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const THIRD_PARTY_RESOURCES = [
  { name: "KU Leuven CP Gait Dataset", license: "CC-BY-NC-SA-4.0", role_ru: "Открытая клиническая когорта (DOI 10.48804/JUNNWW)", role_kz: "Ашық клиникалық когорта (DOI 10.48804/JUNNWW)" },
  { name: "FastAPI / Pydantic / SQLAlchemy", license: "MIT", role_ru: "Клинический сервер и схема хранения", role_kz: "Клиникалық сервер және сақтау жүйесі" },
  { name: "scikit-learn / SciPy / NumPy", license: "BSD-3-Clause", role_ru: "Групповая валидация GroupKFold и PCA", role_kz: "GroupKFold валидациясы және PCA" },
  { name: "Matplotlib", license: "PSF / Matplotlib License", role_ru: "Формирование PDF-протокола выписки", role_kz: "PDF-шығару хаттамасын қалыптастыру" },
  { name: "python-multipart", license: "Apache-2.0", role_ru: "Загрузка клинических CSV-таблиц", role_kz: "Клиникалық CSV кестелерін жүктеу" },
  { name: "Next.js / React / Lucide", license: "MIT / ISC", role_ru: "Интерфейс врача и доступные компоненты", role_kz: "Дәрігер интерфейсі және қолжетімді элементтер" },
  { name: "Inter / Noto Serif / JetBrains Mono", license: "SIL OFL 1.1", role_ru: "Шрифты с поддержкой русского и казахского", role_kz: "Қазақ және орыс әріптерін қолдайтын қаріптер" },
];

export default function SafetyAndLimitationsPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "960px" }}>
      <header>
        <Link
          href="/portal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--muted)",
            marginBottom: "8px",
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} />
          {t.back_to_registry}
        </Link>
        <h1 className="font-display" style={{ fontSize: "clamp(24px, 2.5vw, 32px)", lineHeight: 1.15 }}>
          {t.nav_safety}
        </h1>
        <p style={{ color: "var(--secondary)", fontSize: "14px", marginTop: "6px" }}>
          {isKz
            ? "Деректерді иесіздендіру, клиникалық қолдану шекаралары, шұғыл жағдай ескертуі және лицензиялар."
            : "Статус системы поддержки решений, границы клинического применения, защита персональных данных и лицензии ресурсов."}
        </p>
      </header>

      {/* Emergency & Advisory Status */}
      <section
        className="surface"
        style={{
          background: "var(--amber-bg)",
          borderColor: "var(--amber-border)",
          display: "flex",
          gap: "14px",
          alignItems: "flex-start",
        }}
      >
        <ShieldAlert size={20} strokeWidth={1.7} color="var(--amber)" style={{ flexShrink: 0, marginTop: "2px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
            {isKz ? "Шұғыл жәрдем 103 және медициналық мәртебе (8.2-тармақ)" : "Неотложная помощь 103 и консультативный статус (п. 8.2)"}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>
            {isKz
              ? "Libra дербес диагноз қоймайды, дәрі тағайындамайды және стационарлық немесе амбулаториялық оңалту бағдарламасын дәрігердің орнына бекітпейді. Жедел ауырсыну, естен тану, құлап жарақаттану немесе тыныс тарылу кезінде Қазақстан Республикасында 103 нөміріне қоңырау шалыңыз."
              : "Libra является системой поддержки принятия врачебных решений (СППР): она не устанавливает медицинский диагноз, не назначает лекарственные препараты и не заменяет врача-реабилитолога. При острой боли, судорогах, падении или травме незамедлительно обращайтесь в скорую помощь по номеру 103."}
          </p>
        </div>
      </section>

      {/* Anonymization & Limitations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        <section className="surface" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Lock size={17} strokeWidth={1.6} color="var(--teal)" />
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
              {isKz ? "Дербес деректерді қорғау (94-V Заңы)" : "Защита персональных данных (Закон РК № 94-V)"}
            </h2>
          </div>
          <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.6 }}>
            {isKz
              ? "CSV файлдарды жүктеу кезінде жүйе ЖСН, ТАӘ, телефон, мекенжай және туған күні сияқты дербес бағандарды автоматты түрде бұғаттайды. Карталар тек иесіздендірілген кодтармен (s61520_x) сақталады."
              : "При импорте CSV-таблиц сервер автоматически отклоняет файлы, содержащие персональные идентификаторы (ИИН, ФИО, телефон, адрес, дата рождения). В базе хранятся только обезличенные клинические коды."}
          </p>
        </section>

        <section className="surface" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Scale size={17} strokeWidth={1.6} color="var(--amber)" />
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
              {isKz ? "Шешімнің негізгі шектеулері" : "Явные ограничения методики"}
            </h2>
          </div>
          <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.6 }}>
            {isKz
              ? "Болжам моделі 29 пациенттен тұратын шағын когортада (KU Leuven) калибрленген және тек бастапқы сагитталды көрсеткіштерді ескереді. Түпкілікті оңалту шешімін дәрігер пациентті тікелей қарау нәтижесінде қабылдайды."
              : "Прогностическая модель откалибрована на открытой когорте из 29 детей с ДЦП и оценивает только сагиттальную кинематику и момент бедра. Она не заменяет очный осмотр, ортопедическое тестирование и контроль спастичности."}
          </p>
        </section>
      </div>

      {/* Provenance & Third Party Table */}
      <section className="surface" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "8px" }}>
          <Database size={17} strokeWidth={1.6} color="var(--teal)" />
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
            {isKz ? "Ашық дереккөздер және лицензиялар (8.3-тармақ)" : "Источники открытых данных и лицензии ресурсов (п. 8.3)"}
          </h2>
        </div>
        <div className="table-responsive">
          <table className="clinical-table">
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
                    <span className="badge badge-neutral" style={{ fontFamily: "var(--mono)" }}>
                      {item.license}
                    </span>
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
