import { describe, it, expect } from "vitest";
import {
  applyEloResult,
  expectedScore,
  leaderboard,
  makeSeedSnapshots,
  nextRating,
  pickOpponent,
  snapshotFromTeam,
  teamFromSnapshot,
  type TeamSnapshot,
} from "./pvp";
import { createRng } from "./rng";
import type { Fini, Team } from "./types";

function fini(id: string): Fini {
  return {
    id,
    name: id,
    family: "ETH",
    level: 1,
    xp: 0,
    strength: 6,
    maxHealth: 20,
    currentHealth: 5, // intentionally damaged to test rehydration
    speed: 5,
    defense: 3,
    volatilityAffinity: 0.4,
    cuteness: 0.3,
    passiveAbility: "COMPOUND",
  };
}

function team(): Team {
  return {
    id: "t",
    playerId: "p",
    name: "My Team",
    finis: [fini("a"), fini("b"), fini("c")],
  };
}

describe("pvp ELO", () => {
  it("equal ratings give a 0.5 expected score", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  it("a higher rating gives a higher expected score", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(800, 1000)).toBeLessThan(0.5);
  });

  it("winning raises rating, losing lowers it", () => {
    expect(nextRating(1000, 1000, 1)).toBeGreaterThan(1000);
    expect(nextRating(1000, 1000, 0)).toBeLessThan(1000);
  });

  it("is zero-sum for equal ratings", () => {
    const r = applyEloResult({ ratingA: 1000, ratingB: 1000, aWon: true });
    expect(r.deltaA).toBe(-r.deltaB);
  });

  it("beating a much stronger opponent yields a bigger gain than beating a weaker one", () => {
    const upset = applyEloResult({ ratingA: 1000, ratingB: 1400, aWon: true });
    const expected = applyEloResult({ ratingA: 1000, ratingB: 700, aWon: true });
    expect(upset.deltaA).toBeGreaterThan(expected.deltaA);
  });
});

describe("pvp opponent selection", () => {
  const pool = makeSeedSnapshots(createRng(1));

  it("returns an opponent from the pool", () => {
    const opp = pickOpponent({ pool, rating: 1000, rng: createRng(2) });
    expect(opp).not.toBeNull();
    expect(pool.some((s) => s.id === opp!.id)).toBe(true);
  });

  it("excludes ids in the exclude list", () => {
    const excludeIds = pool.map((s) => s.id).slice(0, pool.length - 1);
    const opp = pickOpponent({
      pool,
      rating: 1000,
      excludeIds,
      rng: createRng(3),
    });
    expect(opp!.id).toBe(pool[pool.length - 1]!.id);
  });

  it("favors opponents near the player's rating", () => {
    // With a window of 1 it must pick the single closest.
    const opp = pickOpponent({
      pool,
      rating: 1000,
      windowSize: 1,
      rng: createRng(4),
    });
    const closest = [...pool].sort(
      (a, b) => Math.abs(a.rating - 1000) - Math.abs(b.rating - 1000),
    )[0]!;
    expect(opp!.id).toBe(closest.id);
  });

  it("returns null for an empty pool", () => {
    expect(pickOpponent({ pool: [], rating: 1000 })).toBeNull();
  });
});

describe("pvp snapshots", () => {
  it("snapshot heals finis to full and round-trips back to a team", () => {
    const snap = snapshotFromTeam({ team: team(), name: "Me", rating: 1100 });
    expect(snap.finis.every((f) => f.currentHealth === f.maxHealth)).toBe(true);
    const t = teamFromSnapshot(snap);
    expect(t.finis).toHaveLength(3);
    expect(t.finis.every((f) => f.currentHealth === f.maxHealth)).toBe(true);
  });

  it("does not mutate the source team", () => {
    const src = team();
    snapshotFromTeam({ team: src, name: "Me", rating: 1100 });
    expect(src.finis[0]!.currentHealth).toBe(5);
  });

  it("seed pool spans a range of ratings", () => {
    const pool = makeSeedSnapshots(createRng(9));
    const ratings = pool.map((s) => s.rating);
    expect(Math.max(...ratings) - Math.min(...ratings)).toBeGreaterThan(300);
    expect(pool.every((s) => s.finis.length === 3)).toBe(true);
  });
});

describe("pvp leaderboard", () => {
  it("sorts by rating desc and marks the player", () => {
    const pool: TeamSnapshot[] = makeSeedSnapshots(createRng(5));
    const rows = leaderboard(pool, {
      id: "__you__",
      name: "You",
      rating: 99999,
    });
    expect(rows[0]!.isPlayer).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.rating).toBeGreaterThanOrEqual(rows[i]!.rating);
    }
  });
});
