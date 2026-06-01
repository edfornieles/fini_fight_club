/**
 * Item catalog. Designed so a typical shop unit roll feels meaningful:
 * a +8 attack sword turns a frontline Fini from "okay" into a wrecker,
 * while small trinkets stack across the team.
 */
export const ITEM_CATALOG = [
    {
        id: "warriors-sword",
        name: "Warrior's Sword",
        description: "A sharp sword. +8 Attack.",
        kind: "WEAPON",
        cost: 3,
        bonuses: { strength: 8 },
    },
    {
        id: "diamond-vest",
        name: "Diamond Vest",
        description: "Cold hard refusal. +6 Defense, +4 HP.",
        kind: "ARMOR",
        cost: 4,
        bonuses: { defense: 6, maxHealth: 4 },
    },
    {
        id: "throughput-shoes",
        name: "Throughput Shoes",
        description: "Run on TPS. +3 Speed.",
        kind: "TRINKET",
        cost: 2,
        bonuses: { speed: 3 },
    },
    {
        id: "oracle-lens",
        name: "Oracle Lens",
        description: "See the next candle. +2 Defense, +2 Speed.",
        kind: "TRINKET",
        cost: 3,
        bonuses: { defense: 2, speed: 2 },
    },
    {
        id: "meme-cap",
        name: "Meme Cap",
        description: "Higher volatility, weirder hits. +0.4 Volatility Affinity.",
        kind: "TRINKET",
        cost: 2,
        bonuses: { volatilityAffinity: 0.4 },
    },
    {
        id: "liquidity-flask",
        name: "Liquidity Flask",
        description: "Healing potion. +10 Max HP.",
        kind: "POTION",
        cost: 3,
        bonuses: { maxHealth: 10 },
    },
    {
        id: "compound-ring",
        name: "Compound Ring",
        description: "Tiny stacking pressure. +3 Attack.",
        kind: "TRINKET",
        cost: 2,
        bonuses: { strength: 3 },
    },
    {
        id: "burn-talisman",
        name: "Burn Talisman",
        description: "Reduces incoming fees. +4 Defense.",
        kind: "ARMOR",
        cost: 3,
        bonuses: { defense: 4 },
    },
    {
        id: "snowball-charm",
        name: "Snowball Charm",
        description: "Grows on impact. +4 Attack, +1 Speed.",
        kind: "TRINKET",
        cost: 4,
        bonuses: { strength: 4, speed: 1 },
    },
    {
        id: "cute-shield",
        name: "Cute Shield",
        description: "Disarming. +2 Defense, +0.3 Cuteness.",
        kind: "ARMOR",
        cost: 2,
        bonuses: { defense: 2, cuteness: 0.3 },
    },
];
export function pickItemForShop(rng) {
    const i = Math.floor(rng() * ITEM_CATALOG.length);
    return { ...ITEM_CATALOG[Math.min(ITEM_CATALOG.length - 1, i)] };
}
/**
 * Apply an equipped item's bonuses to a Fini, returning a new Fini
 * with stats modified. The original Fini is never mutated.
 *
 * Called right before a battle starts, on the team snapshot that goes
 * into runBattle().
 */
export function applyItemToFini(fini, item) {
    if (!item)
        return { ...fini };
    const b = item.bonuses;
    const maxHealth = fini.maxHealth + (b.maxHealth ?? 0);
    return {
        ...fini,
        strength: fini.strength + (b.strength ?? 0),
        maxHealth,
        currentHealth: maxHealth,
        speed: fini.speed + (b.speed ?? 0),
        defense: fini.defense + (b.defense ?? 0),
        volatilityAffinity: fini.volatilityAffinity + (b.volatilityAffinity ?? 0),
        cuteness: fini.cuteness + (b.cuteness ?? 0),
    };
}
export function describeItemDelta(item) {
    const out = [];
    const b = item.bonuses;
    if (b.strength)
        out.push(`+${b.strength} ATK`);
    if (b.maxHealth)
        out.push(`+${b.maxHealth} HP`);
    if (b.speed)
        out.push(`+${b.speed} SPD`);
    if (b.defense)
        out.push(`+${b.defense} DEF`);
    if (b.volatilityAffinity)
        out.push(`+${b.volatilityAffinity} VOL`);
    if (b.cuteness)
        out.push(`+${b.cuteness} CUTE`);
    return out;
}
