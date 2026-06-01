import { describe, it, expect, beforeEach } from "vitest";
import {
  createLeague,
  joinLeague,
  runLeague,
  settleLeague,
  cancelLeague,
  computePrizeBreakdown,
  TIER_BUYINS,
  escrowIdFor,
  type League,
  type LeagueEntry,
} from "./leagues";
import { MockCurrencyLedger } from "./currencyLedger";
import { makeSeedSnapshots } from "./pvp";
import { createRng } from "./rng";

// ─── fixtures ──────────────────────────────────────────────────────────────

function makeEntries(n: number): LeagueEntry[] {
  const snaps = makeSeedSnapshots(createRng(42));
  return snaps.slice(0, n).map((snapshot, i) => ({
    playerId: `player-${i}`,
    snapshot: { ...snapshot, id: `snap-${i}`, name: `Team ${i}` },
  }));
}

function fundedLedger(playerIds: string[], amount: number): MockCurrencyLedger {
  const ledger = new MockCurrencyLedger();
  for (const id of playerIds) ledger.credit(id, amount);
  return ledger;
}

// ─── prize math ──────────────────────────────────────────────────────────

describe("computePrizeBreakdown", () => {
  it("splits 10% house, 65/35 of the rest by default", () => {
    // 8 entrants × 50 buy-in = 400 pool
    const b = computePrizeBreakdown(400);
    expect(b.pool).toBe(400);
    // house base = floor(400*0.10) = 40
    // distributable = 360; first = floor(360*0.65)=234; second=floor(360*0.35)=126
    // dust = 360-234-126 = 0
    expect(b.firstPrize).toBe(234);
    expect(b.secondPrize).toBe(126);
    expect(b.houseCut).toBe(40);
  });

  it("conserves the entire pool (house gets the dust)", () => {
    for (const pool of [1, 7, 13, 99, 401, 1234, 99999]) {
      const b = computePrizeBreakdown(pool);
      expect(b.houseCut + b.firstPrize + b.secondPrize).toBe(pool);
    }
  });

  it("first prize is always >= second prize", () => {
    for (const pool of [10, 100, 1000, 7777]) {
      const b = computePrizeBreakdown(pool);
      expect(b.firstPrize).toBeGreaterThanOrEqual(b.secondPrize);
    }
  });
});

// ─── join flow ───────────────────────────────────────────────────────────

describe("joinLeague", () => {
  let league: League;
  let ledger: MockCurrencyLedger;

  beforeEach(() => {
    league = createLeague({ id: "L1", tier: "SILVER" });
    ledger = fundedLedger(["player-0", "player-1", "player-2"], 1000);
  });

  it("escrows the buy-in and adds the entry", () => {
    const [e0] = makeEntries(1);
    e0.playerId = "player-0";
    const res = joinLeague({ league, entry: e0, ledger });
    expect(res.ok).toBe(true);
    expect(league.entries).toHaveLength(1);
    expect(ledger.getBalance("player-0")).toBe(1000 - TIER_BUYINS.SILVER);
    expect(ledger.escrowBalance(escrowIdFor(league))).toBe(TIER_BUYINS.SILVER);
  });

  it("rejects insufficient funds with no mutation", () => {
    const poor = new MockCurrencyLedger();
    poor.credit("player-0", 5); // SILVER costs 50
    const [e0] = makeEntries(1);
    e0.playerId = "player-0";
    const res = joinLeague({ league, entry: e0, ledger: poor });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("INSUFFICIENT_FUNDS");
    expect(league.entries).toHaveLength(0);
    expect(poor.getBalance("player-0")).toBe(5);
  });

  it("rejects double-join by the same player", () => {
    const entries = makeEntries(2);
    entries[0].playerId = "player-0";
    entries[1].playerId = "player-0"; // same player again
    expect(joinLeague({ league, entry: entries[0], ledger }).ok).toBe(true);
    const res = joinLeague({ league, entry: entries[1], ledger });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("ALREADY_JOINED");
  });

  it("rejects when full", () => {
    const small = createLeague({ id: "L2", tier: "BRONZE", maxEntrants: 1 });
    const entries = makeEntries(2);
    entries[0].playerId = "player-0";
    entries[1].playerId = "player-1";
    expect(joinLeague({ league: small, entry: entries[0], ledger }).ok).toBe(true);
    const res = joinLeague({ league: small, entry: entries[1], ledger });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("FULL");
  });
});

