import { makeDefaultProfile, makeSeedSnapshots, } from "./pvp";
import { createRng } from "./rng";
/**
 * Persistence for the PvP ladder.
 *
 * Today this is localStorage; the read/write surface is deliberately
 * tiny so a backend can drop in later by reimplementing these four
 * functions against an API (load/save profile, load/save pool). Nothing
 * else in the app needs to change.
 */
const PROFILE_KEY = "fini.pvp.profile.v1";
const POOL_KEY = "fini.pvp.pool.v1";
/** Cap the local pool so it can't grow without bound. */
const MAX_POOL = 60;
// In-memory fallback for SSR / tests / private-mode where localStorage
// throws or is unavailable.
const memory = new Map();
function safeGet(key) {
    try {
        if (typeof localStorage !== "undefined")
            return localStorage.getItem(key);
    }
    catch {
        /* fall through to memory */
    }
    return memory.get(key) ?? null;
}
function safeSet(key, value) {
    memory.set(key, value);
    try {
        if (typeof localStorage !== "undefined")
            localStorage.setItem(key, value);
    }
    catch {
        /* memory already updated */
    }
}
export function loadProfile() {
    const raw = safeGet(PROFILE_KEY);
    if (!raw) {
        const fresh = makeDefaultProfile();
        saveProfile(fresh);
        return fresh;
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.rating === "number")
            return parsed;
    }
    catch {
        /* ignore corrupt data */
    }
    return makeDefaultProfile();
}
export function saveProfile(profile) {
    safeSet(PROFILE_KEY, JSON.stringify(profile));
}
export function loadPool() {
    const raw = safeGet(POOL_KEY);
    if (!raw) {
        const seeds = makeSeedSnapshots(createRng(0xc0ffee));
        savePool(seeds);
        return seeds;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0)
            return parsed;
    }
    catch {
        /* ignore corrupt data */
    }
    const seeds = makeSeedSnapshots(createRng(0xc0ffee));
    savePool(seeds);
    return seeds;
}
export function savePool(pool) {
    // Keep seeds + the most recent player snapshots, capped.
    const seeds = pool.filter((s) => s.origin === "seed");
    const players = pool
        .filter((s) => s.origin === "player")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, Math.max(0, MAX_POOL - seeds.length));
    safeSet(POOL_KEY, JSON.stringify([...seeds, ...players]));
}
/** Add a snapshot to the pool and persist. Returns the new pool. */
export function addSnapshotToPool(snap) {
    const pool = loadPool();
    const next = [...pool, snap];
    savePool(next);
    return loadPool();
}
/** Update a single snapshot's rating + W/L in place. */
export function updateSnapshotRating(id, rating, won) {
    const pool = loadPool();
    const next = pool.map((s) => s.id === id
        ? {
            ...s,
            rating,
            wins: s.wins + (won ? 1 : 0),
            losses: s.losses + (won ? 0 : 1),
        }
        : s);
    savePool(next);
    return next;
}
/** Test/dev helper: wipe persisted PvP data. */
export function resetPvpStorage() {
    memory.delete(PROFILE_KEY);
    memory.delete(POOL_KEY);
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem(PROFILE_KEY);
            localStorage.removeItem(POOL_KEY);
        }
    }
    catch {
        /* ignore */
    }
}
