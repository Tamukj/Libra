"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, ShieldCheck, KeyRound } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { useLanguage } from "@/lib/LanguageContext";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, setLang, t } = useLanguage();
  const isKz = lang === "kz";

  const [apiKey, setApiKey] = useState("");
  const [largeFont, setLargeFont] = useState(false);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem("libra_a11y_large") === "1";
      setLargeFont(enabled);
      document.documentElement.classList.toggle("a11y-large", enabled);
      const savedKey = sessionStorage.getItem("libra_api_key");
      if (savedKey) setApiKey(savedKey);
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

  const handleEnterPortal = (e: React.FormEvent) => {
    e.preventDefault();
    document.cookie = "libra_session=clinician; path=/; max-age=604800; SameSite=Lax";
    try {
      if (apiKey.trim()) {
        sessionStorage.setItem("libra_api_key", apiKey.trim());
      } else {
        sessionStorage.removeItem("libra_api_key");
      }
    } catch {}
    const from = searchParams.get("from") || "/portal";
    router.push(from.startsWith("/portal") ? from : "/portal");
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--white)",
          padding: "14px clamp(16px, 4vw, 40px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <LibraLogo size="md" href="/" subtitle={t.brand_sub} />

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            role="group"
            aria-label={isKz ? "Тіл" : "Язык"}
            style={{
              display: "inline-flex",
              background: "var(--sidebar)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => setLang("ru")}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: lang === "ru" ? 600 : 500,
                background: lang === "ru" ? "var(--white)" : "transparent",
                color: "var(--ink)",
              }}
            >
              Рус
            </button>
            <button
              type="button"
              onClick={() => setLang("kz")}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: lang === "kz" ? 600 : 500,
                background: lang === "kz" ? "var(--white)" : "transparent",
                color: "var(--ink)",
              }}
            >
              Қаз
            </button>
          </div>

          <button type="button" onClick={toggleLargeFont} className="btn" style={{ minBlockSize: "34px", padding: "6px 10px" }}>
            <Eye size={14} strokeWidth={1.6} />
            <span style={{ fontSize: "12px" }}>{largeFont ? (isKz ? "Қалыпты" : "Обычный") : "А+"}</span>
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "32px 16px",
        }}
      >
        <div
          className="surface"
          style={{
            width: "100%",
            maxWidth: "460px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                color: "var(--muted)",
                marginBottom: "12px",
              }}
            >
              <ArrowLeft size={14} strokeWidth={1.6} />
              {isKz ? "Басты бетке оралу" : "На главную страницу"}
            </Link>

            <h1 className="font-display" style={{ fontSize: "28px", lineHeight: 1.15 }}>
              {isKz ? "Дәрігер кабинетіне кіру" : "Вход в клинический кабинет"}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--secondary)", marginTop: "8px", lineHeight: 1.55 }}>
              {isKz
                ? "Ашық клиникалық зерттеу когортасы (KU Leuven, 29 иесіздендірілген карта) және CSV импорты. Құпия сөз қажет емес."
                : "Доступ к реестру из 29 обезличенных пациентов (KU Leuven), разбору TJE/PCR, сравнению проб и импорту CSV."}
            </p>
          </div>

          <form onSubmit={handleEnterPortal} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                background: "var(--teal-bg)",
                border: "1px solid var(--teal-border)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "13px",
                color: "var(--ink)",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <ShieldCheck size={17} strokeWidth={1.7} color="var(--teal)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                {isKz
                  ? "Деректер ҚР № 94-V заңына сай толық иесіздендірілген. Жүйе дәрігерге кеңес беретін СППР болып табылады."
                  : "Все записи обезличены по Закону РК № 94-V. Инструмент работает как консультативная СППР для врача."}
              </span>
            </div>

            <details style={{ fontSize: "13px", color: "var(--secondary)" }}>
              <summary style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                <KeyRound size={14} strokeWidth={1.6} />
                {isKz ? "Қорғалған клиника кілті (X-API-Key, міндетті емес)" : "Ключ доступа клиники (X-API-Key, если включён на сервере)"}
              </summary>
              <div style={{ marginTop: "10px" }}>
                <label htmlFor="api-key-input" style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  {isKz ? "Клиника серверінің API кілті" : "Ключ API клинического сервера"}
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ width: "100%" }}
                />
              </div>
            </details>

            <button type="submit" className="btn btn-primary" style={{ minBlockSize: "42px", width: "100%", fontSize: "14px" }}>
              <span>{isKz ? "Реестрді ашу (Дәрігер рөлі)" : "Открыть реестр пациентов"}</span>
              <ArrowRight size={15} strokeWidth={1.7} />
            </button>
          </form>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.55 }}>
            {t.emergency_banner}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: "48px", textAlign: "center" }}>Загрузка...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