// ─── full lifecycle ──────────────────────────────────────────────────────

describe("league lifecycle: run + settle", () => {
  function setup(n: number) {
    const league = createLeague({ id: "season-1", tier: "GOLD", maxEntrants: n, seed: 7 });
    const entries = makeEntries(n);
    const ids = entries.map((e) => e.playerId);
    const ledger = fundedLedger(ids, 5000);
    for (const e of entries) {
      const r = joinLeague({ league, entry: e, ledger });
      expect(r.ok).toBe(true);
    }
    return { league, entries, ledger, ids };
  }

  it("runs a full round-robin and ranks everyone uniquely", () => {
    const { league } = setup(6);
    const result = runLeague(league);
    expect(league.status).toBe("RUNNING");
    // 6 entrants → C(6,2) = 15 matches
    expect(result.matches).toHaveLength(15);
    expect(result.standings).toHaveLength(6);
    // ranks are 1..6, unique
    const ranks = result.standings.map((s) => s.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
    // total wins across the table equals total matches
    const totalWins = result.standings.reduce((a, s) => a + s.wins, 0);
    expect(totalWins).toBe(15);
  });

  it("is deterministic: same seed → identical standings", () => {
    const a = runLeague(setup(5).league);
    const b = runLeague(setup(5).league);
    expect(a.standings.map((s) => s.playerId)).toEqual(b.standings.map((s) => s.playerId));
    expect(a.standings.map((s) => s.wins)).toEqual(b.standings.map((s) => s.wins));
  });

  it("settles: 1st and 2nd are paid, house collects the rest, pot empties", () => {
    const { league, ledger, ids } = setup(8);
    const buyIn = league.config.buyIn;
    const pool = buyIn * 8;
    const before = ids.map((id) => ledger.getBalance(id));

    const result = runLeague(league);
    settleLeague({ league, result, ledger });
    expect(league.status).toBe("SETTLED");

    const firstId = result.standings[0].playerId;
    const secondId = result.standings[1].playerId;
    const breakdown = computePrizeBreakdown(pool);

    // winners' balances went up by exactly their prize
    const firstIdx = ids.indexOf(firstId);
    const secondIdx = ids.indexOf(secondId);
    expect(ledger.getBalance(firstId)).toBe(before[firstIdx] + breakdown.firstPrize);
    expect(ledger.getBalance(secondId)).toBe(before[secondIdx] + breakdown.secondPrize);

    // house collected its cut
    expect(ledger.getHouseTotal()).toBe(breakdown.houseCut);
    // escrow pot is fully drained
    expect(ledger.escrowBalance(escrowIdFor(league))).toBe(0);
  });

  it("conserves money: sum of player balances + house is unchanged by a full season", () => {
    const { league, ledger, ids } = setup(7);
    const totalBefore =
      ids.reduce((a, id) => a + ledger.getBalance(id), 0) +
      ledger.escrowBalance(escrowIdFor(league)) +
      ledger.getHouseTotal();

    const result = runLeague(league);
    settleLeague({ league, result, ledger });

    const totalAfter =
      ids.reduce((a, id) => a + ledger.getBalance(id), 0) +
      ledger.escrowBalance(escrowIdFor(league)) +
      ledger.getHouseTotal();

    expect(totalAfter).toBe(totalBefore);
  });
});

// ─── cancel + refund ───────────────────────────────────────────────────────

describe("cancelLeague", () => {
  it("refunds every entrant and conserves money", () => {
    const league = createLeague({ id: "C1", tier: "SILVER" });
    const entries = makeEntries(3);
    const ids = entries.map((e) => e.playerId);
    const ledger = fundedLedger(ids, 1000);
    for (const e of entries) joinLeague({ league, entry: e, ledger });

    cancelLeague({ league, ledger });
    expect(league.status).toBe("CANCELLED");
    for (const id of ids) expect(ledger.getBalance(id)).toBe(1000);
    expect(ledger.escrowBalance(escrowIdFor(league))).toBe(0);
  });

  it("cannot run a league below minimum entrants", () => {
    const league = createLeague({ id: "C2", tier: "BRONZE", minEntrants: 4 });
    const entries = makeEntries(2);
    const ledger = fundedLedger(entries.map((e) => e.playerId), 1000);
    for (const e of entries) joinLeague({ league, entry: e, ledger });
    expect(() => runLeague(league)).toThrow();
  });
});
