/**
 * Live-price mood, mirroring the original Finiliar mechanism.
 *
 * Researched from the ERC-721 at 0x5a0121a0a21232ec0d024dab9017314509026480:
 * tokenURI → https://api-public.finiliar.com/metadata/<id>, which serves
 * `latestDelta` (percent move of the token's Family currency over its
 * Frequency window — Hourly / Twice Daily / Daily / Weekly / Monthly) and
 * swaps the rendered animation to match: "happy and buoyant when the currency
 * they are linked to does well, and sad or even sick when it performs poorly."
 *
 * Our 3D pipeline currently ships one clip per character (fin_happy_idle), so
 * until mood clips are sourced we express mood through playback speed — a
 * sick Fini idles in slow motion, a happy one is bouncy.
 */

export type FiniLiveMood = "happy" | "neutral" | "sad" | "sick";

/** `deltaPct` is in percent units (0.98 → +0.98%), as served by the API. */
export function moodFromDeltaPct(deltaPct: number): FiniLiveMood {
  if (deltaPct <= -5) return "sick";
  if (deltaPct <= -0.5) return "sad";
  if (deltaPct >= 0.5) return "happy";
  return "neutral";
}

export const MOOD_META: Record<FiniLiveMood, { emoji: string; label: string; timeScale: number }> = {
  happy:   { emoji: "😊", label: "Happy",   timeScale: 1.25 },
  neutral: { emoji: "😐", label: "Neutral", timeScale: 1.0 },
  sad:     { emoji: "🙁", label: "Sad",     timeScale: 0.55 },
  sick:    { emoji: "🤢", label: "Sick",    timeScale: 0.3 },
};

export function fmtUsd(p: number): string {
  if (p >= 1000) return "$" + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return "$" + p.toFixed(2);
  return "$" + p.toFixed(4);
}

export function fmtDeltaPct(d: number): string {
  return `${d >= 0 ? "+" : ""}${d.toFixed(2)}%`;
}
