/**
 * Deterministic trait → battle stats mapper.
 *
 * Every Fini's stats flow from its on-chain traits in a publicly-known,
 * immutable formula. Same token always yields the same stats. No rerolls.
 *
 * Pipeline:
 *   1. Family base block  (archetype lean)
 *   2. × Frequency multiplier  (rarity budget, modest spread)
 *   3. + Clan stat lean  (via hash-assigned passive bucket)
 *   4. + Token jitter  (±0–1 on one stat so clones differ slightly)
 *   5. + Special perk stat mods  (rare intrinsic upgrade)
 *   6. + Mythical perk stat mods  (legendary — only 3 in 10 k tokens)
 *
 * The family counter-triangle is a separate multiplier applied in the
 * battle engine via familyMatchup(). It does NOT touch base stats.
 */
const FAMILY_BASE = {
    // TANK — high HP/defense, slow. Immovable. Wins long battles.
    BTC: { str: 5, hp: 24, spd: 2, def: 7, volAff: 0.15, cute: 0.45, passive: "DIAMOND_BODY", archetype: "Tank" },
    // BALANCED — no hard weakness, compound growth over long fights.
    ETH: { str: 5, hp: 18, spd: 4, def: 4, volAff: 0.40, cute: 0.65, passive: "COMPOUND", archetype: "Balanced" },
    // SPEED — high speed and attack, paper-thin defense. Glass cannon.
    SOL: { str: 7, hp: 13, spd: 9, def: 2, volAff: 0.75, cute: 0.55, passive: "HIGH_THROUGHPUT", archetype: "Speed" },
    // VOLATILE — highest volatility affinity; swingy, punishes market reads.
    DOGE: { str: 6, hp: 16, spd: 5, def: 2, volAff: 0.95, cute: 1.00, passive: "MEME_SPIKE", archetype: "Volatile" },
    // SUPPORT — oracle passive; boosts team when market signals align.
    LINK: { str: 4, hp: 17, spd: 4, def: 5, volAff: 0.35, cute: 0.60, passive: "ORACLE", archetype: "Support" },
    // DISRUPTOR — mid stats, disrupts enemy positioning and passives.
    UNI: { str: 6, hp: 14, spd: 6, def: 3, volAff: 0.55, cute: 0.70, passive: "SWAP", archetype: "Disruptor" },
    // AGGRESSOR — snowballing attacker; wins when it gets going.
    AVAX: { str: 7, hp: 14, spd: 5, def: 3, volAff: 0.60, cute: 0.50, passive: "AVALANCHE", archetype: "Aggressor" },
    // ECONOMY — resource attrition; whittles down enemy defenses over time.
    BNB: { str: 5, hp: 16, spd: 4, def: 4, volAff: 0.40, cute: 0.45, passive: "FEE_BURN", archetype: "Economy" },
    // SCALER — weak at lv1, strongest at high levels; rewards investment.
    MATIC: { str: 4, hp: 15, spd: 5, def: 4, volAff: 0.45, cute: 0.55, passive: "SCALING", archetype: "Scaler" },
    // ADAPTIVE — mirrors and adjusts; hard to fully counter.
    XTZ: { str: 5, hp: 16, spd: 4, def: 5, volAff: 0.30, cute: 0.60, passive: "SELF_AMEND", archetype: "Adaptive" },
};
// ─────────────────────────────────────────────────────────────────────────
// 2. Frequency multiplier (rarity → stat budget)
//    Max spread is ×1.30 at Monthly vs ×1.00 at Hourly.
//    Intentionally modest: a monthly Fini is stronger, not unbeatable.
// ─────────────────────────────────────────────────────────────────────────
const FREQ_MULT = {
    Hourly: 1.00,
    Daily: 1.07,
    "Twice-Daily": 1.14,
    Weekly: 1.21,
    Monthly: 1.30,
};
// Each lean is deliberately small: specialist, not dominant.
const CLAN_LEANS = [
    // 0 → DIAMOND_BODY clans: defender profile — more wall, less speed
    { passive: "DIAMOND_BODY", dStr: 0, dHp: 2, dSpd: -1, dDef: 2, dVolAff: -0.05 },
    // 1 → COMPOUND clans: slow growth — more hp, more str, gives up speed
    { passive: "COMPOUND", dStr: 1, dHp: 2, dSpd: -1, dDef: 0, dVolAff: 0.00 },
    // 2 → HIGH_THROUGHPUT clans: fast striker — speed + str, thin hp
    { passive: "HIGH_THROUGHPUT", dStr: 1, dHp: -2, dSpd: 2, dDef: 0, dVolAff: 0.05 },
    // 3 → MEME_SPIKE clans: high variance — big str, more volatile, fragile
    { passive: "MEME_SPIKE", dStr: 2, dHp: 0, dSpd: 0, dDef: -1, dVolAff: 0.10 },
    // 4 → ORACLE clans: tanky support — more hp, slight defense, less str
    { passive: "ORACLE", dStr: -1, dHp: 2, dSpd: 0, dDef: 1, dVolAff: -0.05 },
    // 5 → SWAP clans: nimble disruptor — balanced speed+def at cost of str
    { passive: "SWAP", dStr: -1, dHp: 0, dSpd: 1, dDef: 1, dVolAff: 0.00 },
    // 6 → AVALANCHE clans: pure aggressor — str + spd, paper defense
    { passive: "AVALANCHE", dStr: 2, dHp: -1, dSpd: 1, dDef: -2, dVolAff: 0.05 },
    // 7 → FEE_BURN clans: attrition — str + spd, hp cost
    { passive: "FEE_BURN", dStr: 1, dHp: -1, dSpd: 1, dDef: -1, dVolAff: 0.00 },
    // 8 → SCALING clans: late bloomer — big hp, low speed/str
    { passive: "SCALING", dStr: -1, dHp: 3, dSpd: -1, dDef: 0, dVolAff: -0.05 },
    // 9 → SELF_AMEND clans: adaptable — balanced minor boosts everywhere
    { passive: "SELF_AMEND", dStr: 0, dHp: 1, dSpd: 1, dDef: 1, dVolAff: 0.00 },
];
/** djb2 hash of a string → uint32. Stable across runs. */
function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
    }
    return h;
}
function clanLean(clan) {
    return CLAN_LEANS[hashString(clan) % CLAN_LEANS.length];
}
// ─────────────────────────────────────────────────────────────────────────
// 4. Token jitter (tiny deterministic spread within a clan)
//    Maximum: +1 to exactly one stat. Clones of the same family+clan
//    become slightly distinct without any power difference that matters.
// ─────────────────────────────────────────────────────────────────────────
function tokenJitter(tokenId) {
    // Knuth multiplicative hash, pick one of 5 buckets (4 stats + no-op)
    const h = Math.imul(tokenId, 2654435769) >>> 0;
    const bucket = h % 5;
    const stats = ["str", "hp", "spd", "def", "none"];
    return { stat: stats[bucket], delta: 1 };
}
export const SPECIAL_PERKS = {
    DIAMOND_HANDS: {
        id: "DIAMOND_HANDS", displayName: "Diamond Hands",
        description: "Immune to market-down penalties on this Fini's family.",
        dStr: 0, dHp: 0, dSpd: 0, dDef: 3,
    },
    WHALE_ECHO: {
        id: "WHALE_ECHO", displayName: "Whale Echo",
        description: "Once per battle: mirrors the highest enemy strength for 3 rounds.",
        dStr: 3, dHp: 0, dSpd: 0, dDef: 0,
    },
    FLASH_LOAN: {
        id: "FLASH_LOAN", displayName: "Flash Loan",
        description: "Ignores speed order in round 1 — always attacks first.",
        dStr: 0, dHp: 0, dSpd: 2, dDef: 0,
    },
    RUGGED_PULL: {
        id: "RUGGED_PULL", displayName: "Rugged Pull",
        description: "First hit taken: enemy loses 20% strength for the rest of the battle.",
        dStr: 0, dHp: 0, dSpd: 0, dDef: 2,
    },
    MOON_SHOT: {
        id: "MOON_SHOT", displayName: "Moon Shot",
        description: "If HP drops to ≤ 40%: gain +50% strength for the remainder (triggers once).",
        dStr: 2, dHp: 0, dSpd: 0, dDef: 0,
    },
    GAS_SURGE: {
        id: "GAS_SURGE", displayName: "Gas Surge",
        description: "Each attack also deals 2 splash damage to all other enemies.",
        dStr: 1, dHp: 0, dSpd: 0, dDef: 0,
    },
    BEAR_TRAP: {
        id: "BEAR_TRAP", displayName: "Bear Trap",
        description: "Reflects 40% of all damage taken back to the attacker.",
        dStr: 0, dHp: 0, dSpd: 0, dDef: 2,
    },
    PUMP_SIGNAL: {
        id: "PUMP_SIGNAL", displayName: "Pump Signal",
        description: "On faint: the next ally enters with +5 strength for this battle.",
        dStr: 0, dHp: 2, dSpd: 0, dDef: 0,
    },
    YIELD_FARM: {
        id: "YIELD_FARM", displayName: "Yield Farm",
        description: "+1 strength at the start of each round survived (up to +5 total).",
        dStr: 1, dHp: 0, dSpd: 0, dDef: 0,
    },
    LIQUIDITY_POOL: {
        id: "LIQUIDITY_POOL", displayName: "Liquidity Pool",
        description: "Heals 2 HP at the start of each round.",
        dStr: 0, dHp: 2, dSpd: 0, dDef: 0,
    },
    FRONT_RUN: {
        id: "FRONT_RUN", displayName: "Front Run",
        description: "Always acts first every round, regardless of speed.",
        dStr: 0, dHp: 0, dSpd: 3, dDef: 0,
    },
    COLD_WALLET: {
        id: "COLD_WALLET", displayName: "Cold Wallet",
        description: "The first 3 hits taken this battle deal 0 damage.",
        dStr: 0, dHp: 0, dSpd: 0, dDef: 3,
    },
    HALVENING: {
        id: "HALVENING", displayName: "The Halvening",
        description: "Every other round this Fini's strength doubles for that round.",
        dStr: 2, dHp: 0, dSpd: 0, dDef: 0,
    },
    DEFI_DRAIN: {
        id: "DEFI_DRAIN", displayName: "DeFi Drain",
        description: "Each attack permanently steals 1 defense from the enemy.",
        dStr: 1, dHp: 0, dSpd: 0, dDef: 0,
    },
    STABLECOIN: {
        id: "STABLECOIN", displayName: "Stablecoin",
        description: "Immune to ALL market modifier effects — no bonus, no penalty.",
        dStr: 0, dHp: 1, dSpd: 0, dDef: 2,
    },
    BRIDGE_BONUS: {
        id: "BRIDGE_BONUS", displayName: "Bridge Bonus",
        description: "Family counter matchup bonus is ×1.2 instead of ×1.1.",
        dStr: 1, dHp: 0, dSpd: 1, dDef: 0,
    },
    VALIDATOR_NODE: {
        id: "VALIDATOR_NODE", displayName: "Validator Node",
        description: "While alive on the backline: grants +2 defense to the frontline ally.",
        dStr: 0, dHp: 0, dSpd: 0, dDef: 3,
    },
    SOFT_FORK: {
        id: "SOFT_FORK", displayName: "Soft Fork",
        description: "On any level-up this run: +3 to this Fini's lowest stat.",
        dStr: 0, dHp: 2, dSpd: 0, dDef: 1,
    },
    NFT_ROYALTY: {
        id: "NFT_ROYALTY", displayName: "NFT Royalty",
        description: "Heals 1 HP whenever any enemy attacks (not just this Fini).",
        dStr: 0, dHp: 3, dSpd: 0, dDef: 0,
    },
    BLOCK_REWARD: {
        id: "BLOCK_REWARD", displayName: "Block Reward",
        description: "If this Fini is the last one standing on your team: +3 strength.",
        dStr: 2, dHp: 0, dSpd: 0, dDef: 0,
    },
    GENESIS_MINT: {
        id: "GENESIS_MINT", displayName: "Genesis Mint",
        description: "At battle start: all stats gain +2 (one-time blessing).",
        dStr: 2, dHp: 2, dSpd: 2, dDef: 2,
    },
    PAPER_HANDS: {
        id: "PAPER_HANDS", displayName: "Paper Hands",
        description: "Market penalties land 20% harder on this Fini. A rare curse.",
        dStr: 0, dHp: 0, dSpd: 0, dDef: -1,
    },
    LEVERAGE_TRADE: {
        id: "LEVERAGE_TRADE", displayName: "Leverage Trade",
        description: "Market bonuses doubled AND market penalties doubled. High risk.",
        dStr: 3, dHp: 0, dSpd: 0, dDef: -3,
    },
    WHALE_WALLET: {
        id: "WHALE_WALLET", displayName: "Whale Wallet",
        description: "Starts with extra HP reserves, but carrying all that weight slows it down.",
        dStr: 0, dHp: 5, dSpd: -1, dDef: 0,
    },
};
// Known on-chain special trait names → perk IDs.
// Any name not listed here is hash-assigned to one of the 24 IDs.
const KNOWN_SPECIAL_MAP = {
    "Diamond Hands": "DIAMOND_HANDS",
    "Whale Echo": "WHALE_ECHO",
    "Flash Loan": "FLASH_LOAN",
    "Rugged Pull": "RUGGED_PULL",
    "Moon Shot": "MOON_SHOT",
    "Gas Surge": "GAS_SURGE",
    "Bear Trap": "BEAR_TRAP",
    "Pump Signal": "PUMP_SIGNAL",
    "Yield Farm": "YIELD_FARM",
    "Liquidity Pool": "LIQUIDITY_POOL",
    "Front Run": "FRONT_RUN",
    "Cold Wallet": "COLD_WALLET",
    "The Halvening": "HALVENING",
    "DeFi Drain": "DEFI_DRAIN",
    "Stablecoin": "STABLECOIN",
    "Bridge Bonus": "BRIDGE_BONUS",
    "Validator Node": "VALIDATOR_NODE",
    "Soft Fork": "SOFT_FORK",
    "NFT Royalty": "NFT_ROYALTY",
    "Block Reward": "BLOCK_REWARD",
    "Genesis Mint": "GENESIS_MINT",
    "Paper Hands": "PAPER_HANDS",
    "Leverage Trade": "LEVERAGE_TRADE",
    "Whale Wallet": "WHALE_WALLET",
};
const SPECIAL_PERK_IDS = Object.keys(SPECIAL_PERKS);
function resolveSpecialPerk(name) {
    return KNOWN_SPECIAL_MAP[name] ?? SPECIAL_PERK_IDS[hashString(name) % SPECIAL_PERK_IDS.length];
}
export const MYTHICAL_PERKS = {
    GENESIS_BLOCK: {
        id: "GENESIS_BLOCK", displayName: "Genesis Block",
        description: "Survives one killing blow at 1 HP (once per battle). The moment enters the battle log as a legendary event.",
        dStr: 0, dHp: 5, dSpd: 0, dDef: 2,
    },
    THE_MERGE: {
        id: "THE_MERGE", displayName: "The Merge",
        description: "At battle start, absorbs one benched teammate's full stat block. That teammate sits out but powers this Fini.",
        dStr: 3, dHp: 3, dSpd: 0, dDef: 0,
    },
    NAKAMOTO: {
        id: "NAKAMOTO", displayName: "Nakamoto",
        description: "This Fini's family counts as ALL families for counter purposes. It is never at a matchup disadvantage.",
        dStr: 2, dHp: 2, dSpd: 2, dDef: 2,
    },
};
const MYTHICAL_PERK_IDS = Object.keys(MYTHICAL_PERKS);
// Known on-chain mythical names (fill in when real names are confirmed).
const KNOWN_MYTHICAL_MAP = {
    "Genesis Block": "GENESIS_BLOCK",
    "The Merge": "THE_MERGE",
    "Nakamoto": "NAKAMOTO",
};
function resolveMythicalPerk(name) {
    return KNOWN_MYTHICAL_MAP[name] ?? MYTHICAL_PERK_IDS[hashString(name) % MYTHICAL_PERK_IDS.length];
}
// ─────────────────────────────────────────────────────────────────────────
// Main export: traitsToStats
// ─────────────────────────────────────────────────────────────────────────
export function traitsToStats(t) {
    const base = FAMILY_BASE[t.family];
    const freqMult = FREQ_MULT[t.frequency];
    const lean = clanLean(t.clan);
    // Step 1+2: base × frequency (round to integers)
    let str = Math.round(base.str * freqMult);
    let hp = Math.round(base.hp * freqMult);
    let spd = Math.round(base.spd * freqMult);
    let def = Math.round(base.def * freqMult);
    let volAff = base.volAff + lean.dVolAff;
    // Step 3: clan lean (flat after scaling so the lean is an absolute bonus)
    str += lean.dStr;
    hp += lean.dHp;
    spd += lean.dSpd;
    def += lean.dDef;
    // Step 4: token jitter (±0 or +1 to one stat)
    const jitter = tokenJitter(t.tokenId);
    if (jitter.stat === "str")
        str += jitter.delta;
    else if (jitter.stat === "hp")
        hp += jitter.delta;
    else if (jitter.stat === "spd")
        spd += jitter.delta;
    else if (jitter.stat === "def")
        def += jitter.delta;
    // Clan may override the family's default passive.
    const passive = lean.passive;
    // Step 5: special perk
    let specialPerk;
    if (t.special) {
        specialPerk = resolveSpecialPerk(t.special);
        const perk = SPECIAL_PERKS[specialPerk];
        str += perk.dStr;
        hp += perk.dHp;
        spd += perk.dSpd;
        def += perk.dDef;
    }
    // Step 6: mythical perk
    let mythicalPerk;
    if (t.mythical) {
        mythicalPerk = resolveMythicalPerk(t.mythical);
        const perk = MYTHICAL_PERKS[mythicalPerk];
        str += perk.dStr;
        hp += perk.dHp;
        spd += perk.dSpd;
        def += perk.dDef;
    }
    // Clamp stats to sane minimums so no perk can zero anything out.
    str = Math.max(1, str);
    hp = Math.max(4, hp);
    spd = Math.max(1, spd);
    def = Math.max(1, def);
    volAff = Math.max(0, Math.min(1, volAff));
    return {
        strength: str,
        maxHealth: hp,
        speed: spd,
        defense: def,
        volatilityAffinity: volAff,
        cuteness: base.cute,
        passiveAbility: passive,
        ...(specialPerk && { specialPerk }),
        ...(mythicalPerk && { mythicalPerk }),
    };
}
// ─────────────────────────────────────────────────────────────────────────
// Family counter-triangle
//
// A single 10-step cycle. Each family beats the one behind it (−1 mod 10)
// and loses to the one ahead (+1 mod 10). Multiplier is applied to the
// ATTACKER's damage when they have the counter advantage.
//
// Cycle & narrative:
//   BTC → ETH → LINK → AVAX → SOL → DOGE → BNB → UNI → MATIC → XTZ → (back to BTC)
//
//   BTC beats XTZ   : Institutional immovability outlasts governance experiments
//   ETH beats BTC   : Smart contract utility surpasses digital gold
//   LINK beats ETH  : Oracle data is the nervous system ETH depends on
//   AVAX beats LINK : Subnet speed eats oracle query time
//   SOL beats AVAX  : Raw throughput overwhelms Avalanche's subnets
//   DOGE beats SOL  : Meme virality disrupts pure speed claims
//   BNB beats DOGE  : Exchange utility outlasts meme cycles
//   UNI beats BNB   : Decentralised swap defeats centralised exchange
//   MATIC beats UNI : L2 scaling routes around Ethereum DEX friction
//   XTZ beats MATIC : On-chain governance adapts past L2 solutions
// ─────────────────────────────────────────────────────────────────────────
const COUNTER_CYCLE = [
    "BTC", "ETH", "LINK", "AVAX", "SOL", "DOGE", "BNB", "UNI", "MATIC", "XTZ",
];
/** ~0.1 advantage for the counter family, ~0.1 disadvantage for the countered. */
const COUNTER_ADV = 1.10;
const COUNTER_DIS = 0.90;
const COUNTER_NEUT = 1.00;
/**
 * Returns a damage multiplier for attacker vs defender.
 *   1.10 = attacker has counter advantage
 *   0.90 = attacker is at a disadvantage
 *   1.00 = neutral matchup
 *
 * Finis with the NAKAMOTO mythical perk always return 1.00 (never disadvantaged
 * and never advantaged — checked by the caller).
 */
