import { ALL_COIN_FAMILIES, } from "./types";
import { generateMockMarketSignals, normalizeMarketSignal } from "./marketSignals";
/** Local calendar date, e.g. "2026-05-30". */
export function todayKey(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function moodFor(avgMomentum, avgVol) {
    if (avgVol > 0.6)
        return "Volatile";
    if (avgMomentum > 0.12)
        return "Risk-on";
    if (avgMomentum < -0.12)
        return "Risk-off";
    return "Choppy";
}
/**
 * Derive the regime from a market snapshot. Hot = strongest momentum,
 * cold = weakest. Bias is just each family's momentum, softened.
 */
export function regimeFromSignals(signals, dateKey, source) {
    let hot = ALL_COIN_FAMILIES[0];
    let cold = ALL_COIN_FAMILIES[0];
    let hotScore = -Infinity;
    let coldScore = Infinity;
    let sumMom = 0;
    let sumVol = 0;
    const bias = {};
    for (const fam of ALL_COIN_FAMILIES) {
        const m = signals[fam].momentumScore;
        bias[fam] = Math.max(-1, Math.min(1, m * 0.8));
        sumMom += m;
        sumVol += signals[fam].volatility;
        if (m > hotScore) {
            hotScore = m;
            hot = fam;
        }
        if (m < coldScore) {
            coldScore = m;
            cold = fam;
        }
    }
    const n = ALL_COIN_FAMILIES.length;
    return {
        dateKey,
        hotFamily: hot,
        coldFamily: cold,
        bias,
        source,
        mood: moodFor(sumMom / n, sumVol / n),
    };
}
/**
 * The default daily regime when no live data is loaded: a date-seeded
 * mock snapshot so the whole player base shares the same "weather" for
 * the day without needing a server.
 */
export function computeMockDailyRegime(dateKey = todayKey()) {
    const seed = hashString(dateKey);
    // 24h window gives the steadiest day-long flavor.
    const snapshot = generateMockMarketSignals("24h", seed);
    return regimeFromSignals(snapshot, dateKey, "mock");
}
/**
 * Layer the daily regime onto a fresh battle signal map. Each family's
 * momentum is nudged toward the day's bias so battles within a day feel
 * coherent, then direction/percent are re-derived to stay consistent.
 *
 * `weight` controls how strongly the day's weather overrides the
 * individual battle roll (0 = ignore regime, 1 = regime dominates).
 */
export function applyRegimeToSignals(signals, regime, weight = 0.35) {
    const out = {};
    for (const fam of ALL_COIN_FAMILIES) {
        const base = signals[fam];
        const nudgedMomentum = Math.max(-1, Math.min(1, base.momentumScore * (1 - weight) + regime.bias[fam] * weight));
        // Re-derive a believable percent change from the nudged momentum so
        // the UI and the engine agree. Inverse of tanh(percent/6).
        const nudgedPercent = atanhClamped(nudgedMomentum) * 6;
        out[fam] = normalizeMarketSignal(nudgedPercent, base.volatility, fam);
    }
    return out;
}
function atanhClamped(x) {
    const c = Math.max(-0.999, Math.min(0.999, x));
    return 0.5 * Math.log((1 + c) / (1 - c));
}
export const _internal = { hashString };
