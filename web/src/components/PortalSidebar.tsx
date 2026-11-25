"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Activity,
  BarChart2,
  ShieldCheck,
  Scale,
  Upload,
  BookOpen,
  Eye,
  LogOut,
  Stethoscope,
  Menu,
  X,
  PhoneCall,
} from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";

interface SidebarProps {
  onOpenUpload: () => void;
  onOpenGuide: () => void;
}

function SidebarContent({
  onOpenUpload,
  onOpenGuide,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [largeFont, setLargeFont] = useState(false);
  const [activePatient, setActivePatient] = useState("s61520_1");

  useEffect(() => {
    try {
      const enabled = localStorage.getItem("libra_a11y_large") === "1";
      setLargeFont(enabled);
      document.documentElement.classList.toggle("a11y-large", enabled);
    } catch {}
  }, []);

  useEffect(() => {
    const match = pathname.match(/^\/portal\/patients\/([^/]+)/);
    if (match && match[1]) {
      const code = decodeURIComponent(match[1]);
      setActivePatient(code);
      try {
        localStorage.setItem("libra_last_patient", code);
      } catch {}
    } else {
      try {
        const saved = localStorage.getItem("libra_last_patient");
        if (saved) setActivePatient(saved);
      } catch {}
    }
  }, [pathname]);

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
    try {
      sessionStorage.removeItem("libra_api_key");
    } catch {}
    onNavigate?.();
    router.push("/login");
  };

  const navItems = [
    {
      href: "/portal",
      label: t.nav_registry,
      icon: Users,
      active: pathname === "/portal",
    },
    {
      href: `/portal/patients/${encodeURIComponent(activePatient)}`,
      label: t.nav_patient,
      icon: Activity,
      active: pathname.startsWith("/portal/patients"),
    },
    {
      href: "/portal/analytics",
      label: t.nav_cohort,
      icon: BarChart2,
      active: pathname.startsWith("/portal/analytics"),
    },
    {
      href: "/portal/ml-validation",
      label: t.nav_ml,
      icon: ShieldCheck,
      active: pathname.startsWith("/portal/ml-validation"),
    },
    {
      href: "/portal/safety",
      label: t.nav_safety,
      icon: Scale,
      active: pathname.startsWith("/portal/safety"),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "20px" }}>
      <div style={{ paddingInline: "4px" }}>
        <LibraLogo size="md" href="/portal" subtitle={t.brand_sub} />
      </div>

      {/* Primary clinical navigation */}
      <nav aria-label={lang === "kz" ? "Негізгі мәзір" : "Основная навигация"}>
        <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)", paddingInline: "12px", marginBottom: "8px" }}>
          {lang === "kz" ? "Клиникалық бөлімдер" : "Клиническая работа"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={item.active ? "page" : undefined}
                className={`sidebar-nav-row ${item.active ? "is-active" : ""}`}
              >
                <Icon
                  size={16}
                  strokeWidth={1.6}
                  color={item.active ? "var(--teal)" : "var(--muted)"}
                  style={{ flexShrink: 0 }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Workspace tools */}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)", paddingInline: "12px", marginBottom: "8px" }}>
          {lang === "kz" ? "Құралдар" : "Инструменты"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              onOpenUpload();
            }}
            className="sidebar-nav-row"
          >
            <Upload size={16} strokeWidth={1.6} color="var(--amber)" style={{ flexShrink: 0 }} />
            <span>{t.btn_upload}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              onOpenGuide();
            }}
            className="sidebar-nav-row"
          >
            <BookOpen size={16} strokeWidth={1.6} color="var(--muted)" style={{ flexShrink: 0 }} />
            <span>{lang === "kz" ? "Дәрігер жаднамасы" : "Памятка врача"}</span>
          </button>
        </div>
      </div>

      {/* Bottom utilities: Accessibility, Language, Clinician & Logout */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "16px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          type="button"
          onClick={toggleLargeFont}
          aria-pressed={largeFont}
          className={`sidebar-nav-row ${largeFont ? "is-active" : ""}`}
        >
          <Eye size={16} strokeWidth={1.6} color={largeFont ? "var(--teal)" : "var(--muted)"} style={{ flexShrink: 0 }} />
          <span>{lang === "kz" ? "Үлкен қаріп" : "Крупный шрифт"}</span>
        </button>

        {/* Single unified RU / KZ switcher */}
        <div
          role="group"
          aria-label={lang === "kz" ? "Тілді таңдау" : "Выбор языка"}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            border: "1px solid var(--line-strong)",
            borderRadius: "8px",
            overflow: "hidden",
            background: "var(--white)",
          }}
        >
          <button
            type="button"
            onClick={() => setLang("ru")}
            aria-pressed={lang === "ru"}
            style={{
              padding: "7px 10px",
              fontSize: "12px",
              fontWeight: lang === "ru" ? 600 : 500,
              border: "none",
              background: lang === "ru" ? "var(--ink)" : "transparent",
              color: lang === "ru" ? "var(--white)" : "var(--secondary)",
              cursor: "pointer",
            }}
          >
            Русский
          </button>
          <button
            type="button"
            onClick={() => setLang("kz")}
            aria-pressed={lang === "kz"}
            style={{
              padding: "7px 10px",
              fontSize: "12px",
              fontWeight: lang === "kz" ? 600 : 500,
              border: "none",
              borderInlineStart: "1px solid var(--line)",
              background: lang === "kz" ? "var(--ink)" : "transparent",
              color: lang === "kz" ? "var(--white)" : "var(--secondary)",
              cursor: "pointer",
            }}
          >
            Қазақша
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            padding: "8px 10px",
            background: "var(--white)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <Stethoscope size={16} strokeWidth={1.6} color="var(--teal)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lang === "kz" ? "Оңалту дәрігері" : "Врач-реабилитолог"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {lang === "kz" ? "СППР кабинеті" : "Кабинет СППР"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={lang === "kz" ? "Порталдан шығу" : "Выйти из портала"}
            aria-label={lang === "kz" ? "Шығу" : "Выйти"}
            style={{
              background: "transparent",
              border: "none",
              padding: "6px",
              borderRadius: "6px",
              color: "var(--muted)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogOut size={16} strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortalSidebar({ onOpenUpload, onOpenGuide }: SidebarProps) {
  const { lang, t } = useLanguage();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = () => {
    setDrawerOpen(true);
    drawerRef.current?.showModal();
  };

  const closeDrawer = () => {
    drawerRef.current?.close();
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="portal-sidebar no-print" aria-label={lang === "kz" ? "Бүйірлік тақта" : "Боковая панель"}>
        <SidebarContent onOpenUpload={onOpenUpload} onOpenGuide={onOpenGuide} />
      </aside>

      {/* Mobile top bar */}
      <div className="portal-mobile-bar no-print">
        <LibraLogo size="sm" href="/portal" />
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button type="button" onClick={onOpenUpload} className="btn" style={{ padding: "6px 10px", fontSize: "12px" }}>
            <Upload size={14} />
            <span>{t.btn_upload}</span>
          </button>
          <button
            type="button"
            onClick={openDrawer}
            className="btn"
            aria-label={lang === "kz" ? "Мәзірді ашу" : "Открыть меню"}
            aria-expanded={drawerOpen}
            style={{ padding: "6px 10px" }}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Mobile navigation dialog drawer */}
      <dialog
        ref={drawerRef}
        className="libra-dialog dialog-narrow no-print"
        aria-label={lang === "kz" ? "Навигация мәзірі" : "Меню навигации"}
        onClose={() => setDrawerOpen(false)}
        style={{
          margin: 0,
          marginInlineEnd: "auto",
          blockSize: "100dvh",
          maxBlockSize: "100dvh",
          inlineSize: "min(300px, 86vw)",
          borderRadius: "0 14px 14px 0",
          padding: "20px 16px",
          background: "var(--sidebar)",
          overflowX: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={lang === "kz" ? "Жабу" : "Закрыть"}
            style={{
              background: "transparent",
              border: "none",
              padding: "6px",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>
        <SidebarContent
          onOpenUpload={onOpenUpload}
          onOpenGuide={onOpenGuide}
          onNavigate={closeDrawer}
        />
      </dialog>
    </>
  );
}

export function PortalTopBar() {
  const pathname = usePathname();
  const { lang } = useLanguage();

  let pageLabel = lang === "kz" ? "Пациенттер тізілімі" : "Реестр пациентов";
  if (pathname.startsWith("/portal/patients/")) {
    const id = decodeURIComponent(pathname.replace("/portal/patients/", "").split("/")[0] || "");
    pageLabel = `${lang === "kz" ? "Пациент картасы" : "Карточка пациента"} · ${id}`;
  } else if (pathname.startsWith("/portal/analytics")) {
    pageLabel = lang === "kz" ? "Когорта талдауы" : "Аналитика когорты";
  } else if (pathname.startsWith("/portal/ml-validation")) {
    pageLabel = lang === "kz" ? "ЖИ және валидация" : "Модели ИИ и валидация";
  } else if (pathname.startsWith("/portal/safety")) {
    pageLabel = lang === "kz" ? "Этика, 103 және шектеулер" : "Этика, 103 и ограничения";
  }

  return (
    <header className="portal-topbar no-print">
      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--secondary)" }}>
        {pageLabel}
      </div>
      <Link
        href="/portal/safety"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: "var(--amber)",
          fontWeight: 500,
        }}
      >
        <PhoneCall size={14} strokeWidth={1.6} />
        <span>
          {lang === "kz"
            ? "Жедел көмек: 103 · СППР (8.2-т.)"
            : "Экстренная помощь: 103 · СППР (п. 8.2)"}
        </span>
      </Link>
    </header>
  );
}
