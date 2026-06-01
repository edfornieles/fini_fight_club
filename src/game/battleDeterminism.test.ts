import { describe, it, expect } from "vitest";
import { quickBattle } from "./battleEngine";
import { makeMockTeamA, makeMockTeamB } from "./mockTeams";
import { getManualTestSignals } from "./marketSignals";

/**
 * Determinism guarantee for verifiable settlement.
 *
 * The WHOLE battle — winner, events, AND the narration prose — must be
 * byte-identical when replayed from the same seed. Previously the log text
 * used Math.random(); this test pins that it no longer does, so the event log
 * can be hashed for optimistic on-chain settlement.
 */

function run(seed: number) {
  return quickBattle({
    teamA: makeMockTeamA(),
    teamB: makeMockTeamB(),
    signals: getManualTestSignals(),
    seed,
  });
}

describe("battle determinism", () => {
  it("same seed → byte-identical event log (messages included)", () => {
    const a = run(2024);
    const b = run(2024);
    expect(a.winner).toBe(b.winner);
    // Full structural + textual equality of the entire event stream.
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    // And the rest of the result.
    expect(JSON.stringify(a.rounds)).toBe(JSON.stringify(b.rounds));
    expect(JSON.stringify(a.xpAwards)).toBe(JSON.stringify(b.xpAwards));
  });

  it("the event log contains no Math.random()-style drift across many replays", () => {
    const reference = JSON.stringify(run(7).events);
    for (let i = 0; i < 25; i++) {
      expect(JSON.stringify(run(7).events)).toBe(reference);
    }
  });

  it("different seeds generally produce different logs", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 20; s++) seen.add(JSON.stringify(run(s + 1).events));
    // not all 20 seeds collapse to the same log
    expect(seen.size).toBeGreaterThan(1);
  });
});
