"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LibraLogo } from "@/components/LibraLogo";
import { getApiBase } from "@/lib/api";
import { Lock, Stethoscope, ShieldCheck, ArrowLeft, Globe } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const targetUrl = (rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//") && !rawFrom.startsWith("/\\"))
    ? rawFrom
    : "/portal";
  const [lang, setLang] = useState<"ru" | "kz">("ru");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("libra_lang") || localStorage.getItem("gaitai_lang");
      if (saved === "kz" || saved === "ru") {
        setLang(saved as "ru" | "kz");
      }
    } catch {}
  }, []);

  const switchLanguage = (newLang: "ru" | "kz") => {
    setLang(newLang);
    try {
      localStorage.setItem("libra_lang", newLang);
      if (typeof document !== "undefined") {
        document.documentElement.lang = newLang;
      }
    } catch {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setErrorMsg(
        lang === "kz"
          ? "Жарамды Email және кемінде 6 таңбадан тұратын құпиясөз енгізіңіз."
          : "Введите корректный Email и пароль не менее 6 символов."
      );
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/health`, { method: "GET" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      document.cookie = "libra_session=clinician_authorized; path=/; max-age=86400; SameSite=Lax";
      router.push(targetUrl);
    } catch (err) {
      console.error("Login verification error:", err);
      setErrorMsg(
        lang === "kz"
          ? "Libra API сервері қолжетімсіз. ./run_local.sh арқылы серверді іске қосыңыз немесе демо-кіруді пайдаланыңыз."
          : "Сервер Libra API недоступен. Убедитесь, что backend запущен (./run_local.sh)."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/health`, { method: "GET" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      document.cookie = "libra_session=demo_jury_member; path=/; max-age=86400; SameSite=Lax";
      router.push(targetUrl);
    } catch (err) {
      console.error("Demo login error:", err);
      setErrorMsg(
        lang === "kz"
          ? "Libra API серверімен байланыс жоқ (http://127.0.0.1:8000)."
          : "Нет связи с сервером Libra API (http://127.0.0.1:8000)."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      
      {/* Top Header */}
      <header style={{ padding: "18px var(--gutter)", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <LibraLogo size="md" href="/" />
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Bilingual Switcher */}
            <div style={{ display: "flex", background: "var(--linen)", borderRadius: "6px", border: "1px solid var(--line)", padding: "2px", fontSize: "12px" }}>
              <button
                type="button"
                onClick={() => switchLanguage("kz")}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background: lang === "kz" ? "var(--teal)" : "transparent",
                  color: lang === "kz" ? "#fff" : "var(--muted)"
                }}
              >
                ҚАЗ
              </button>
              <button
                type="button"
                onClick={() => switchLanguage("ru")}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background: lang === "ru" ? "var(--teal)" : "transparent",
                  color: lang === "ru" ? "#fff" : "var(--muted)"
                }}
              >
                РУС
              </button>
            </div>

            <Link href="/" className="btn" style={{ fontSize: "12px", padding: "6px 12px" }}>
              <ArrowLeft size={14} />
              <span>{lang === "kz" ? "Басты бетке" : "На главную"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Canvas */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{
          width: "100%",
          maxWidth: "440px",
          background: "var(--white)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          padding: "32px 28px",
          boxShadow: "0 1px 3px rgba(28, 25, 23, 0.04)"
        }}>
          
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ display: "inline-flex", padding: "8px", borderRadius: "8px", background: "var(--linen)", marginBottom: "10px" }}>
              <Stethoscope size={22} color="var(--amber)" />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: "600", letterSpacing: "-0.025em" }}>
              {lang === "kz" ? "Клиникалық порталға кіру" : "Вход в клинический портал"}
            </h1>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
              {lang === "kz"
                ? "Дәрігер-неврологтар мен ортопедтерге арналған авторизацияланған кіру"
                : "Авторизованный доступ для врачей-неврологов и ортопедов"}
            </p>
          </div>

          {/* Quick Demo Access Bar for Hackathon Jury */}
          <div style={{
            background: "var(--teal-bg)",
            border: "1px solid var(--teal-border)",
            borderRadius: "6px",
            padding: "12px 14px",
            marginBottom: "20px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "11px", color: "var(--teal)", fontWeight: "700", marginBottom: "6px" }}>
              {lang === "kz" ? "Қазылар алқасы мен консилиум мүшелері үшін:" : "Для членов жюри и консилиума:"}
            </div>
            <button
              onClick={handleDemoLogin}
              className="btn btn-teal"
              style={{ width: "100%", height: "36px", fontSize: "13px" }}
              disabled={loading}
              type="button"
            >
              <ShieldCheck size={15} />
              <span>
                {loading
                  ? (lang === "kz" ? "Авторизация..." : "Авторизация...")
                  : (lang === "kz" ? "Зерттеуші-дәрігер ретінде кіру (1 шерту)" : "Войти как врач-исследователь (1 клик)")}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0", color: "var(--muted)", fontSize: "11px", textTransform: "uppercase" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
            <span>{lang === "kz" ? "немесе жұмыс есептік жазбасымен" : "или по рабочей учетной записи"}</span>
            <div style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
          </div>

          {/* Error Message Banner */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                background: "var(--red-bg)",
                border: "1px solid var(--red-border)",
                color: "var(--red)",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "12px",
                marginBottom: "14px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Standard Login Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label htmlFor="email" style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "5px", color: "var(--ink)" }}>
                {lang === "kz" ? "Дәрігердің жұмыс Email-і" : "Рабочий Email врача"}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", height: "38px" }}
                placeholder="doctor@hospital.kz"
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <label htmlFor="password" style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>
                  {lang === "kz" ? "Құпиясөз" : "Пароль"}
                </label>
                <span style={{ fontSize: "11px", color: "var(--muted)", cursor: "pointer" }}>
                  {lang === "kz" ? "Қалпына келтіру" : "Восстановить"}
                </span>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", height: "38px" }}
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", height: "40px", marginTop: "6px", fontSize: "14px" }}
              disabled={loading}
            >
              <Lock size={14} />
              <span>
                {loading
                  ? (lang === "kz" ? "Қосылу..." : "Подключение...")
                  : (lang === "kz" ? "Жүйеге кіру" : "Войти в систему")}
              </span>
            </button>

          </form>

          {/* Legal Compliance Notice with real hyperlinks */}
          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--line)", fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", textAlign: "center" }}>
            {lang === "kz" ? (
              <>
                Жүйеге кіру арқылы сіз{" "}
                <Link href="/terms" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                  Пайдалану шарттарын
                </Link>{" "}
                және ҚР № 94-V Заңына сәйкес{" "}
                <Link href="/privacy" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                  Құпиялылық саясатын
                </Link>{" "}
                қабылдайсыз.
              </>
            ) : (
              <>
                Входя в систему, вы принимаете{" "}
                <Link href="/terms" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                  Условия использования
                </Link>{" "}
                и подтверждаете согласие с{" "}
                <Link href="/privacy" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                  Политикой конфиденциальности
                </Link>{" "}
                в соответствии с Законом РК № 94-V.
              </>
            )}
          </div>

        </div>
      </main>

      <footer style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--muted)", borderTop: "1px solid var(--line)", background: "var(--paper)" }}>
        <div style={{ marginBottom: "6px", fontSize: "11px", color: "var(--critical)" }}>
          {lang === "kz"
            ? "ШҰҒЫЛ ЖАҒДАЙДА: 103 нөміріне қоңырау шалыңыз (СППР, 8.4-бап)."
            : "ВНИМАНИЕ: В экстренных ситуациях звоните 103 (СППР, ст. 8.4)."}
        </div>
        {lang === "kz"
          ? "© 2026 Libra. Денсаулық сақтау мамандарына арналған клиникалық портал."
          : "© 2026 Libra. Портал для специалистов здравоохранения."}
      </footer>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--paper)" }} />}>
      <LoginContent />
    </Suspense>
  );
}
