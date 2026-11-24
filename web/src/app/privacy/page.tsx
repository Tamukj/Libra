import React from "react";
import Link from "next/link";
import { LibraLogo } from "@/components/LibraLogo";
import { ArrowLeft, ShieldCheck, Lock, FileText, CheckCircle2 } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--white)", padding: "16px var(--gutter)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <LibraLogo size="md" href="/" />
          <Link href="/" className="btn" style={{ fontSize: "12px", padding: "6px 12px" }}>
            <ArrowLeft size={14} />
            <span>Вернуться на главную</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "48px var(--gutter)" }}>
        <div style={{ maxWidth: "840px", margin: "0 auto" }}>
          
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--teal)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px" }}>
              <ShieldCheck size={16} />
              Законодательство Республики Казахстан
            </div>
            <h1 style={{ fontSize: "32px", marginBottom: "12px" }}>
              Политика конфиденциальности и защиты данных
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>
              Регламент обработки медицинской информации в соответствии с Законом Республики Казахстан от 21 мая 2013 года № 94-V «О персональных данных и их защите» и Кодексом РК «О здоровье народа и системе здравоохранения».
            </p>
          </div>

          <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", fontSize: "14px", lineHeight: "1.7" }}>
            
            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                1. Общие положения и оператор данных
              </h2>
              <p style={{ color: "var(--ink)" }}>
                Настоящая Политика определяет порядок обработки и защиты персональных и медицинских данных в программно-аппаратном комплексе <strong>Libra</strong>, используемом в клинической практике детской ортопедии и неврологии (Областная детская больница г. Семей, область Абай).
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                2. Деперсонализация (обезличивание) данных
              </h2>
              <p style={{ color: "var(--ink)", marginBottom: "10px" }}>
                Для проведения биомеханического анализа и машинной обработки применяется строгое шифрование и деперсонализация:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", color: "var(--muted)" }}>
                <li>Идентификаторы пациентов заменяются на псевдонимизированные клинические коды (например, <code style={{ fontFamily: "var(--mono)", background: "var(--linen)", padding: "2px 6px", borderRadius: "4px" }}>s61520_*</code>).</li>
                <li>Обрабатываются только численные биомеханические ряды: углы суставов (Pelvis, Hip, Knee, Ankle), координаты маркеров Vicon и антропометрические коэффициенты (рост, масса тела, длина сегментов конечностей).</li>
                <li>ФИО, индивидуальный идентификационный номер (ИИН) и адресные данные законных представителей не передаются в расчетный модуль платформы.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                3. Цели сбора и обработки
              </h2>
              <p style={{ color: "var(--ink)" }}>
                Данные используются исключительно в медицинских и диагностических целях: расчет коэффициентов патологической компенсации таза ($PCR$), выявление истинного разгибания ($TJE$), оценка тяжести нарушений стереотипа походки по Международной классификации функционирования (ВОЗ МКФ $b770$, $d450$) и формирование заключений для консилиумов в МИС Damumed.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                4. Серверная локализация и защита данных в РК
              </h2>
              <p style={{ color: "var(--ink)" }}>
                В соответствии со статьей 12 Закона РК № 94-V, базы данных с медицинской информацией размещаются на серверных мощностях, физически находящихся на территории Республики Казахстан. Сетевой обмен защищен протоколами сквозного TLS/HTTPS шифрования с двухфакторным контролем сессий врачей.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                5. Права законных представителей пациентов
              </h2>
              <p style={{ color: "var(--ink)" }}>
                Родители и законные представители несовершеннолетних пациентов имеют право на получение полной информации об объеме собираемых биомеханических показателей, отзыв согласия на обработку данных, а также получение копии электронного протокола осмотра через портал электронного правительства eGov и МИС Damumed.
              </p>
            </section>

            <section style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", fontSize: "13px", color: "var(--muted)" }}>
              <strong>Контактная информация оператора:</strong><br />
              Клинический сектор детской неврологии и реабилитации, Областная детская больница г. Семей, область Абай, Республика Казахстан.<br />
              Дата редакции: 24 ноября 2026 года.
            </section>

          </div>

        </div>
      </main>

      <footer style={{ padding: "20px var(--gutter)", borderTop: "1px solid var(--line)", background: "var(--paper)", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
        © 2026 Libra. Защита данных пациентов в соответствии с Законом РК № 94-V.
      </footer>

    </div>
  );
}
