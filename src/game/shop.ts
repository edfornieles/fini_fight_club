import { ALL_COIN_FAMILIES, type Fini, type PassiveAbility, type CoinFamily } from "./types";
import { type Item, pickItemForShop, ITEM_CATALOG } from "./items";
import type { RNG } from "./rng";
import { SHOP_ITEM_SLOTS, SHOP_UNIT_SLOTS, UNIT_COST } from "./runConstants";

/**
 * Shop state — what the player sees in the shop phase. Locking the
 * shop preserves the units/items into the next phase.
 */

export type ShopState = {
  units: Fini[];
  items: Item[];
  locked: boolean;
};

const FAMILY_PASSIVE: Record<CoinFamily, PassiveAbility> = {
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

/** Roll one shop unit. Mirrors the existing site's stat ranges loosely. */
function rollShopFini(rng: RNG, stage: number, idx: number): Fini {
  const family = rng.pick(ALL_COIN_FAMILIES);
  const tokenId = `${1000 + Math.floor(rng.next() * 9000)}`;
  const tier = 1 + Math.floor((stage - 1) / 2);
  const strength = Math.round(4 + rng.range(0, 5) + tier);
  const maxHealth = Math.round(14 + rng.range(0, 12) + tier * 2);
  const speed = Math.round(2 + rng.range(0, 6) + tier);
  const defense = Math.round(2 + rng.range(0, 5) + tier);
  return {
    id: `shop-${stage}-${idx}-${Math.floor(rng.next() * 1e9)}`,
    tokenId,
    name: `Fini #${tokenId}`,
    family,
    level: 1,
    xp: 0,
    strength,
    maxHealth,
    currentHealth: maxHealth,
    speed,
    defense,
    volatilityAffinity: 0.3 + rng.next() * 0.6,
    cuteness: 0.3 + rng.next() * 0.6,
    passiveAbility: FAMILY_PASSIVE[family],
  };
}

export function rollShop(args: { rng: RNG; stage: number }): ShopState {
  const units: Fini[] = [];
  for (let i = 0; i < SHOP_UNIT_SLOTS; i++) {
    units.push(rollShopFini(args.rng, args.stage, i));
  }
  const items: Item[] = [];
  for (let i = 0; i < SHOP_ITEM_SLOTS; i++) {
    items.push(pickItemForShop(() => args.rng.next()));
  }
  return { units, items, locked: false };
}

export function unitCost(): number {
  return UNIT_COST;
}

export function itemCost(item: Item): number {
  return item.cost;
}

export function canAfford(gold: number, cost: number): boolean {
  return gold >= cost;
}

export const SHOP_DEBUG_ITEMS = ITEM_CATALOG;
