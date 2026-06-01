/**
 * Tuning knobs for the run-based meta-loop. Keep these all in one
 * place so balance can be iterated without combing the codebase.
 */

export const STARTING_LIVES = 3;
export const STARTING_GOLD = 10;

export const SHOP_UNIT_SLOTS = 3;
export const SHOP_ITEM_SLOTS = 1;

export const ROLL_COST = 1;
export const UNIT_COST = 3;
export const SELL_REFUND = 1;

export const ENCOUNTERS_PER_STAGE = 3;
export const FINAL_STAGE = 3;

export const GOLD_REWARD_PER_FIGHT_WIN = 4;
export const GOLD_REWARD_PER_BOSS_WIN = 8;
export const TROPHIES_PER_BOSS_WIN = 1;

export const POST_STAGE_GOLD_REFRESH = 4; // gold granted at start of each stage

// ─────────────── Ranked / PvP ───────────────
/** Gold pool the player drafts with before each ranked match. */
export const RANKED_DRAFT_GOLD = 14;
