import type { RNG } from "./rng";
import type { CoinFamily } from "./types";

/**
 * Encounters are the per-step choices the player makes inside a stage.
 * Inspired by Slay-the-Spire's map nodes and battles.pixelsolve.net's
 * "Stage X: Choose your next encounter" screen.
 */

export type EncounterType =
  | "FIGHT"
  | "BOSS_FIGHT"
  | "FOUND_COINS"
  | "VISIT_SHOP"
  | "REST"
  | "TREASURE"
  | "DEATH_MATCH";

export type Encounter = {
  id: string;
  type: EncounterType;
  label: string;
  description: string;
  /** Pre-rolled fight name when applicable (e.g. "Shiba Pack"). */
  enemyPackName?: string;
  /** Pre-rolled gold for FOUND_COINS. */
  gold?: number;
  /** Pre-rolled HP/lives heal for REST. */
  healAmount?: number;
  /** Family theme of the encounter, for flavor + enemy biasing. */
  themeFamily?: CoinFamily;
};

const ENEMY_PACKS = [
  "Shiba Pack",
  "Gas Goblins",
  "Slippage Wraiths",
  "Liquidity Hounds",
  "Whale Squadron",
  "Validator Set",
  "Bear Den",
  "Dust Imps",
  "Stablecoin Cult",
  "Wick Howlers",
];

/**
 * Generate 3 encounter options to present to the player on the
 * encounter selection screen.
 *
 * Rules:
 *  - Always at least one FIGHT.
 *  - Stage 3 final encounter is always BOSS_FIGHT (gated by caller).
 *  - Roughly: 50% Fight, 15% Coins, 15% Shop, 10% Rest, 5% Treasure,
 *    5% Death Match (only when stage >= 2).
 */
export function generateEncounterOptions(args: {
  stage: number;
  stageProgress: number;
  encountersPerStage: number;
  finalStage: number;
  rng: RNG;
}): Encounter[] {
  const { stage, stageProgress, encountersPerStage, finalStage, rng } = args;

  const isLast = stage === finalStage && stageProgress === encountersPerStage - 1;
  if (isLast) {
    return [
      makeBossFight(rng, stage),
      makeFight(rng, stage),
      makeRest(rng),
    ];
  }

  const types: EncounterType[] = [];
  // Always guarantee at least one fight option.
  types.push("FIGHT");
  while (types.length < 3) {
    const roll = rng.next();
    let pick: EncounterType;
    if (roll < 0.35) pick = "FIGHT";
    else if (roll < 0.55) pick = "FOUND_COINS";
    else if (roll < 0.75) pick = "VISIT_SHOP";
    else if (roll < 0.85) pick = "REST";
    else if (roll < 0.94) pick = "TREASURE";
    else pick = stage >= 2 ? "DEATH_MATCH" : "FIGHT";
    if (
      pick === "DEATH_MATCH" &&
      types.includes("DEATH_MATCH")
    ) {
      pick = "FIGHT";
    }
    types.push(pick);
  }

  // Deduplicate fight pack names so the player never sees two
  // identical "FIGHT: Shiba Pack" cards side by side.
  const usedPacks = new Set<string>();
  return types.map((t) => {
    const enc = makeEncounter(t, rng, stage);
    if ((t === "FIGHT" || t === "BOSS_FIGHT") && enc.enemyPackName) {
      let attempts = 0;
      let pack = enc.enemyPackName;
      while (usedPacks.has(pack) && attempts < 8) {
        const reroll = makeEncounter(t, rng, stage);
        if (!reroll.enemyPackName) break;
        pack = reroll.enemyPackName;
        enc.enemyPackName = pack;
        enc.label = reroll.label;
        attempts++;
      }
      usedPacks.add(pack);
    }
    return enc;
  });
}

function makeEncounter(
  type: EncounterType,
  rng: RNG,
  stage: number,
): Encounter {
  switch (type) {
    case "FIGHT":
      return makeFight(rng, stage);
    case "BOSS_FIGHT":
      return makeBossFight(rng, stage);
    case "FOUND_COINS":
      return makeFoundCoins(rng, stage);
    case "VISIT_SHOP":
      return {
        id: `enc-shop-${Math.floor(rng.next() * 1e9)}`,
        type: "VISIT_SHOP",
        label: "VISIT SHOP",
        description: "A traveling merchant unfolds their stall.",
      };
    case "REST":
      return makeRest(rng);
    case "TREASURE":
      return {
        id: `enc-treasure-${Math.floor(rng.next() * 1e9)}`,
        type: "TREASURE",
        label: "TREASURE",
        description: "An unattended item case. Take what you can carry.",
      };
    case "DEATH_MATCH":
      return {
        id: `enc-death-${Math.floor(rng.next() * 1e9)}`,
        type: "DEATH_MATCH",
        label: "DEATH MATCH",
        description:
          "A rival challenges you to a simulated Death Match. Stake a Fini. Winner keeps loser's Fini.",
      };
  }
}

function makeFight(rng: RNG, stage: number): Encounter {
  const name = rng.pick(ENEMY_PACKS);
  return {
    id: `enc-fight-${Math.floor(rng.next() * 1e9)}`,
    type: "FIGHT",
    label: `FIGHT: ${name.toUpperCase()}`,
    description: `Stage ${stage} skirmish. They smell weakness in the order book.`,
    enemyPackName: name,
  };
}

function makeBossFight(rng: RNG, stage: number): Encounter {
  const name = `The ${rng.pick([
    "Black Swan",
    "Liquidation Cascade",
    "Market Maker King",
    "Volatility Hydra",
    "Whale Mother",
  ])}`;
  return {
    id: `enc-boss-${Math.floor(rng.next() * 1e9)}`,
    type: "BOSS_FIGHT",
    label: `BOSS: ${name.toUpperCase()}`,
    description: `Stage ${stage} boss. The arena rumbles.`,
    enemyPackName: name,
  };
}

function makeFoundCoins(rng: RNG, stage: number): Encounter {
  const gold = 2 + Math.floor(rng.next() * (2 + stage));
  return {
    id: `enc-coins-${Math.floor(rng.next() * 1e9)}`,
    type: "FOUND_COINS",
    label: "FOUND COINS",
    description: `A small pouch in the dust. +$${gold}.`,
    gold,
  };
}

function makeRest(rng: RNG): Encounter {
  return {
    id: `enc-rest-${Math.floor(rng.next() * 1e9)}`,
    type: "REST",
    label: "REST",
    description: "A quiet block. Your team recovers and steadies.",
    healAmount: 1,
  };
}
