"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations";

export type Lang = "ru" | "kz";

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

  const applyDomLanguage = (targetLang: Lang) => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = targetLang === "kz" ? "kk" : "ru";
    document.title =
      targetLang === "kz"
        ? "Libra — БЦП кезіндегі жүрісті талдау жүйесі"
        : "Libra — Клиническая система анализа походки при ДЦП";
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("libra_lang") || localStorage.getItem("gaitai_lang");
      if (saved === "ru" || saved === "kz") {
        setLangState(saved);
        applyDomLanguage(saved);
        return;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get("lang");
      if (urlLang === "ru" || urlLang === "kz") {
        setLangState(urlLang);
        applyDomLanguage(urlLang);
        return;
      }
      applyDomLanguage("ru");
    } catch {}
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    applyDomLanguage(newLang);
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
