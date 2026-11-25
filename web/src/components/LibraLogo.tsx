import React from "react";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  subtitle?: string;
}

export function LibraLogo({ size = "md", href = "/", subtitle }: LogoProps) {
  const markHeight = size === "sm" ? 22 : size === "lg" ? 34 : 26;
  const markWidth = Math.round(markHeight * 1.57);
  const textSize = size === "sm" ? "16px" : size === "lg" ? "20px" : "18px";

  const content = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", userSelect: "none" }}>
      <img
        src="/brand/libra-mark.png"
        alt="Libra"
        width={markWidth}
        height={markHeight}
        style={{
          display: "block",
          objectFit: "contain",
          flexShrink: 0,
        }}
      />

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
