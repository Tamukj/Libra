"use client";

import React from "react";
import Link from "next/link";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
  const { lang, setLang } = useLanguage();
  const isKz = lang === "kz";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--white)", padding: "16px var(--gutter)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <LibraLogo size="md" href="/" />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", background: "var(--white)" }}>
              <button onClick={() => setLang("kz")} style={{ padding: "5px 10px", fontSize: "11px", fontWeight: 700, border: "none", background: isKz ? "var(--linen)" : "transparent", color: "var(--ink)", cursor: "pointer" }}>ҚАЗ</button>
              <button onClick={() => setLang("ru")} style={{ padding: "5px 10px", fontSize: "11px", fontWeight: 700, border: "none", borderLeft: "1px solid var(--line)", background: !isKz ? "var(--linen)" : "transparent", color: "var(--ink)", cursor: "pointer" }}>РУС</button>
            </div>
            <Link href="/" className="btn" style={{ fontSize: "12px", padding: "6px 12px" }}>
              <ArrowLeft size={14} />
              <span>{isKz ? "Басты бетке оралу" : "Вернуться на главную"}</span>
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: "48px var(--gutter)" }}>
        <div style={{ maxWidth: "840px", margin: "0 auto" }}>
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--amber)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px" }}>
              <FileText size={16} />
              {isKz ? "Клиникалық қолдану регламенті" : "Регламент клинического использования"}
            </div>
            <h1 style={{ fontSize: "32px", marginBottom: "12px" }}>
              {isKz ? "Платформаны пайдалану шарттары (Terms of Service)" : "Условия использования платформы (Terms of Service)"}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>
              {isKz
                ? "Қазақстан Республикасының балалар стационарлары мен оңалту орталықтарының медицина мамандарына арналған Libra дәрігерлік шешімдерді қолдау жүйесін пайдалану ережелері."
                : "Правила эксплуатации системы поддержки врачебных решений Libra для медицинских специалистов детских стационаров и реабилитационных центров Республики Казахстан."}
            </p>
          </div>

          <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", fontSize: "14px", lineHeight: "1.7" }}>
            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "1. Мақсаты және СППР (CDSS) құқықтық мәртебесі" : "1. Назначение и правовой статус CDSS"}
              </h2>
              <p style={{ color: "var(--ink)" }}>
                {isKz
                  ? "Libra бағдарламалық кешені дәрігерлік шешімдерді қолдау жүйесі (Clinical Decision Support System) болып табылады. Платформа кинематикалық параметрлерді есептеуді, қадам циклінің қисықтарын визуализациялауды және жамбастың патологиялық компенсациясы (PCR) қаупін анықтауды қамтамасыз етеді."
                  : "Программный комплекс Libra является системой поддержки принятия врачебных решений (Clinical Decision Support System). Платформа предоставляет автоматизированный расчет кинематических параметров, визуализацию кривых цикла шага и выявление рисков патологической компенсации таза (PCR)."}
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "2. Дәрігердің жауапкершілігін шектеу" : "2. Разграничение ответственности врача"}
              </h2>
              <p style={{ color: "var(--ink)", marginBottom: "8px" }}>
                {isKz
                  ? "Алгоритмнің есептік қорытындылары (Verbal және VR режимдерін таңдау, сондай-ақ CDSS бағдаршамы) тек ұсынымдық сипатқа ие."
                  : "Расчетные вердикты алгоритма (включая выбор между режимами Verbal и VR, а также классификацию степени риска по светофору CDSS) носят рекомендательный характер."}
              </p>
              <div style={{ background: "var(--amber-light)", border: "1px solid var(--amber-border)", borderRadius: "6px", padding: "12px 16px", color: "var(--ink)", fontSize: "13px" }}>
                <strong>{isKz ? "Маңызды клиникалық ескерту:" : "Важное клиническое уведомление:"}</strong>{" "}
                {isKz
                  ? "Диагноз қою, емдеу тактикасын немесе ЕДШ жоспарын өзгерту туралы түпкілікті шешімді тек емдеуші дәрігер қабылдайды. Шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз."
                  : "Окончательное решение о диагнозе, тактике вмешательства или изменении плана ЛФК принимает лечащий врач. Алгоритм не заменяет очного осмотра. В экстренных случаях звоните 103."}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "3. Damumed МИС жүйесімен интеграция" : "3. Интеграция с МИС Damumed"}
              </h2>
              <p style={{ color: "var(--ink)" }}>
                {isKz
                  ? "Экспортталатын хаттамалар ҚР ДСМ клиникалық хаттамалары мен ДДҰ ХҚЖ (b770, d450) стандарттарына сәйкес қалыптастырылады. Damumed жүйесінде ЭЦҚ-мен қол қоятын дәрігер деректердің дұрыстығына жауапты."
                  : "Экспортируемые выписки и протоколы осмотра формируются с учетом структуры клинического протокола МЗ РК и кодов МКФ ВОЗ (b770, d450). Врач, подписывающий протокол ЭЦП в МИС Damumed, несет ответственность за верификацию рекомендаций."}
              </p>
            </section>

            <section style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", fontSize: "13px", color: "var(--muted)" }}>
              {isKz ? "Семей қ. Облыстық балалар ауруханасы, Абай облысы." : "Областная детская больница г. Семей, область Абай."}
            </section>
          </div>
        </div>
      </main>

      <footer style={{ padding: "20px var(--gutter)", borderTop: "1px solid var(--line)", background: "var(--paper)", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
        {isKz ? "© 2026 Libra. ҚР денсаулық сақтау мекемелерінде клиникалық қолдану регламенті." : "© 2026 Libra. Регламент клинического применения в учреждениях здравоохранения РК."}
      </footer>
    </div>
  );
}
