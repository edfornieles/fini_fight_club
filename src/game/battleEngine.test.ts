import { describe, expect, it } from "vitest";
import { runBattle } from "./battleEngine";
import { makeMockTeamA, makeMockTeamB } from "./mockTeams";
import { generateMockMarketSignals, getManualTestSignals } from "./marketSignals";
import type { BattleConfig, MarketSignalMap } from "./types";

function defaultConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    mode: "FREE",
    battleWindow: "1h",
    maxRounds: 30,
    marketInfluence: 0.65,
    statInfluence: 0.35,
    enablePassives: true,
    enableXP: true,
    seed: 42,
    ...overrides,
  };
}

describe("runBattle", () => {
  it("resolves with a winner", () => {
    const result = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: generateMockMarketSignals("1h", 1),
      config: defaultConfig(),
    });
    expect(result.winner === "teamA" || result.winner === "teamB").toBe(true);
    expect(result.loser).not.toBe(result.winner);
    expect(result.events.length).toBeGreaterThan(3);
    expect(result.events.at(-1)?.type).toBe("BATTLE_END");
  });

  it("rotates through team of 3 after fainting", () => {
    const result = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: defaultConfig(),
    });
    const attackers = new Set(
      result.events
        .filter((e): e is Extract<typeof e, { type: "ATTACK" }> => e.type === "ATTACK")
        .map((e) => e.attackerId),
    );
    expect(attackers.size).toBeGreaterThan(1);
  });

  it("awards XP and the winning team gains more", () => {
    const result = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: defaultConfig(),
    });
    expect(result.xpAwards.length).toBeGreaterThan(0);
    const teamAIds = new Set(makeMockTeamA().finis.map((f) => f.id));
    const winningIds =
      result.winner === "teamA"
        ? teamAIds
        : new Set(makeMockTeamB().finis.map((f) => f.id));
    const winSum = result.xpAwards
      .filter((a) => winningIds.has(a.finiId))
      .reduce((s, a) => s + a.amount, 0);
    const loseSum = result.xpAwards
      .filter((a) => !winningIds.has(a.finiId))
      .reduce((s, a) => s + a.amount, 0);
    expect(winSum).toBeGreaterThanOrEqual(loseSum);
  });

  it("positive market momentum increases damage on average", () => {
    const teamA = makeMockTeamA();
    const teamB = makeMockTeamB();
    let bigMarket: MarketSignalMap = getManualTestSignals();
    // Boost A families positive and B families negative.
    bigMarket = { ...bigMarket };
    for (const f of teamA.finis) {
      bigMarket[f.family] = {
        ...bigMarket[f.family],
        percentChange: 8,
        momentumScore: 0.9,
        direction: "up",
        volatility: 0.5,
      };
    }
    for (const f of teamB.finis) {
      bigMarket[f.family] = {
        ...bigMarket[f.family],
        percentChange: -8,
        momentumScore: -0.9,
        direction: "down",
        volatility: 0.5,
      };
    }
    let aWins = 0;
    const trials = 20;
    for (let i = 0; i < trials; i++) {
      const r = runBattle({
        teamA: makeMockTeamA(),
        teamB: makeMockTeamB(),
        marketSignals: bigMarket,
        config: defaultConfig({ seed: i + 1 }),
      });
      if (r.winner === "teamA") aWins++;
    }
    expect(aWins).toBeGreaterThan(trials / 2);
  });

  it("mild negative market does not guarantee loss", () => {
    // Mild negative market for team A, mild positive for team B.
    // Character stats and passives should still let A win sometimes —
    // by design, market influence is 60-70% not 100%.
    const teamA = makeMockTeamA();
    const teamB = makeMockTeamB();
    let badMarket: MarketSignalMap = { ...getManualTestSignals() };
    for (const f of teamA.finis) {
      badMarket[f.family] = {
        ...badMarket[f.family],
        percentChange: -1,
        momentumScore: -0.18,
        direction: "down",
        volatility: 0.2,
      };
    }
    for (const f of teamB.finis) {
      badMarket[f.family] = {
        ...badMarket[f.family],
        percentChange: 1,
        momentumScore: 0.18,
        direction: "up",
        volatility: 0.2,
      };
    }
    let aWins = 0;
    for (let i = 0; i < 60; i++) {
      const r = runBattle({
        teamA: makeMockTeamA(),
        teamB: makeMockTeamB(),
        marketSignals: badMarket,
        config: defaultConfig({ seed: i + 100 }),
      });
      if (r.winner === "teamA") aWins++;
    }
    expect(aWins).toBeGreaterThan(0);
  });

  it("liveMarket produces mid-battle market ticks but stays deterministic", () => {
    const run = () =>
      runBattle({
        teamA: makeMockTeamA(),
        teamB: makeMockTeamB(),
        marketSignals: generateMockMarketSignals("1h", 3),
        config: defaultConfig({ seed: 5, liveMarket: true }),
      });
    const r1 = run();
    const r2 = run();
    const ticks1 = r1.events.filter((e) => e.type === "MARKET_TICK");
    // A multi-round battle should swing the market at least once.
    expect(ticks1.length).toBeGreaterThan(0);
    // Same seed → identical swings (replayable).
    expect(r1.events.length).toBe(r2.events.length);
    expect(r1.winner).toBe(r2.winner);
    // Ticks only fire from round 2 onward (round 1 keeps the opening read).
    for (const t of ticks1) {
      if (t.type === "MARKET_TICK") expect(t.roundNumber).toBeGreaterThan(1);
    }
  });

  it("does not emit market ticks when liveMarket is off", () => {
    const r = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: defaultConfig({ seed: 9 }),
    });
    expect(r.events.some((e) => e.type === "MARKET_TICK")).toBe(false);
  });

  it("is deterministic when seeded", () => {
    const seed = 7;
    const r1 = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: defaultConfig({ seed }),
    });
    const r2 = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: defaultConfig({ seed }),
    });
    expect(r1.winner).toBe(r2.winner);
    expect(r1.rounds.length).toBe(r2.rounds.length);
    expect(r1.events.length).toBe(r2.events.length);
  });
});
