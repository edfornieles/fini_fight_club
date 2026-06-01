import { describe, expect, it } from "vitest";
import { runBattle } from "./battleEngine";
import { makeMockTeamA, makeMockTeamB } from "./mockTeams";
import { getManualTestSignals } from "./marketSignals";
import {
  buildDeathModeOpeningEvents,
  checkDeathModeReadiness,
  makeEmptyDeathModeConfig,
  resolveSimulatedDeathMode,
} from "./deathMode";
import { mockOwnershipLedger } from "./ownership";

describe("Death Mode", () => {
  it("cannot start without both stakes", () => {
    const teamA = makeMockTeamA();
    const teamB = makeMockTeamB();
    const cfg = makeEmptyDeathModeConfig();
    cfg.enabled = true;
    expect(checkDeathModeReadiness({ config: cfg, teamA, teamB }).ok).toBe(false);

    cfg.stakes.teamA = {
      playerId: teamA.playerId,
      finiId: teamA.finis[0]!.id,
      confirmed: true,
    };
    expect(checkDeathModeReadiness({ config: cfg, teamA, teamB }).ok).toBe(false);
  });

  it("cannot start without both confirmations", () => {
    const teamA = makeMockTeamA();
    const teamB = makeMockTeamB();
    const cfg = makeEmptyDeathModeConfig();
    cfg.enabled = true;
    cfg.stakes.teamA = {
      playerId: teamA.playerId,
      finiId: teamA.finis[0]!.id,
      confirmed: true,
    };
    cfg.stakes.teamB = {
      playerId: teamB.playerId,
      finiId: teamB.finis[0]!.id,
      confirmed: false,
    };
    const res = checkDeathModeReadiness({ config: cfg, teamA, teamB });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("UNCONFIRMED_B");
  });

  it("opening events contain stake messages for both sides", () => {
    const teamA = makeMockTeamA();
    const teamB = makeMockTeamB();
    const cfg = makeEmptyDeathModeConfig();
    cfg.enabled = true;
    cfg.stakes.teamA = {
      playerId: teamA.playerId,
      finiId: teamA.finis[0]!.id,
      confirmed: true,
    };
    cfg.stakes.teamB = {
      playerId: teamB.playerId,
      finiId: teamB.finis[0]!.id,
      confirmed: true,
    };
    const events = buildDeathModeOpeningEvents({ config: cfg, teamA, teamB });
    expect(events.length).toBeGreaterThan(0);
    const stakeFor = events.filter((e) => e.type === "DEATH_MODE_STAKE");
    expect(stakeFor.length).toBeGreaterThanOrEqual(2);
  });

  it("simulated resolve assigns loser's staked Fini to winner and updates ledger", () => {
    const teamA = makeMockTeamA();
    const teamB = makeMockTeamB();
    for (const f of teamA.finis) mockOwnershipLedger.setOwner(f.id, "player-a");
    for (const f of teamB.finis) mockOwnershipLedger.setOwner(f.id, "player-b");

    const cfg = makeEmptyDeathModeConfig();
    cfg.enabled = true;
    cfg.stakes.teamA = {
      playerId: teamA.playerId,
      finiId: teamA.finis[0]!.id,
      confirmed: true,
    };
    cfg.stakes.teamB = {
      playerId: teamB.playerId,
      finiId: teamB.finis[0]!.id,
      confirmed: true,
    };

    const result = runBattle({
      teamA,
      teamB,
      marketSignals: getManualTestSignals(),
      config: {
        mode: "DEATH",
        battleWindow: "1h",
        maxRounds: 30,
        marketInfluence: 0.65,
        statInfluence: 0.35,
        enablePassives: true,
        enableXP: true,
        simulatedDeathMode: true,
        seed: 99,
      },
    });

    const dm = resolveSimulatedDeathMode({
      result,
      config: cfg,
      teamA,
      teamB,
    });
    expect(dm.deathModeResult.simulatedTransferComplete).toBe(true);

    const wonFiniId = dm.deathModeResult.wonFiniId;
    const finalOwner = mockOwnershipLedger.getOwner(wonFiniId);
    expect(finalOwner).toBe(dm.deathModeResult.winnerPlayerId);
  });
});
