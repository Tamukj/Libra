"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Eye } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function useLargeFontPreference() {
  const [largeFont, setLargeFont] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const enabled = localStorage.getItem("libra_a11y_large") === "1";
        setLargeFont(enabled);
        document.documentElement.classList.toggle("a11y-large", enabled);
      } catch {}
    };
    sync();
    window.addEventListener("libra:a11y-changed", sync);
    return () => window.removeEventListener("libra:a11y-changed", sync);
  }, []);

  const toggleLargeFont = useCallback(() => {
    setLargeFont((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("a11y-large", next);
      try {
        localStorage.setItem("libra_a11y_large", next ? "1" : "0");
      } catch {}
      window.dispatchEvent(new Event("libra:a11y-changed"));
      return next;
    });
  }, []);

  return { largeFont, toggleLargeFont };
}

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  return (
    <div
      role="group"
      aria-label={lang === "kz" ? "Тілді таңдау" : "Выбор языка"}
      className="seg-group"
    >
      <button
        type="button"
        onClick={() => setLang("ru")}
        aria-pressed={lang === "ru"}
        className="seg-btn seg-btn-light"
      >
        {compact ? "Рус" : "Русский"}
      </button>
      <button
        type="button"
        onClick={() => setLang("kz")}
        aria-pressed={lang === "kz"}
        className="seg-btn seg-btn-light"
      >
        {compact ? "Қаз" : "Қазақша"}
      </button>
    </div>
  );
}

export function LargeFontButton({ hideLabelOnMobile = true }: { hideLabelOnMobile?: boolean }) {
  const { lang } = useLanguage();
  const { largeFont, toggleLargeFont } = useLargeFontPreference();
  const isKz = lang === "kz";

  return (
    <button
      type="button"
      onClick={toggleLargeFont}
      aria-pressed={largeFont}
      aria-label={
        largeFont
          ? isKz
            ? "Қалыпты қаріп өлшемін қосу"
            : "Вернуть обычный размер шрифта"
          : isKz
          ? "Ірі қаріп режимін қосу"
          : "Включить крупный шрифт для слабовидящих"
      }
      className={`btn btn-sm ${largeFont ? "btn-primary" : ""}`}
    >
      <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
      <span className={hideLabelOnMobile ? "hide-on-mobile" : undefined}>
        {largeFont ? (isKz ? "Қалыпты" : "Обычный") : isKz ? "Ірі қаріп" : "А+"}
      </span>
    </button>
  );
}
