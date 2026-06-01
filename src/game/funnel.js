/**
 * Open-play funnel economy — the retention + money loop for Tier-A players.
 *
 * This is the layer that turns "a battler" into "a game people come back to
 * daily and put money into." It defines:
 *   - the escalating stakes ladder (free practice → micro → bronze → silver),
 *   - faucets (free daily roll + free practice entries + winnings) and
 *     sinks (roll cost, entry rake) so money flows toward the house,
 *   - house-seeded pots so early leagues feel rich even with few real players
 *     (a customer-acquisition cost), and
 *   - the expected house edge, so the loop is provably profitable when tuned.
 *
 * Pure + deterministic. No I/O, no React, no league-engine coupling: it works
 * in whole-dollar amounts and hands numbers to leagues.ts / the store. All
 * amounts are whole dollars (matching the Base + USDC plan).
 */
/**
 * The ladder. Practice is free and always available so anyone can start with
 * zero money. Micro ($1) is the gateway to real stakes. Bronze/Silver gate
 * behind a few completed leagues so newcomers learn before they bet bigger.
 */
export const FUNNEL_LADDER = [
    { id: "PRACTICE", label: "Practice", entryFee: 0, guaranteedPot: 0, unlockAfterPlays: 0, rakeBps: 0 },
    { id: "MICRO", label: "Micro", entryFee: 1, guaranteedPot: 8, unlockAfterPlays: 0, rakeBps: 1000 },
    { id: "BRONZE", label: "Rookie", entryFee: 10, guaranteedPot: 60, unlockAfterPlays: 2, rakeBps: 1000 },
    { id: "SILVER", label: "Pro", entryFee: 50, guaranteedPot: 200, unlockAfterPlays: 5, rakeBps: 1000 },
];
export function tierById(id) {
    const t = FUNNEL_LADDER.find((x) => x.id === id);
    if (!t)
        throw new Error(`unknown funnel tier ${id}`);
    return t;
}
/** Which tiers a player can enter given how many leagues they've completed. */
export function unlockedTiers(playsCompleted) {
    return FUNNEL_LADDER.filter((t) => playsCompleted >= t.unlockAfterPlays);
}
export function isTierUnlocked(id, playsCompleted) {
    return playsCompleted >= tierById(id).unlockAfterPlays;
}
// ─────────────────────────────────────────────────────────────────────────
// House-seeded pots (cold-start liquidity)
// ─────────────────────────────────────────────────────────────────────────
/**
 * The pot a league actually pays out from: the real buy-ins, topped up to the
 * tier's guaranteed floor if needed. Early on (few real entrants) the house
 * subsidises the difference to make pots attractive; once enough real players
 * join, the guarantee is already covered and the subsidy is $0.
 *
 * Returns the final pot and how much the house had to seed.
 */
export function seededPot(args) {
    const realPot = args.tier.entryFee * args.realEntrants;
    const pot = Math.max(realPot, args.tier.guaranteedPot);
    return { pot, houseSeed: Math.max(0, pot - realPot) };
}
// ─────────────────────────────────────────────────────────────────────────
// Faucets & sinks (the daily loop)
// ─────────────────────────────────────────────────────────────────────────
/** Roll pricing. First daily roll is free (faucet); extra rolls cost (sink). */
export const FREE_DAILY_ROLLS = 1;
export const PAID_ROLL_COST = 3;
/** Cost to roll `n` units in one day given how many free rolls remain. */
export function rollCost(n, freeRollsRemaining) {
    const free = Math.min(n, Math.max(0, freeRollsRemaining));
    const paid = n - free;
    return paid * PAID_ROLL_COST;
}
/** Daily free practice entries (a faucet that keeps non-payers in the loop). */
export const FREE_DAILY_PRACTICE = 3;
// ─────────────────────────────────────────────────────────────────────────
// House economics
// ─────────────────────────────────────────────────────────────────────────
/**
 * Expected house take from one settled league: rake on the REAL pot, minus any
 * pot the house had to seed. Negative early (subsidised growth), positive once
 * real entrants cover the guarantee — exactly the CAC → profit curve.
 */
export function leagueHouseEdge(args) {
    const realPot = args.tier.entryFee * args.realEntrants;
    const { houseSeed } = seededPot(args);
    const rake = Math.floor((realPot * args.tier.rakeBps) / 10000);
    return rake - houseSeed;
}
/**
 * The break-even entrant count for a tier: the smallest number of real players
 * at which the league stops costing the house money. Useful for tuning
 * guaranteed pots so subsidies stay bounded.
 */
export function breakEvenEntrants(tier) {
    if (tier.entryFee === 0)
        return Infinity; // free tier never makes money directly
    for (let n = 1; n <= 64; n++) {
        if (leagueHouseEdge({ tier, realEntrants: n }) >= 0)
            return n;
    }
    return Infinity;
}
