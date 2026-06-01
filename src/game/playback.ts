import type { AnimationState, BattleEvent, Team } from "./types";

/**
 * Pure playback helpers shared by the main BattleScreen and the League
 * tournament viewer. Given a frozen pair of teams and the engine's event
 * timeline, derive the live HP/faint state at any point in the timeline,
 * and the attack/hit/faint animation implied by the most recent event.
 *
 * The battle engine is the single source of truth: DAMAGE events carry the
 * defender's remaining HP, FAINT events flip the fainted flag. Replaying the
 * events up to an index reconstructs the exact mid-battle board state.
 */

function freshTeam(team: Team): Team {
  return {
    ...team,
    finis: team.finis.map((f) => ({
      ...f,
      currentHealth: f.maxHealth,
      fainted: false,
    })) as Team["finis"],
  };
}

export function deriveLiveTeams(
  teamA: Team,
  teamB: Team,
  events: BattleEvent[],
  upto: number,
): { liveA: Team; liveB: Team } {
  let liveA = freshTeam(teamA);
  let liveB = freshTeam(teamB);

  const applyDamage = (team: Team, finiId: string, remaining: number): Team => {
    const idx = team.finis.findIndex((f) => f.id === finiId);
    if (idx < 0) return team;
    const next = [...team.finis] as Team["finis"];
    next[idx] = { ...next[idx]!, currentHealth: remaining };
    return { ...team, finis: next };
  };
  const applyFaint = (team: Team, finiId: string): Team => {
    const idx = team.finis.findIndex((f) => f.id === finiId);
    if (idx < 0) return team;
    const next = [...team.finis] as Team["finis"];
    next[idx] = { ...next[idx]!, fainted: true, currentHealth: 0 };
    return { ...team, finis: next };
  };

  const end = Math.min(upto, events.length);
  for (let i = 0; i < end; i++) {
    const ev = events[i]!;
    if (ev.type === "DAMAGE") {
      liveA = applyDamage(liveA, ev.finiId, ev.remainingHealth);
      liveB = applyDamage(liveB, ev.finiId, ev.remainingHealth);
    } else if (ev.type === "FAINT") {
      liveA = applyFaint(liveA, ev.finiId);
      liveB = applyFaint(liveB, ev.finiId);
    }
  }
  return { liveA, liveB };
}

/** Animation for both sides implied by the last-played event. */
export function animFromEvent(
  ev: BattleEvent | undefined,
  teamA: Team,
): { animA: AnimationState; animB: AnimationState } {
  const out: { animA: AnimationState; animB: AnimationState } = {
    animA: "idle",
    animB: "idle",
  };
  if (!ev) return out;
  const onA = (id: string) => teamA.finis.some((f) => f.id === id);
  if (ev.type === "ATTACK") {
    if (onA(ev.attackerId)) {
      out.animA = "attack";
      out.animB = "hit";
    } else {
      out.animB = "attack";
      out.animA = "hit";
    }
  } else if (ev.type === "PASSIVE_TRIGGER") {
    if (onA(ev.finiId)) out.animA = "passive";
    else out.animB = "passive";
  } else if (ev.type === "FAINT") {
    if (onA(ev.finiId)) out.animA = "faint";
    else out.animB = "faint";
  }
  return out;
}
