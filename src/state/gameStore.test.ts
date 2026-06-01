import { describe, it, expect } from "vitest";
import { useGameStore } from "./gameStore";
import { ALL_COIN_FAMILIES } from "../game/types";

/**
 * Smoke test for the main game store.
 *
 * Intentionally minimal and refactor-resilient: it asserts the store boots
 * with sane defaults and a valid market, which catches initialisation crashes
 * (the store wires together many modules). Deep behavioural coverage should be
 * added per-slice after gameStore is split (marketStore / ownershipStore /
 * pvpStore) — see WORKSTREAM_COORDINATION.md.
 */

describe("gameStore — boot invariants", () => {
  it("initialises without throwing and exposes a getter API", () => {
    const s = useGameStore.getState();
    expect(s).toBeTruthy();
    expect(typeof useGameStore.getState).toBe("function");
  });

  it("starts at the title screen, not mid-run", () => {
    const s = useGameStore.getState();
    expect(s.phase).toBe("title");
    expect(s.isRanked).toBe(false);
  });

  it("boots with a complete, valid market (all 10 families present)", () => {
    const { marketSignals } = useGameStore.getState();
    for (const fam of ALL_COIN_FAMILIES) {
      const sig = marketSignals[fam];
      expect(sig).toBeDefined();
      expect(sig.family).toBe(fam);
      expect(Number.isFinite(sig.momentumScore)).toBe(true);
      expect(sig.momentumScore).toBeGreaterThanOrEqual(-1);
      expect(sig.momentumScore).toBeLessThanOrEqual(1);
    }
  });
});
