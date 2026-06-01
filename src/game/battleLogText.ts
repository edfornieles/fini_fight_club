import type { CoinFamily, Fini, MarketDirection, MarketSignal } from "./types";

/**
 * Flavor text generator. The battle engine asks for short, mythic,
 * financial-folktale phrases. The vocabulary list comes from the brief:
 *   market mood, momentum, panic, green candle, red wick, volatility
 *   surge, family pressure, coin spirit, liquidity tremor, cute violence,
 *   oracle trembles, diamond body, meme spike, compound pressure.
 *
 * DETERMINISM: phrase selection is derived deterministically from each call's
 * arguments (never `Math.random()`), so the entire battle event log — prose
 * included — is reproducible from the battle seed. This lets the full log be
 * hashed for verifiable on-chain settlement.
 */

/** Tiny stable string hash (FNV-1a-ish), non-negative. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic index into `len` from a key string. */
function pickIndex(key: string, len: number): number {
  return len <= 1 ? 0 : hashStr(key) % len;
}

const FAMILY_FLAVOR: Record<CoinFamily, { up: string[]; down: string[]; flat: string[] }> = {
  BTC: {
    up: ["Old Orange feels heavy and certain.", "Diamond pressure builds."],
    down: ["BTC turns inward and tightens its grip.", "Red wick wraps the body."],
    flat: ["BTC hums like a stone."],
  },
  ETH: {
    up: ["Soft Gwei hardens under the green candle.", "Compound pressure rises."],
    down: ["ETH gas drips cold from its hands.", "ETH shivers but does not flinch."],
    flat: ["ETH waits in a neutral block."],
  },
  SOL: {
    up: ["SOL throughput surges, the body vibrates.", "Fast Wick laughs and lunges."],
    down: ["SOL trips on its own latency.", "Throughput stutters."],
    flat: ["SOL paces with idle speed."],
  },
  DOGE: {
    up: ["Laugh Candle barks at the green sky.", "Meme spike incoming."],
    down: ["DOGE giggles nervously, eyes wide.", "The meme dims for a beat."],
    flat: ["DOGE smiles politely, plotting chaos."],
  },
  LINK: {
    up: ["Oracle Pup glows with confidence.", "The oracle trembles upward."],
    down: ["LINK reads sour numbers and steels itself.", "Oracle trembles in red."],
    flat: ["LINK listens for the price."],
  },
  UNI: {
    up: ["UNI swaps positions in pure liquidity joy."],
    down: ["UNI's pool drains slightly — pressure mounts."],
    flat: ["UNI ripples in place."],
  },
  AVAX: {
    up: ["Snowball gathers white momentum.", "Avalanche climbs the slope."],
    down: ["AVAX melts at the edges but stands.", "Snowpack cracks below."],
    flat: ["AVAX is silent on the ridge."],
  },
  BNB: {
    up: ["Fee Burner exhales fire across the arena.", "BNB heats the air."],
    down: ["BNB's flame dims to ember."],
    flat: ["BNB simmers patiently."],
  },
  MATIC: {
    up: ["MATIC scales up another layer.", "MATIC stacks routines beneath itself."],
    down: ["MATIC's layers wobble."],
    flat: ["MATIC compounds quietly in the corner."],
  },
  XTZ: {
    up: ["Self-Amender writes a better version of itself."],
    down: ["XTZ rewrites itself slower under pressure."],
    flat: ["XTZ self-amends a single line."],
  },
};

export function familyMarketLine(signal: MarketSignal): string {
  const lines = FAMILY_FLAVOR[signal.family][signal.direction];
  const idx = Math.floor(Math.abs(signal.momentumScore) * (lines.length - 0.001));
  const safeIdx = Math.min(lines.length - 1, Math.max(0, idx));
  const pct = signal.percentChange.toFixed(2);
  const tag = signal.direction === "up" ? "+" : signal.direction === "down" ? "" : "±";
  return `${signal.family} ${tag}${pct}%. ${lines[safeIdx]}`;
}

const TICK_PUMP = [
  "rips higher mid-fight",
  "catches a green candle",
  "pumps — the body surges",
  "moons a little",
  "finds bids and swells",
];
const TICK_DUMP = [
  "bleeds red mid-fight",
  "dumps — the body sags",
  "takes a red wick to the face",
  "loses its bid and wobbles",
  "slips down the chart",
];

/**
 * A live market swing during the battle. `delta` is the signed momentum
 * change this round; positive = the family is pumping (its Finis hit harder).
 */
export function marketTickLine(
  family: CoinFamily,
  _direction: MarketDirection,
  delta: number,
): string {
  const pumping = delta > 0;
  const pool = pumping ? TICK_PUMP : TICK_DUMP;
  const phrase = pool[pickIndex(`${family}:${delta.toFixed(4)}`, pool.length)];
  const arrow = pumping ? "📈" : "📉";
  const effect = pumping
    ? `${family} Finis hit harder`
    : `${family} Finis lose their edge`;
  return `${arrow} ${family} ${phrase} — ${effect}.`;
}

export function attackLine(attacker: Fini, defender: Fini, damage: number): string {
  const verbs = [
    "lunges at",
    "strikes",
    "headbutts",
    "swipes",
    "tail-whips",
    "rolls into",
    "tackles",
    "bites",
  ];
  const verb = verbs[pickIndex(`${attacker.id}>${defender.id}:${damage}`, verbs.length)];
  return `${attacker.name} (${attacker.family}) ${verb} ${defender.name} (${defender.family}) for ${damage} damage.`;
}

export function faintLine(fini: Fini): string {
  const tail = [
    "Its coin spirit drifts off.",
    "A small liquidity tremor passes through the arena.",
    "Family pressure releases.",
    "The market exhales.",
  ];
  const pick = tail[pickIndex(`${fini.id}:faint`, tail.length)];
  return `${fini.name} (${fini.family}) faints. ${pick}`;
}

export function damageLine(fini: Fini, dmg: number, remaining: number): string {
  return `${fini.name} takes ${dmg} damage. ${remaining} HP remaining.`;
}

export function deathModeStakeLine(fini: Fini): string {
  return `${fini.family} Fini #${fini.tokenId ?? fini.id} is now exposed.`;
}

export function deathModeOpeningLines(): string[] {
  return [
    "Death Mode has been accepted.",
    "Each side has placed one Fini at risk.",
    "The arena locks.",
    "No more running.",
  ];
}

export function deathModeClosingLines(wonFamily: CoinFamily, wonId: string): string[] {
  return [
    "Death Mode Complete.",
    `The winning team claims ${wonFamily} Fini #${wonId}.`,
    "The losing Fini leaves its old family behind.",
  ];
}
