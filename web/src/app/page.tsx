"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Activity, FileText } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { LanguageSwitch, LargeFontButton } from "@/components/PageControls";
import { useLanguage } from "@/lib/LanguageContext";
import { getCohortAnalytics } from "@/lib/api";
import { CohortAnalytics } from "@/lib/types";

export default function LandingPage() {
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";
  const [cohort, setCohort] = useState<CohortAnalytics | null>(null);

  useEffect(() => {
    getCohortAnalytics()
      .then((d) => setCohort(d))
      .catch(() => {});
  }, []);

  const workflowSteps = [
    {
      title: isKz ? "Иесіздендірілген CSV жүктеу" : "Импорт обезличенного CSV",
      text: isKz
        ? "Бөлгіш «;» және ондық үтірі бар бір немесе көп пациенттік кестелерді оқиды. ЖСН мен ТАӘ бағандары ҚР № 94-V заңына сай автоматты түрде бұғатталады."
        : "Импорт одно- и многосубъектных таблиц с разделителем «;», десятичной запятой и пропусками. Столбцы с ФИО и ИИН отклоняются по Закону РК № 94-V.",
    },
    {
      title: isKz ? "Қалыпты, ауызша және VR салыстыру" : "Сравнение обычной ходьбы, голоса и VR",
      text: isKz
        ? "Сау балалар нормативтік дәлізі аясында жамбас, сан, тізе, тобық бұрыштарын талдап, жамбас компенсациясын (PCR) және шынайы өсімді (TJE) есептейді."
        : "Строит кривые углов таза, бедра, колена и стопы на фоне нормы здоровых детей, выявляет перегрузку таза и определяет безопасный режим.",
    },
    {
      title: isKz ? "Қазақ және орыс тілдеріндегі PDF есеп" : "Двуязычный отчёт PDF и коды МКФ",
      text: isKz
        ? "Дәрігерге арналған клиникалық хаттама мен ата-аналарға түсінікті жадынаманы ДДҰ МКФ (b770, d450) санаттарымен қалыптастырады."
        : "Формирует врачебный протокол и памятку для родителей с графиками, таблицей изменений и кодами МКФ ВОЗ b770 и d450.",
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      <a href="#main-landing" className="skip-link visually-hidden">
        {isKz ? "Негізгі мазмұнға өту" : "Перейти к содержимому"}
      </a>

      <header className="site-header">
        <div className="container site-header-inner">
          <LibraLogo size="md" href="/" subtitle={t.brand_sub} />

          <nav aria-label={isKz ? "Бет бөлімдері" : "Разделы страницы"} className="site-nav hide-on-mobile">
            <a href="#methodology" className="site-nav-link">
              {isKz ? "Әдістеме" : "Методика"}
            </a>
            <a href="#workflow" className="site-nav-link">
              {isKz ? "Дәрігер жұмысы" : "Для врача"}
            </a>
            <Link href="/portal/safety" className="site-nav-link">
              {isKz ? "Қауіпсіздік және 103" : "Этика и 103"}
            </Link>
          </nav>

          <div className="cluster">
            <LanguageSwitch compact />
            <LargeFontButton />
            <Link href="/portal" className="btn btn-primary">
              <span>{isKz ? "Дәрігер кабинеті" : "Кабинет врача"}</span>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-landing" tabIndex={-1} style={{ flex: 1 }}>
        {/* Hero */}
        <section className="container" style={{ paddingBlock: "clamp(32px, 5vw, 64px)" }}>
          <div className="grid-hero">
            <div className="stack-md" style={{ maxWidth: "540px" }}>
              <h1 className="font-display" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>
                {isKz
                  ? "Жамбасқа артық жүктемесіз сан буынының шынайы жазылуы"
                  : "Истинное разгибание бедра без скрытой перегрузки таза"}
              </h1>

              <p style={{ fontSize: "16px", color: "var(--secondary)", lineHeight: 1.6 }}>
                {isKz
                  ? "БЦП бар балалардың қалыпты жүрісін, ауызша нұсқауын және VR-жаттығуларын салыстырып, буынның нақты прогресін (TJE) жамбастың компенсаторлық еңкеюінен (PCR) ажыратады"
                  : "Libra сравнивает обычную ходьбу, голосовые команды и VR-обратную связь у детей с ДЦП, отделяя анатомический прогресс (TJE) от компенсации тазом (PCR)"}
              </p>

              <div className="cluster" style={{ paddingTop: "var(--sp-1)", gap: "var(--sp-3)" }}>
                <Link href="/portal" className="btn btn-primary btn-lg">
                  <span>{isKz ? "Пациенттер тізілімін ашу" : "Открыть реестр пациентов"}</span>
                  <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                </Link>

                <Link href="/portal/patients/s61520_1" className="btn btn-lg">
                  {isKz ? "Клиникалық жағдайды қарау" : "Разобрать клинический случай"}
                </Link>
              </div>

              <p className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)" }}>
                {cohort
                  ? isKz
                    ? `Ашық дерекқор KU Leuven (CC-BY-NC-SA-4.0) · ${cohort.total_patients} пациент · ${cohort.cycles.total.toLocaleString("kk-KZ")} қадам циклі`
                    : `Открытая база KU Leuven (DOI 10.48804/JUNNWW · CC-BY-NC-SA-4.0) · ${cohort.total_patients} пациентов · ${cohort.cycles.total.toLocaleString("ru-RU")} циклов шага`
                  : isKz
                  ? "Ашық клиникалық дерекқор KU Leuven (DOI 10.48804/JUNNWW · CC-BY-NC-SA-4.0)"
                  : "Открытая клиническая база KU Leuven (DOI 10.48804/JUNNWW · CC-BY-NC-SA-4.0)"}
              </p>
            </div>

            <div className="surface-flush" style={{ background: "#f8f5ee" }}>
              <img
                src="/assets/images/gait-editorial-hero.webp"
                alt={
                  isKz
                    ? "Сагиттальды жазықтықтағы бала жүрісінің фазалары мен буын бұрыштарының сызбасы"
                    : "Схема сагиттальной биомеханики шага ребёнка: углы таза, бедра и колена в фазе опоры"
                }
                width={1264}
                height={848}
                fetchPriority="high"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section
          id="methodology"
          style={{
            borderBlockStart: "1px solid var(--line)",
            background: "var(--white)",
            paddingBlock: "var(--sp-12)",
          }}
        >
          <div className="container stack-lg">
            <div style={{ maxWidth: "66ch" }}>
              <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 32px)" }}>
                {isKz
                  ? "Неліктен буын бұрышының өзі жеткіліксіз"
                  : "Почему одного угла разгибания бедра недостаточно"}
              </h2>
              <p className="page-subtitle">
                {isKz
                  ? "VR-жаттығуда бала жамбасын алға еңкейтіп, бел омыртқасына жүктеме түсіру арқылы бейнені орындай алады. Libra бұл компенсацияны сандық түрде бөліп көрсетеді."
                  : "На дорожке с VR-экраном ребёнок нередко выводит бедро вперёд за счёт гиперлордоза и переднего наклона таза. Обычная разница углов скрывает перегрузку поясницы."}
              </p>
            </div>

            <div className="grid-3">
              <div className="surface-muted stack-sm">
                <Activity size={18} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
                <h3 className="section-title">
                  {isKz ? "Шынайы буын жазылуы (TJE)" : "Истинное разгибание (TJE)"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {isKz
                    ? "Тірек фазасындағы сан бұрышының өзгерісін жамбастың сагиттальды еңкеюіне түзетеді. TJE ≤ −1,0° нақты буын ілгерілеуін растайды."
                    : "Корректирует прирост разгибания бедра в фазе опоры на изменение наклона таза. Значение ≤ −1,0° подтверждает анатомическую коррекцию."}
                </p>
              </div>

              <div className="surface-muted stack-sm">
                <ShieldCheck size={18} strokeWidth={1.5} color="var(--amber)" aria-hidden="true" />
                <h3 className="section-title">
                  {isKz ? "Компенсация индексі (PCR)" : "Индекс компенсации (PCR)"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {isKz
                    ? "Жамбас, тізе және тобық ауытқуын сан нәтижесіне бөледі. PCR > 0,80 немесе жамбас еңкеюі > +2,0° болса, жүйе дәрігерге ескерту береді."
                    : "Соотносит избыточный наклон таза, колена и стопы к выигрышу в бедре. Порог PCR > 0,80 или завал таза > +2,0° предупреждает о перегрузке."}
                </p>
              </div>

              <div className="surface-muted stack-sm">
                <FileText size={18} strokeWidth={1.5} color="var(--ink)" aria-hidden="true" />
                <h3 className="section-title">
                  {isKz ? "Қалыпты · Ауызша · VR және МКФ" : "Обычная · Голос · VR и МКФ ВОЗ"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {isKz
                    ? "Үш режимді қатар салыстырып, қауіпсіз бағытты көрсетеді және ДДҰ МКФ (b770, d450) санаттары бар PDF есеп қалыптастырады."
                    : "Сопоставляет все три режима проб, выделяет безопасный протокол и формирует PDF-выписку с кодами МКФ ВОЗ b770 и d450."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Doctor Workflow */}
        <section id="workflow" className="container" style={{ paddingBlock: "var(--sp-12)" }}>
          <div className="row-end" style={{ marginBlockEnd: "var(--sp-6)" }}>
            <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 32px)" }}>
              {isKz ? "Дәрігер қабылдауындағы үш қадам" : "Три шага на приёме врача-реабилитолога"}
            </h2>
            <Link href="/portal/ml-validation" className="btn">
              {isKz ? "Модельдер дәлдігін тексеру" : "Метрики и проверка моделей"}
            </Link>
          </div>

          <div className="grid-3">
            {workflowSteps.map((step) => (
              <div
                key={step.title}
                className="stack-sm"
                style={{ borderBlockStart: "2px solid var(--ink)", paddingBlockStart: "var(--sp-4)" }}
              >
                <h3 style={{ fontSize: "17px", fontWeight: 600 }}>{step.title}</h3>
                <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.6 }}>{step.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <div style={{ maxWidth: "66ch", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--ink)" }}>Libra</strong> · {t.emergency_banner}
          </div>

          <div className="site-footer-links">
            <Link href="/portal/safety">{t.nav_safety}</Link>
            <Link href="/privacy">{isKz ? "Дербес деректер (94-V)" : "Конфиденциальность"}</Link>
            <Link href="/terms">{isKz ? "Қолдану шектеулері" : "Ограничения СППР"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
