import React from "react";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  subtitle?: string;
}

export function LibraLogo({ size = "md", href = "/", subtitle }: LogoProps) {
  const markSize = size === "sm" ? 24 : size === "lg" ? 32 : 28;
  const textSize = size === "sm" ? "16px" : size === "lg" ? "20px" : "18px";

  const content = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", userSelect: "none" }}>
      <svg
        aria-hidden="true"
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        style={{ flexShrink: 0, display: "block" }}
      >
        <rect width="32" height="32" rx="7" fill="var(--ink)" />
        <path
          d="M 10 13 C 10 9.7 12.7 7 16 7 C 19.3 7 22 9.7 22 13"
          stroke="var(--paper)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M 7 21 L 25 21" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="17" r="2" fill="var(--amber)" />
      </svg>

      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontFamily: "var(--sans)",
            fontSize: textSize,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          Libra
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--muted)",
              marginTop: "2px",
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: "inline-flex" }} aria-label="Libra">
        {content}
      </Link>
    );
  }

  return content;
}
