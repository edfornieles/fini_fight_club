import { describe, expect, it } from "vitest";
import { runBattle } from "./battleEngine";
import { makeMockTeamA, makeMockTeamB } from "./mockTeams";
import { getManualTestSignals } from "./marketSignals";
import type { BattleConfig } from "./types";

function cfg(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    mode: "FREE",
    battleWindow: "1h",
    maxRounds: 30,
    marketInfluence: 0.65,
    statInfluence: 0.35,
    enablePassives: true,
    enableXP: false,
    seed: 5,
    ...overrides,
  };
}

describe("passive abilities", () => {
  it("at least one passive triggers across a battle", () => {
    const result = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: cfg(),
    });
    const passives = result.events.filter((e) => e.type === "PASSIVE_TRIGGER");
    expect(passives.length).toBeGreaterThan(0);
  });

  it("passives can be disabled via config and engine still runs", () => {
    const result = runBattle({
      teamA: makeMockTeamA(),
      teamB: makeMockTeamB(),
      marketSignals: getManualTestSignals(),
      config: cfg({ enablePassives: false }),
    });
    const passives = result.events.filter((e) => e.type === "PASSIVE_TRIGGER");
    expect(passives.length).toBe(0);
    expect(["teamA", "teamB"]).toContain(result.winner);
  });
});
