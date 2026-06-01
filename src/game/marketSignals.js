import { ALL_COIN_FAMILIES, } from "./types";
import { createRng } from "./rng";
/**
 * Modular market signal layer.
 *
 * Today: two modes — Mock generator (random believable changes) and
 * Manual Test (hardcoded fixtures for deterministic testing).
 *
 * Tomorrow: this is the seam where CoinGecko / Pyth / Chainlink / a
 * custom oracle gets wired in. Keep `MarketSignal` shape stable so the
 * battle engine stays untouched when real data lands.
 *
 *  - Replace generateMockMarketSignals with `fetchMarketSignals(window)`
 *  - Add a server-side cache so battles within the same window are
 *    deterministic across players.
 *  - For Ranked, snapshot the signal map BEFORE battle start so the
 *    server can replay it.
 */
const WINDOW_CONFIG = {
    "5m": { magnitude: 0.8, volatility: 0.7 },
    "1h": { magnitude: 1.6, volatility: 0.6 },
    "4h": { magnitude: 3.0, volatility: 0.5 },
    "24h": { magnitude: 5.0, volatility: 0.4 },
};
function directionFromPercent(percent) {
    if (percent > 0.4)
        return "up";
    if (percent < -0.4)
        return "down";
    return "flat";
}
/**
 * Convert a raw percent change + volatility into a momentum score
 * clamped to [-1, 1]. The battle engine consumes momentumScore.
 */
export function normalizeMarketSignal(percentChange, volatility, family = "ETH") {
    // Soft saturation so a +20% swing doesn't dwarf everything.
    const momentum = Math.tanh(percentChange / 6);
    return {
        family,
        percentChange,
        volatility: Math.max(0, Math.min(1, volatility)),
        direction: directionFromPercent(percentChange),
        momentumScore: Math.max(-1, Math.min(1, momentum)),
    };
}
function generateOneSignal(family, window, rng) {
    const cfg = WINDOW_CONFIG[window];
    // Family flavor: BTC moves less, DOGE/SOL more.
    const familyMult = {
        BTC: 0.6,
        ETH: 0.9,
        SOL: 1.3,
        DOGE: 1.6,
        LINK: 1.0,
        UNI: 1.1,
        AVAX: 1.2,
        BNB: 0.8,
        MATIC: 1.0,
        XTZ: 0.9,
    };
    const mag = cfg.magnitude * familyMult[family];
    const percentChange = (rng.next() * 2 - 1) * mag * 2;
    const volatility = Math.min(1, Math.max(0, cfg.volatility * (0.6 + rng.next() * 0.8)));
    return normalizeMarketSignal(percentChange, volatility, family);
}
export function generateMockMarketSignals(window, seed) {
    const rng = createRng(seed);
    const out = {};
    for (const fam of ALL_COIN_FAMILIES) {
        out[fam] = generateOneSignal(fam, window, rng);
    }
    return out;
}
/**
 * Hardcoded fixture useful for tests and design tuning.
 */
export function getManualTestSignals() {
    const manual = {
        BTC: { percent: -0.4, volatility: 0.2 },
        ETH: { percent: 1.2, volatility: 0.3 },
        SOL: { percent: 3.8, volatility: 0.7 },
        DOGE: { percent: 6.5, volatility: 0.95 },
        LINK: { percent: 0.3, volatility: 0.25 },
        UNI: { percent: -1.1, volatility: 0.5 },
        AVAX: { percent: 2.1, volatility: 0.5 },
        BNB: { percent: 0.1, volatility: 0.2 },
        MATIC: { percent: -0.7, volatility: 0.4 },
        XTZ: { percent: 0.5, volatility: 0.3 },
    };
    const out = {};
    for (const fam of ALL_COIN_FAMILIES) {
        const { percent, volatility } = manual[fam];
        out[fam] = normalizeMarketSignal(percent, volatility, fam);
    }
    return out;
}
export function strongestFamily(signals) {
    let best = ALL_COIN_FAMILIES[0];
    let bestScore = -Infinity;
    for (const f of ALL_COIN_FAMILIES) {
        if (signals[f].momentumScore > bestScore) {
            bestScore = signals[f].momentumScore;
            best = f;
        }
    }
    return best;
}
