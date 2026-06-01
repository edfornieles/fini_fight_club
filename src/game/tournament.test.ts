import { describe, it, expect } from "vitest";
import {
  createBracket,
  seedOrder,
  roundName,
  nextPlayableMatch,
  playMatch,
  recordResult,
  isComplete,
  allMatches,
  type Bracket,
} from "./tournament";
import type { LeagueEntry } from "./leagues";
import { makeSeedSnapshots } from "./pvp";
import { createRng } from "./rng";

function field(n: number): LeagueEntry[] {
  const snaps = makeSeedSnapshots(createRng(7));
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p${i}`,
    snapshot: { ...snaps[i % snaps.length], id: `s${i}`, name: `T${i}`, rating: 1000 + i * 10 },
  }));
}

/** Play the whole bracket through to a champion. */
function runFull(bracket: Bracket): void {
  let guard = 0;
  let m = nextPlayableMatch(bracket);
  while (m && guard++ < 100) {
    recordResult(bracket, m.id, playMatch(bracket, m));
    m = nextPlayableMatch(bracket);
  }
}

describe("seedOrder", () => {
  it("keeps seeds 1 and 2 on opposite halves (8)", () => {
    const o = seedOrder(8);
    expect(o).toHaveLength(8);
    expect(o[0]).toBe(1);
    // seed 2 is in the second half
    expect(o.indexOf(2)).toBeGreaterThanOrEqual(4);
    // every seed 1..8 present
    expect([...o].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("roundName", () => {
  it("labels QF/SF/Final for an 8-team (3-round) bracket", () => {
    expect(roundName(0, 3)).toBe("Quarterfinal");
    expect(roundName(1, 3)).toBe("Semifinal");
    expect(roundName(2, 3)).toBe("Final");
  });
});

describe("createBracket", () => {
  it("builds 3 rounds (4/2/1 matches) for 8 entrants, first round seeded", () => {
    const b = createBracket({ entrants: field(8), seed: 1 });
    expect(b.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    // first round fully seeded
    for (const m of b.rounds[0]) {
      expect(m.aId).toBeTruthy();
      expect(m.bId).toBeTruthy();
    }
    // later rounds start empty
    expect(b.rounds[1].every((m) => !m.aId && !m.bId)).toBe(true);
  });

  it("rejects a non-power-of-two field", () => {
    expect(() => createBracket({ entrants: field(6), seed: 1 })).toThrow();
  });

  it("top seed and 2nd seed can only meet in the final", () => {
    const b = createBracket({ entrants: field(8), seed: 1 });
    // highest rating = p7 (1070), second = p6 (1060) after sort desc
    const top = [...field(8)].sort((x, y) => y.snapshot.rating - x.snapshot.rating);
    const s1 = top[0].playerId;
    const s2 = top[1].playerId;
    // they are NOT in the same first-round match, nor same semifinal feed
    const r0 = b.rounds[0];
    const s1Match = r0.find((m) => m.aId === s1 || m.bId === s1)!;
    const s2Match = r0.find((m) => m.aId === s2 || m.bId === s2)!;
    expect(s1Match.id).not.toBe(s2Match.id);
    expect(s1Match.next!.matchId).not.toBe(s2Match.next!.matchId);
  });
});

describe("playing the bracket", () => {
  it("resolves to exactly one champion, fully deterministic", () => {
    const a = createBracket({ entrants: field(8), seed: 42 });
    const b = createBracket({ entrants: field(8), seed: 42 });
    runFull(a);
    runFull(b);
    expect(isComplete(a)).toBe(true);
    expect(a.championId).toBeTruthy();
    expect(a.championId).toBe(b.championId); // same seed → same champion
  });

  it("every match has a winner and produces a playable event timeline", () => {
    const b = createBracket({ entrants: field(8), seed: 5 });
    // play just the first match and check the result shape
    const m = nextPlayableMatch(b)!;
    const result = playMatch(b, m);
    expect(result.events.length).toBeGreaterThan(0);
    expect(["teamA", "teamB"]).toContain(result.winner);
    recordResult(b, m.id, result);
    expect(m.winnerId === m.aId || m.winnerId === m.bId).toBe(true);
    // winner advanced into the next round
    const next = allMatches(b).find((x) => x.id === m.next!.matchId)!;
    expect(next.aId === m.winnerId || next.bId === m.winnerId).toBe(true);
  });

  it("plays 7 matches total for an 8-team knockout", () => {
    const b = createBracket({ entrants: field(8), seed: 9 });
    let played = 0;
    let m = nextPlayableMatch(b);
    while (m) {
      recordResult(b, m.id, playMatch(b, m));
      played++;
      m = nextPlayableMatch(b);
    }
    expect(played).toBe(7); // 4 + 2 + 1
  });
});
