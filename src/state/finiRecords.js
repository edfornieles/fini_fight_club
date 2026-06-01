/**
 * Per-Fini battle record.
 *
 * In production this is a SQL table keyed by (contract_address, token_id):
 *
 *   CREATE TABLE fini_records (
 *     contract_address  text       NOT NULL,
 *     token_id          int        NOT NULL,
 *     wins              int        DEFAULT 0,
 *     losses            int        DEFAULT 0,
 *     draws             int        DEFAULT 0,
 *     xp                int        DEFAULT 0,
 *     last_battle_at    timestamptz,
 *     resting_until     timestamptz,
 *     traits_earned     jsonb      DEFAULT '[]',
 *     PRIMARY KEY (contract_address, token_id)
 *   );
 *
 * Because the record is keyed by tokenId (not owner_wallet), it follows the
 * NFT through every sale or transfer. The new owner inherits the full history.
 *
 * For the MVP prototype we use zustand with localStorage persistence to
 * simulate the same shape — same fields, same write rules.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
// ── XP / level curve ─────────────────────────────────────────────────────────
// Level N requires N * 100 XP cumulative. Each level grants +1 to ATK, DEF, HP scale.
const XP_PER_LEVEL = 100;
export function levelFromXp(xp) {
    return Math.floor(xp / XP_PER_LEVEL) + 1;
}
export function xpToNextLevel(xp) {
    const lvl = levelFromXp(xp);
    const into = xp - (lvl - 1) * XP_PER_LEVEL;
    const needed = XP_PER_LEVEL;
    return { current: into, needed, pct: (into / needed) * 100 };
}
// ── Rest / fatigue ───────────────────────────────────────────────────────────
// Higher level = shorter cooldown (training pays off). MVP defaults.
const BASE_REST_MS = 60 * 60 * 1000; // 1 hour
const MIN_REST_MS = 10 * 60 * 1000; // floor 10 min
function restDuration(level) {
    return Math.max(MIN_REST_MS, BASE_REST_MS - (level - 1) * 5 * 60 * 1000);
}
// ── XP per outcome ───────────────────────────────────────────────────────────
const XP_WIN = 30;
const XP_DRAW = 12;
const XP_LOSS = 6; // small consolation — losing still teaches
function emptyRecord(tokenId) {
    return { tokenId, wins: 0, losses: 0, draws: 0, xp: 0, level: 1, lastBattleAt: null, restingUntil: null, traitsEarned: [] };
}
export const useFiniRecords = create()(persist((set, getState) => ({
    records: {},
    applyBattleOutcome: (tokenId, outcome) => {
        set(state => {
            const cur = state.records[tokenId] ?? emptyRecord(tokenId);
            const xpGain = outcome === "win" ? XP_WIN : outcome === "draw" ? XP_DRAW : XP_LOSS;
            const winInc = outcome === "win" ? 1 : 0;
            const lossInc = outcome === "loss" ? 1 : 0;
            const drawInc = outcome === "draw" ? 1 : 0;
            const newXp = cur.xp + xpGain;
            const newLevel = levelFromXp(newXp);
            const now = Date.now();
            // Rest cooldown: winners stay fresh, draws get a short break, losses rest fully.
            const restingUntil = outcome === "win" ? null
                : outcome === "draw" ? now + Math.floor(restDuration(newLevel) / 2)
                    : now + restDuration(newLevel);
            const next = {
                ...cur,
                wins: cur.wins + winInc,
                losses: cur.losses + lossInc,
                draws: cur.draws + drawInc,
                xp: newXp,
                level: newLevel,
                lastBattleAt: now,
                restingUntil,
            };
            return { records: { ...state.records, [tokenId]: next } };
        });
    },
    applyBatch: (results) => {
        results.forEach(r => getState().applyBattleOutcome(r.tokenId, r.outcome));
    },
    restoreFully: (tokenId) => {
        set(state => {
            const cur = state.records[tokenId] ?? emptyRecord(tokenId);
            return { records: { ...state.records, [tokenId]: { ...cur, restingUntil: null } } };
        });
    },
    shortenRest: (tokenId, ms) => {
        set(state => {
            const cur = state.records[tokenId] ?? emptyRecord(tokenId);
            if (!cur.restingUntil)
                return state;
            const next = cur.restingUntil - ms;
            return { records: { ...state.records, [tokenId]: { ...cur, restingUntil: next <= Date.now() ? null : next } } };
        });
    },
    grantXp: (tokenId, xp) => {
        set(state => {
            const cur = state.records[tokenId] ?? emptyRecord(tokenId);
            const newXp = cur.xp + xp;
            return { records: { ...state.records, [tokenId]: { ...cur, xp: newXp, level: levelFromXp(newXp) } } };
        });
    },
    awardTrait: (tokenId, trait) => {
        set(state => {
            const cur = state.records[tokenId] ?? emptyRecord(tokenId);
            if (cur.traitsEarned.includes(trait))
                return state;
            return { records: { ...state.records, [tokenId]: { ...cur, traitsEarned: [...cur.traitsEarned, trait] } } };
        });
    },
    get: (tokenId) => getState().records[tokenId] ?? emptyRecord(tokenId),
    isResting: (tokenId) => {
        const r = getState().records[tokenId];
        return !!(r?.restingUntil && r.restingUntil > Date.now());
    },
    restingMsLeft: (tokenId) => {
        const r = getState().records[tokenId];
        if (!r?.restingUntil)
            return 0;
        return Math.max(0, r.restingUntil - Date.now());
    },
    reset: (tokenId) => {
        if (tokenId == null) {
            set({ records: {} });
            return;
        }
        set(state => {
            const next = { ...state.records };
            delete next[tokenId];
            return { records: next };
        });
    },
    /**
     * Pull authoritative records for a batch of token IDs from the server.
     * Overwrites the local cache for those tokens. Safe to call on every
     * wallet connect.
     */
    syncFromServer: async (tokenIds) => {
        const { supabase, isOnline } = await import("../lib/supabase");
        if (!isOnline)
            return;
        const { data } = await supabase
            .from("fini_records")
            .select("token_id, wins, losses, draws, xp, level, last_battle_at, resting_until, traits_earned")
            .in("token_id", tokenIds);
        if (!data)
            return;
        set(state => {
            const next = { ...state.records };
            for (const row of data) {
                next[row.token_id] = {
                    tokenId: row.token_id,
                    wins: row.wins, losses: row.losses, draws: row.draws,
                    xp: row.xp, level: row.level,
                    lastBattleAt: row.last_battle_at ? new Date(row.last_battle_at).getTime() : null,
                    restingUntil: row.resting_until ? new Date(row.resting_until).getTime() : null,
                    traitsEarned: Array.isArray(row.traits_earned) ? row.traits_earned : [],
                };
            }
            return { records: next };
        });
    },
}), { name: "fini-records-v2" } // v2: winners no longer rest. Bumped to clear legacy rest timers.
));
export function computeFiniPower(record) {
    const base = record.level * 100;
    const recBonus = (record.wins - record.losses) * 5;
    const xpInto = (record.xp % XP_PER_LEVEL) / 10;
    return Math.max(50, Math.round(base + recBonus + xpInto));
}
export function tierFor(power) {
    if (power >= 3000)
        return { name: "Legend", color: "#dc2626" };
    if (power >= 2000)
        return { name: "Diamond", color: "#06b6d4" };
    if (power >= 1200)
        return { name: "Gold", color: "#f59e0b" };
    if (power >= 700)
        return { name: "Silver", color: "#94a3b8" };
    if (power >= 400)
        return { name: "Bronze", color: "#a16207" };
    return { name: "Rookie", color: "#84cc16" };
}
export function computeTeamPower(tokenIds, getter) {
    const byFini = tokenIds.map(id => ({ tokenId: id, power: computeFiniPower(getter(id)) }));
    const total = byFini.reduce((s, x) => s + x.power, 0);
    const t = tierFor(total);
    return { total, byFini, tier: t.name, tierColor: t.color };
}
// Match opponents within ±matchTolerance of your team power.
export function matchesPower(yourPower, theirPower, tolerance = 0.15) {
    const diff = Math.abs(yourPower - theirPower) / yourPower;
    return diff <= tolerance;
}
export function fmtRestTime(ms) {
    if (ms <= 0)
        return "Ready";
    const s = Math.ceil(ms / 1000);
    if (s < 60)
        return `${s}s`;
    const m = Math.ceil(s / 60);
    if (m < 60)
        return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}
