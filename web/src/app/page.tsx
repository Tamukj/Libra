"use client";

import React from "react";
import Link from "next/link";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { ArrowRight, Stethoscope, ChevronRight, CheckCircle2, AlertOctagon, Activity } from "lucide-react";

export default function LandingPage() {
  const { lang, setLang } = useLanguage();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      
      {/* 1. Public Header */}
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--paper)", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "68px" }}>
          
          <LibraLogo size="md" />

          <nav style={{ display: "flex", gap: "24px", fontSize: "13px", fontWeight: "600" }} className="hide-on-mobile">
            <Link href="#problem" style={{ color: "var(--muted)" }}>{lang === "kz" ? "Клиникалық міндет" : "Клиническая задача"}</Link>
            <Link href="#technology" style={{ color: "var(--muted)" }}>{lang === "kz" ? "Биомеханика" : "Биомеханика"}</Link>
            <Link href="#regional" style={{ color: "var(--muted)" }}>{lang === "kz" ? "Аймақ статистикасы" : "Статистика региона"}</Link>
            <Link href="/portal" style={{ color: "var(--muted)" }}>{lang === "kz" ? "Демо-портал" : "Демо-портал"}</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Bilingual Switcher */}
            <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", background: "var(--white)" }}>
              <button
                onClick={() => setLang("kz")}
                style={{
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "none",
                  background: lang === "kz" ? "var(--linen)" : "transparent",
                  color: "var(--ink)",
                  cursor: "pointer"
                }}
              >
                ҚАЗ
              </button>
              <button
                onClick={() => setLang("ru")}
                style={{
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "none",
                  borderLeft: "1px solid var(--line)",
                  background: lang === "ru" ? "var(--linen)" : "transparent",
                  color: "var(--ink)",
                  cursor: "pointer"
                }}
              >
                РУС
              </button>
            </div>

            <Link href="/login" className="btn btn-primary" style={{ padding: "8px 16px" }}>
              <Stethoscope size={15} />
              <span>{lang === "kz" ? "Дәрігерлер кіруі" : "Вход для врачей"}</span>
            </Link>
          </div>

        </div>
      </header>

      {/* 2. Hero Section */}
      <section style={{ padding: "56px 0 64px", borderBottom: "1px solid var(--line)" }}>
        <div className="container">
          <div className="grid-hero">
            
            <div>
              <h1 style={{ fontSize: "clamp(34px, 4.2vw, 56px)", lineHeight: 1.1, marginBottom: "18px" }}>
                {lang === "kz"
                  ? "Балалар церебралды параличіндегі жүрістің клиникалық биомеханикалық талдауы"
                  : "Клинический анализ походки по CSV-данным при детском церебральном параличе"}
              </h1>

              <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: "1.6", maxWidth: "52ch", marginBottom: "28px" }}>
                {lang === "kz"
                  ? "CSV-деректері бойынша жүрістің клиникалық талдауы 30 секундта. Қолмен толтырылатын 40 минуттық құжаттаманы алмастырады, VR кезіндегі жамбастың жасырын компенсациясын анықтайды және Damumed-ке арналған ДДҰ ХҚЖ ресми хаттамасын дайындайды."
                  : "Клинический анализ походки по CSV-данным за 30 секунд. Заменяет 40 минут ручного заполнения бланков, выявляет скрытые компенсации таза в VR и формирует готовый протокол по МКФ ВОЗ для вставки в Damumed."}
              </p>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <Link href="/login" className="btn btn-amber" style={{ padding: "11px 22px", fontSize: "14px" }}>
                  <span>{lang === "kz" ? "Дәрігердің жұмыс үстеліне өту" : "Открыть рабочий стол врача"}</span>
                  <ArrowRight size={15} />
                </Link>
                <Link href="/portal" className="btn" style={{ padding: "11px 18px", fontSize: "14px" }}>
                  <span>{lang === "kz" ? "Консилиумға арналған демо-қолжетімділік" : "Демо-доступ для консилиума"}</span>
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "36px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {lang === "kz" ? "Пациенттер таңдамасы" : "Выборка пациентов"}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: "600", marginTop: "2px" }}>
                    {lang === "kz" ? "29 бала" : "29 детей"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {lang === "kz" ? "Бағалау стандарты" : "Стандарт оценки"}
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "600", marginTop: "2px" }}>
                    {lang === "kz" ? "Бейкер (GVS)" : "Бейкер (GVS)"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {lang === "kz" ? "ДДҰ классификациясы" : "Классификация ВОЗ"}
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "600", marginTop: "2px" }}>
                    {lang === "kz" ? "МКФ b770" : "МКФ b770"}
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Visual Card with Clinical Telemetry */}
            <div style={{
              background: "var(--white)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(28, 25, 23, 0.04)"
            }}>
              <div style={{
                background: "var(--linen)",
                padding: "10px 16px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--ink)"
              }}>
                <span>{lang === "kz" ? "CSV бойынша жүрісті биомеханикалық талдау кешені" : "Комплекс биомеханического анализа походки по CSV"}</span>
              </div>

              <div style={{ position: "relative", height: "280px" }}>
                <img
                  src="/assets/images/clinical-lab.jpg"
                  alt="Клинический комплекс анализа походки"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "12px",
                  right: "12px",
                  background: "rgba(255, 254, 250, 0.95)",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {lang === "kz" ? "Терапиялық әсерді бақылау" : "Контроль терапевтического эффекта"}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", marginTop: "2px" }}>
                      {lang === "kz" ? "Санның шынайы жазылуы vs жамбас компенсациясы" : "Истинное разгибание бедра vs компенсация таза"}
                    </div>
                  </div>
                  <span className="badge badge-yellow" style={{ fontSize: "11px" }}>
                    {lang === "kz" ? "TJE / PCR бейіні" : "Профиль TJE / PCR"}
                  </span>
                </div>
              </div>

              <div style={{ padding: "14px 16px", background: "var(--white)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                    {lang === "kz" ? "Консилиум құралы" : "Инструмент консилиума"}
                  </span>
                  <strong>{lang === "kz" ? "Қадам циклінің 0-100% клиникалық профилі" : "Клинический профиль 0-100% цикла шага"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>
                    {lang === "kz" ? "Медициналық картаға экспорт" : "Экспорт в медкарту"}
                  </span>
                  <strong>{lang === "kz" ? "Damumed МИС электронды хаттамасы" : "Электронный протокол МИС Damumed"}</strong>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 3. Section: Clinical Challenge (Abai Region & Kazakhstan) */}
      <section id="problem" style={{ padding: "56px 0", borderBottom: "1px solid var(--line)", background: "var(--white)" }}>
        <div className="container" id="regional">
          
          <div style={{ maxWidth: "640px", marginBottom: "36px" }}>
            <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>
              {lang === "kz" ? "Балалардың оңалту қажеттілігі Қазақстанда" : "Потребность детской реабилитации в Казахстане"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.6" }}>
              {lang === "kz"
                ? "CSV-деректер бойынша жүрісті нақты биомеханикалық талдау ортопедиялық араласуларды жоспарлау және емдік дене шынықтыруды таңдау үшін қажет. Өңірлерде диагностика жиі көзбен жүргізіледі, бұл жамбастың патологиялық еңкеюін дер кезінде анықтауды қиындатады."
                : "Точный биомеханический анализ походки по CSV-данным необходим для планирования ортопедических вмешательств и подбора ЛФК. В регионах диагностика часто проводится визуально, что затрудняет обнаружение патологических наклонов таза."}
            </p>
          </div>

          <div className="grid-problem">
            
            <div className="card-raised">
              <div style={{ fontFamily: "var(--serif)", fontSize: "40px", fontWeight: "500", color: "var(--ink)", lineHeight: 1 }}>
                122 400
              </div>
              <div style={{ fontWeight: "700", marginTop: "10px", fontSize: "14px" }}>
                {lang === "kz" ? "ҚР-дағы мүгедектігі бар балалар" : "Детей с инвалидностью в РК"}
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
                {lang === "kz"
                  ? "Ұлттық статистика бюросының мәліметтері бойынша 22 150 балада БЦП диагнозы бар және қозғалыс бұзылыстарын мониторингтеуді қажет етеді."
                  : "По данным Бюро национальной статистики, 22 150 детей имеют диагноз ДЦП и нуждаются в мониторинге двигательных нарушений."}
              </p>
            </div>

            <div className="card-raised">
              <div style={{ fontFamily: "var(--serif)", fontSize: "40px", fontWeight: "500", color: "var(--amber)", lineHeight: 1 }}>
                2 840
              </div>
              <div style={{ fontWeight: "700", marginTop: "10px", fontSize: "14px" }}>
                {lang === "kz" ? "Абай облысында есепте тұрған балалар" : "Детей на учете в области Абай"}
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
                {lang === "kz"
                  ? "Семей қаласы мен іргелес аудандарда жүрісті объективті аппараттық бақылауға жоғары қажеттілік сақталуда."
                  : "В Семее и прилегающих районах сохраняется высокая потребность в объективном аппаратном контроле походки."}
              </p>
            </div>

            <div className="card-raised">
              <div style={{ fontFamily: "var(--serif)", fontSize: "40px", fontWeight: "500", color: "var(--teal)", lineHeight: 1 }}>
                {lang === "kz" ? "30 секунд" : "30 секунд"}
              </div>
              <div style={{ fontWeight: "700", marginTop: "10px", fontSize: "14px" }}>
                {lang === "kz" ? "Қорытынды жасау уақыты" : "Время формирования заключения"}
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
                {lang === "kz"
                  ? "Libra жүріс параметрлерін, Бейкер индекстерін есептеп, дәрігерге арналған дайын қарап-тексеру хаттамасын құрастырады."
                  : "Libra рассчитывает параметры походки, индексы Бейкера и формирует готовый протокол осмотра для врача."}
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Section: Biomechanics - Clean Native Clinical Cards */}
      <section id="technology" style={{ padding: "56px 0", borderBottom: "1px solid var(--line)" }}>
        <div className="container">
          
          <div style={{ maxWidth: "680px", marginBottom: "32px" }}>
            <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>
              {lang === "kz" ? "Биомеханикалық қақтығыс: шынайы жазылу мен жамбас" : "Биомеханический конфликт: истинное разгибание против наклона таза"}
            </h2>
            <p style={{ color: "var(--muted)", lineHeight: "1.6", fontSize: "14px" }}>
              {lang === "kz"
                ? "Виртуалды шындықта жаттығу кезінде бала нысанаға жетуге тырысып, қадамын ұзартады. Көбінесе бұл сан бұлшықеттерінің есебінен емес, жамбастың компенсаторлық алға еңкеюі арқылы орындалып, бел гиперлордозын тудырады."
                : "При тренировках в виртуальной реальности ребенок стремится дотянуться до цели и удлиняет шаг. Часто это происходит не мышцами бедра, а за счет компенсаторного переднего наклона таза, провоцируя поясничный гиперлордоз."}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            
            {/* Card 1: True Hip Extension */}
            <div className="card" style={{ borderLeft: "4px solid var(--teal)", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--teal)", fontWeight: 700, fontSize: "13px" }}>
                    <CheckCircle2 size={16} />
                    <span>{lang === "kz" ? "Физиологиялық қадам (TJE ≤ -1°)" : "Физиологический шаг (TJE ≤ -1°)"}</span>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginTop: "4px" }}>
                    {lang === "kz" ? "Шынайы буын жазылуы" : "Истинное разгибание сустава"}
                  </div>
                </div>
                <span className="badge badge-green">PCR &lt; 0.40</span>
              </div>

              <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "6px", padding: "12px 14px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Жамбас қалпы:" : "Положение таза:"}</span>
                  <strong>{lang === "kz" ? "Тұрақты (ΔSagP ≈ 0°)" : "Стабильно (ΔSagP ≈ 0°)"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Биомеханика:" : "Биомеханика:"}</span>
                  <strong style={{ color: "var(--teal)" }}>{lang === "kz" ? "Санның белсенді жазылуы" : "Активное отведение бедра"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Омыртқа:" : "Позвоночник:"}</span>
                  <strong>{lang === "kz" ? "Физиологиялық ось" : "Физиологическая ось"}</strong>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: "1.6", margin: 0 }}>
                {lang === "kz"
                  ? "Қозғалыс жамбасты алға еңкейтпей, жамбас-сан буынында орындалады. Виртуалды шындықтағы жаттығулар қауіпсіз және дұрыс қадамды қалпына келтіруге ықпал етеді."
                  : "Движение совершается в тазобедренном суставе без наклона таза вперед. Тренировки в виртуальной реальности безопасны и способствуют восстановлению правильного шага."}
              </p>
            </div>

            {/* Card 2: Pathological Pelvic Compensation */}
            <div className="card" style={{ borderLeft: "4px solid var(--red)", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--red)", fontWeight: 700, fontSize: "13px" }}>
                    <AlertOctagon size={16} />
                    <span>{lang === "kz" ? "Патологиялық компенсация (PCR > 0.80)" : "Патологическая компенсация (PCR > 0.80)"}</span>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginTop: "4px" }}>
                    {lang === "kz" ? "Гиперлордоз қаупі" : "Угроза гиперлордоза"}
                  </div>
                </div>
                <span className="badge badge-red">PCR = 1.21</span>
              </div>

              <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "6px", padding: "12px 14px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Жамбас еңкеюі:" : "Наклон таза:"}</span>
                  <strong style={{ color: "var(--red)" }}>{lang === "kz" ? "Патологиялық (+5.5° ΔSagP)" : "Патологический (+5.5° ΔSagP)"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Биомеханика:" : "Биомеханика:"}</span>
                  <strong>{lang === "kz" ? "Бел бүгілуімен қадамды еліктеу" : "Имитация шага прогибом"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{lang === "kz" ? "Ұсыным:" : "Рекомендация:"}</span>
                  <strong style={{ color: "var(--amber)" }}>{lang === "kz" ? "VR тоқтату (Verbal режимі)" : "Отмена VR (режим Verbal)"}</strong>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: "1.6", margin: 0 }}>
                {lang === "kz"
                  ? "Бала сан бұлшықеттерінің әлсіздігін жамбасты алға еңкейту арқылы өтейді, бұл белге артық жүктеме түсіреді. Жүйе дәрігерге сөздік нұсқауларға көшу қажеттігін хабарлайды."
                  : "Ребенок компенсирует слабость разгибателей бедра наклоном таза вперед, перегружая поясницу. Система сигнализирует врачу о необходимости перехода на словесные команды."}
              </p>
            </div>

          </div>

          <div style={{ marginTop: "24px" }}>
            <Link href="/portal" className="btn btn-primary">
              <span>{lang === "kz" ? "Пациенттер тізіліміне өту" : "Перейти к реестру пациентов"}</span>
              <ChevronRight size={15} />
            </Link>
          </div>

        </div>
      </section>

      {/* 5. CTA Section */}
      <section style={{ padding: "56px 0", background: "var(--linen)", borderBottom: "1px solid var(--line)" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: "600px" }}>
          <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>
            {lang === "kz" ? "Дәрігер-маманның жұмыс ортасы" : "Рабочая среда врача-специалиста"}
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "24px", fontSize: "14px" }}>
            {lang === "kz"
              ? "Пациенттердің диагностикалық профильдеріне қол жеткізу және клиникалық хаттамаларды дайындау үшін клиникалық порталға кіріңіз."
              : "Авторизуйтесь в клиническом портале для доступа к диагностическим профилям пациентов и формированию выписок."}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-primary" style={{ padding: "11px 24px", fontSize: "14px" }}>
              {lang === "kz" ? "Тіркелгі бойынша кіру" : "Вход по учетной записи"}
            </Link>
            <Link href="/portal" className="btn" style={{ padding: "11px 18px", fontSize: "14px" }}>
              {lang === "kz" ? "Демо-қолжетімділік" : "Демо-доступ"}
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Legal & Regulatory Footer */}
      <footer style={{ padding: "32px 0", background: "var(--paper)", fontSize: "12px", color: "var(--muted)" }}>
        <div className="container" style={{ textAlign: "center", marginBottom: "16px", fontSize: "11px", color: "var(--critical)" }}>
          {lang === "kz"
            ? "ШҰҒЫЛ ЖАҒДАЙДА: 103 нөміріне қоңырау шалыңыз. Libra диагноз қоймайды және дәрігерді алмастырмайды (СППР, 8.4-бап)."
            : "ВНИМАНИЕ: В экстренных ситуациях вызывайте скорую помощь 103. Libra является СППР, не ставит диагноз и не заменяет очного приема врача (ст. 8.4)."}
        </div>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LibraLogo size="sm" />
            <span>{lang === "kz" ? "Жүрісті клиникалық талдау платформасы" : "Платформа клинического анализа походки"}</span>
          </div>

          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <Link href="/privacy" style={{ textDecoration: "underline", color: "var(--muted)" }}>
              {lang === "kz" ? "Құпиялылық саясаты (ҚР Заңы № 94-V)" : "Политика конфиденциальности (Закон РК № 94-V)"}
            </Link>
            <Link href="/terms" style={{ textDecoration: "underline", color: "var(--muted)" }}>
              {lang === "kz" ? "Пайдалану шарттары" : "Условия использования"}
            </Link>
          </div>

          <div>
            {lang === "kz" ? "© 2026 Libra. Барлық құқықтар қорғалған." : "© 2026 Libra. Все права защищены."}
          </div>
        </div>
      </footer>

    </div>
  );
}
