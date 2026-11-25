"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { LibraLogo } from "@/components/LibraLogo";
import { LanguageSwitch, LargeFontButton } from "@/components/PageControls";
import { useLanguage } from "@/lib/LanguageContext";

const SESSION_SALT = "libra-clinical-v1";

function createSessionToken(): string {
  const ts = String(Date.now());
  let h = 2166136261;
  const input = `${SESSION_SALT}:${ts}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `v1.${ts}.${(h >>> 0).toString(16).padStart(8, "0")}`;
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const isKz = lang === "kz";

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem("libra_api_key");
      if (savedKey) setApiKey(savedKey);
    } catch {}
  }, []);

  const handleEnterPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    const trimmedKey = apiKey.trim();
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL !== undefined
        ? process.env.NEXT_PUBLIC_API_URL
        : "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${apiBase}/api/v1/patients`, {
        headers: trimmedKey ? { "X-API-Key": trimmedKey } : {},
      });
      if (!res.ok) {
        setAuthError(
          isKz
            ? `Кіру қабылданбады (HTTP ${res.status}). Сервер кілтін тексеріңіз.`
            : `Доступ отклонён (HTTP ${res.status}). Проверьте ключ доступа клиники.`
        );
        return;
      }
      document.cookie = `libra_session=${createSessionToken()}; path=/; max-age=604800; SameSite=Lax`;
      try {
        if (trimmedKey) {
          sessionStorage.setItem("libra_api_key", trimmedKey);
        } else {
          sessionStorage.removeItem("libra_api_key");
        }
      } catch {}
      const from = searchParams.get("from") || "/portal";
      window.location.assign(from.startsWith("/portal") ? from : "/portal");
    } catch {
      setAuthError(
        isKz
          ? "Серверге қосылу мүмкін болмады."
          : "Не удалось связаться с сервером для проверки доступа."
      );
    } finally {
      setSubmitting(false);
    }
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
                <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
                  <input
                    id="api-key-input"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ width: "100%" }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-pressed={showKey}
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? (isKz ? "Жасыру" : "Скрыть") : (isKz ? "Көрсету" : "Показать")}
                  </button>
                </div>
              </div>
            </details>

            {authError && (
              <div className="callout callout-red" role="alert" style={{ padding: "var(--sp-3) var(--sp-4)", fontSize: "13px" }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={submitting}>
              <span>{submitting ? (isKz ? "Тексерілуде..." : "Проверка...") : isKz ? "Тізілімді ашу" : "Открыть реестр пациентов"}</span>
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
