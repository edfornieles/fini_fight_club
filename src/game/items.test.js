import { describe, expect, it } from "vitest";
import { applyItemToFini, describeItemDelta, ITEM_CATALOG } from "./items";
import { mockFinis } from "./mockTeams";
describe("items", () => {
    it("applies stat bonuses without mutating original fini", () => {
        const base = mockFinis[0];
        const sword = ITEM_CATALOG.find((i) => i.id === "warriors-sword");
        const buffed = applyItemToFini(base, sword);
        expect(buffed.strength).toBe(base.strength + 8);
        expect(base.strength).not.toBe(buffed.strength); // base unchanged
    });
    it("null item is a no-op clone", () => {
        const base = mockFinis[0];
        const out = applyItemToFini(base, null);
        expect(out.strength).toBe(base.strength);
        expect(out).not.toBe(base);
    });
    it("describeItemDelta produces human-readable deltas", () => {
        const sword = ITEM_CATALOG.find((i) => i.id === "warriors-sword");
        const lines = describeItemDelta(sword);
        expect(lines.some((l) => l.includes("+8 ATK"))).toBe(true);
    });
    it("max-health item heals current health to full", () => {
        const base = { ...mockFinis[0], currentHealth: 1, maxHealth: 18 };
        const flask = ITEM_CATALOG.find((i) => i.id === "liquidity-flask");
        const buffed = applyItemToFini(base, flask);
        expect(buffed.maxHealth).toBe(28);
        expect(buffed.currentHealth).toBe(28);
    });
});
