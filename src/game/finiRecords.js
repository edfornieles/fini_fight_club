/**
 * Per-token battle records — the collection's living history.
 *
 * The collection codex shows each Fini's level + win/loss record. There is no
 * global on-chain battle ledger, so we accumulate one locally as Finis fight:
 * ranked matches (which also level them) and league seasons write here. Tokens
 * that have never battled simply have no record yet ("unbattled").
 *
 * localStorage today; the tiny load/save surface means a backend can drop in
 * later by reimplementing get/save against an API.
 */
const KEY = "fini.records.v1";
const memory = new Map();
function safeGet(key) {
    try {
        if (typeof localStorage !== "undefined")
            return localStorage.getItem(key);
    }
    catch {
        /* fall through */
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
function readAll() {
    const raw = safeGet(KEY);
    if (!raw)
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function writeAll(all) {
    safeSet(KEY, JSON.stringify(all));
}
export function getFiniRecord(tokenId) {
    return readAll()[String(tokenId)] ?? null;
}
export function getAllFiniRecords() {
    return readAll();
}
/**
 * Apply a delta to a token's record (creating it if needed). Counts add;
 * `level`/`xp` overwrite when the new level is at least the stored one (so a
 * level-up sticks, but a frozen-snapshot league fight doesn't reset progress).
 */
export function bumpFiniRecord(tokenId, delta) {
    const all = readAll();
    const key = String(tokenId);
    const cur = all[key] ?? { tokenId, battles: 0, wins: 0, losses: 0, level: 1, xp: 0, lastPlayed: 0 };
    const wins = delta.wins ?? 0;
    const losses = delta.losses ?? 0;
    cur.wins += wins;
    cur.losses += losses;
    cur.battles += wins + losses;
    if (delta.level != null && delta.level >= cur.level) {
        cur.level = delta.level;
        if (delta.xp != null)
            cur.xp = delta.xp;
    }
    cur.lastPlayed = Date.now();
    all[key] = cur;
    writeAll(all);
}
/** Convenience for a single ranked match. */
export function recordFiniBattle(args) {
    bumpFiniRecord(args.tokenId, {
        wins: args.won ? 1 : 0,
        losses: args.won ? 0 : 1,
        level: args.level,
        xp: args.xp,
    });
}
export function winRate(rec) {
    return rec.battles === 0 ? 0 : rec.wins / rec.battles;
}
