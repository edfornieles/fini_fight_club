import { describe, it, expect } from "vitest";
import { useLeagueStore, PLAYER_ID } from "./leagueStore";
import { TIER_BUYINS } from "../game/leagues";
import { makeSeedSnapshots, teamFromSnapshot } from "../game/pvp";
import { createRng } from "../game/rng";
import type { Team } from "../game/types";

/**
 * Integration test for the shared league store — the testable money loop,
 * end to end, against the real (mock) singleton ledger + pure league logic.
 */

function playerTeam(): Team {
  const snap = makeSeedSnapshots(createRng(99))[3];
  const team = teamFromSnapshot({ ...snap, name: "Your Team" });
  return { ...team, playerId: PLAYER_ID };
}

/** Find an OPEN league of a tier; refresh if the previous one settled. */
function openLeagueId(tier: "BRONZE" | "SILVER"): string {
  const store = useLeagueStore.getState();
  let lg = store.leagues.find((l) => l.config.tier === tier && l.status === "OPEN");
  if (!lg) {
    store.refreshOpenLeagues();
    lg = useLeagueStore
      .getState()
      .leagues.find((l) => l.config.tier === tier && l.status === "OPEN");
  }
  if (!lg) throw new Error(`no open ${tier} league`);
  return lg.config.id;
}

describe("leagueStore money loop", () => {
  it("seeds both live tiers as OPEN leagues with CPU entrants", () => {
    const { leagues, potOf } = useLeagueStore.getState();
    const bronze = leagues.find((l) => l.config.tier === "BRONZE");
    const silver = leagues.find((l) => l.config.tier === "SILVER");
    expect(bronze).toBeDefined();
    expect(silver).toBeDefined();
    // CPU ghosts pre-paid, so there's already a real pot before the player joins.
    expect(bronze!.entries.length).toBeGreaterThan(0);
    expect(potOf(bronze!.config.id)).toBeGreaterThan(0);
  });

  it("joining debits the buy-in and grows the pot", () => {
    const id = openLeagueId("BRONZE");
    const before = useLeagueStore.getState().balance;
    const potBefore = useLeagueStore.getState().potOf(id);

    const err = useLeagueStore.getState().joinWithTeam(id, playerTeam());
    expect(err).toBeNull();

    const s = useLeagueStore.getState();
    expect(s.isEntered(id)).toBe(true);
    expect(s.balance).toBe(before - TIER_BUYINS.BRONZE);
    expect(s.potOf(id)).toBe(potBefore + TIER_BUYINS.BRONZE);
  });

  it("running a joined league settles, updates record, and pays winners from the pot", () => {
    const id = openLeagueId("BRONZE");
    if (!useLeagueStore.getState().isEntered(id)) {
      useLeagueStore.getState().joinWithTeam(id, playerTeam());
    }
    const balBefore = useLeagueStore.getState().balance;
    const playedBefore = useLeagueStore.getState().record.played;

    useLeagueStore.getState().runAndSettle(id);

    const s = useLeagueStore.getState();
    expect(s.record.played).toBe(playedBefore + 1);
    expect(s.lastResult?.leagueId).toBe(id);

    // The player's balance only ever goes up at settle (payout) — never down,
    // because the buy-in was already debited at join.
    expect(s.balance).toBeGreaterThanOrEqual(balBefore);

    // If the player placed, the recorded payout matches the balance jump.
    const mine = s.lastResult!.result.payouts.find((p) => p.playerId === PLAYER_ID);
    if (mine) {
      expect(s.balance).toBe(balBefore + mine.amount);
    }
  });

  it("a full season conserves money: winners' gains == pot − house cut", () => {
    const id = openLeagueId("SILVER");
    if (!useLeagueStore.getState().isEntered(id)) {
      useLeagueStore.getState().joinWithTeam(id, playerTeam());
    }
    const potBeforeSettle = useLeagueStore.getState().potOf(id);

    useLeagueStore.getState().runAndSettle(id);
    const result = useLeagueStore.getState().lastResult!.result;

    const paidOut = result.payouts.reduce((a, p) => a + p.amount, 0);
    // 1st + 2nd payouts plus the house cut must exactly equal the pot.
    expect(paidOut + result.prize.houseCut).toBe(potBeforeSettle);
  });

  it("topUp adds funds", () => {
    const before = useLeagueStore.getState().balance;
    useLeagueStore.getState().topUp();
    expect(useLeagueStore.getState().balance).toBeGreaterThan(before);
  });
});
