"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, ShieldCheck, Activity, FileText } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { getCohortAnalytics } from "@/lib/api";
import { CohortAnalytics } from "@/lib/types";

export default function LandingPage() {
  const { lang, setLang, t } = useLanguage();
  const isKz = lang === "kz";
  const [largeFont, setLargeFont] = useState(false);
  const [cohort, setCohort] = useState<CohortAnalytics | null>(null);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem("libra_a11y_large") === "1";
      setLargeFont(enabled);
      document.documentElement.classList.toggle("a11y-large", enabled);
    } catch {}
    getCohortAnalytics()
      .then((d) => setCohort(d))
      .catch(() => {});
  }, []);

  const toggleLargeFont = () => {
    const next = !largeFont;
    setLargeFont(next);
    document.documentElement.classList.toggle("a11y-large", next);
    try {
      localStorage.setItem("libra_a11y_large", next ? "1" : "0");
    } catch {}
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      <a href="#main-landing" className="skip-link visually-hidden">
        {isKz ? "Негізгі мазмұнға өту" : "Перейти к содержимому"}
      </a>

      {/* Quiet Editorial Header */}
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--paper)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          className="container"
          style={{
            minBlockSize: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            paddingBlock: "10px",
          }}
        >
          <LibraLogo size="md" href="/" subtitle={t.brand_sub} />

          <nav
            aria-label={isKz ? "Бет бөлімдері" : "Навигация по странице"}
            className="hide-on-mobile"
            style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "14px", color: "var(--secondary)" }}
          >
            <a href="#methodology" style={{ fontWeight: 500 }}>
              {isKz ? "Әдістеме" : "Методика"}
            </a>
            <a href="#workflow" style={{ fontWeight: 500 }}>
              {isKz ? "Дәрігерге арналған" : "Для врача"}
            </a>
            <Link href="/portal/safety" style={{ fontWeight: 500 }}>
              {isKz ? "Этика және шектеулер" : "Этика и 103"}
            </Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div
              role="group"
              aria-label={isKz ? "Тілді таңдау" : "Выбор языка"}
              style={{
                display: "inline-flex",
                background: "var(--sidebar)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "2px",
                gap: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setLang("ru")}
                aria-pressed={lang === "ru"}
                style={{
                  minBlockSize: "30px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: lang === "ru" ? 600 : 500,
                  background: lang === "ru" ? "var(--white)" : "transparent",
                  color: lang === "ru" ? "var(--ink)" : "var(--secondary)",
                }}
              >
                Рус
              </button>
              <button
                type="button"
                onClick={() => setLang("kz")}
                aria-pressed={lang === "kz"}
                style={{
                  minBlockSize: "30px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: lang === "kz" ? 600 : 500,
                  background: lang === "kz" ? "var(--white)" : "transparent",
                  color: lang === "kz" ? "var(--ink)" : "var(--secondary)",
                }}
              >
                Қаз
              </button>
            </div>

            <button
              type="button"
              onClick={toggleLargeFont}
              aria-pressed={largeFont}
              title={isKz ? "Ірі қаріп режимі" : "Версия для слабовидящих"}
              className="btn"
              style={{ minBlockSize: "34px", padding: "6px 10px" }}
            >
              <Eye size={14} strokeWidth={1.6} />
              <span className="hide-on-mobile" style={{ fontSize: "12px" }}>
                {largeFont ? (isKz ? "Қалыпты" : "Обычный") : (isKz ? "Ірі қаріп" : "А+")}
              </span>
            </button>

            <Link href="/portal" className="btn btn-primary" style={{ minBlockSize: "36px" }}>
              <span>{isKz ? "Дәрігер кабинеті" : "Кабинет врача"}</span>
              <ArrowRight size={14} strokeWidth={1.7} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-landing" tabIndex={-1} style={{ flex: 1 }}>
        {/* Hero */}
        <section className="container" style={{ paddingBlock: "clamp(40px, 6vw, 76px)" }}>
          <div className="grid-hero">
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "560px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--teal)" }}>
                {isKz
                  ? "БЦП бар балалардың жүріс биомеханикасын клиникалық талдау"
                  : "Клиническая оценка VR-реабилитации при детском церебральном параличе"}
              </p>

              <h1 className="font-display" style={{ fontSize: "clamp(32px, 4.2vw, 50px)", lineHeight: 1.08 }}>
                {isKz
                  ? "Жамбасқа артық жүктемесіз сан буынының шынайы жазылуы."
                  : "Истинное разгибание бедра без скрытой перегрузки таза."}
              </h1>

              <p style={{ fontSize: "16px", color: "var(--secondary)", lineHeight: 1.6 }}>
                {isKz
                  ? "Libra қалыпты жүріс, ауызша нұсқау және VR-кері байланыс сынақтарын салыстырып, буынның нақты прогресін (TJE) жамбастың компенсаторлық еңкеюінен (PCR) ажыратады."
                  : "Libra сравнивает обычную ходьбу, голосовые инструкции и VR-обратную связь, отделяя истинное суставное движение (TJE) от компенсации тазом (PCR)."}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", paddingTop: "4px" }}>
                <Link href="/portal" className="btn btn-primary" style={{ minBlockSize: "42px", paddingInline: "20px", fontSize: "14px" }}>
                  <span>
                    {cohort
                      ? isKz
                        ? `Тізілімді ашу (${cohort.total_patients} пациент)`
                        : `Открыть реестр (${cohort.total_patients} пациентов)`
                      : isKz
                      ? "Дәрігер кабинетін ашу"
                      : "Открыть кабинет врача"}
                  </span>
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>

                <Link href="/portal/patients/s61520_8" className="btn" style={{ minBlockSize: "42px", paddingInline: "18px", fontSize: "14px" }}>
                  {isKz ? "Клиникалық жағдайды қарау" : "Разобрать клинический случай"}
                </Link>
              </div>

              <p className="tabular-nums" style={{ fontSize: "12px", color: "var(--muted)" }}>
                {cohort
                  ? isKz
                    ? `Дерекқор: KU Leuven (DOI 10.48804/JUNNWW · CC-BY-NC-SA-4.0) · ${cohort.total_patients} науқас · ${cohort.cycles.total} қадам циклі`
                    : `Данные KU Leuven (DOI 10.48804/JUNNWW · CC-BY-NC-SA-4.0) · ${cohort.total_patients} пациентов · ${cohort.cycles.total} циклов шага`
                  : isKz
                  ? "KU Leuven ашық клиникалық деректер базасы (CC-BY-NC-SA-4.0)"
                  : "Открытая клиническая база KU Leuven (DOI 10.48804/JUNNWW · CC-BY-NC-SA-4.0)"}
              </p>
            </div>

            <div
              style={{
                borderRadius: "14px",
                border: "1px solid var(--line)",
                background: "var(--paper)",
                overflow: "hidden",
              }}
            >
              <img
                src="/assets/images/gait-editorial-hero.webp"
                alt={
                  isKz
                    ? "Сагитталды жазықтықта жүріс жолындағы баланың қадам фазалары: жамбас, сан және тізе бұрыштарының сызбасы"
                    : "Клиническая иллюстрация анализа походки ребёнка в сагиттальной плоскости: фазы шага и дуги углов таза, бедра и колена"
                }
                width={1264}
                height={848}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          </div>
        </section>

        {/* Methodology: What Standard Evaluation Misses vs Libra */}
        <section
          id="methodology"
          style={{
            borderTop: "1px solid var(--line)",
            background: "var(--white)",
            paddingBlock: "56px",
          }}
        >
          <div className="container" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div style={{ maxWidth: "68ch" }}>
              <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 32px)" }}>
                {isKz
                  ? "Неліктен буын бұрышының өзі жеткіліксіз"
                  : "Почему одного угла разгибания бедра недостаточно"}
              </h2>
              <p style={{ color: "var(--secondary)", marginTop: "8px", fontSize: "15px" }}>
                {isKz
                  ? "VR-жаттығуда бала жамбасын алға еңкейтіп, бел омыртқасына жүктеме түсіру арқылы бейнені орындай алады. Libra бұл бүркемеленген компенсацияны сандық түрде бөліп көрсетеді."
                  : "На дорожке с VR-экраном ребёнок нередко выводит бедро за счёт гиперлордоза и переднего наклона таза. Интегральный показатель и сырая разница углов скрывают перегрузку поясницы."}
              </p>
            </div>

            <div className="grid-problem">
              <div className="surface-muted" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Activity size={18} strokeWidth={1.6} color="var(--teal)" />
                <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                  {isKz ? "Шынайы буын жазылуы (TJE)" : "Истинное разгибание (TJE)"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {isKz
                    ? "Сан буынының тірек фазасындағы өзгерісін (aMinSagH) жамбастың сагитталды еңкеюіне түзетеді. TJE ≤ −1,0° буын ішілік нақты прогресті растайды."
                    : "Корректирует прирост разгибания бедра в фазе опоры на изменение наклона таза. Значение ≤ −1,0° подтверждает анатомическую коррекцию."}
                </p>
              </div>

              <div className="surface-muted" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <ShieldCheck size={18} strokeWidth={1.6} color="var(--amber)" />
                <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                  {isKz ? "Компенсация индексі (PCR)" : "Индекс компенсации (PCR)"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {isKz
                    ? "Сабақтас буындар ауытқуын сан нәтижесіне бөледі. PCR > 0,80 немесе жамбас еңкеюі > +2,0° болса, жүйе жүктемені төмендетуді ескертеді."
                    : "Соотносит избыточный наклон таза, колена и стопы к выигрышу в бедре. Порог PCR > 0,80 или завал таза > +2,0° блокирует рекомендацию агрессивного VR."}
                </p>
              </div>

              <div className="surface-muted" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <FileText size={18} strokeWidth={1.6} color="var(--ink)" />
                <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                  {isKz ? "Қалып · Ауызша · VR және МКФ" : "Обычная · Голос · VR и МКФ ВОЗ"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {isKz
                    ? "Үш режимді қатар салыстырып, науқасқа ең қауіпсіз әдісті таңдайды және ДДҰ МКФ (b770, d450) бойынша қос тілді PDF есеп қалыптастырады."
                    : "Сопоставляет три режима проб, выбирает оптимальный протокол и формирует двуязычную выписку в PDF с кодами МКФ ВОЗ b770 и d450."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Doctor Workflow */}
        <section id="workflow" className="container" style={{ paddingBlock: "56px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
            <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 32px)" }}>
              {isKz ? "Дәрігер жұмысының үш қадамы" : "Три шага на приёме врача-реабилитолога"}
            </h2>
            <Link href="/portal/ml-validation" className="btn">
              {isKz ? "GroupKFold және PCA валидациясы" : "Валидация моделей GroupKFold"}
            </Link>
          </div>

          <div className="grid-problem">
            {[
              {
                num: "01",
                title: isKz ? "Иесіздендірілген CSV жүктеу" : "Загрузка обезличенного CSV",
                text: isKz
                  ? "Бөлгіш «;» және ондық үтірмен бірыңғай немесе көп пациенттік кестелерді импорттау. ЖСН, ТАӘ бағандары ҚР № 94-V заңына сай автоматты түрде бұғатталады."
                  : "Импорт одно- и многосубъектных файлов («;», запятая, LEFT/RIGHT). Столбцы ФИО и ИИН автоматически блокируются по Закону РК № 94-V.",
              },
              {
                num: "02",
                title: isKz ? "Буын қисықтары мен бағдаршам" : "Кривые суставов и светофор риска",
                text: isKz
                  ? "Сау балалар нормативтік дәлізі аясында жамбас, сан, тізе, тобық бұрыштары мен сан моментін талдау және LOO-калибрленген болжам алу."
                  : "Графики углов и момента бедра на фоне нормативного коридора здоровых детей, индекс GPS и прогноз ответа без перегрузки поясницы.",
              },
              {
                num: "03",
                title: isKz ? "Қазақ және орыс тілді PDF" : "Клинический отчёт на РУС / ҚАЗ",
                text: isKz
                  ? "Оңалту орталықтары мен ата-аналарға түсінікті клиникалық қорытынды, шұғыл 103 ескертуі және МКФ b770/d450 статусын экспорттау."
                  : "Готовый PDF-протокол с кинематикой, тактикой по методу и обязательным консультативным дисклеймером по пункту 8.2.",
              },
            ].map((step) => (
              <div
                key={step.num}
                style={{
                  borderTop: "2px solid var(--ink)",
                  paddingTop: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <span className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, color: "var(--teal)" }}>
                  {step.num}
                </span>
                <h3 style={{ fontSize: "17px", fontWeight: 600 }}>{step.title}</h3>
                <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.6 }}>{step.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Quiet Clinical Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          background: "var(--white)",
          paddingBlock: "24px",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          <div style={{ maxWidth: "64ch", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--ink)" }}>Libra</strong> ·{" "}
            {isKz
              ? "Дәрігерлік шешімдерді қолдау жүйесі (СППР). Дербес диагноз қоймайды, дәрі тағайындамайды. Жедел жағдайда 103 нөміріне қоңырау шалыңыз."
              : "Система поддержки врачебных решений при ДЦП. Не ставит диагноз и не назначает лечение. В экстренных случаях звоните 103."}
          </div>

          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <Link href="/portal/safety" style={{ color: "var(--ink)", fontWeight: 500 }}>
              {t.nav_safety}
            </Link>
            <Link href="/privacy" style={{ color: "var(--ink)", fontWeight: 500 }}>
              {isKz ? "Дербес деректер (94-V)" : "Конфиденциальность"}
            </Link>
            <Link href="/terms" style={{ color: "var(--ink)", fontWeight: 500 }}>
              {isKz ? "Қолдану шарттары" : "Ограничения СППР"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
