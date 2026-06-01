import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLiveMarketSignals, COINGECKO_IDS } from "./marketData";
import { ALL_COIN_FAMILIES } from "./types";
function rowFor(id, change24h) {
    return {
        id,
        current_price: 100,
        high_24h: 110,
        low_24h: 95,
        price_change_percentage_1h_in_currency: change24h / 8,
        price_change_percentage_24h_in_currency: change24h,
    };
}
afterEach(() => {
    vi.restoreAllMocks();
});
describe("marketData (live feed adapter)", () => {
    it("maps every CoinGecko row onto a signal for each family", async () => {
        const rows = ALL_COIN_FAMILIES.map((fam, i) => rowFor(COINGECKO_IDS[fam], i % 2 === 0 ? 5 : -5));
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => rows })));
        const { signals, source } = await fetchLiveMarketSignals("24h");
        expect(source).toBe("live");
        for (const fam of ALL_COIN_FAMILIES) {
            expect(signals[fam].family).toBe(fam);
            expect(signals[fam].momentumScore).toBeGreaterThanOrEqual(-1);
            expect(signals[fam].momentumScore).toBeLessThanOrEqual(1);
        }
    });
    it("reflects direction from the percent change", async () => {
        const rows = [
            rowFor(COINGECKO_IDS.BTC, 5),
            rowFor(COINGECKO_IDS.ETH, -5),
        ];
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => rows })));
        const { signals } = await fetchLiveMarketSignals("24h");
        expect(signals.BTC.direction).toBe("up");
        expect(signals.ETH.direction).toBe("down");
    });
    it("gives a neutral signal for a missing coin instead of crashing", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => [rowFor(COINGECKO_IDS.BTC, 5)],
        })));
        const { signals } = await fetchLiveMarketSignals("24h");
        expect(signals.SOL.percentChange).toBe(0);
        expect(signals.SOL.direction).toBe("flat");
    });
    it("throws on a non-ok response so the caller can fall back to mock", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
        await expect(fetchLiveMarketSignals("1h")).rejects.toThrow();
    });
});
