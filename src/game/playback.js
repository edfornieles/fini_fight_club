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
function freshTeam(team) {
    return {
        ...team,
        finis: team.finis.map((f) => ({
            ...f,
            currentHealth: f.maxHealth,
            fainted: false,
        })),
    };
}
export function deriveLiveTeams(teamA, teamB, events, upto) {
    let liveA = freshTeam(teamA);
    let liveB = freshTeam(teamB);
    const applyDamage = (team, finiId, remaining) => {
        const idx = team.finis.findIndex((f) => f.id === finiId);
        if (idx < 0)
            return team;
        const next = [...team.finis];
        next[idx] = { ...next[idx], currentHealth: remaining };
        return { ...team, finis: next };
    };
    const applyFaint = (team, finiId) => {
        const idx = team.finis.findIndex((f) => f.id === finiId);
        if (idx < 0)
            return team;
        const next = [...team.finis];
        next[idx] = { ...next[idx], fainted: true, currentHealth: 0 };
        return { ...team, finis: next };
    };
    const end = Math.min(upto, events.length);
    for (let i = 0; i < end; i++) {
        const ev = events[i];
        if (ev.type === "DAMAGE") {
            liveA = applyDamage(liveA, ev.finiId, ev.remainingHealth);
            liveB = applyDamage(liveB, ev.finiId, ev.remainingHealth);
        }
        else if (ev.type === "FAINT") {
            liveA = applyFaint(liveA, ev.finiId);
            liveB = applyFaint(liveB, ev.finiId);
        }
    }
    return { liveA, liveB };
}
/** Animation for both sides implied by the last-played event. */
export function animFromEvent(ev, teamA) {
    const out = {
        animA: "idle",
        animB: "idle",
    };
    if (!ev)
        return out;
    const onA = (id) => teamA.finis.some((f) => f.id === id);
    if (ev.type === "ATTACK") {
        if (onA(ev.attackerId)) {
            out.animA = "attack";
            out.animB = "hit";
        }
        else {
            out.animB = "attack";
            out.animA = "hit";
        }
    }
    else if (ev.type === "PASSIVE_TRIGGER") {
        if (onA(ev.finiId))
            out.animA = "passive";
        else
            out.animB = "passive";
    }
    else if (ev.type === "FAINT") {
        if (onA(ev.finiId))
            out.animA = "faint";
        else
            out.animB = "faint";
    }
    return out;
}
