"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LibraLogo } from "@/components/LibraLogo";
import { Users, BarChart2, LogOut, Upload, Stethoscope, HelpCircle, Scale, AlertTriangle, Sparkles } from "lucide-react";
import { OnboardingModal } from "@/components/OnboardingModal";
import { LegalModal } from "@/components/LegalModal";
import { uploadPatientCSV } from "@/lib/api";
import { LanguageProvider, useLanguage } from "@/lib/LanguageContext";

function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadNotice(lang === "kz" ? "Файл импортталуда..." : "Импорт CSV файла...");
      const res = await uploadPatientCSV(file);
      setUploadNotice(lang === "kz" ? res.message_kz : res.message_ru);
      e.target.value = "";
      router.refresh();
      setTimeout(() => {
        setUploadNotice(null);
      }, 3000);
    } catch {
      e.target.value = "";
      setUploadNotice(lang === "kz" ? "Жүктеу қатесі: CSV форматын тексеріңіз" : "Ошибка загрузки: проверьте формат CSV файла");
      setTimeout(() => setUploadNotice(null), 4000);
    }
  };

  const navLinks = [
    { href: "/portal", label: lang === "kz" ? "Пациенттер" : "Пациенты", icon: Users },
    { href: "/portal/analytics", label: lang === "kz" ? "Аймақ статистикасы" : "Статистика региона", icon: BarChart2 },
  ];

  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--white)", position: "sticky", top: 0, zIndex: 40 }} className="no-print">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "64px", gap: "16px", flexWrap: "nowrap" }}>
          
          {/* Left: Brand & Primary Doctor Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
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

          {/* Right: Actions, Language Switcher & Doctor Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "auto" }}>
            
            {/* CSV File Upload Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-amber"
              style={{ fontSize: "12px", padding: "6px 12px" }}
              title="Импорт CSV файла обследования"
            >
              <Upload size={14} />
              <span className="hide-on-mobile">{t.btn_upload || "Загрузить CSV"}</span>
            </button>

            {/* Clinical Help Sheet */}
            <button
              onClick={() => setGuideOpen(true)}
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
              title="Клинический справочник показателей"
              aria-label="Справка по биомеханике"
            >
              <HelpCircle size={15} color="var(--teal)" />
              <span className="hide-on-mobile">{lang === "kz" ? "Жаднама" : "Справка"}</span>
            </button>

            {/* Legal and 103 Ethics Modal Trigger (Art 8.4) */}
            <button
              onClick={() => setLegalOpen(true)}
              className="btn"
              style={{ fontSize: "12px", padding: "6px 10px" }}
              title="Правовая база и стандарты безопасности (ст. 8.4 Положения)"
              aria-label="Правовые стандарты и скорая помощь 103"
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
                <span style={{ fontWeight: 700 }}>Д-р Аманжолов К.</span>
                <span style={{ fontSize: "10px", color: "var(--muted)" }} className="hide-on-mobile">ОДБ г. Семей</span>
              </div>
            </div>

            {/* Logout */}
            <Link href="/login" className="btn" style={{ padding: "6px 8px", color: "var(--muted)" }} title="Выход из портала" aria-label="Выход">
              <LogOut size={15} />
            </Link>

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
    <LanguageProvider>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
        <PortalHeader />
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <PortalFooter />
      </div>
    </LanguageProvider>
  );
}
