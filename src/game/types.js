/**
 * Core types for the Finiliar Battler prototype.
 *
 * A Fini is a body possessed by the market.
 *
 * Design rules baked into these types:
 *  - Battle engine output is pure data (BattleResult + BattleEvent[]).
 *  - The UI consumes events on a timeline.
 *  - Market signals are first-class, not bolted on.
 *  - Ownership is optional and decoupled from battle logic, so Free Mode
 *    can run with zero wallet/NFT context, and Death Mode can layer in
 *    safe simulated state later.
 */
export const ALL_COIN_FAMILIES = [
    "BTC",
    "ETH",
    "SOL",
    "DOGE",
    "LINK",
    "UNI",
    "AVAX",
    "BNB",
    "MATIC",
    "XTZ",
];
