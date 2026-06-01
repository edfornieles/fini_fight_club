import { describe, it, expect } from "vitest";
import { traitsToStats, familyMatchup, familyMatchupWithPerks, validateTeamSpecials, countSpecialFinis, SPECIAL_PERKS, } from "./attributes";
import { ALL_COIN_FAMILIES } from "./types";
// ─── fixtures ──────────────────────────────────────────────────────────────
const BASE_TRAITS = {
    tokenId: 1,
    family: "ETH",
    frequency: "Hourly",
    clan: "Blades",
    latestDelta: 0,
};
// ─── determinism ───────────────────────────────────────────────────────────
describe("traitsToStats determinism", () => {
    it("returns identical stats on repeated calls", () => {
        const a = traitsToStats(BASE_TRAITS);
        const b = traitsToStats(BASE_TRAITS);
        expect(a).toEqual(b);
    });
    it("tokenId jitter: two tokens same clan differ by at most 1 on one stat", () => {
        const t1 = traitsToStats({ ...BASE_TRAITS, tokenId: 1 });
        const t2 = traitsToStats({ ...BASE_TRAITS, tokenId: 2 });
        const diffs = [
            Math.abs(t1.strength - t2.strength),
            Math.abs(t1.maxHealth - t2.maxHealth),
            Math.abs(t1.speed - t2.speed),
            Math.abs(t1.defense - t2.defense),
        ];
        const total = diffs.reduce((a, b) => a + b, 0);
        // At most one stat differs by 1.
        expect(total).toBeLessThanOrEqual(1);
    });
    it("same tokenId different clan → different stats or passive", () => {
        const a = traitsToStats({ ...BASE_TRAITS, clan: "Stickies" });
        const b = traitsToStats({ ...BASE_TRAITS, clan: "Migs" });
        // At least something must differ between two different clans
        const same = a.strength === b.strength &&
            a.maxHealth === b.maxHealth &&
            a.speed === b.speed &&
            a.defense === b.defense &&
            a.passiveAbility === b.passiveAbility;
        expect(same).toBe(false);
    });
});
// ─── rarity budget ─────────────────────────────────────────────────────────
describe("frequency rarity budget", () => {
    const frequencies = ["Hourly", "Daily", "Twice-Daily", "Weekly", "Monthly"];
    it("higher rarity → higher aggregate stat total", () => {
        const totals = frequencies.map(freq => {
            const s = traitsToStats({ ...BASE_TRAITS, frequency: freq });
            return s.strength + s.maxHealth + s.speed + s.defense;
        });
        for (let i = 0; i < totals.length - 1; i++) {
            expect(totals[i + 1]).toBeGreaterThanOrEqual(totals[i]);
        }
    });
    it("Monthly total is at most 40% more than Hourly total", () => {
        const hourly = traitsToStats({ ...BASE_TRAITS, frequency: "Hourly" });
        const monthly = traitsToStats({ ...BASE_TRAITS, frequency: "Monthly" });
        const hTotal = hourly.strength + hourly.maxHealth + hourly.speed + hourly.defense;
        const mTotal = monthly.strength + monthly.maxHealth + monthly.speed + monthly.defense;
        expect(mTotal / hTotal).toBeLessThanOrEqual(1.40);
    });
    it("no stat is ever below 1 at any rarity", () => {
        for (const freq of frequencies) {
            for (const family of ALL_COIN_FAMILIES) {
                const s = traitsToStats({ ...BASE_TRAITS, family, frequency: freq });
                expect(s.strength).toBeGreaterThanOrEqual(1);
                expect(s.maxHealth).toBeGreaterThanOrEqual(4);
                expect(s.speed).toBeGreaterThanOrEqual(1);
                expect(s.defense).toBeGreaterThanOrEqual(1);
            }
        }
    });
});
// ─── special perks ─────────────────────────────────────────────────────────
describe("special perk resolution", () => {
    it("known special name resolves to correct perk", () => {
        const s = traitsToStats({ ...BASE_TRAITS, special: "Diamond Hands" });
        expect(s.specialPerk).toBe("DIAMOND_HANDS");
    });
    it("unknown special name hashes to a valid perk ID", () => {
        const s = traitsToStats({ ...BASE_TRAITS, special: "Some Unknown Trait XYZ" });
        expect(s.specialPerk).toBeDefined();
        expect(SPECIAL_PERKS[s.specialPerk]).toBeDefined();
    });
    it("special perk stat mods are applied", () => {
        const without = traitsToStats({ ...BASE_TRAITS });
        const with_ = traitsToStats({ ...BASE_TRAITS, special: "Genesis Mint" });
        // GENESIS_MINT: +2 to all stats
        expect(with_.strength).toBe(without.strength + 2);
        expect(with_.maxHealth).toBe(without.maxHealth + 2);
        expect(with_.speed).toBe(without.speed + 2);
        expect(with_.defense).toBe(without.defense + 2);
    });
    it("no special → no specialPerk field", () => {
        const s = traitsToStats({ ...BASE_TRAITS });
        expect(s.specialPerk).toBeUndefined();
    });
});
// ─── mythical perks ─────────────────────────────────────────────────────────
describe("mythical perk resolution", () => {
    it("known mythical name resolves correctly", () => {
        const s = traitsToStats({ ...BASE_TRAITS, mythical: "Genesis Block" });
        expect(s.mythicalPerk).toBe("GENESIS_BLOCK");
    });
    it("mythical stat mods are applied on top of special if both present", () => {
        const base = traitsToStats({ ...BASE_TRAITS });
        const withBoth = traitsToStats({
            ...BASE_TRAITS,
            special: "Diamond Hands", // +3 def
            mythical: "Genesis Block", // +5 hp, +2 def
        });
        expect(withBoth.defense).toBe(base.defense + 3 + 2);
        expect(withBoth.maxHealth).toBe(base.maxHealth + 5);
    });
});
// ─── team special validation ────────────────────────────────────────────────
describe("team special validation", () => {
    const plain = { specialPerk: undefined, mythicalPerk: undefined };
    const withSpecial = { specialPerk: "DIAMOND_HANDS", mythicalPerk: undefined };
    const withMythical = { specialPerk: undefined, mythicalPerk: "GENESIS_BLOCK" };
    it("zero specials on team: valid", () => {
        expect(validateTeamSpecials([plain, plain, plain])).toBe(true);
    });
    it("one special on team: valid", () => {
        expect(validateTeamSpecials([plain, withSpecial, plain])).toBe(true);
    });
    it("two specials on team: invalid", () => {
        expect(validateTeamSpecials([withSpecial, withSpecial, plain])).toBe(false);
    });
    it("one special + one mythical: invalid", () => {
        expect(validateTeamSpecials([withSpecial, withMythical, plain])).toBe(false);
    });
    it("count helper returns correct number", () => {
        expect(countSpecialFinis([plain, withSpecial, withMythical])).toBe(2);
    });
});
// ─── family counter-triangle ────────────────────────────────────────────────
describe("familyMatchup counter-triangle", () => {
    it("neutral matchup returns 1.00", () => {
        // BTC vs ETH are adjacent (ETH beats BTC), but BTC vs SOL should be neutral
        expect(familyMatchup("BTC", "SOL")).toBe(1.00);
        expect(familyMatchup("ETH", "DOGE")).toBe(1.00);
    });
    it("counter advantage returns 1.10", () => {
        // BTC beats XTZ in cycle
        expect(familyMatchup("BTC", "XTZ")).toBe(1.10);
        // ETH beats BTC
        expect(familyMatchup("ETH", "BTC")).toBe(1.10);
    });
    it("counter disadvantage returns 0.90", () => {
        // XTZ beats BTC means BTC attacking XTZ is 1.10, but XTZ attacking BTC's nemesis
        // BTC loses to ETH
        expect(familyMatchup("BTC", "ETH")).toBe(0.90);
    });
    it("cycle is consistent: if A beats B, then B loses to A", () => {
        for (const a of ALL_COIN_FAMILIES) {
            for (const b of ALL_COIN_FAMILIES) {
                if (a === b)
                    continue;
                const ab = familyMatchup(a, b);
                const ba = familyMatchup(b, a);
                if (ab === 1.10)
                    expect(ba).toBe(0.90);
                if (ab === 0.90)
                    expect(ba).toBe(1.10);
                if (ab === 1.00)
                    expect(ba).toBe(1.00);
            }
        }
    });
    it("self-matchup is always neutral", () => {
        for (const f of ALL_COIN_FAMILIES) {
            expect(familyMatchup(f, f)).toBe(1.00);
        }
    });
    it("BRIDGE_BONUS upgrades advantage to 1.20", () => {
        // ETH beats BTC with BRIDGE_BONUS
        expect(familyMatchupWithPerks("ETH", "BRIDGE_BONUS", "BTC")).toBe(1.20);
        // Neutral matchup unchanged
        expect(familyMatchupWithPerks("BTC", "BRIDGE_BONUS", "SOL")).toBe(1.00);
        // Disadvantage unchanged
        expect(familyMatchupWithPerks("BTC", "BRIDGE_BONUS", "ETH")).toBe(0.90);
    });
});
// ─── family fairness (neutral-market mirror matchup) ────────────────────────
describe("family fairness", () => {
    it("every family has exactly one soft counter in the cycle", () => {
        // The counter cycle guarantees every family is countered by exactly one other.
        // This is the structural fairness guarantee — no family has zero natural counters.
        for (const family of ALL_COIN_FAMILIES) {
            const counters = ALL_COIN_FAMILIES.filter(opp => opp !== family && familyMatchup(opp, family) === 1.10);
            expect(counters).toHaveLength(1);
        }
    });
    it("volatility affinity is well-spread (DOGE/SOL high, BTC/XTZ low)", () => {
        // Volatile markets wildly favour high-volAff families; stable markets favour
        // low-volAff tanks. This spread ensures different families shine in different
        // conditions — the market-based fairness layer.
        const affinities = ALL_COIN_FAMILIES.map(f => traitsToStats({ tokenId: 1, family: f, frequency: "Hourly", clan: "Stickies", latestDelta: 0 })
            .volatilityAffinity);
        const range = Math.max(...affinities) - Math.min(...affinities);
        // Spread must be at least 0.5 so market conditions create real winner variance.
        expect(range).toBeGreaterThanOrEqual(0.5);
    });
    it("stat archetypes are distinct: tank (BTC) vs glass cannon (SOL)", () => {
        const btc = traitsToStats({ tokenId: 1, family: "BTC", frequency: "Hourly", clan: "Stickies", latestDelta: 0 });
        const sol = traitsToStats({ tokenId: 2, family: "SOL", frequency: "Hourly", clan: "Stickies", latestDelta: 0 });
        // BTC must have meaningfully more HP and defense.
        expect(btc.maxHealth).toBeGreaterThan(sol.maxHealth);
        expect(btc.defense).toBeGreaterThan(sol.defense);
        // SOL must have meaningfully more speed.
        expect(sol.speed).toBeGreaterThan(btc.speed);
    });
});
