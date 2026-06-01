import { describe, expect, it } from "vitest";
import { generateEncounterOptions } from "./encounters";
import { createRng } from "./rng";
describe("encounter generator", () => {
    it("always returns 3 options", () => {
        for (let seed = 1; seed < 20; seed++) {
            const opts = generateEncounterOptions({
                stage: 1,
                stageProgress: 0,
                encountersPerStage: 3,
                finalStage: 3,
                rng: createRng(seed),
            });
            expect(opts).toHaveLength(3);
        }
    });
    it("always includes at least one FIGHT (or BOSS_FIGHT) option", () => {
        for (let seed = 1; seed < 30; seed++) {
            const opts = generateEncounterOptions({
                stage: 2,
                stageProgress: 1,
                encountersPerStage: 3,
                finalStage: 3,
                rng: createRng(seed),
            });
            const hasFight = opts.some((o) => o.type === "FIGHT" || o.type === "BOSS_FIGHT");
            expect(hasFight).toBe(true);
        }
    });
    it("final encounter of final stage is a boss fight", () => {
        const opts = generateEncounterOptions({
            stage: 3,
            stageProgress: 2,
            encountersPerStage: 3,
            finalStage: 3,
            rng: createRng(42),
        });
        expect(opts.some((o) => o.type === "BOSS_FIGHT")).toBe(true);
    });
    it("never offers DEATH_MATCH on stage 1", () => {
        for (let seed = 1; seed < 50; seed++) {
            const opts = generateEncounterOptions({
                stage: 1,
                stageProgress: 0,
                encountersPerStage: 3,
                finalStage: 3,
                rng: createRng(seed),
            });
            expect(opts.some((o) => o.type === "DEATH_MATCH")).toBe(false);
        }
    });
});
