import { describe, it, expect } from "vitest";
import { MockOwnershipLedger, getOwnedFinis } from "./ownership";
/**
 * The ownership ledger is Death Mode's transfer state machine. When real
 * stakes go live this becomes on-chain ownership, so the invariant that
 * matters is: a Fini is only ever transferred by its current owner, and never
 * forks or duplicates.
 */
describe("MockOwnershipLedger", () => {
    it("sets and reads an owner", () => {
        const l = new MockOwnershipLedger();
        l.setOwner("fini1", "alice");
        expect(l.getOwner("fini1")).toBe("alice");
        expect(l.getOwner("unknown")).toBeUndefined();
    });
    it("transfer succeeds only from the current owner", () => {
        const l = new MockOwnershipLedger();
        l.setOwner("fini1", "alice");
        // wrong `from` is rejected, no mutation
        expect(l.transfer("fini1", "bob", "carol")).toBe(false);
        expect(l.getOwner("fini1")).toBe("alice");
        // correct `from` succeeds
        expect(l.transfer("fini1", "alice", "bob")).toBe(true);
        expect(l.getOwner("fini1")).toBe("bob");
    });
    it("a transferred Fini cannot be re-transferred by the old owner (no double-spend)", () => {
        const l = new MockOwnershipLedger();
        l.setOwner("fini1", "alice");
        expect(l.transfer("fini1", "alice", "bob")).toBe(true);
        // alice no longer owns it
        expect(l.transfer("fini1", "alice", "carol")).toBe(false);
        expect(l.getOwner("fini1")).toBe("bob");
    });
    it("transfer of an unknown Fini fails", () => {
        const l = new MockOwnershipLedger();
        expect(l.transfer("ghost", "alice", "bob")).toBe(false);
        expect(l.getOwner("ghost")).toBeUndefined();
    });
    it("a chain of transfers leaves exactly one owner (no forking)", () => {
        const l = new MockOwnershipLedger();
        l.setOwner("fini1", "a");
        expect(l.transfer("fini1", "a", "b")).toBe(true);
        expect(l.transfer("fini1", "b", "c")).toBe(true);
        expect(l.transfer("fini1", "c", "d")).toBe(true);
        const snap = l.snapshot();
        expect(snap.fini1).toBe("d");
        // exactly one entry for the token
        expect(Object.keys(snap).filter((k) => k === "fini1")).toHaveLength(1);
    });
    it("snapshot reflects all owned tokens", () => {
        const l = new MockOwnershipLedger();
        l.setOwner("a", "x");
        l.setOwner("b", "y");
        expect(l.snapshot()).toEqual({ a: "x", b: "y" });
    });
});
describe("getOwnedFinis (mock)", () => {
    it("tags returned Finis with the queried wallet", async () => {
        const finis = await getOwnedFinis("0xWALLET");
        expect(finis.length).toBeGreaterThan(0);
        for (const f of finis)
            expect(f.ownerAddress).toBe("0xWALLET");
    });
});
