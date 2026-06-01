import { describe, expect, it } from "vitest";
import { rollShop } from "./shop";
import { createRng } from "./rng";
import { SHOP_ITEM_SLOTS, SHOP_UNIT_SLOTS } from "./runConstants";

describe("shop", () => {
  it("rolls the right number of units and items", () => {
    const shop = rollShop({ rng: createRng(1), stage: 1 });
    expect(shop.units).toHaveLength(SHOP_UNIT_SLOTS);
    expect(shop.items).toHaveLength(SHOP_ITEM_SLOTS);
    expect(shop.locked).toBe(false);
  });

  it("unit stats scale with stage", () => {
    const s1 = rollShop({ rng: createRng(7), stage: 1 });
    const s3 = rollShop({ rng: createRng(7), stage: 3 });
    const sum = (units: typeof s1.units) =>
      units.reduce((s, u) => s + u.strength + u.maxHealth + u.defense, 0);
    expect(sum(s3.units)).toBeGreaterThan(sum(s1.units));
  });

  it("shop units have valid families and passives", () => {
    const shop = rollShop({ rng: createRng(3), stage: 2 });
    for (const u of shop.units) {
      expect(typeof u.family).toBe("string");
      expect(typeof u.passiveAbility).toBe("string");
      expect(u.maxHealth).toBeGreaterThan(0);
      expect(u.currentHealth).toBe(u.maxHealth);
    }
  });
});
