import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";

const sans = localFont({
  src: "../../public/fonts/manrope-latin.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const serif = localFont({
  src: "../../public/fonts/source-serif-4-latin.woff2",
  variable: "--font-source-serif",
  weight: "200 900",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "Libra — Портал клинического анализа походки по CSV-данным при ДЦП",
  description: "Система поддержки принятия врачебных решений (CDSS) на основе анализа CSV-данных биомеханики походки для реабилитации детей с ДЦП. AI-Sana Shakarim Solveathon 2026 (г. Семей).",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
