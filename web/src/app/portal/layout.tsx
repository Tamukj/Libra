"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalSidebar, PortalTopBar } from "@/components/PortalSidebar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { UploadCsvModal } from "@/components/UploadCsvModal";
import { CsvUploadResponse } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const handleUploadSuccess = (res: CsvUploadResponse) => {
    setUploadOpen(false);
    const fallbackMsg =
      lang === "kz"
        ? `Файл сәтті импортталды (${res.code}).`
        : `Данные CSV успешно импортированы (${res.code}).`;
    setUploadNotice((lang === "kz" ? res.message_kz : res.message_ru) || fallbackMsg);
    if (res.code) {
      window.dispatchEvent(new CustomEvent("libra:patient-updated", { detail: { code: res.code } }));
      router.push(`/portal/patients/${encodeURIComponent(res.code)}`);
    }
    router.refresh();
    setTimeout(() => {
      setUploadNotice(null);
    }, 5000);
  };

  return (
    <div className="portal-shell">
      <a href="#portal-main-content" className="skip-link visually-hidden">
        {lang === "kz" ? "Негізгі мазмұнға өту" : "Перейти к содержимому"}
      </a>

      <PortalSidebar
        onOpenUpload={() => setUploadOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
      />

      <div className="portal-main">
        <PortalTopBar />

        {uploadNotice && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: "var(--teal-bg)",
              borderBottom: "1px solid var(--teal-border)",
              color: "var(--teal)",
              padding: "10px 32px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {uploadNotice}
          </div>
        )}

        <main id="portal-main-content" tabIndex={-1} className="portal-content">
          {children}
        </main>

        <footer
          className="no-print"
          style={{
            borderTop: "1px solid var(--line)",
            background: "var(--white)",
            padding: "14px 32px",
            fontSize: "12px",
            color: "var(--muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span>
            Libra ·{" "}
            {lang === "kz"
              ? "БЦП кезіндегі жүрісті талдау жүйесі (СППР)"
              : "Система поддержки врачебных решений при ДЦП"}
          </span>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Link href="/privacy" style={{ textDecoration: "underline" }}>
              {lang === "kz" ? "Құпиялылық (ҚР № 94-V)" : "Конфиденциальность (Закон РК № 94-V)"}
            </Link>
            <Link href="/terms" style={{ textDecoration: "underline" }}>
              {lang === "kz" ? "Пайдалану шарттары" : "Условия использования"}
            </Link>
            <Link href="/portal/safety" style={{ textDecoration: "underline" }}>
              {lang === "kz" ? "Шектеулер мен лицензиялар" : "Ограничения и лицензии"}
            </Link>
          </div>
        </footer>
      </div>

      <UploadCsvModal
        open={uploadOpen}
        lang={lang}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      <OnboardingModal
        open={guideOpen}
        lang={lang}
        onClose={() => setGuideOpen(false)}
      />
    </div>
  );
}
