import { describe, it, expect } from "vitest";
import {
  applyRegimeToSignals,
  computeMockDailyRegime,
  regimeFromSignals,
  todayKey,
} from "./dailyRegime";
import { generateMockMarketSignals, getManualTestSignals } from "./marketSignals";
import { ALL_COIN_FAMILIES } from "./types";

describe("dailyRegime", () => {
  it("is deterministic per date key", () => {
    const a = computeMockDailyRegime("2026-05-30");
    const b = computeMockDailyRegime("2026-05-30");
    expect(a.hotFamily).toBe(b.hotFamily);
    expect(a.coldFamily).toBe(b.coldFamily);
    expect(a.bias).toEqual(b.bias);
  });

  it("produces different weather on different days (usually)", () => {
    const keys = ["2026-01-01", "2026-06-15", "2026-12-31", "2026-03-03"];
    const hots = new Set(keys.map((k) => computeMockDailyRegime(k).hotFamily));
    // At least two distinct hot families across four days.
    expect(hots.size).toBeGreaterThan(1);
  });

  it("derives hot family as the strongest momentum in a snapshot", () => {
    const signals = getManualTestSignals();
    const regime = regimeFromSignals(signals, "2026-05-30", "mock");
    // DOGE is the strongest mover in the manual fixture (+6.5%).
    expect(regime.hotFamily).toBe("DOGE");
  });

  it("nudges momentum toward the regime bias", () => {
    const regime = regimeFromSignals(
      getManualTestSignals(),
      todayKey(),
      "mock",
    );
    const base = generateMockMarketSignals("1h", 42);
    const blended = applyRegimeToSignals(base, regime, 1); // full weight
    // With full weight, blended momentum should equal the regime bias.
    for (const fam of ALL_COIN_FAMILIES) {
      expect(blended[fam].momentumScore).toBeCloseTo(regime.bias[fam], 1);
    }
  });

  it("does not mutate the input signal map", () => {
    const base = generateMockMarketSignals("1h", 7);
    const before = base.BTC.momentumScore;
    const regime = computeMockDailyRegime("2026-05-30");
    applyRegimeToSignals(base, regime, 0.5);
    expect(base.BTC.momentumScore).toBe(before);
  });
});
