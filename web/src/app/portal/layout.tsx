"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LibraLogo } from "@/components/LibraLogo";
import { Users, BarChart2, LogOut, Upload, Stethoscope, HelpCircle, Scale, AlertTriangle, Eye } from "lucide-react";
import { OnboardingModal } from "@/components/OnboardingModal";
import { LegalModal } from "@/components/LegalModal";
import { UploadCsvModal } from "@/components/UploadCsvModal";
import { CsvUploadResponse } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";

function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [largeFont, setLargeFont] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem("libra_a11y_large") === "1";
      setLargeFont(enabled);
      document.documentElement.classList.toggle("a11y-large", enabled);
    } catch {}
  }, []);

  const toggleLargeFont = () => {
    const next = !largeFont;
    setLargeFont(next);
    document.documentElement.classList.toggle("a11y-large", next);
    try {
      localStorage.setItem("libra_a11y_large", next ? "1" : "0");
    } catch {}
  };

  const handleLogout = () => {
    document.cookie = "libra_session=; path=/; max-age=0";
    router.push("/login");
  };

  const handleUploadSuccess = (res: CsvUploadResponse) => {
    setUploadOpen(false);
    const fallbackMsg =
      lang === "kz"
        ? `Файл сәтті импортталды (${res.code}).`
        : `CSV успешно импортирован (${res.code}).`;
    setUploadNotice((lang === "kz" ? res.message_kz : res.message_ru) || fallbackMsg);
    if (res.code) {
      router.push(`/portal/patients/${encodeURIComponent(res.code)}`);
    }
    router.refresh();
    setTimeout(() => {
      setUploadNotice(null);
    }, 4500);
  };

  const navLinks = [
    { href: "/portal", label: lang === "kz" ? "Пациенттер" : "Пациенты", icon: Users },
    { href: "/portal/analytics", label: lang === "kz" ? "Аймақ статистикасы" : "Статистика региона", icon: BarChart2 },
  ];

  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--white)", position: "sticky", top: 0, zIndex: 40 }} className="no-print">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "64px", paddingBlock: "8px", gap: "12px", flexWrap: "wrap" }}>
          
          {/* Left: Brand & Primary Doctor Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <LibraLogo size="md" href="/portal" />

            <nav style={{ display: "flex", alignItems: "center", gap: "6px" }} className="portal-nav-links">
              {navLinks.map((item) => {
                const isActive = item.href === "/portal"
                  ? pathname === "/portal" || pathname.startsWith("/portal/patients")
                  : pathname.startsWith(item.href);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="btn"
                    style={{
                      background: isActive ? "var(--ink)" : "transparent",
                      color: isActive ? "var(--white)" : "var(--ink)",
                      borderColor: isActive ? "var(--ink)" : "transparent",
                      padding: "6px 12px",
                      fontSize: "13px"
                    }}
                  >
                    <IconComponent size={15} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions, Accessibility, Language Switcher & Doctor Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginLeft: "auto" }}>
            
            {/* Multi-condition CSV Upload Modal Trigger */}
            <button
              onClick={() => setUploadOpen(true)}
              className="btn btn-amber"
              style={{ fontSize: "12px", padding: "6px 12px" }}
              title={lang === "kz" ? "Тексеру CSV файлын импорттау" : "Импорт CSV файла обследования"}
            >
              <Upload size={14} />
              <span className="hide-on-mobile">{t.btn_upload || (lang === "kz" ? "CSV жүктеу" : "Загрузить CSV")}</span>
            </button>

            {/* Accessibility / Patient & Elderly Mode Toggle */}
            <button
              onClick={toggleLargeFont}
              className={`btn ${largeFont ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "6px 10px" }}
              aria-pressed={largeFont}
              title={lang === "kz" ? "Пациенттер мен қарт адамдарға арналған үлкен қаріп режимі" : "Режим крупного шрифта и повышенного контраста"}
              aria-label={lang === "kz" ? "Үлкен қаріп" : "Крупный шрифт"}
            >
              <Eye size={15} />
              <span className="hide-on-mobile">{lang === "kz" ? "Үлкен қаріп" : "Крупный шрифт"}</span>
            </button>

            {/* Clinical Help Sheet */}
            <button
              onClick={() => setGuideOpen(true)}
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
              title={lang === "kz" ? "Көрсеткіштер бойынша клиникалық анықтамалық" : "Клинический справочник показателей"}
              aria-label={lang === "kz" ? "Биомеханика бойынша анықтама" : "Справка по биомеханике"}
            >
              <HelpCircle size={15} color="var(--teal)" />
              <span className="hide-on-mobile">{lang === "kz" ? "Жаднама" : "Справка"}</span>
            </button>

            {/* Legal and 103 Ethics Modal Trigger (Art 8.4) */}
            <button
              onClick={() => setLegalOpen(true)}
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
              title={lang === "kz" ? "Құқықтық негіз және қауіпсіздік стандарттары (8.4-бап)" : "Правовая база и стандарты безопасности (ст. 8.4 Положения)"}
              aria-label={lang === "kz" ? "Құқықтық стандарттар және 103 жедел жәрдем" : "Правовые стандарты и скорая помощь 103"}
            >
              <Scale size={15} color="var(--amber)" />
              <span className="hide-on-mobile">{lang === "kz" ? "Құқық (103)" : "Право (103)"}</span>
            </button>

            {/* Language Switcher */}
            <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "var(--white)" }}>
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

            {/* Doctor Profile Pill */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 10px",
              background: "var(--linen)",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              fontSize: "12px",
              flexShrink: 0
            }}>
              <Stethoscope size={14} color="var(--amber)" />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontWeight: 700 }}>{lang === "kz" ? "Дәр. Аманжолов Қ." : "Д-р Аманжолов К."}</span>
                <span style={{ fontSize: "10px", color: "var(--muted)" }} className="hide-on-mobile">
                  {lang === "kz" ? "Семей қ. ОБА" : "ОДБ г. Семей"}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="btn"
              style={{ padding: "6px 8px", color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer" }}
              title={lang === "kz" ? "Порталдан шығу" : "Выход из портала"}
              aria-label={lang === "kz" ? "Шығу" : "Выход"}
            >
              <LogOut size={15} />
            </button>

          </div>

        </div>
      </header>

      {/* Upload Notification Banner */}
      {uploadNotice && (
        <div style={{
          background: "var(--teal-bg)",
          borderBottom: "1px solid var(--teal-border)",
          color: "var(--teal)",
          padding: "10px var(--gutter)",
          fontSize: "13px",
          fontWeight: 600,
          textAlign: "center"
        }}>
          {uploadNotice}
        </div>
      )}

      {/* Section 8.4 Regulatory Compliance Top Banner: Non-diagnostic CDSS & Emergency 103 */}
      <div style={{
        background: "var(--amber-light)",
        borderBottom: "1px solid var(--amber-border)",
        color: "var(--amber)",
        padding: "6px var(--gutter)",
        fontSize: "12px",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        textAlign: "center"
      }} className="no-print">
        <AlertTriangle size={14} />
        <span>
          {lang === "kz"
            ? "Шұғыл медициналық көмек: 103 · Libra жүйесі СППР болып табылады, диагноз қоймайды (Ереже 8.4-бабы)"
            : "Скорая медицинская помощь: 103 · Libra является СППР и не ставит диагноз (ст. 8.4 Положения)"}
        </span>
      </div>

      {uploadOpen && (
        <UploadCsvModal
          lang={lang}
          onClose={() => setUploadOpen(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {guideOpen && (
        <OnboardingModal
          lang={lang}
          onClose={() => setGuideOpen(false)}
        />
      )}

      {legalOpen && (
        <LegalModal
          lang={lang}
          onClose={() => setLegalOpen(false)}
        />
      )}
    </>
  );
}

function PortalFooter() {
  const { lang, t } = useLanguage();
  return (
    <footer style={{ borderTop: "1px solid var(--line)", background: "var(--white)", padding: "16px 0", fontSize: "12px", color: "var(--muted)" }} className="no-print">
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <strong>Libra</strong> · {lang === "kz" ? "Семей қ. облыстық балалар ауруханасы" : "Областная детская больница г. Семей"}
        </div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <Link href="/privacy" style={{ textDecoration: "underline", color: "var(--muted)" }}>{lang === "kz" ? "Құпиялылық саясаты" : "Политика конфиденциальности"}</Link>
          <Link href="/terms" style={{ textDecoration: "underline", color: "var(--muted)" }}>{lang === "kz" ? "Пайдалану шарттары" : "Условия использования"}</Link>
          <Link href="/portal/ml-validation" style={{ textDecoration: "underline", color: "var(--muted)" }}>{lang === "kz" ? "ML әдіснамасы (GroupKFold)" : "Методология расчетов (GroupKFold)"}</Link>
        </div>
        <div>
          {lang === "kz" ? "ҚР Дербес деректерді қорғау туралы Заңы (№ 94-V)" : "Закон РК «О персональных данных» (№ 94-V)"}
        </div>
      </div>
    </footer>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      <PortalHeader />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}
