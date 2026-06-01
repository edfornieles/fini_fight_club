import { describe, expect, it } from "vitest";
import { generateMockMarketSignals, getManualTestSignals, normalizeMarketSignal, } from "./marketSignals";
import { ALL_COIN_FAMILIES } from "./types";
describe("market signals", () => {
    it("covers all coin families", () => {
        const map = generateMockMarketSignals("1h", 1);
        for (const fam of ALL_COIN_FAMILIES) {
            expect(map[fam]).toBeDefined();
            expect(map[fam].family).toBe(fam);
        }
    });
    it("manual test signals are deterministic", () => {
        const a = getManualTestSignals();
        const b = getManualTestSignals();
        for (const fam of ALL_COIN_FAMILIES) {
            expect(a[fam].percentChange).toBe(b[fam].percentChange);
            expect(a[fam].momentumScore).toBe(b[fam].momentumScore);
        }
    });
    it("normalizeMarketSignal clamps momentum to [-1, 1]", () => {
        expect(normalizeMarketSignal(1000, 0.5).momentumScore).toBeLessThanOrEqual(1);
        expect(normalizeMarketSignal(-1000, 0.5).momentumScore).toBeGreaterThanOrEqual(-1);
    });
    it("direction reflects sign", () => {
        expect(normalizeMarketSignal(5, 0.3).direction).toBe("up");
        expect(normalizeMarketSignal(-5, 0.3).direction).toBe("down");
        expect(normalizeMarketSignal(0, 0.3).direction).toBe("flat");
    });
});
