import React from "react";
import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  showSub?: boolean;
}

export function LibraLogo({ size = "md", href = "/", showSub = false }: LogoProps) {
  const markHeight = size === "sm" ? 22 : size === "lg" ? 34 : 26;
  const markWidth = Math.round(markHeight * 1.57);
  const textSize = size === "sm" ? "17px" : size === "lg" ? "24px" : "20px";

  const content = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", userSelect: "none" }}>
      {/* Brand Flowing Equilibrium Wave Mark */}
      <img
        src="/brand/libra-mark.png"
        alt="Libra Equilibrium Mark"
        width={markWidth}
        height={markHeight}
        style={{
          display: "block",
          objectFit: "contain",
          flexShrink: 0
        }}
      />

      <span
        style={{
          fontFamily: "var(--sans)",
          fontSize: textSize,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: "#164478",
          lineHeight: 1,
          textTransform: "uppercase"
        }}
      >
        LIBRA
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "inline-flex" }} aria-label="Libra главная">
        {content}
      </Link>
    );
  }

  return content;
}
