import { describe, it, expect } from "vitest";
import { runBattle } from "./battleEngine";
import { getManualTestSignals } from "./marketSignals";
function fini(id, family, passive, over = {}) {
    return {
        id,
        name: id,
        family,
        level: 1,
        xp: 0,
        strength: 6,
        maxHealth: 20,
        currentHealth: 20,
        speed: 5,
        defense: 3,
        volatilityAffinity: 0.4,
        cuteness: 0.3,
        passiveAbility: passive,
        ...over,
    };
}
function team(id) {
    return {
        id,
        playerId: id,
        name: id,
        finis: [
            fini(`${id}-1`, "BTC", "DIAMOND_BODY"),
            fini(`${id}-2`, "ETH", "COMPOUND"),
            fini(`${id}-3`, "LINK", "ORACLE"),
        ],
    };
}
function baseConfig(over = {}) {
    return {
        mode: "FREE",
        battleWindow: "1h",
        maxRounds: 30,
        marketInfluence: 0.65,
        statInfluence: 0.35,
        enablePassives: false, // isolate the read effect
        enableXP: false,
        seed: 12345,
        ...over,
    };
}
function totalDamageBy(team, result) {
    const ids = new Set(team.finis.map((f) => f.id));
    let sum = 0;
    for (const ev of result.events) {
        if (ev.type === "ATTACK" && ids.has(ev.attackerId))
            sum += ev.damage;
    }
    return sum;
}
describe("market read", () => {
    const signals = getManualTestSignals();
    // In the manual fixture DOGE is strongly positive (+6.5%, momentum well
    // above the 0.1 threshold) and BTC is slightly negative.
    it("emits a correct MARKET_READ event when the called family pumps", () => {
        const result = runBattle({
            teamA: team("A"),
            teamB: team("B"),
            marketSignals: signals,
            config: baseConfig({
                marketRead: { side: "teamA", predictedFamily: "DOGE" },
            }),
        });
        const read = result.events.find((e) => e.type === "MARKET_READ");
        expect(read).toBeDefined();
        expect(read && read.type === "MARKET_READ" && read.correct).toBe(true);
    });
    it("emits an incorrect MARKET_READ event when the called family is flat/down", () => {
        const result = runBattle({
            teamA: team("A"),
            teamB: team("B"),
            marketSignals: signals,
            config: baseConfig({
                marketRead: { side: "teamA", predictedFamily: "BTC" },
            }),
        });
        const read = result.events.find((e) => e.type === "MARKET_READ");
        expect(read && read.type === "MARKET_READ" && read.correct).toBe(false);
    });
    it("a correct read increases the calling team's damage output", () => {
        const without = runBattle({
            teamA: team("A"),
            teamB: team("B"),
            marketSignals: signals,
            config: baseConfig(),
        });
        const withRead = runBattle({
            teamA: team("A"),
            teamB: team("B"),
            marketSignals: signals,
            config: baseConfig({
                marketRead: { side: "teamA", predictedFamily: "DOGE" },
            }),
        });
        expect(totalDamageBy(team("A"), withRead)).toBeGreaterThan(totalDamageBy(team("A"), without));
    });
    it("a wrong read grants no damage bonus", () => {
        const without = runBattle({
            teamA: team("A"),
            teamB: team("B"),
            marketSignals: signals,
            config: baseConfig(),
        });
        const wrongRead = runBattle({
            teamA: team("A"),
            teamB: team("B"),
            marketSignals: signals,
            config: baseConfig({
                marketRead: { side: "teamA", predictedFamily: "BTC" },
            }),
        });
        expect(totalDamageBy(team("A"), wrongRead)).toBe(totalDamageBy(team("A"), without));
    });
});
