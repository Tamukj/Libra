"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useLanguage();
  const isKz = lang === "kz";

  return (
    <div className="surface stack-md" style={{ padding: "var(--sp-8)", maxWidth: "560px", margin: "var(--sp-8) auto" }}>
      <div className="cluster" style={{ gap: "var(--sp-3)" }}>
        <AlertTriangle size={20} color="var(--red)" aria-hidden="true" />
        <h1 className="page-title" style={{ fontSize: "20px" }}>
          {isKz ? "Бетті көрсету кезінде қате шықты" : "Ошибка отображения страницы"}
        </h1>
      </div>
      <p style={{ fontSize: "14px", color: "var(--secondary)" }}>
        {error?.message || (isKz ? "Күтпеген қате." : "Непредвиденная ошибка.")}
      </p>
      <div className="cluster" style={{ gap: "var(--sp-3)" }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => reset()}>
          <RotateCcw size={14} aria-hidden="true" />
          <span>{isKz ? "Қайталау" : "Повторить"}</span>
        </button>
        <Link href="/portal" className="btn btn-sm">
          {isKz ? "Тізілімге оралу" : "Вернуться в реестр"}
        </Link>
      </div>
    </div>
  );
}
