import { create } from "zustand";
import { createBracket, playMatch, recordResult, nextPlayableMatch, findMatch, roundName, } from "../game/tournament";
import { computePrizeBreakdown } from "../game/leagues";
import { makeSeedSnapshots, snapshotFromTeam, teamFromSnapshot } from "../game/pvp";
import { createRng } from "../game/rng";
/**
 * Tournament playback store — drives the watchable knockout.
 *
 * Holds the bracket and a per-match playback cursor that steps the battle
 * engine's event timeline into animated stage state (active finis, attack/hit
 * anims, HP, a climbing faint score). Self-contained: the pure bracket lives in
 * game/tournament.ts; this is just the play head + presentation state.
 */
export const PLAYER_ID = "you";
const FIELD = 8;
const BUY_IN = 25; // flavour prize pool only ($25 × 8)
function buildEntrants(playerTeam, seed) {
    const pool = makeSeedSnapshots(createRng(seed));
    const playerEntry = {
        playerId: PLAYER_ID,
        snapshot: snapshotFromTeam({ team: playerTeam, name: "You", rating: 1000, origin: "player" }),
    };
    const cpu = pool.slice(0, FIELD - 1).map((snap, i) => ({
        playerId: `cpu-${i}`,
        snapshot: { ...snap, id: `cpu-${i}` },
    }));
    return [playerEntry, ...cpu];
}
function freshLive(team) {
    const cloned = {
        ...team,
        finis: team.finis.map((f) => ({ ...f, currentHealth: f.maxHealth, fainted: false })),
    };
    return { team: cloned, activeId: cloned.finis[0].id, anim: "idle", score: 0 };
}
let floatKey = 0;
export const useTournamentStore = create((set, get) => ({
    bracket: null,
    status: "idle",
    matchId: null,
    result: null,
    eventIndex: 0,
    liveA: null,
    liveB: null,
    message: "",
    floatDmg: null,
    champion: null,
    prizePool: BUY_IN * FIELD,
    start: (playerTeam) => {
        const seed = 4242;
        const entrants = buildEntrants(playerTeam, seed);
        const bracket = createBracket({ entrants, seed });
        set({
            bracket,
            status: "bracket",
            matchId: null,
            result: null,
            champion: null,
            message: "Quarterfinals are set. Play the first match!",
            prizePool: BUY_IN * FIELD,
        });
    },
    playNext: () => {
        const { bracket } = get();
        if (!bracket)
            return;
        const match = nextPlayableMatch(bracket);
        if (!match)
            return;
        const result = playMatch(bracket, match);
        const teamA = teamFromSnapshot(bracket.byId[match.aId].snapshot);
        const teamB = teamFromSnapshot(bracket.byId[match.bId].snapshot);
        set({
            status: "playing",
            matchId: match.id,
            result,
            eventIndex: 0,
            liveA: freshLive(teamA),
            liveB: freshLive(teamB),
            floatDmg: null,
            message: result.events[0]?.message ?? "Fight!",
        });
    },
    tick: () => {
        const { result, eventIndex, liveA, liveB, bracket, matchId } = get();
        if (!result || !liveA || !liveB || !bracket)
            return;
        if (eventIndex >= result.events.length) {
            // playback finished → record + advance bracket
            const match = findMatch(bracket, matchId);
            if (!match.winnerId)
                recordResult(bracket, matchId, result);
            const champ = bracket.championId ? bracket.byId[bracket.championId] : null;
            set({
                status: champ ? "champion" : "matchOver",
                champion: champ,
                message: champ ? `${champ.snapshot.name} is the champion!` : "Match over.",
            });
            return;
        }
        const ev = result.events[eventIndex];
        const idsA = new Set(liveA.team.finis.map((f) => f.id));
        let a = { ...liveA, anim: "idle" };
        let b = { ...liveB, anim: "idle" };
        let floatDmg = null;
        if (ev.type === "ATTACK") {
            const attackerInA = idsA.has(ev.attackerId);
            if (attackerInA) {
                a = { ...a, activeId: ev.attackerId, anim: "attack" };
                b = { ...b, activeId: ev.defenderId, anim: "hit" };
                floatDmg = { side: "b", amount: ev.damage, key: floatKey++ };
            }
            else {
                b = { ...b, activeId: ev.attackerId, anim: "attack" };
                a = { ...a, activeId: ev.defenderId, anim: "hit" };
                floatDmg = { side: "a", amount: ev.damage, key: floatKey++ };
            }
        }
        else if (ev.type === "DAMAGE") {
            const side = idsA.has(ev.finiId) ? a : b;
            const fini = side.team.finis.find((f) => f.id === ev.finiId);
            if (fini) {
                side.team = {
                    ...side.team,
                    finis: side.team.finis.map((f) => f.id === ev.finiId ? { ...f, currentHealth: Math.max(0, ev.remainingHealth) } : f),
                };
            }
        }
        else if (ev.type === "FAINT") {
            const inA = idsA.has(ev.finiId);
            const side = inA ? a : b;
            side.team = {
                ...side.team,
                finis: side.team.finis.map((f) => f.id === ev.finiId ? { ...f, fainted: true, currentHealth: 0 } : f),
            };
            if (inA)
                b = { ...b, score: b.score + 1 };
            else
                a = { ...a, score: a.score + 1 };
        }
        set({
            liveA: a,
            liveB: b,
            eventIndex: eventIndex + 1,
            message: ev.message ?? get().message,
            floatDmg,
        });
    },
    skipMatch: () => {
        const { result } = get();
        if (!result)
            return;
        set({ eventIndex: result.events.length, floatDmg: null });
        get().tick(); // finalise
    },
    continueAfterMatch: () => {
        set({ status: "bracket", matchId: null, result: null, liveA: null, liveB: null, floatDmg: null });
    },
    reset: () => set({ bracket: null, status: "idle", champion: null, matchId: null, result: null }),
}));
/** Prize the champion takes from the pool (flavour; reuses league prize math). */
export function championPrize(pool) {
    return computePrizeBreakdown(pool).firstPrize;
}
export { roundName };