export function familyMatchup(attacker, defender) {
    if (attacker === defender)
        return COUNTER_NEUT;
    const atkIdx = COUNTER_CYCLE.indexOf(attacker);
    const defIdx = COUNTER_CYCLE.indexOf(defender);
    if (atkIdx === -1 || defIdx === -1)
        return COUNTER_NEUT;
    // Attacker beats the family one step behind it in the cycle.
    const beatTarget = (atkIdx - 1 + COUNTER_CYCLE.length) % COUNTER_CYCLE.length;
    if (defIdx === beatTarget)
        return COUNTER_ADV;
    // Attacker loses to the family one step ahead of it.
    const loseTarget = (atkIdx + 1) % COUNTER_CYCLE.length;
    if (defIdx === loseTarget)
        return COUNTER_DIS;
    return COUNTER_NEUT;
}
/**
 * Returns the BRIDGE_BONUS-adjusted counter multiplier.
 * If the attacker has BRIDGE_BONUS their advantage is ×1.2 not ×1.1.
 */
export function familyMatchupWithPerks(attacker, attackerSpecialPerk, defender) {
    const base = familyMatchup(attacker, defender);
    if (base === COUNTER_ADV && attackerSpecialPerk === "BRIDGE_BONUS") {
        return 1.20;
    }
    return base;
}
// ─────────────────────────────────────────────────────────────────────────
// Team validation helpers
// ─────────────────────────────────────────────────────────────────────────
/**
 * A team may contain AT MOST one Fini with a special or mythical perk.
 * This makes specials genuinely scarce and team-defining.
 */
