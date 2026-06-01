import type { CoinFamily } from "../game/types";
import { FAMILY_COLOR } from "./familyColors";

export type FiniMood = "happy" | "ok" | "sad" | "ko";

/** Pick a mood from a health ratio (0..1) — the Finiliar way: buoyant
 * when healthy, sad/sick when low, fainted when gone. */
export function moodFromHp(ratio: number, fainted?: boolean): FiniMood {
  if (fainted || ratio <= 0) return "ko";
  if (ratio > 0.6) return "happy";
  if (ratio > 0.3) return "ok";
  return "sad";
}

/**
 * A cute Finiliar-style face: a soft round body in its coin-family
 * colour with big sparkly eyes, blush, and a mood-driven mouth.
 * Pure SVG so it scales crisply and animates cheaply.
 */
export function FiniAvatar(props: {
  family: CoinFamily;
  size?: number;
  mood?: FiniMood;
  /** gentle idle wobble */
  wobble?: boolean;
  className?: string;
}) {
  const { family, size = 44, mood = "happy", wobble, className } = props;
  const hex = FAMILY_COLOR[family].hex;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${wobble ? "animate-wobble" : ""} ${className ?? ""}`}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`body-${family}`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="42%" stopColor={hex} stopOpacity="1" />
          <stop offset="100%" stopColor={hex} stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* soft shadow */}
      <ellipse cx="50" cy="92" rx="26" ry="6" fill="rgba(120,90,150,0.18)" />

      {/* body — squishy blob */}
      <path
        d="M50 8
           C74 8 90 26 90 50
           C90 76 74 92 50 92
           C26 92 10 76 10 50
           C10 26 26 8 50 8 Z"
        fill={`url(#body-${family})`}
        stroke="rgba(70,40,90,0.18)"
        strokeWidth="2"
      />

      {/* cheeks */}
      {mood !== "ko" && (
        <>
          <ellipse cx="28" cy="60" rx="8" ry="5" fill="#ff8fc7" opacity="0.55" />
          <ellipse cx="72" cy="60" rx="8" ry="5" fill="#ff8fc7" opacity="0.55" />
        </>
      )}

      {/* eyes */}
      {mood === "ko" ? (
        <g stroke="#3a2b48" strokeWidth="4" strokeLinecap="round">
          <line x1="30" y1="42" x2="40" y2="52" />
          <line x1="40" y1="42" x2="30" y2="52" />
          <line x1="60" y1="42" x2="70" y2="52" />
          <line x1="70" y1="42" x2="60" y2="52" />
        </g>
      ) : (
        <>
          <ellipse cx="36" cy="46" rx="8.5" ry="10" fill="#fff" />
          <ellipse cx="64" cy="46" rx="8.5" ry="10" fill="#fff" />
          <circle cx={mood === "sad" ? 36 : 37} cy={mood === "sad" ? 49 : 48} r="4.6" fill="#3a2b48" />
          <circle cx={mood === "sad" ? 64 : 65} cy={mood === "sad" ? 49 : 48} r="4.6" fill="#3a2b48" />
          <circle cx={mood === "sad" ? 34.5 : 35.3} cy={mood === "sad" ? 47 : 46} r="1.7" fill="#fff" />
          <circle cx={mood === "sad" ? 62.5 : 63.3} cy={mood === "sad" ? 47 : 46} r="1.7" fill="#fff" />
        </>
      )}

      {/* mouth */}
      {mood === "happy" && (
        <path
          d="M40 64 Q50 74 60 64"
          fill="none"
          stroke="#3a2b48"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      )}
      {mood === "ok" && (
        <path
          d="M42 67 Q50 70 58 67"
          fill="none"
          stroke="#3a2b48"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      )}
      {mood === "sad" && (
        <path
          d="M41 70 Q50 62 59 70"
          fill="none"
          stroke="#3a2b48"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      )}
      {mood === "ko" && (
        <path
          d="M41 70 Q50 64 59 70"
          fill="none"
          stroke="#3a2b48"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
