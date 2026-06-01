import { describe, it, expect } from "vitest";
import {
  FUNNEL_LADDER,
  tierById,
  unlockedTiers,
  isTierUnlocked,
  seededPot,
  rollCost,
  leagueHouseEdge,
  breakEvenEntrants,
  FREE_DAILY_ROLLS,
  PAID_ROLL_COST,
} from "./funnel";

describe("funnel ladder", () => {
  it("starts free and escalates in entry fee", () => {
    const fees = FUNNEL_LADDER.map((t) => t.entryFee);
    expect(fees[0]).toBe(0); // practice is free
    for (let i = 1; i < fees.length; i++) {
      expect(fees[i]).toBeGreaterThan(fees[i - 1]);
    }
  });

  it("gates higher tiers behind completed plays", () => {
    expect(isTierUnlocked("PRACTICE", 0)).toBe(true);
    expect(isTierUnlocked("MICRO", 0)).toBe(true);
    expect(isTierUnlocked("BRONZE", 0)).toBe(false);
    expect(isTierUnlocked("BRONZE", 2)).toBe(true);
    expect(isTierUnlocked("SILVER", 4)).toBe(false);
    expect(isTierUnlocked("SILVER", 5)).toBe(true);
  });

  it("unlockedTiers grows as the player plays more", () => {
    expect(unlockedTiers(0).map((t) => t.id)).toEqual(["PRACTICE", "MICRO"]);
    expect(unlockedTiers(5).map((t) => t.id)).toEqual([
      "PRACTICE",
      "MICRO",
      "BRONZE",
      "SILVER",
    ]);
  });
});

describe("house-seeded pots (cold start)", () => {
  it("tops a thin league up to the guaranteed floor (house subsidises)", () => {
    const tier = tierById("BRONZE"); // $10 fee, $60 guarantee
    const { pot, houseSeed } = seededPot({ tier, realEntrants: 2 });
    // 2 × $10 = $20 real, guaranteed $60 → house seeds $40
    expect(pot).toBe(60);
    expect(houseSeed).toBe(40);
  });

  it("stops subsidising once real buy-ins cover the guarantee", () => {
    const tier = tierById("BRONZE");
    const { pot, houseSeed } = seededPot({ tier, realEntrants: 8 });
    // 8 × $10 = $80 > $60 guarantee → no seed
    expect(pot).toBe(80);
    expect(houseSeed).toBe(0);
  });
});

describe("roll faucet/sink", () => {
  it("first daily roll is free, extras cost", () => {
    expect(rollCost(1, FREE_DAILY_ROLLS)).toBe(0);
    expect(rollCost(2, FREE_DAILY_ROLLS)).toBe(PAID_ROLL_COST);
    expect(rollCost(5, 0)).toBe(5 * PAID_ROLL_COST);
  });
});

describe("house economics", () => {
  it("house edge is negative while subsidising, positive once covered", () => {
    const tier = tierById("BRONZE");
    expect(leagueHouseEdge({ tier, realEntrants: 2 })).toBeLessThan(0); // CAC
    expect(leagueHouseEdge({ tier, realEntrants: 8 })).toBeGreaterThan(0); // profit
  });

  it("break-even entrant count is finite for paid tiers, infinite for free", () => {
    expect(breakEvenEntrants(tierById("PRACTICE"))).toBe(Infinity);
    const be = breakEvenEntrants(tierById("BRONZE"));
    expect(be).toBeGreaterThan(0);
    expect(Number.isFinite(be)).toBe(true);
    // At break-even the edge is non-negative; one fewer entrant is negative.
    expect(leagueHouseEdge({ tier: tierById("BRONZE"), realEntrants: be })).toBeGreaterThanOrEqual(0);
  });
});
