import type {
  BattleEvent,
  Fini,
  MarketSignal,
  MarketSignalMap,
  PassiveAbility,
  Team,
} from "./types";
import type { RNG } from "./rng";

/**
 * Passive abilities live in a per-battle state map so they can track
 * things like "Compound has gained +N strength this fight" or
 * "Self-Amend already used its single heal".
 *
 * The engine is pure: it threads a PassiveState object through each
 * hook function and writes BattleEvents when something triggers.
 */
export type PassiveState = {
  // ETH Compound — count rounds where the Fini was alive.
  compoundRoundsAlive: Record<string, number>;
  compoundBonusStrength: Record<string, number>;

  // UNI Swap — one position swap per battle.
  swapUsed: Record<string, boolean>;

  // XTZ Self-Amend — one heal per battle.
  selfAmendUsed: Record<string, boolean>;

  // AVAX Avalanche — bonus damage next attack after a faint.
  avalancheBonus: Record<string, number>;

  // BNB Fee Burn — accumulated defense reduction applied to opponent.
  feeBurnDefenseDebuff: Record<string, number>;

  // MATIC Scaling — accumulated speed/defense bonus.
  scalingBonus: Record<string, { speed: number; defense: number }>;
};

export function createPassiveState(): PassiveState {
  return {
    compoundRoundsAlive: {},
    compoundBonusStrength: {},
    swapUsed: {},
    selfAmendUsed: {},
    avalancheBonus: {},
    feeBurnDefenseDebuff: {},
    scalingBonus: {},
  };
}

export type PassiveTriggerContext = {
  state: PassiveState;
  rng: RNG;
  signals: MarketSignalMap;
  events: BattleEvent[];
  enable: boolean;
};

function pushTrigger(
  events: BattleEvent[],
  fini: Fini,
  passive: PassiveAbility,
  message: string,
): void {
  events.push({ type: "PASSIVE_TRIGGER", finiId: fini.id, passive, message });
}

/**
 * Returns an "effective attack" multiplier and any damage bonus from
 * passives. Called when this Fini is about to attack.
 */
export function applyPassiveBeforeAttack(args: {
  attacker: Fini;
  defender: Fini;
  ctx: PassiveTriggerContext;
}): { attackMultiplier: number; bonusDamage: number } {
  const { attacker, ctx } = args;
  if (!ctx.enable) return { attackMultiplier: 1, bonusDamage: 0 };
  let multiplier = 1;
  let bonus = 0;

  switch (attacker.passiveAbility) {
    case "COMPOUND": {
      const comp = ctx.state.compoundBonusStrength[attacker.id] ?? 0;
      if (comp > 0) bonus += comp;
      break;
    }
    case "HIGH_THROUGHPUT": {
      const sig = ctx.signals[attacker.family];
      if (sig.direction === "up") {
        multiplier *= 1 + 0.15 + sig.momentumScore * 0.2;
        pushTrigger(
          ctx.events,
          attacker,
          "HIGH_THROUGHPUT",
          `${attacker.name} surges with throughput, riding the green candle.`,
        );
      }
      break;
    }
    case "MEME_SPIKE": {
      const sig = ctx.signals[attacker.family];
      const chance = 0.15 + sig.volatility * 0.45;
      if (ctx.rng.chance(chance)) {
        const memeBonus = Math.round(2 + sig.volatility * 4);
        bonus += memeBonus;
        pushTrigger(
          ctx.events,
          attacker,
          "MEME_SPIKE",
          `${attacker.name} meme-spikes and laughs (+${memeBonus} damage).`,
        );
      }
      break;
    }
    case "AVALANCHE": {
      const ava = ctx.state.avalancheBonus[attacker.id] ?? 0;
      if (ava > 0) {
        bonus += ava;
        ctx.state.avalancheBonus[attacker.id] = 0;
        pushTrigger(
          ctx.events,
          attacker,
          "AVALANCHE",
          `${attacker.name} snowballs into a bigger hit (+${ava}).`,
        );
      }
      break;
    }
    default:
      break;
  }

  return { attackMultiplier: multiplier, bonusDamage: bonus };
}

/**
 * Returns an "effective defense" multiplier for the defender.
 * Called when this Fini is about to take damage.
 */
