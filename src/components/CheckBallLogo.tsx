/**
 * CheckBall — Concept A from the brand exploration.
 *
 * Squircle container + soccer-ball pentagon (panel allusion) + ascending check
 * mark + pivot dot. Communicates "predicción acertada + identidad futbolera"
 * without resembling a betting ticket. Used as primary brand mark.
 *
 * Defaults match the dark-theme app (navy fill on transparent bg). For app
 * icon / favicon callers may pass `bg` to swap to a colored squircle.
 */
import * as React from "react";

export const CHECKBALL_TOKENS = {
  green: "#10B981",
  navy: "#0B1220",
  gold: "#F5B82E",
  white: "#FAFAF7",
};

export interface CheckBallLogoProps {
  size?: number;
  /** Squircle background. Defaults to navy. Pass "transparent" to skip. */
  bg?: string;
  /** Pentagon stroke + pivot dot. */
  accent?: string;
  /** Check mark stroke. */
  gold?: string;
  className?: string;
  ariaLabel?: string;
}

export function CheckBallLogo({
  size = 96,
  bg = CHECKBALL_TOKENS.navy,
  accent = CHECKBALL_TOKENS.green,
  gold = CHECKBALL_TOKENS.gold,
  className,
  ariaLabel = "ArmaTuProde",
}: CheckBallLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      {bg !== "transparent" && (
        <rect x="2" y="2" width="92" height="92" rx="22" fill={bg} />
      )}
      {/* Pentagon — soccer-ball panel allusion */}
      <path
        d="M48 22 L70 38 L61.6 64 L34.4 64 L26 38 Z"
        fill="none"
        stroke={accent}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Check rising up-right out of the pentagon */}
      <path
        d="M40 50 L50 60 L78 30"
        stroke={gold}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pivot dot */}
      <circle cx="48" cy="42" r="3" fill={accent} />
    </svg>
  );
}

export default CheckBallLogo;
