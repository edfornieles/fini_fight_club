import { describe, it, expect } from "vitest";
import { createRng } from "./rng";
/**
 * The RNG is the determinism backbone — every reproducible battle/league/roll
 * depends on it. These tests pin: same seed → same sequence, and the range/int
 * helpers stay in bounds.
 */
describe("createRng (seeded)", () => {
    it("same seed produces an identical sequence", () => {
        const a = createRng(12345);
        const b = createRng(12345);
        const seqA = Array.from({ length: 200 }, () => a.next());
        const seqB = Array.from({ length: 200 }, () => b.next());
        expect(seqA).toEqual(seqB);
    });
    it("different seeds diverge", () => {
        const a = createRng(1);
        const b = createRng(2);
        const seqA = Array.from({ length: 50 }, () => a.next());
        const seqB = Array.from({ length: 50 }, () => b.next());
        expect(seqA).not.toEqual(seqB);
    });
    it("next() stays in [0, 1)", () => {
        const r = createRng(7);
        for (let i = 0; i < 10000; i++) {
            const v = r.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
    it("int(min,max) is inclusive on both ends and never out of range", () => {
        const r = createRng(99);
        const seen = new Set();
        for (let i = 0; i < 20000; i++) {
            const v = r.int(1, 3);
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(3);
            seen.add(v);
        }
        // all of 1,2,3 should appear across 20k draws
        expect([...seen].sort()).toEqual([1, 2, 3]);
    });
    it("range(min,max) stays within [min,max)", () => {
        const r = createRng(3);
        for (let i = 0; i < 10000; i++) {
            const v = r.range(-5, 5);
            expect(v).toBeGreaterThanOrEqual(-5);
            expect(v).toBeLessThan(5);
        }
    });
    it("chance(0) is never true, chance(1) is always true", () => {
        const r = createRng(5);
        for (let i = 0; i < 1000; i++) {
            expect(r.chance(0)).toBe(false);
            expect(r.chance(1)).toBe(true);
        }
    });
    it("pick returns an element and is deterministic per seed", () => {
        const arr = ["a", "b", "c", "d"];
        const a = createRng(8);
        const b = createRng(8);
        const pa = Array.from({ length: 20 }, () => a.pick(arr));
        const pb = Array.from({ length: 20 }, () => b.pick(arr));
        expect(pa).toEqual(pb);
        for (const x of pa)
            expect(arr).toContain(x);
    });
    it("seed 0 does not degenerate (falls back to a valid stream)", () => {
        const r = createRng(0);
        const vals = Array.from({ length: 10 }, () => r.next());
        expect(new Set(vals).size).toBeGreaterThan(1); // not all identical
        for (const v of vals) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});