export function countSpecialFinis(finis) {
    return finis.filter(f => f.specialPerk !== undefined || f.mythicalPerk !== undefined).length;
}
export function validateTeamSpecials(finis) {
    return countSpecialFinis(finis) <= 1;
}
// ─────────────────────────────────────────────────────────────────────────
// Utility re-exports for UI / other modules
// ─────────────────────────────────────────────────────────────────────────
export function getFamilyArchetype(family) {
    return FAMILY_BASE[family].archetype;
}
export function getFamilyDefaultPassive(family) {
    return FAMILY_BASE[family].passive;
}
export function getFamilyInfo(family) {
    const b = FAMILY_BASE[family];
    const idx = COUNTER_CYCLE.indexOf(family);
    const beats = COUNTER_CYCLE[(idx - 1 + COUNTER_CYCLE.length) % COUNTER_CYCLE.length];
    const losesTo = COUNTER_CYCLE[(idx + 1) % COUNTER_CYCLE.length];
    return {
        family,
        archetype: b.archetype,
        baseStats: { strength: b.str, maxHealth: b.hp, speed: b.spd, defense: b.def },
        volatilityAffinity: b.volAff,
        cuteness: b.cute,
        defaultPassive: b.passive,
        beats,
        losesTo,
    };
}
export function getClanProfile(clan) {
    const lean = clanLean(clan);
    return {
        clan,
        passive: lean.passive,
        statLean: {
            strength: lean.dStr,
            maxHealth: lean.dHp,
            speed: lean.dSpd,
            defense: lean.dDef,
            volatilityAffinity: lean.dVolAff,
        },
    };
}
