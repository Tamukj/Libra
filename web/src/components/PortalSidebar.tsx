"use client";

import React, { useState, useEffect } from "react";
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
import { ModalDialog } from "@/components/ModalDialog";
import { LanguageSwitch, useLargeFontPreference } from "@/components/PageControls";
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
  const { lang, t } = useLanguage();
  const { largeFont, toggleLargeFont } = useLargeFontPreference();
  const [activePatient, setActivePatient] = useState("s61520_1");

  useEffect(() => {
    const match = pathname.match(/^\/portal\/patients\/([^/]+)/);
    if (match && match[1]) {
      const code = decodeURIComponent(match[1]);
      setActivePatient(code);
      try {
        sessionStorage.setItem("libra_last_patient", code);
      } catch {}
    } else {
      try {
        const saved = sessionStorage.getItem("libra_last_patient");
        if (saved) setActivePatient(saved);
      } catch {}
    }
  }, [pathname]);

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "var(--sp-5)" }}>
      <div style={{ paddingInline: "var(--sp-1)" }}>
        <LibraLogo size="md" href="/portal" subtitle={t.brand_sub} />
      </div>

      <nav aria-label={lang === "kz" ? "Негізгі мәзір" : "Основная навигация"}>
        <div className="sidebar-section-label">
          {lang === "kz" ? "Клиникалық бөлімдер" : "Клиническая работа"}
        </div>
        <div className="stack-xs">
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
                  strokeWidth={1.5}
                  color={item.active ? "var(--teal)" : "var(--muted)"}
                  style={{ flexShrink: 0 }}
                  aria-hidden="true"
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div>
        <div className="sidebar-section-label">
          {lang === "kz" ? "Құралдар" : "Инструменты"}
        </div>
        <div className="stack-xs">
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              onOpenUpload();
            }}
            className="sidebar-nav-row"
          >
            <Upload size={16} strokeWidth={1.5} color="var(--amber)" style={{ flexShrink: 0 }} aria-hidden="true" />
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
            <BookOpen size={16} strokeWidth={1.5} color="var(--muted)" style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>{lang === "kz" ? "Дәрігер жаднамасы" : "Памятка врача"}</span>
          </button>
        </div>
      </div>

      <div
        className="stack-sm"
        style={{
          marginTop: "auto",
          paddingBlockStart: "var(--sp-4)",
          borderBlockStart: "1px solid var(--line)",
        }}
      >
        <button
          type="button"
          onClick={toggleLargeFont}
          aria-pressed={largeFont}
          className={`sidebar-nav-row ${largeFont ? "is-active" : ""}`}
        >
          <Eye
            size={16}
            strokeWidth={1.5}
            color={largeFont ? "var(--teal)" : "var(--muted)"}
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          />
          <span>{lang === "kz" ? "Үлкен қаріп" : "Крупный шрифт"}</span>
        </button>

        <div style={{ display: "grid" }}>
          <LanguageSwitch />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--sp-2)",
            padding: "var(--sp-2) var(--sp-3)",
            background: "var(--white)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
            <Stethoscope size={16} strokeWidth={1.5} color="var(--teal)" style={{ flexShrink: 0 }} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lang === "kz" ? "Оңалту дәрігері" : "Врач-реабилитолог"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {lang === "kz" ? "СППР кабинеті" : "Кабинет СППР"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label={lang === "kz" ? "Порталдан шығу" : "Выйти из портала"}
            className="btn-icon"
          >
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortalSidebar({ onOpenUpload, onOpenGuide }: SidebarProps) {
  const { lang, t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <aside className="portal-sidebar no-print" aria-label={lang === "kz" ? "Бүйірлік тақта" : "Боковая панель"}>
        <SidebarContent onOpenUpload={onOpenUpload} onOpenGuide={onOpenGuide} />
      </aside>

      <div className="portal-mobile-bar no-print">
        <LibraLogo size="sm" href="/portal" />
        <div className="cluster">
          <button type="button" onClick={onOpenUpload} className="btn btn-sm">
            <Upload size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{t.btn_upload}</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="btn btn-sm"
            aria-label={lang === "kz" ? "Мәзірді ашу" : "Открыть меню"}
            aria-expanded={drawerOpen}
          >
            <Menu size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ModalDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        labelledBy="mobile-drawer-title"
        narrow
        className="no-print"
      >
        <div className="dialog-header">
          <h1 id="mobile-drawer-title" className="section-title">
            {lang === "kz" ? "Бөлімдер" : "Навигация"}
          </h1>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={lang === "kz" ? "Жабу" : "Закрыть"}
            className="btn-icon"
          >
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="dialog-body" style={{ background: "var(--sidebar)" }}>
          <SidebarContent
            onOpenUpload={onOpenUpload}
            onOpenGuide={onOpenGuide}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
      </ModalDialog>
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
    pageLabel = lang === "kz" ? "Модельдерді тексеру" : "Валидация моделей";
  } else if (pathname.startsWith("/portal/safety")) {
    pageLabel = lang === "kz" ? "Қауіпсіздік және шектеулер" : "Безопасность и ограничения";
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
        <PhoneCall size={14} strokeWidth={1.5} aria-hidden="true" />
        <span>
          {lang === "kz"
            ? "Кеңестік СППР · Жедел жәрдем: 103"
            : "Консультативная СППР · Экстренная помощь: 103"}
        </span>
      </Link>
    </header>
  );
}
