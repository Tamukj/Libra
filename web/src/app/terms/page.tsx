import React from "react";
import Link from "next/link";
import { LibraLogo } from "@/components/LibraLogo";
import { ArrowLeft, FileText, Stethoscope, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function TermsPage() {
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--amber)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px" }}>
              <FileText size={16} />
              Регламент клинического использования
            </div>
            <h1 style={{ fontSize: "32px", marginBottom: "12px" }}>
              Условия использования платформы (Terms of Service)
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>
              Правила эксплуатации системы поддержки врачебных решений Libra для медицинских специалистов детских стационаров и реабилитационных центров Республики Казахстан.
            </p>
          </div>

          <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", fontSize: "14px", lineHeight: "1.7" }}>
            
            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                1. Назначение и правовой статус CDSS
              </h2>
              <p style={{ color: "var(--ink)" }}>
                Программный комплекс <strong>Libra</strong> является системой поддержки принятия врачебных решений (Clinical Decision Support System). Платформа предоставляет автоматизированный расчет кинематических параметров, визуализацию кривых цикла шага и выявление рисков патологической компенсации таза ($PCR$) на основе алгоритмов биомеханики.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                2. Разграничение ответственности врача
              </h2>
              <p style={{ color: "var(--ink)", marginBottom: "8px" }}>
                Расчетные вердикты алгоритма (включая выбор между режимами Verbal и VR, а также классификацию степени риска по светофору CDSS) носят <strong>рекомендательный характер</strong>.
              </p>
              <div style={{ background: "var(--amber-light)", border: "1px solid var(--amber-border)", borderRadius: "6px", padding: "12px 16px", color: "var(--ink)", fontSize: "13px" }}>
                <strong>Важное клиническое уведомление:</strong> Окончательное решение о диагнозе, тактике ортопедо-хирургического вмешательства или изменении плана ЛФК принимает лечащий врач травматолог-ортопед, детский невролог или клинический консилиум. Алгоритм не заменяет очного клинического осмотра пациента.
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                3. Авторизация и правила доступа персонала
              </h2>
              <p style={{ color: "var(--ink)" }}>
                Доступ к закрытому порталу предоставляется исключительно медицинским работникам, имеющим действующий сертификат специалиста в Республике Казахстан. Врач обязуется не передавать учетные данные третьим лицам и осуществлять выход из системы по завершении рабочей смены.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: "700" }}>
                4. Интеграция с МИС Damumed
              </h2>
              <p style={{ color: "var(--ink)" }}>
                Экспортируемые выписки и протоколы осмотра формируются по утвержденной структуре клинического протокола МЗ РК. Врач, подписывающий протокол ЭЦП в МИС Damumed, несет персональную ответственность за корректность внесенных рекомендаций.
              </p>
            </section>

            <section style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", fontSize: "13px", color: "var(--muted)" }}>
              Областная детская больница г. Семей, область Абай.<br />
              Дата вступления в силу: 24 ноября 2026 года.
            </section>

          </div>

        </div>
      </main>

      <footer style={{ padding: "20px var(--gutter)", borderTop: "1px solid var(--line)", background: "var(--paper)", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
        © 2026 Libra. Регламент клинического применения в учреждениях здравоохранения РК.
      </footer>

    </div>
  );
}
