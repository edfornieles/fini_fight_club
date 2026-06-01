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

export type CoinFamily =
  | "BTC"
  | "ETH"
  | "SOL"
  | "DOGE"
  | "LINK"
  | "UNI"
  | "AVAX"
  | "BNB"
  | "MATIC"
  | "XTZ";

export const ALL_COIN_FAMILIES: CoinFamily[] = [
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

export type PassiveAbility =
  | "DIAMOND_BODY"
  | "COMPOUND"
  | "HIGH_THROUGHPUT"
  | "MEME_SPIKE"
  | "ORACLE"
  | "SWAP"
  | "AVALANCHE"
  | "FEE_BURN"
  | "SCALING"
  | "SELF_AMEND";

export type AnimationState =
  | "idle"
  | "enter"
  | "attack"
  | "hit"
  | "passive"
  | "faint"
  | "celebrate"
  | "deathModeClaim";

export type Fini = {
  id: string;
  tokenId?: string;
  ownerAddress?: string;

  name: string;
  family: CoinFamily;

  modelUrl?: string;
  animationSet?: string;

  level: number;
  xp: number;

  strength: number;
  maxHealth: number;
  currentHealth: number;
  speed: number;
  defense: number;

  volatilityAffinity: number;
  cuteness: number;

  passiveAbility: PassiveAbility;

  /** Raw on-chain trait name (e.g. "Diamond Hands"). Carried for display. */
  special?: string;
  /** Raw on-chain mythical trait name. Carried for display. */
  mythical?: string;
  /** Resolved perk ID from the special trait. Used by battle engine. */
  specialPerk?: SpecialPerkId;
  /** Resolved perk ID from the mythical trait. Used by battle engine. */
  mythicalPerk?: MythicalPerkId;

  fainted?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────
// On-chain traits → battle stats (shared contract with the attributes stream)
//
// The ownership/data stream produces `FiniTraits` (normalized from the
// Finiliar metadata API). The attributes stream consumes them in
// `traitsToStats()` and returns a `BattleStatBlock`. These two types are the
// seam between the two workstreams — keep them stable.
// ─────────────────────────────────────────────────────────────────────────

/** Rarity tier. Hourly = most common … Monthly = rarest. */
export type FiniFrequency =
  | "Hourly"
  | "Daily"
  | "Twice-Daily"
  | "Weekly"
  | "Monthly";

/** Normalized, already-mapped traits for a single owned Fini. */
export type FiniTraits = {
  tokenId: number;
  /** Already mapped to a ticker: "Ethereum" → "ETH", "Tezos" → "XTZ", etc. */
  family: CoinFamily;
  /** Rarity tier → stat budget. */
  frequency: FiniFrequency;
  /** One of ~146 clan values. */
  clan: string;
  /** ~48 possible rare perks; most Finis have none. */
  special?: string;
  /** 3 possible very-rare perks. */
  mythical?: string;
  /** Live price move (real mood); informational for the attributes layer. */
  latestDelta: number;
};

// ─────────────────────────────────────────────────────────────────────────
// Special & Mythical perk IDs
// Full perk definitions (stat mods + mechanic descriptions) live in
// src/game/attributes.ts. These IDs are the stable handle used by the
// battle engine to look up runtime behaviour.
// ─────────────────────────────────────────────────────────────────────────

export type SpecialPerkId =
  | "DIAMOND_HANDS"   // immune to market-down penalty
  | "WHALE_ECHO"      // once: mirror highest-enemy str for 3 rounds
  | "FLASH_LOAN"      // ignore speed order in round 1
  | "RUGGED_PULL"     // on first hit taken: enemy -20% str rest of battle
  | "MOON_SHOT"       // if HP ≤ 40%: +50% str rest of battle (once)
  | "GAS_SURGE"       // +2 splash damage to all enemies when attacking
  | "BEAR_TRAP"       // reflect 40% of damage taken back
  | "PUMP_SIGNAL"     // on faint: next ally +5 str this battle
  | "YIELD_FARM"      // +1 str per round survived (max +5)
  | "LIQUIDITY_POOL"  // heal 2 HP at start of each round
  | "FRONT_RUN"       // always acts first every round
  | "COLD_WALLET"     // first 3 hits taken deal 0 damage
  | "HALVENING"       // every other round: strength doubles
  | "DEFI_DRAIN"      // each attack: steal 1 def from enemy permanently
  | "STABLECOIN"      // immune to ALL market modifier effects
  | "BRIDGE_BONUS"    // family counter bonus ×1.2 not ×1.1
  | "VALIDATOR_NODE"  // while on backline: +2 def to frontline ally
  | "SOFT_FORK"       // on level-up this run: +3 to lowest stat
  | "NFT_ROYALTY"     // heal 1 HP whenever any enemy attacks
  | "BLOCK_REWARD"    // +3 str if last Fini standing on your team
  | "GENESIS_MINT"    // at battle start: +2 to all stats
  | "PAPER_HANDS"     // market penalties hit 20% harder (rare downside)
  | "LEVERAGE_TRADE"  // market bonus doubled AND market penalty doubled
  | "WHALE_WALLET";   // +5 hp, -1 spd (big reserves, slow)

export type MythicalPerkId =
  | "GENESIS_BLOCK"   // survive one killing blow at 1 HP (once per battle)
  | "THE_MERGE"       // absorb a benched teammate's stats at battle start
  | "NAKAMOTO";       // family counts as ALL families for counter purposes

/** Level-1 base battle stats derived purely from traits. Deterministic. */
export type BattleStatBlock = {
  strength: number;
  maxHealth: number;
  speed: number;
  defense: number;
  /** 0..1 */
  volatilityAffinity: number;
  /** 0..1, flavour / tiebreak */
  cuteness: number;
  passiveAbility: PassiveAbility;
  /** Resolved special perk, if any. */
  specialPerk?: SpecialPerkId;
  /** Resolved mythical perk, if any. */
  mythicalPerk?: MythicalPerkId;
};

export type TeamSlot = "frontline" | "midline" | "backline";

export type Team = {
  id: string;
  playerId: string;
  name: string;
  finis: [Fini, Fini, Fini];
};

export type BattleWindow = "5m" | "1h" | "4h" | "24h";

export type MarketDirection = "up" | "down" | "flat";

export type MarketSignal = {
  family: CoinFamily;
  percentChange: number;
  volatility: number;
  direction: MarketDirection;
  /** normalized from -1 to +1 */
  momentumScore: number;
};

export type MarketSignalMap = Record<CoinFamily, MarketSignal>;

export type BattleMode = "FREE" | "RANKED" | "DEATH";

/**
 * The player's pre-battle "call" on the market. Picking a family that
 * actually pumps grants the player's team a conviction bonus. This is
 * what turns the market from a dice roll into a skill expression.
 */
export type MarketRead = {
  /** which side made the call (the human player is always teamA today) */
  side: "teamA" | "teamB";
  predictedFamily: CoinFamily;
};

export type BattleConfig = {
  mode: BattleMode;
  battleWindow: BattleWindow;
  maxRounds: number;
  /** default 0.65 */
  marketInfluence: number;
  /** default 0.35 */
  statInfluence: number;
  enablePassives: boolean;
  enableXP: boolean;
  simulatedDeathMode?: boolean;
  /** seed for deterministic battles in tests */
  seed?: number;
  /** optional pre-battle market prediction */
  marketRead?: MarketRead;
  /**
   * When true, family momentum drifts every round (a seeded random walk
   * scaled by volatility, mean-reverting toward the opening read). This is
   * what makes the live market swing the fight round-to-round instead of
   * being a one-time pre-fight stat check. Off by default so deterministic
   * balance tests keep their fixed signals.
   */
  liveMarket?: boolean;
};

export type XPAward = {
  finiId: string;
  amount: number;
  reasons: string[];
};

export type LevelUpRecord = {
  finiId: string;
  fromLevel: number;
  toLevel: number;
  statDeltas: {
    strength: number;
    maxHealth: number;
  };
};

// ─────────────────────────────────────────────────────────────────────────
// Death Mode
// ─────────────────────────────────────────────────────────────────────────

export type DeathModeStake = {
  playerId: string;
  finiId: string;
  tokenId?: string;
  confirmed: boolean;
};

export type DeathModeConfig = {
  enabled: boolean;
  simulatedOnly: boolean;
  stakes: {
    teamA: DeathModeStake;
    teamB: DeathModeStake;
  };
};

export type DeathModeResult = {
  winnerPlayerId: string;
  loserPlayerId: string;
  wonFiniId: string;
  lostFiniId: string;
  simulatedTransferComplete: boolean;
};

// ─────────────────────────────────────────────────────────────────────────
// Battle events
// ─────────────────────────────────────────────────────────────────────────

export type BattleEvent =
  | { type: "BATTLE_START"; message: string }
  | { type: "ROUND_START"; roundNumber: number; message: string }
  | {
      type: "ATTACK";
      attackerId: string;
      defenderId: string;
      damage: number;
      message: string;
    }
  | {
      type: "DAMAGE";
      finiId: string;
      amount: number;
      remainingHealth: number;
      message: string;
    }
  | {
      type: "PASSIVE_TRIGGER";
      finiId: string;
      passive: PassiveAbility;
      message: string;
    }
  | { type: "FAINT"; finiId: string; message: string }
  | {
      type: "FAMILY_MARKET_SIGNAL";
      family: CoinFamily;
      signal: MarketSignal;
      message: string;
    }
  | {
      type: "MARKET_READ";
      side: "teamA" | "teamB";
      predictedFamily: CoinFamily;
      correct: boolean;
      message: string;
    }
  | {
      type: "MARKET_TICK";
      roundNumber: number;
      family: CoinFamily;
      direction: MarketDirection;
      /** momentum after the tick, -1..1 */
      momentumScore: number;
      /** signed change in momentum this round */
      delta: number;
      message: string;
    }
  | { type: "LEVEL_UP"; finiId: string; newLevel: number; message: string }
  | {
      type: "DEATH_MODE_STAKE";
      finiId: string;
      playerId: string;
      message: string;
    }
  | {
      type: "DEATH_MODE_TRANSFER";
      winnerPlayerId: string;
      loserPlayerId: string;
      wonFiniId: string;
      message: string;
    }
  | { type: "BATTLE_END"; winner: "teamA" | "teamB"; message: string };

export type BattleRound = {
  roundNumber: number;
  /** Damage totals per attacker in the round (for analytics). */
  damageByFini: Record<string, number>;
  faintedFiniIds: string[];
};

export type BattleResult = {
  winner: "teamA" | "teamB";
  loser: "teamA" | "teamB";

  rounds: BattleRound[];
  events: BattleEvent[];

  finalTeams: {
    teamA: Fini[];
    teamB: Fini[];
  };

  xpAwards: XPAward[];
  levelUps: LevelUpRecord[];

  summary: {
    totalRounds: number;
    bestFiniId: string;
    strongestMarketFamily: CoinFamily;
    highestDamageDealerId?: string;
  };

  deathModeResult?: DeathModeResult;
};