export function applyPassiveOnDamage(args: {
  attacker: Fini;
  defender: Fini;
  incomingDamage: number;
  ctx: PassiveTriggerContext;
}): { defenseMultiplier: number; damageOverride?: number } {
  const { defender, ctx } = args;
  if (!ctx.enable) return { defenseMultiplier: 1 };
  let multiplier = 1;
  let damageOverride: number | undefined;

  switch (defender.passiveAbility) {
    case "DIAMOND_BODY": {
      const sig = ctx.signals[defender.family];
      if (sig.direction === "down") {
        multiplier *= 0.7;
        pushTrigger(
          ctx.events,
          defender,
          "DIAMOND_BODY",
          `${defender.name} turns to diamond under the red wick.`,
        );
      } else {
        multiplier *= 0.92;
      }
      break;
    }
    case "ORACLE": {
      const sig = ctx.signals[defender.family];
      if (sig.direction === "down" || sig.volatility > 0.6) {
        multiplier *= 0.85;
        pushTrigger(
          ctx.events,
          defender,
          "ORACLE",
          `${defender.name}'s oracle trembles and softens the blow.`,
        );
      }
      break;
    }
    default:
      break;
  }

  return { defenseMultiplier: multiplier, damageOverride };
}

/**
 * Hook called immediately after damage is applied to a Fini that did
 * NOT faint. XTZ Self-Amend uses this to heal once per battle.
 */
export function applyPassiveAfterDamage(args: {
  defender: Fini;
  ctx: PassiveTriggerContext;
}): { heal: number } {
  const { defender, ctx } = args;
  if (!ctx.enable) return { heal: 0 };
  if (defender.passiveAbility === "SELF_AMEND") {
    if (!ctx.state.selfAmendUsed[defender.id]) {
      ctx.state.selfAmendUsed[defender.id] = true;
      const heal = Math.min(
        defender.maxHealth - defender.currentHealth,
        Math.round(defender.maxHealth * 0.2),
      );
      if (heal > 0) {
        pushTrigger(
          ctx.events,
          defender,
          "SELF_AMEND",
          `${defender.name} self-amends and patches itself (+${heal} HP).`,
        );
        return { heal };
      }
    }
  }
  return { heal: 0 };
}

/**
 * Hook called after an attacker successfully causes a faint.
 * AVAX Avalanche queues a bonus for next round.
 */
export function applyPassiveOnFaint(args: {
  attacker: Fini;
  defender: Fini;
  ctx: PassiveTriggerContext;
}): void {
  const { attacker, ctx } = args;
  if (!ctx.enable) return;
  if (attacker.passiveAbility === "AVALANCHE") {
    const cur = ctx.state.avalancheBonus[attacker.id] ?? 0;
    ctx.state.avalancheBonus[attacker.id] = cur + 3;
    pushTrigger(
      ctx.events,
      attacker,
      "AVALANCHE",
      `${attacker.name} feels the snowball coming on.`,
    );
  }
}

/**
 * End-of-round hook. Compound grows +1 strength every 2 rounds.
 * MATIC Scaling accrues speed/defense each round. BNB Fee Burn
 * tags the opposing active fini with a defense debuff.
 *
 * Returns possibly-mutated Finis to substitute into teams.
 */
export function applyPassiveEndOfRound(args: {
  roundNumber: number;
  teamA: Team;
  teamB: Team;
  activeA: Fini | undefined;
  activeB: Fini | undefined;
  ctx: PassiveTriggerContext;
}): { teamA: Team; teamB: Team } {
  const { teamA, teamB, roundNumber, ctx, activeA, activeB } = args;
  if (!ctx.enable) return { teamA, teamB };

  const nextA = teamA;
  const nextB = teamB;

  // Compound: increment counter for all alive Finis, every 2 rounds +1 STR.
  for (const f of [...teamA.finis, ...teamB.finis]) {
    if (f.passiveAbility !== "COMPOUND") continue;
    if (f.fainted || f.currentHealth <= 0) continue;
    const cur = ctx.state.compoundRoundsAlive[f.id] ?? 0;
    const next = cur + 1;
    ctx.state.compoundRoundsAlive[f.id] = next;
    if (next % 2 === 0) {
      const bonus = (ctx.state.compoundBonusStrength[f.id] ?? 0) + 1;
      ctx.state.compoundBonusStrength[f.id] = bonus;
      pushTrigger(
        ctx.events,
        f,
        "COMPOUND",
        `${f.name} compounds (+1 strength, total +${bonus}).`,
      );
    }
  }

  // MATIC Scaling: speed + defense climbs slowly.
  for (const team of [nextA, nextB]) {
    for (const f of team.finis) {
      if (f.passiveAbility !== "SCALING") continue;
      if (f.fainted || f.currentHealth <= 0) continue;
      const cur = ctx.state.scalingBonus[f.id] ?? { speed: 0, defense: 0 };
      const next = {
        speed: cur.speed + (roundNumber % 2 === 0 ? 1 : 0),
        defense: cur.defense + (roundNumber % 3 === 0 ? 1 : 0),
      };
      if (next.speed > cur.speed || next.defense > cur.defense) {
        ctx.state.scalingBonus[f.id] = next;
        pushTrigger(
          ctx.events,
          f,
          "SCALING",
          `${f.name} scales up (+${next.speed - cur.speed} SPD, +${
            next.defense - cur.defense
          } DEF).`,
        );
      }
    }
  }

  // BNB Fee Burn: weakens the opposing active Fini each round.
  if (activeA && activeA.passiveAbility === "FEE_BURN" && activeB) {
    ctx.state.feeBurnDefenseDebuff[activeB.id] =
      (ctx.state.feeBurnDefenseDebuff[activeB.id] ?? 0) + 1;
    pushTrigger(
      ctx.events,
      activeA,
      "FEE_BURN",
      `${activeA.name} burns fees off ${activeB.name}'s defense.`,
    );
  }
  if (activeB && activeB.passiveAbility === "FEE_BURN" && activeA) {
    ctx.state.feeBurnDefenseDebuff[activeA.id] =
      (ctx.state.feeBurnDefenseDebuff[activeA.id] ?? 0) + 1;
    pushTrigger(
      ctx.events,
      activeB,
      "FEE_BURN",
      `${activeB.name} burns fees off ${activeA.name}'s defense.`,
    );
  }

  return { teamA: nextA, teamB: nextB };
}

