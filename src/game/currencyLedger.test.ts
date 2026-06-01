import { describe, it, expect } from "vitest";
import { MockCurrencyLedger } from "./currencyLedger";

/**
 * Money-safety tests for the mock escrow ledger. The whole league economy
 * settles through this, so the invariant that matters most is conservation:
 * money is never created or destroyed, only moved between players, escrows,
 * and the house.
 */

/** Total money in the system = all player balances + all escrows + house. */
function totalInSystem(
  ledger: MockCurrencyLedger,
  players: string[],
  escrows: string[],
): number {
  const bal = players.reduce((a, p) => a + ledger.getBalance(p), 0);
  const esc = escrows.reduce((a, e) => a + ledger.escrowBalance(e), 0);
  return bal + esc + ledger.getHouseTotal();
}

describe("MockCurrencyLedger — basics", () => {
  it("credits and debits", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 100);
    expect(l.getBalance("a")).toBe(100);
    expect(l.debit("a", 30)).toBe(true);
    expect(l.getBalance("a")).toBe(70);
  });

  it("rejects an over-debit with NO mutation", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 10);
    expect(l.debit("a", 25)).toBe(false);
    expect(l.getBalance("a")).toBe(10); // unchanged
  });

  it("unknown account reads as 0", () => {
    const l = new MockCurrencyLedger();
    expect(l.getBalance("nobody")).toBe(0);
    expect(l.escrowBalance("none")).toBe(0);
  });
});

describe("MockCurrencyLedger — escrow", () => {
  it("escrowDeposit moves funds out of balance into the pot", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 100);
    expect(l.escrowDeposit("pot", "a", 40)).toBe(true);
    expect(l.getBalance("a")).toBe(60);
    expect(l.escrowBalance("pot")).toBe(40);
  });

  it("escrowDeposit fails (no mutation) when the player can't cover it", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 10);
    expect(l.escrowDeposit("pot", "a", 50)).toBe(false);
    expect(l.getBalance("a")).toBe(10);
    expect(l.escrowBalance("pot")).toBe(0);
  });

  it("payout cannot exceed the pot", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 30);
    l.escrowDeposit("pot", "a", 30);
    expect(() => l.payout("pot", "b", 31)).toThrow();
  });

  it("houseCollect cannot exceed the pot", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 30);
    l.escrowDeposit("pot", "a", 30);
    expect(() => l.houseCollect("pot", 31)).toThrow();
  });

  it("escrowRefund returns the whole pot to one player", () => {
    const l = new MockCurrencyLedger();
    l.credit("a", 50);
    l.escrowDeposit("pot", "a", 50);
    expect(l.escrowRefund("pot", "a")).toBe(50);
    expect(l.getBalance("a")).toBe(50);
    expect(l.escrowBalance("pot")).toBe(0);
  });
});

describe("MockCurrencyLedger — conservation invariant", () => {
  it("a full deposit → payout → house-sweep conserves money exactly", () => {
    const l = new MockCurrencyLedger();
    const players = ["p1", "p2", "p3", "p4"];
    for (const p of players) l.credit(p, 100);
    const before = totalInSystem(l, players, ["pot"]); // 400

    // everyone antes 25 into the pot
    for (const p of players) expect(l.escrowDeposit("pot", p, 25)).toBe(true);
    expect(l.escrowBalance("pot")).toBe(100);

    // pay winners, sweep the rest to house (the leagues.ts settle pattern)
    l.payout("pot", "p1", 60);
    l.payout("pot", "p2", 30);
    l.houseCollect("pot", l.escrowBalance("pot")); // remaining 10

    const after = totalInSystem(l, players, ["pot"]);
    expect(after).toBe(before); // nothing created or destroyed
    expect(l.escrowBalance("pot")).toBe(0); // pot fully drained
    expect(l.getHouseTotal()).toBe(10);
  });

  it("randomised deposits/payouts never create or destroy money", () => {
    const l = new MockCurrencyLedger();
    const players = ["a", "b", "c"];
    for (const p of players) l.credit(p, 1000);
    const start = totalInSystem(l, players, ["e1", "e2"]);

    // deterministic pseudo-sequence of moves
    const seq = [3, 7, 11, 2, 19, 5, 13, 1, 17];
    let i = 0;
    for (const amt of seq) {
      const p = players[i % players.length];
      const e = i % 2 === 0 ? "e1" : "e2";
      if (l.getBalance(p) >= amt) l.escrowDeposit(e, p, amt);
      // pay some back to a different player + sweep a bit to house
      if (l.escrowBalance(e) >= 2) l.payout(e, players[(i + 1) % players.length], 1);
      if (l.escrowBalance(e) >= 1) l.houseCollect(e, 1);
      i++;
    }
    expect(totalInSystem(l, players, ["e1", "e2"])).toBe(start);
  });
});
