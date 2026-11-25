"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { LanguageSwitch, LargeFontButton } from "@/components/PageControls";
import { useLanguage } from "@/lib/LanguageContext";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem("libra_api_key");
      if (savedKey) setApiKey(savedKey);
    } catch {}
  }, []);

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
      <header className="site-header" style={{ background: "var(--white)" }}>
        <div className="container site-header-inner">
          <LibraLogo size="md" href="/" subtitle={t.brand_sub} />
          <div className="cluster">
            <LanguageSwitch compact />
            <LargeFontButton />
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "var(--sp-8) var(--sp-4)" }}>
        <div className="surface stack-lg" style={{ width: "100%", maxWidth: "460px", padding: "var(--sp-6)" }}>
          <div className="stack-sm">
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                color: "var(--muted)",
              }}
            >
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>{isKz ? "Басты бетке оралу" : "На главную страницу"}</span>
            </Link>

            <h1 className="page-title" style={{ fontSize: "28px" }}>
              {isKz ? "Дәрігер кабинетіне кіру" : "Вход в клинический кабинет"}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--secondary)", lineHeight: 1.55 }}>
              {isKz
                ? "Ашық клиникалық когорта (KU Leuven, 29 иесіздендірілген карта) және CSV импорты. Құпия сөз талап етілмейді."
                : "Доступ к реестру из 29 обезличенных пациентов (KU Leuven), расчёту TJE/PCR, сравнению проб и импорту CSV."}
            </p>
          </div>

          <form onSubmit={handleEnterPortal} className="stack-md">
            <div className="callout callout-teal" style={{ padding: "var(--sp-3) var(--sp-4)", fontSize: "13px" }}>
              <ShieldCheck size={16} strokeWidth={1.6} color="var(--teal)" style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
              <span>
                {isKz
                  ? "Деректер ҚР № 94-V заңына сай толық иесіздендірілген. Жүйе дәрігерге кеңес беретін СППР болып табылады."
                  : "Все записи обезличены по Закону РК № 94-V. Инструмент работает как консультативная СППР для врача."}
              </span>
            </div>

            <details style={{ fontSize: "13px", color: "var(--secondary)" }}>
              <summary style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                <KeyRound size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  {isKz ? "Клиника серверінің кілті (қажет болса)" : "Ключ доступа клиники (если настроен на сервере)"}
                </span>
              </summary>
              <div style={{ marginTop: "var(--sp-2)" }}>
                <label htmlFor="api-key-input" style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "var(--sp-2)" }}>
                  {isKz ? "Сервер кілті" : "Ключ доступа сервера"}
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

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
              <span>{isKz ? "Тізілімді ашу" : "Открыть реестр пациентов"}</span>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </form>

          <div style={{ borderBlockStart: "1px solid var(--line)", paddingBlockStart: "var(--sp-3)", fontSize: "12px", color: "var(--muted)", lineHeight: 1.55 }}>
            {t.emergency_banner}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: "48px", textAlign: "center", color: "var(--muted)" }}>Загрузка...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