/**
 * UNI Swap: if low health, swap position with the next teammate.
 * Returns a possibly-reordered team. Called before the team's active
 * Fini attacks.
 */
export function applyPassiveSwapIfNeeded(args: {
  team: Team;
  ctx: PassiveTriggerContext;
}): Team {
  const { team, ctx } = args;
  if (!ctx.enable) return team;

  const activeIdx = team.finis.findIndex(
    (f) => !f.fainted && f.currentHealth > 0,
  );
  if (activeIdx < 0) return team;
  const active = team.finis[activeIdx]!;
  if (active.passiveAbility !== "SWAP") return team;
  if (ctx.state.swapUsed[active.id]) return team;
  if (active.currentHealth > active.maxHealth * 0.35) return team;

  // Find next alive teammate after active.
  for (let i = activeIdx + 1; i < team.finis.length; i++) {
    const candidate = team.finis[i]!;
    if (!candidate.fainted && candidate.currentHealth > 0) {
      ctx.state.swapUsed[active.id] = true;
      const next = [...team.finis] as Team["finis"];
      next[activeIdx] = candidate;
      next[i] = active;
      pushTrigger(
        ctx.events,
        active,
        "SWAP",
        `${active.name} swaps with ${candidate.name} — fluid liquidity.`,
      );
      return { ...team, finis: next };
    }
  }
  return team;
}

/** Speed boost from MATIC Scaling. Adds to base speed when picking turn order. */
export function getEffectiveSpeed(fini: Fini, ctx: PassiveTriggerContext): number {
  const bonus = ctx.state.scalingBonus[fini.id]?.speed ?? 0;
  return fini.speed + bonus;
}

/** Defense modifier including MATIC Scaling and BNB Fee Burn debuff. */
export function getEffectiveDefense(fini: Fini, ctx: PassiveTriggerContext): number {
  const scaling = ctx.state.scalingBonus[fini.id]?.defense ?? 0;
  const debuff = ctx.state.feeBurnDefenseDebuff[fini.id] ?? 0;
  return Math.max(0, fini.defense + scaling - debuff);
}

/**
 * Helper: family of available signals plus SOL nudge to attack order.
 * Returns "first attacker" team key.
 */
export function decideFirstAttacker(args: {
  attackerA: Fini;
  attackerB: Fini;
  signals: MarketSignalMap;
  ctx: PassiveTriggerContext;
}): "teamA" | "teamB" {
  const { attackerA, attackerB, signals, ctx } = args;
  let speedA = getEffectiveSpeed(attackerA, ctx);
  let speedB = getEffectiveSpeed(attackerB, ctx);

  // SOL High Throughput: extra chance to attack first when positive momentum.
  if (attackerA.passiveAbility === "HIGH_THROUGHPUT") {
    const sig: MarketSignal = signals[attackerA.family];
    if (sig.direction === "up") speedA += 2 + sig.momentumScore * 2;
  }
  if (attackerB.passiveAbility === "HIGH_THROUGHPUT") {
    const sig: MarketSignal = signals[attackerB.family];
    if (sig.direction === "up") speedB += 2 + sig.momentumScore * 2;
  }

  // Market momentum nudges speed slightly so green candles act first.
  speedA += signals[attackerA.family].momentumScore * 1.5;
  speedB += signals[attackerB.family].momentumScore * 1.5;

  // Tiny random jitter avoids deterministic ties.
  speedA += ctx.rng.range(0, 0.5);
  speedB += ctx.rng.range(0, 0.5);

  return speedA >= speedB ? "teamA" : "teamB";
}
