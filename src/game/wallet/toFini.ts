/**
 * Bridge: owned NFT → battle-ready Fini.
 *
 * This is where the two workstreams meet. The ownership stream produces an
 * `OwnedFini` (real traits + artwork); the attributes stream's
 * `traitsToStats()` turns those traits into a deterministic `BattleStatBlock`.
 * Here we assemble both into the `Fini` the battle engine consumes.
 */

import type { Fini } from "../types";
import { traitsToStats } from "../attributes";
import type { OwnedFini } from "./types";

/** Convert one owned NFT into a level-1 battle Fini with trait-derived stats. */
export function ownedFiniToBattleFini(owned: OwnedFini): Fini {
  const stats = traitsToStats(owned.traits);
  // Prefer the animated mp4 for an in-battle model hook; fall back to the gif.
  const modelUrl =
    owned.artwork.animationUrl ?? owned.artwork.imageUrl ?? undefined;

  return {
    id: `owned-${owned.tokenId}`,
    tokenId: String(owned.tokenId),
    name: owned.name,
    family: owned.traits.family,
    modelUrl,
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
    ...(stats.specialPerk && { specialPerk: stats.specialPerk }),
    ...(stats.mythicalPerk && { mythicalPerk: stats.mythicalPerk }),
    // Raw on-chain display names, carried for roster/narration UI.
    ...(owned.traits.special && { special: owned.traits.special }),
    ...(owned.traits.mythical && { mythical: owned.traits.mythical }),
  };
}

/** Convert a picked roster into an array of battle Finis (max 3 fielded). */
export function ownedFinisToBattleFinis(owned: OwnedFini[]): Fini[] {
  return owned.map(ownedFiniToBattleFini);
}
