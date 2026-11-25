export type FormatLang = "ru" | "kz";

const MINUS = "−";

export function isFiniteNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function fmtFixed(
  value: number | null | undefined,
  digits = 1,
  unit = ""
): string {
  if (!isFiniteNum(value)) return "—";
  if (Math.abs(value) < 0.5 * Math.pow(10, -digits)) {
    return `${(0).toFixed(digits)}${unit}`;
  }
  const abs = Math.abs(value).toFixed(digits);
  return value < 0 ? `${MINUS}${abs}${unit}` : `${abs}${unit}`;
}

export function fmtSigned(
  value: number | null | undefined,
  digits = 1,
  unit = "°"
): string {
  if (!isFiniteNum(value)) return "—";
  if (Math.abs(value) < 0.5 * Math.pow(10, -digits)) {
    return `${(0).toFixed(digits)}${unit}`;
  }
  const sign = value > 0 ? "+" : MINUS;
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
}

export function fmtPcr(value: number | null | undefined): string {
  return fmtFixed(value, 2, "");
}

export function fmtCm(
  value: number | null | undefined,
  withUnit = true
): string {
  if (!isFiniteNum(value) || value <= 0) return "—";
  const cm = value < 3.0 ? value * 100 : value;
  return withUnit ? `${Math.round(cm)} см` : `${Math.round(cm)}`;
}

export function fmtPercent(
  value: number | null | undefined,
  isRatio = true,
  digits = 0
): string {
  if (!isFiniteNum(value)) return "—";
  const pct = isRatio && value <= 1 ? value * 100 : value;
  return `${pct.toFixed(digits)}%`;
}

export function fmtVisitCount(count: number, lang: FormatLang): string {
  if (lang === "kz") return `${count} визит`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} визит`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} визита`;
  }
  return `${count} визитов`;
}

export function cleanClinicalText(text: string): string {
  return text
    .replace(/\s*\((?:п\.\s*8\.2(?:\s+Положения)?|Ереже\s*8\.2-т\.|8\.2-т\.|Rule\s*8\.2)\)/gi, "")
    .replace(/,\s*(?:п\.\s*8\.2|8\.2-т\.|Rule\s*8\.2)/gi, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
