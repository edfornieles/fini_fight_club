/**
 * Persistence for the player's fielded owned team.
 *
 * Mirrors pvpStorage's tiny load/save surface so a backend can drop in later.
 * Stores the chosen wallet + token IDs + the fully built battle Finis, so the
 * player doesn't have to re-pick from their wallet every session.
 */
const TEAM_KEY = "fini.owned.team.v1";
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
function safeRemove(key) {
    memory.delete(key);
    try {
        if (typeof localStorage !== "undefined")
            localStorage.removeItem(key);
    }
    catch {
        /* memory already cleared */
    }
}
export function saveOwnedTeam(args) {
    const tokenIds = args.finis
        .map((f) => Number(f.tokenId))
        .filter((n) => Number.isFinite(n));
    const team = {
        wallet: args.wallet,
        tokenIds,
        finis: args.finis,
        savedAt: Date.now(),
    };
    safeSet(TEAM_KEY, JSON.stringify(team));
    return team;
}
export function loadOwnedTeam() {
    const raw = safeGet(TEAM_KEY);
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed &&
            Array.isArray(parsed.finis) &&
            parsed.finis.length > 0 &&
            typeof parsed.wallet === "string") {
            return parsed;
        }
    }
    catch {
        /* ignore corrupt data */
    }
    return null;
}
export function clearOwnedTeam() {
    safeRemove(TEAM_KEY);
}
