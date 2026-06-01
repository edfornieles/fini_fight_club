import { ALL_COIN_FAMILIES, } from "./types";
const FAMILY_PASSIVE = {
    BTC: "DIAMOND_BODY",
    ETH: "COMPOUND",
    SOL: "HIGH_THROUGHPUT",
    DOGE: "MEME_SPIKE",
    LINK: "ORACLE",
    UNI: "SWAP",
    AVAX: "AVALANCHE",
    BNB: "FEE_BURN",
    MATIC: "SCALING",
    XTZ: "SELF_AMEND",
};
const FAMILY_NAME_POOL = {
    BTC: ["Old Orange", "Block Bear", "Halving Cub"],
    ETH: ["Soft Gwei", "Beacon Wisp", "Gas Pebble"],
    SOL: ["Fast Wick", "Mainnet Mosquito", "Throughput Chick"],
    DOGE: ["Laugh Candle", "Meme Pup", "Spike Hound"],
    LINK: ["Oracle Pup", "Node Otter", "Feed Sprite"],
    UNI: ["Swap Spirit", "Pool Pixie", "AMM Imp"],
    AVAX: ["Snowball", "Drift Cub", "Slope Wolf"],
    BNB: ["Fee Burner", "Yellow Ash", "Validator Vole"],
    MATIC: ["Layer Layer", "Roll Sprite", "Plasma Pug"],
    XTZ: ["Self Amender", "Baker Snail", "Vote Worm"],
};
function nameFor(family, rng) {
    const pool = FAMILY_NAME_POOL[family];
    return rng.pick(pool);
}
function statsForStage(stage, rng) {
    const scale = 1 + (stage - 1) * 0.25; // tunable difficulty curve
    return {
        strength: Math.round((4 + rng.range(0, 4)) * scale),
        maxHealth: Math.round((14 + rng.range(0, 10)) * scale),
        speed: Math.round((3 + rng.range(0, 5)) * scale),
        defense: Math.round((2 + rng.range(0, 4)) * scale),
        level: 1 + Math.floor((stage - 1) / 2),
    };
}
function makeEnemyFini(args) {
    const family = args.family ?? args.rng.pick(ALL_COIN_FAMILIES);
    const s = statsForStage(args.stage, args.rng);
    return {
        id: `enemy-${args.idTag}-${Math.floor(args.rng.next() * 1e9)}`,
        tokenId: `${1000 + Math.floor(args.rng.next() * 9000)}`,
        name: nameFor(family, args.rng),
        family,
        level: s.level,
        xp: 0,
        strength: s.strength,
        maxHealth: s.maxHealth,
        currentHealth: s.maxHealth,
        speed: s.speed,
        defense: s.defense,
        volatilityAffinity: 0.3 + args.rng.next() * 0.5,
        cuteness: 0.3 + args.rng.next() * 0.5,
        passiveAbility: FAMILY_PASSIVE[family],
    };
}
/**
 * Generate an opponent team scaling with the current stage. Each pack
 * name suggests its own family bias.
 */
export function generateEnemyTeam(args) {
    const bias = packNameToFamily(args.packName);
    const finis = [];
    for (let i = 0; i < 3; i++) {
        finis.push(makeEnemyFini({
            stage: args.stage,
            rng: args.rng,
            idTag: `s${args.stage}-${i}`,
            family: bias ?? undefined,
        }));
    }
    // Boss: buff the frontline.
    if (args.isBoss) {
        const front = finis[0];
        finis[0] = {
            ...front,
            name: args.packName ?? "Boss",
            strength: Math.round(front.strength * 1.3),
            maxHealth: Math.round(front.maxHealth * 1.6),
            currentHealth: Math.round(front.maxHealth * 1.6),
            defense: front.defense + 2,
            level: front.level + 1,
        };
    }
    return {
        id: `team-enemy-${Math.floor(args.rng.next() * 1e9)}`,
        playerId: "cpu",
        name: args.packName ?? "Opponent",
        finis: [finis[0], finis[1], finis[2]],
    };
}
function packNameToFamily(name) {
    if (!name)
        return null;
    const lower = name.toLowerCase();
    if (lower.includes("shiba") || lower.includes("dog") || lower.includes("meme"))
        return "DOGE";
    if (lower.includes("gas") || lower.includes("beacon"))
        return "ETH";
    if (lower.includes("liquidity") || lower.includes("hound"))
        return "UNI";
    if (lower.includes("whale") || lower.includes("orange"))
        return "BTC";
    if (lower.includes("validator"))
        return "BNB";
    if (lower.includes("oracle"))
        return "LINK";
    if (lower.includes("snow") || lower.includes("avalanche"))
        return "AVAX";
    if (lower.includes("wick"))
        return "SOL";
    if (lower.includes("stable"))
        return "BNB";
    return null;
}
