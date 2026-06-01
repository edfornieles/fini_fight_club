/**
 * Game-Fini acquisition engine — the top of the open-play funnel.
 *
 * Game-Finis are OFF-CHAIN game units, NOT the real mainnet Finiliar NFTs.
 * Anyone can roll them (no wallet, no gas), so the player base isn't capped
 * at the ~few thousand real holders. They share the exact same families,
 * clans, frequencies, perks, and `traitsToStats` chart as the real collection,
 * so the game design is shared — but they live in a separate id namespace and
 * never touch on-chain ownership.
 *
 *  ─────────────── FUTURE: optional mint-to-NFT ─────────────────────────
 *  A player who wants to truly own/trade a strong game-Fini can later "mint"
 *  it to a Base L2 NFT for a fee. That's an upsell, not a requirement — the
 *  funnel stays frictionless. Keep generation deterministic so a minted unit
 *  reproduces the exact same stats on-chain.
 *  ──────────────────────────────────────────────────────────────────────
 */
import { ALL_COIN_FAMILIES } from "./types";
import { traitsToStats, SPECIAL_PERKS, MYTHICAL_PERKS } from "./attributes";
import { createRng } from "./rng";
/** Game-Finis get ids in this range so they never collide with real tokens 0–9999. */
export const GAME_FINI_ID_BASE = 1_000_000;
const FREQUENCY_WEIGHTS = [
    { value: "Hourly", weight: 60 },
    { value: "Daily", weight: 22 },
    { value: "Twice-Daily", weight: 12 },
    { value: "Weekly", weight: 5 },
    { value: "Monthly", weight: 1 },
];
/** Chance a rolled game-Fini carries a Special perk. */
export const SPECIAL_ROLL_RATE = 0.03;
/** Chance a rolled game-Fini carries a Mythical perk (ultra-rare). */
export const MYTHICAL_ROLL_RATE = 0.001;
/** Kawaii clan-name pool. Clan only matters via hash → passive bucket, so any
 * names work; these just read nicely in the UI. */
const GAME_CLANS = [
    "Stickies", "Blades", "Blackberries", "Soil Dragons", "Funsies", "Monks",
    "Soldiers", "Coral Kids", "Mec Mec", "Migs", "Sarks", "Ulfsak", "Kem",
    "Gusty Dragons", "Boba Gang", "Mochi Squad", "Cloud Nibblers", "Pastel Panic",
];
const NAME_PREFIX = [
    "Soft", "Tiny", "Lil", "Puffy", "Sleepy", "Brave", "Lucky", "Shiny",
    "Bubbly", "Mighty", "Chonky", "Zoomy", "Spicy", "Cozy", "Sparkly",
];
const NAME_SUFFIX = [
    "Wick", "Candle", "Gwei", "Blob", "Pip", "Nugget", "Bean", "Sprout",
    "Wisp", "Pebble", "Tot", "Mochi", "Cub", "Sprite", "Puff",
];
function weightedPick(rng, table) {
    const total = table.reduce((a, w) => a + w.weight, 0);
    let r = rng.next() * total;
    for (const entry of table) {
        r -= entry.weight;
        if (r <= 0)
            return entry.value;
    }
    return table[table.length - 1].value;
}
const SPECIAL_NAMES = Object.values(SPECIAL_PERKS).map((p) => p.displayName);
const MYTHICAL_NAMES = Object.values(MYTHICAL_PERKS).map((p) => p.displayName);
/**
 * Roll a single deterministic game-Fini. `seed` fully determines the result,
 * so the same seed always yields the same unit (mint-to-NFT safe).
 */
export function rollGameFini(seed) {
    const rng = createRng(seed);
    // Hash the seed into the id space so +seed and -seed don't collide.
    const hashed = (Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0) % 100_000_000;
    const gameId = GAME_FINI_ID_BASE + hashed;
    const family = rng.pick(ALL_COIN_FAMILIES);
    const frequency = weightedPick(rng, FREQUENCY_WEIGHTS);
    const clan = rng.pick(GAME_CLANS);
    const special = rng.chance(SPECIAL_ROLL_RATE)
        ? rng.pick(SPECIAL_NAMES)
        : undefined;
    // A unit can't carry BOTH (keeps the one-special-per-team rule meaningful
    // and mythicals genuinely singular).
    const mythical = !special && rng.chance(MYTHICAL_ROLL_RATE) ? rng.pick(MYTHICAL_NAMES) : undefined;
    const traits = {
        tokenId: gameId,
        family,
        frequency,
        clan,
        ...(special && { special }),
        ...(mythical && { mythical }),
        latestDelta: 0,
    };
    const stats = traitsToStats(traits);
    const name = `${rng.pick(NAME_PREFIX)} ${rng.pick(NAME_SUFFIX)}`;
    const fini = {
        id: `g-${gameId}`,
        tokenId: String(gameId),
        name,
        family,
        level: 1,
        xp: 0,
        strength: stats.strength,
        maxHealth: stats.maxHealth,
        currentHealth: stats.maxHealth,
        speed: stats.speed,
        defense: stats.defense,
        volatilityAffinity: stats.volatilityAffinity,
        cuteness: stats.cuteness,
        passiveAbility: stats.passiveAbility,
        ...(special && { special }),
        ...(mythical && { mythical }),
        ...(stats.specialPerk && { specialPerk: stats.specialPerk }),
        ...(stats.mythicalPerk && { mythicalPerk: stats.mythicalPerk }),
    };
    return { gameId, traits, fini };
}
/** Roll a pack of `n` game-Finis from one base seed (deterministic per slot). */
export function rollPack(seed, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        // Mix the slot index into the seed so each unit differs deterministically.
        out.push(rollGameFini((Math.imul(seed ^ (i + 1), 2654435761) >>> 0) % 2_000_000_000));
    }
    return out;
}
/** True if a Fini is an off-chain game unit (vs a real on-chain Finiliar). */
export function isGameFini(fini) {
    return fini.id.startsWith("g-");
}
