/**
 * Family roles + type effectiveness — the strategic layer.
 *
 * Each Fini family belongs to one of three archetypes (Tank / Striker / Healer).
 * Roles form a triangle:
 *
 *           Tank
 *          ↗   ↘
 *      Healer ← Striker
 *
 * Tank > Striker > Healer > Tank
 *
 * When the attacker's role is strong vs the defender's role, damage is +30%.
 * Weak: -30%. Same archetype: normal damage.
 *
 * Items also map to a role — equipping a role-matched item on a same-role Fini
 * grants a +50% synergy bonus on top of the base stat bonus. So a Diamond Shell
 * (+10 DEF, Tank item) on a BTC Fini becomes +15 DEF.
 */

export type FamilyRole = "tank" | "striker" | "healer";

export const FAMILY_ROLE: Record<string, FamilyRole> = {
  // 🛡️ Tanks — high HP/DEF, slow. Built to absorb hits.
  BTC:   "tank",
  BNB:   "tank",
  LINK:  "tank",

  // ⚔️ Strikers — high ATK/SPD, fragile. Burst damage dealers.
  SOL:   "striker",
  DOGE:  "striker",
  UNI:   "striker",
  AVAX:  "striker",
  ETH:   "striker",

  // 💚 Healers — balanced stats with sustain. Outlast their opponents.
  XTZ:   "healer",
  MATIC: "healer",
};

export const ROLE_META: Record<FamilyRole, { name: string; icon: string; color: string; bgTint: string; description: string }> = {
  tank:    { name: "Tank",    icon: "🛡️", color: "#3b82f6", bgTint: "#dbeafe",  description: "Absorbs damage. Strong vs Strikers, weak vs Healers." },
  striker: { name: "Striker", icon: "⚔️", color: "#ef4444", bgTint: "#fee2e2",  description: "Bursts damage. Strong vs Healers, weak vs Tanks." },
  healer:  { name: "Healer",  icon: "💚", color: "#22c55e", bgTint: "#dcfce7",  description: "Outlasts. Strong vs Tanks, weak vs Strikers." },
};

/**
 * Damage multiplier when an attacker of role A hits a defender of role B.
 * Returns 1.3 / 1.0 / 0.7 — never zero (so unfavoured matchups still chip away).
 */
export function roleDamageMultiplier(attackerRole: FamilyRole, defenderRole: FamilyRole): number {
  if (attackerRole === defenderRole) return 1.0;
  const strongVs: Record<FamilyRole, FamilyRole> = {
    tank: "striker",
    striker: "healer",
    healer: "tank",
  };
  if (strongVs[attackerRole] === defenderRole) return 1.3;
  return 0.7;
}

/** Convenience: takes family symbols and looks up the multiplier. */
export function familyDamageMultiplier(attackerFamily: string, defenderFamily: string): number {
  const a = FAMILY_ROLE[attackerFamily] ?? "striker";
  const b = FAMILY_ROLE[defenderFamily] ?? "striker";
  return roleDamageMultiplier(a, b);
}

/** Map each item name (canonical) to its synergy role, or null for neutral. */
export const ITEM_SYNERGY: Record<string, FamilyRole | null> = {
  // Tank items — defensive boosts pair with tanks
  "Acorn":           "tank",
  "Leaf Vest":       "tank",
  "Diamond Shell":   "tank",
  "Ancient Helm":    "tank",
  "Dragon Scale":    "tank",

  // Striker items — offensive + speed boosts pair with strikers
  "Pebble":          "striker",
  "Twig Stick":      "striker",
  "Sneakers":        "striker",
  "Volatility Spike":"striker",
  "Speed Boots":     "striker",
  "Lightning Sigil": "striker",

  // Healer items — HP-heavy items pair with healers
  "Spring Water":    "healer",
  "Berry Juice":     "healer",
  "Oracle Tonic":    "healer",
  "Honey Pot":       "healer",
  "Phoenix Feather": "healer",

  // Neutral — combo/utility items, no role lock
  "Quick Cloak":     null,
  "Battle Scar":     null,
  "Meme Charm":      null,
  "Cookie Pendant":  null,
  "Crystal Lens":    null,
  "Rune Stone":      null,
  "Aurora Mantle":   null,
  "Eternal Idol":    null,
};

/** Synergy multiplier applied to an item's stat bonus when equipped on the
 *  matching role. 1.5× — meaningful but not OP. */
export const SYNERGY_BONUS_MULTIPLIER = 1.5;

/** Does this item synergize with the given family? */
export function hasSynergy(itemName: string, family: string): boolean {
  const itemRole = ITEM_SYNERGY[itemName];
  if (!itemRole) return false;
  return FAMILY_ROLE[family] === itemRole;
}
