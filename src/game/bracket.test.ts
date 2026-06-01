import { describe, it, expect } from "vitest";
import { runBracketLeague } from "./bracket";
import { createLeague, type League, type LeagueEntry } from "./leagues";
import { makeSeedSnapshots } from "./pvp";
import { createRng } from "./rng";

function leagueWith(n: number, seed = 1): League {
  const snaps = makeSeedSnapshots(createRng(seed)).slice(0, n);
  const entries: LeagueEntry[] = snaps.map((s) => ({ playerId: s.id, snapshot: s }));
  const lg = createLeague({ id: "test", tier: "BRONZE", seed: 42 });
  lg.entries = entries;
  return lg;
}

describe("knockout bracket", () => {
  it("builds an 8-team QF→SF→F bracket with one match per pairing", () => {
    const { bracket } = runBracketLeague(leagueWith(8));
    expect(bracket.size).toBe(8);
    expect(bracket.rounds).toBe(3);
    // 4 QF + 2 SF + 1 F
    expect(bracket.matches.length).toBe(7);
    expect(bracket.matches.filter((m) => m.stage === "QUARTER").length).toBe(4);
    expect(bracket.matches.filter((m) => m.stage === "SEMI").length).toBe(2);
    expect(bracket.matches.filter((m) => m.stage === "FINAL").length).toBe(1);
  });

  it("crowns exactly one champion and a distinct runner-up", () => {
    const { bracket } = runBracketLeague(leagueWith(8));
    expect(bracket.championId).toBeTruthy();
    expect(bracket.runnerUpId).toBeTruthy();
    expect(bracket.championId).not.toBe(bracket.runnerUpId);
    const final = bracket.matches.find((m) => m.stage === "FINAL")!;
    expect(final.winnerPlayerId).toBe(bracket.championId);
    expect(final.loserPlayerId).toBe(bracket.runnerUpId);
  });

  it("records a real battle timeline for every contested match", () => {
    const { bracket } = runBracketLeague(leagueWith(8));
    for (const m of bracket.matches) {
      expect(m.isBye).toBe(false);
      expect(m.events.length).toBeGreaterThan(0);
      expect(m.winnerPlayerId).toBeTruthy();
    }
  });

  it("is fully deterministic for the same entries + seed", () => {
    const a = runBracketLeague(leagueWith(8));
    const b = runBracketLeague(leagueWith(8));
    expect(a.bracket.championId).toBe(b.bracket.championId);
    expect(a.result.standings.map((s) => s.playerId)).toEqual(
      b.result.standings.map((s) => s.playerId),
    );
  });

  it("produces ranked standings 1..8 with champion first, runner-up second", () => {
    const { bracket, result } = runBracketLeague(leagueWith(8));
    expect(result.standings.length).toBe(8);
    expect(result.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.standings[0]!.playerId).toBe(bracket.championId);
    expect(result.standings[1]!.playerId).toBe(bracket.runnerUpId);
    expect(result.payouts[0]!.place).toBe(1);
    expect(result.payouts[1]!.place).toBe(2);
  });

  it("conserves money: first + second + house == pool", () => {
    const { result } = runBracketLeague(leagueWith(8));
    const paid = result.payouts.reduce((a, p) => a + p.amount, 0);
    expect(paid + result.prize.houseCut).toBe(result.prize.pool);
  });

  it("handles a 4-team bracket as Semifinals → Final", () => {
    const { bracket } = runBracketLeague(leagueWith(4));
    expect(bracket.size).toBe(4);
    expect(bracket.rounds).toBe(2);
    expect(bracket.matches.filter((m) => m.stage === "SEMI").length).toBe(2);
    expect(bracket.matches.filter((m) => m.stage === "FINAL").length).toBe(1);
    expect(bracket.championId).toBeTruthy();
  });
});
