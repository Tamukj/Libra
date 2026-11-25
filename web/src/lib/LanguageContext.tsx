"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { translations } from "./translations";
import { safeDecodeParam } from "./format";

export type Lang = "ru" | "kz" | "en";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof translations.ru;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ru",
  setLang: () => {},
  t: translations.ru,
});

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "ru";
  try {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "ru" || urlLang === "kz" || urlLang === "en") return urlLang;
    const saved = localStorage.getItem("libra_lang");
    if (saved === "ru" || saved === "kz" || saved === "en") return saved;
    const cookieMatch = document.cookie.match(/(?:^|;\s*)libra_lang=(ru|kz|en)/);
    if (cookieMatch?.[1] === "ru" || cookieMatch?.[1] === "kz" || cookieMatch?.[1] === "en") {
      return cookieMatch[1];
    }
  } catch {}
  return "ru";
}

function resolvePageTitle(pathname: string, lang: Lang): string {
  const isKz = lang === "kz";
  if (pathname.startsWith("/portal/patients/")) {
    const code = safeDecodeParam(
      pathname.replace("/portal/patients/", "").split("/")[0] || ""
    );
    return isKz
      ? `${code} · Пациент картасы — Libra`
      : `${code} · Карточка пациента — Libra`;
  }
  if (pathname.startsWith("/portal/analytics")) {
    return isKz ? "Когорта талдауы — Libra" : "Аналитика когорты — Libra";
  }
  if (pathname.startsWith("/portal/ml-validation")) {
    return isKz ? "Модельдерді тексеру — Libra" : "Валидация моделей — Libra";
  }
  if (pathname.startsWith("/portal/safety")) {
    return isKz ? "Қауіпсіздік және шектеулер — Libra" : "Безопасность и ограничения — Libra";
  }
  if (pathname.startsWith("/portal")) {
    return isKz ? "Пациенттер тізілімі — Libra" : "Реестр пациентов — Libra";
  }
  if (pathname.startsWith("/login")) {
    return isKz ? "Кабинетке кіру — Libra" : "Вход в кабинет — Libra";
  }
  if (pathname.startsWith("/privacy")) {
    return isKz ? "Дербес деректер — Libra" : "Конфиденциальность — Libra";
  }
  if (pathname.startsWith("/terms")) {
    return isKz ? "Шектеулер — Libra" : "Ограничения СППР — Libra";
  }
  return isKz
    ? "Libra — БЦП кезіндегі жүрісті талдау жүйесі"
    : "Libra — Клиническая система анализа походки при ДЦП";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [lang, setLangState] = useState<Lang>("ru");

  const applyDomLanguage = useCallback(
    (targetLang: Lang, currentPath: string) => {
      if (typeof document === "undefined") return;
      document.documentElement.lang = targetLang === "kz" ? "kk" : targetLang;
      document.title = resolvePageTitle(currentPath, targetLang);
    },
    []
  );

  useEffect(() => {
    const initial = readStoredLang();
    setLangState(initial);
    applyDomLanguage(initial, pathname);
  }, [pathname, applyDomLanguage]);

  useEffect(() => {
    const expectedTitle = resolvePageTitle(pathname, lang);
    applyDomLanguage(lang, pathname);

    const rafId = requestAnimationFrame(() => {
      if (document.title !== expectedTitle) {
        document.title = expectedTitle;
      }
    });

    const headObserver =
      typeof MutationObserver !== "undefined" && document.head
        ? new MutationObserver(() => {
            const activeLang = readStoredLang();
            const target = resolvePageTitle(pathname, activeLang);
            if (document.title !== target) {
              document.title = target;
            }
          })
        : null;

    if (headObserver && document.head) {
      headObserver.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      headObserver?.disconnect();
    };
  }, [lang, pathname, applyDomLanguage]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "libra_lang" && (e.newValue === "ru" || e.newValue === "kz")) {
        setLangState(e.newValue);
        applyDomLanguage(e.newValue, pathname);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname, applyDomLanguage]);

  const setLang = useCallback(
    (newLang: Lang) => {
      setLangState(newLang);
      applyDomLanguage(newLang, pathname);
      try {
        localStorage.setItem("libra_lang", newLang);
        document.cookie = `libra_lang=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    },
    [pathname, applyDomLanguage]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang === "kz" ? "kz" : "ru"] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
