"use client";

import React from "react";
import Link from "next/link";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--teal)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px" }}>
              <ShieldCheck size={16} />
              {isKz ? "Қазақстан Республикасының заңнамасы" : "Законодательство Республики Казахстан"}
            </div>
            <h1 style={{ fontSize: "32px", marginBottom: "12px" }}>
              {isKz ? "Құпиялылық және деректерді қорғау саясаты" : "Политика конфиденциальности и защиты данных"}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>
              {isKz
                ? "Қазақстан Республикасының 2013 жылғы 21 мамырдағы № 94-V «Дербес деректер және оларды қорғау туралы» Заңына және «Халық денсаулығы және денсаулық сақтау жүйесі туралы» Кодексіне сәйкес медициналық ақпаратты өңдеу регламенті."
                : "Регламент обработки медицинской информации в соответствии с Законом Республики Казахстан от 21 мая 2013 года № 94-V «О персональных данных и их защите» и Кодексом РК «О здоровье народа и системе здравоохранения»."}
            </p>
          </div>

          <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", fontSize: "14px", lineHeight: "1.7" }}>
            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "1. Жалпы ережелер және деректер операторы" : "1. Общие положения и оператор данных"}
              </h2>
              <p style={{ color: "var(--ink)" }}>
                {isKz
                  ? "Осы Саясат балалар ортопедиясы мен неврологиясының клиникалық тәжірибесінде қолданылатын Libra бағдарламалық-аппараттық кешеніндегі (Семей қ., Абай облысы) дербес және медициналық деректерді өңдеу мен қорғау тәртібін айқындайды."
                  : "Настоящая Политика определяет порядок обработки и защиты персональных и медицинских данных в программно-аппаратном комплексе Libra, используемом в клинической практике детской ортопедии и неврологии (Областная детская больница г. Семей, область Абай)."}
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "2. Деректерді иесіздендіру (деперсонализация)" : "2. Деперсонализация (обезличивание) данных"}
              </h2>
              <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", color: "var(--muted)" }}>
                <li>
                  {isKz
                    ? "Пациент идентификаторлары бүркеншік клиникалық кодтармен ауыстырылады (мысалы, s61520_*)."
                    : "Идентификаторы пациентов заменяются на псевдонимизированные клинические коды (например, s61520_*)."}
                </li>
                <li>
                  {isKz
                    ? "Тек сандық биомеханикалық қатарлар өңделеді: буын бұрыштары (Pelvis, Hip, Knee, Ankle) және антропометриялық көрсеткіштер (бой, салмақ, аяқ ұзындығы)."
                    : "Обрабатываются только численные биомеханические ряды: углы суставов (Pelvis, Hip, Knee, Ankle) и антропометрические коэффициенты (рост, масса тела, длина конечностей)."}
                </li>
                <li>
                  {isKz
                    ? "Аты-жөні, ЖСН, мекенжай және байланыс деректері платформаға жүктелмейді және API арқылы қатаң түрде қабылданбайды."
                    : "ФИО, ИИН, адресные и контактные данные не передаются в расчетный модуль платформы и отклоняются валидатором загрузки CSV."}
                </li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "3. Жинау және өңдеу мақсаттары" : "3. Цели сбора и обработки"}
              </h2>
              <p style={{ color: "var(--ink)" }}>
                {isKz
                  ? "Деректер тек медициналық және диагностикалық мақсаттарда пайдаланылады: патологиялық компенсация коэффициентін (PCR) есептеу, шынайы жазылуды (TJE) анықтау, ДДҰ ХҚЖ (b770, d450) бойынша бағалау және Damumed МИС үшін қорытынды дайындау."
                  : "Данные используются исключительно в медицинских и диагностических целях: расчет коэффициентов патологической компенсации таза (PCR), выявление истинного разгибания (TJE), оценка нарушений по Международной классификации функционирования (ВОЗ МКФ b770, d450) и формирование заключений для консилиумов в МИС Damumed."}
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                {isKz ? "4. ҚР аумағында деректерді сақтау" : "4. Серверная локализация и защита данных в РК"}
              </h2>
              <p style={{ color: "var(--ink)" }}>
                {isKz
                  ? "ҚР № 94-V Заңының 12-бабына сәйкес клиникалық дерекқорлар Қазақстан Республикасының аумағындағы серверлерде сақталады, желілік алмасу TLS/HTTPS арқылы қорғалады."
                  : "В соответствии со статьей 12 Закона РК № 94-V базы данных с медицинской информацией размещаются на серверах на территории Республики Казахстан; сетевой обмен защищен протоколами TLS/HTTPS."}
              </p>
            </section>

            <section style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", fontSize: "13px", color: "var(--muted)" }}>
              <strong>{isKz ? "Оператордың байланыс деректері:" : "Контактная информация оператора:"}</strong><br />
              {isKz
                ? "Балалар неврологиясы және оңалту клиникалық секторы, Семей қ. Облыстық балалар ауруханасы, Абай облысы, ҚР."
                : "Клинический сектор детской неврологии и реабилитации, Областная детская больница г. Семей, область Абай, Республика Казахстан."}
            </section>
          </div>
        </div>
      </main>

      <footer style={{ padding: "20px var(--gutter)", borderTop: "1px solid var(--line)", background: "var(--paper)", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
        {isKz ? "© 2026 Libra. ҚР № 94-V Заңына сәйкес пациенттер деректерін қорғау." : "© 2026 Libra. Защита данных пациентов в соответствии с Законом РК № 94-V."}
      </footer>
    </div>
  );
}
