"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations";

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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("libra_lang") || localStorage.getItem("gaitai_lang")) as Lang | null;
      if (saved === "ru" || saved === "kz" || saved === "en") {
        setLangState(saved);
        if (typeof document !== "undefined") {
          document.documentElement.lang = saved;
        }
        return;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get("lang") as Lang | null;
      if (urlLang === "ru" || urlLang === "kz" || urlLang === "en") {
        setLangState(urlLang);
        if (typeof document !== "undefined") {
          document.documentElement.lang = urlLang;
        }
      }
    } catch {}
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLang;
    }
    try {
      localStorage.setItem("libra_lang", newLang);
    } catch {}
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
