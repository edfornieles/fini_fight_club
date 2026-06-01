import { describe, it, expect } from "vitest";
import { familyView, allFamilyViews, type TaxonomyDataset } from "./taxonomy";
import { ALL_COIN_FAMILIES } from "./types";

const DATASET: TaxonomyDataset = {
  source: "test",
  fetchedAt: "2026-05-30",
  scanned: 30,
  total: 30,
  families: {
    BTC: {
      count: 30,
      clans: { Soldiers: 10, Miners: 15, Royals: 5, "(none)": 2 },
      frequencies: { Hourly: 25, Monthly: 5 },
      specials: 3,
      mythicals: 1,
    },
  },
};

describe("familyView", () => {
  it("merges scan data with mechanics, sorts clans by population, drops (none)", () => {
    const v = familyView("BTC", DATASET);
    expect(v.info.archetype).toBe("Tank");
    expect(v.population).toBe(30);
    expect(v.specials).toBe(3);
    expect(v.mythicals).toBe(1);
    // sorted desc by count, "(none)" filtered out
    expect(v.clans.map((c) => c.clan)).toEqual(["Miners", "Soldiers", "Royals"]);
    expect(v.clans[0].count).toBe(15);
    // each clan carries a passive bucket + lean
    expect(v.clans[0].passive).toBeTruthy();
    expect(v.clans[0].statLean).toHaveProperty("strength");
  });

  it("falls back to mechanics-only when no dataset", () => {
    const v = familyView("SOL", null);
    expect(v.info.archetype).toBe("Speed");
    expect(v.population).toBeNull();
    expect(v.clans).toEqual([]);
    expect(v.info.beats).toBeTruthy();
    expect(v.info.losesTo).toBeTruthy();
  });

  it("a family missing from the dataset still returns mechanics", () => {
    const v = familyView("DOGE", DATASET); // not in fixture
    expect(v.population).toBeNull();
    expect(v.clans).toEqual([]);
    expect(v.info.family).toBe("DOGE");
  });
});

describe("allFamilyViews", () => {
  it("returns all 10 families in canonical order", () => {
    const views = allFamilyViews(DATASET);
    expect(views.map((v) => v.info.family)).toEqual(ALL_COIN_FAMILIES);
  });
});
