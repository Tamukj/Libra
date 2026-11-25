"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalSidebar, PortalTopBar } from "@/components/PortalSidebar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { UploadCsvModal } from "@/components/UploadCsvModal";
import { CsvUploadResponse, VisitSummary } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";

interface OpenUploadDetail {
  subjectCode?: string;
  defaultVisitMode?: "new" | "existing";
  visits?: VisitSummary[];
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPrefill, setUploadPrefill] = useState<OpenUploadDetail | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onOpenUpload = (ev: Event) => {
      const detail = (ev as CustomEvent<OpenUploadDetail | undefined>).detail ?? null;
      setUploadPrefill(detail);
      setUploadOpen(true);
    };
    window.addEventListener("libra:open-upload", onOpenUpload);
    return () => {
      window.removeEventListener("libra:open-upload", onOpenUpload);
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const handleCloseUpload = () => {
    setUploadOpen(false);
    setUploadPrefill(null);
  };

  const handleUploadSuccess = (res: CsvUploadResponse) => {
    setUploadOpen(false);
    setUploadPrefill(null);

    const fallbackMsg =
      lang === "kz"
        ? `Файл сәтті импортталды (${res.code}).`
        : `Данные CSV успешно импортированы (${res.code}).`;
    setUploadNotice((lang === "kz" ? res.message_kz : res.message_ru) || fallbackMsg);

    if (res.code) {
      window.dispatchEvent(
        new CustomEvent("libra:patient-updated", {
          detail: { code: res.code, visit_key: res.visit_key },
        })
      );
      const visitQuery = res.visit_key ? `?visit=${encodeURIComponent(res.visit_key)}` : "";
      router.push(`/portal/patients/${encodeURIComponent(res.code)}${visitQuery}`);
    }
    router.refresh();

    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
      setUploadNotice(null);
    }, 5000);
  };

  return (
    <div className="portal-shell">
      <a href="#portal-main-content" className="skip-link visually-hidden">
        {lang === "kz" ? "Негізгі мазмұнға өту" : "Перейти к содержимому"}
      </a>

      <PortalSidebar
        onOpenUpload={() => {
          setUploadPrefill(null);
          setUploadOpen(true);
        }}
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
              borderBlockEnd: "1px solid var(--teal-border)",
              color: "var(--teal)",
              padding: "var(--sp-3) var(--sp-8)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {uploadNotice}
          </div>
        )}

        <main id="portal-main-content" tabIndex={-1} className="portal-content no-print">
          {children}
        </main>

        <footer className="portal-footer no-print">
          <span>
            Libra ·{" "}
            {lang === "kz"
              ? "БЦП кезіндегі жүрісті талдау жүйесі (СППР)"
              : "Система поддержки врачебных решений при ДЦП"}
          </span>
          <div className="cluster" style={{ gap: "var(--sp-4)" }}>
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
        lang={lang === "kz" ? "kz" : "ru"}
        initialSubjectCode={uploadPrefill?.subjectCode}
        defaultVisitMode={uploadPrefill?.defaultVisitMode}
        initialVisits={uploadPrefill?.visits}
        onClose={handleCloseUpload}
        onSuccess={handleUploadSuccess}
      />

      <OnboardingModal
        open={guideOpen}
        lang={lang === "kz" ? "kz" : "ru"}
        onClose={() => setGuideOpen(false)}
      />
    </div>
  );
}
