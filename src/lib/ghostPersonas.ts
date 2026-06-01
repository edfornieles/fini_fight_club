/**
 * Ghost-wallet personas.
 *
 * Every Fini holder wallet gets a deterministic persona derived from its
 * address — a recognizable handle, a tier emoji (🐋 whale / 📊 trader /
 * 🥚 newcomer), and a procedurally-generated "fame" stat (recent streak,
 * 24h P&L) shown in the activity feed.
 *
 * Why: a 1700-holder snapshot feels lifeless if every entry just says
 * "0x4733…2679 bet 134 FINI$". Recognisable identities make the feed
 * feel like a real prediction market with characters, not random hex.
 *
 * Everything is deterministic from the wallet address so the same wallet
 * always shows the same name + emoji + bias across sessions. Stats that
 * imply a track record (today's P&L, win rate) are derived from a stable
 * pseudo-random seed too — consistent but not actually persisted.
 */

const HANDLES_ADJ = [
  "swift", "diamond", "calm", "sharp", "lucky", "midnight", "quiet", "bold",
  "feral", "tiny", "tall", "rusty", "silver", "crimson", "moss", "neon",
  "blue", "honey", "rapid", "slow", "soft", "wild", "fast", "icy",
];
const HANDLES_NOUN = [
  "fox", "moth", "tiger", "panther", "raven", "owl", "wolf", "swan",
  "snail", "hawk", "lynx", "robin", "beetle", "crane", "doe", "elk",
  "finch", "heron", "jay", "magpie", "newt", "otter", "puma", "stag",
];
const FAMOUS_HANDLES: Record<string, string> = {
  // Hand-curated names for the top whales so they feel like real on-chain personalities
  "0x18ce6cd5c283dca2f50c8347420607a4e59716a6": "sam_spike",
  "0x6266dbb2d202d4e246ee86d76bb2fbb9a71eafcd": "jorgelopez",
  "0x28d2d8d8780ff95d94689ce59f031cf829a41d40": "0xpresley",
  "0xcbbea7ec33d60db283ab79bdac9ffbfa46a83134": "llovd",
  "0x5c47c9ab05716d26d6e339eb19d2be3a0b0b097e": "dollar.monopoly",
};

export type GhostTier = "whale" | "trader" | "newcomer";
export type GhostBias = "momentum" | "contrarian" | "loyalist" | "swing" | "balanced";

export interface GhostPersona {
  wallet: string;
  shortWallet: string;
  handle: string;
  tier: GhostTier;
  tierIcon: string;
  bias: GhostBias;
  /** Synthesized "vibe" stat for feed flavor — e.g. "🔥 3 wins streak" */
  fameTag: string | null;
  /** Synthesized 24h P&L. Positive = green, negative = red. */
  pnl24h: number;
  ownedCount: number;
}

// Simple stable hash for derived randomness
function hash(s: string, salt = ""): number {
  let h = 2166136261;
  const x = salt + s;
  for (let i = 0; i < x.length; i++) {
    h ^= x.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const cache = new Map<string, GhostPersona>();

export function personaFor(wallet: string, ownedCount = 0): GhostPersona {
  const key = wallet.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const h1 = hash(key, "name1");
  const h2 = hash(key, "name2");
  const h3 = hash(key, "bias");
  const h4 = hash(key, "fame");
  const h5 = hash(key, "pnl");

  const tier: GhostTier = ownedCount >= 50 ? "whale" : ownedCount >= 5 ? "trader" : "newcomer";
  const tierIcon = tier === "whale" ? "🐋" : tier === "trader" ? "📊" : "🥚";

  const handle = FAMOUS_HANDLES[key]
    ?? `${pick(HANDLES_ADJ, h1)}_${pick(HANDLES_NOUN, h2)}`;

  const bias: GhostBias = pick(["momentum", "contrarian", "loyalist", "swing", "balanced"], h3) as GhostBias;

  // Synthesise a "fame tag" for ~30% of personas to keep the feed varied
  const fameRoll = h4 % 100;
  let fameTag: string | null = null;
  if (tier === "whale") {
    fameTag = `🐋 holds ${ownedCount}`;
  } else if (fameRoll < 8) {
    const streak = 3 + (h4 % 6);
    fameTag = `🔥 ${streak}W streak`;
  } else if (fameRoll < 16) {
    fameTag = `📈 hot today`;
  } else if (fameRoll < 22) {
    fameTag = `❄️ cold today`;
  } else if (fameRoll < 28) {
    fameTag = `🆕 just joined`;
  }

  // Synthesised 24h P&L — biased positive for whales/traders (they win
  // more on average because they have bigger Crumbs to spend) and around-zero
  // for newcomers.
  const pnlBase = tier === "whale" ? 800 : tier === "trader" ? 200 : 30;
  const pnlSign = (h5 % 10) < 6 ? 1 : -1; // 60% chance of green
  const pnlMag = Math.floor(((h5 >>> 4) % pnlBase) * 1.5);
  const pnl24h = pnlSign * pnlMag;

  const shortWallet = wallet.length >= 10 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
  const persona: GhostPersona = {
    wallet: key, shortWallet, handle,
    tier, tierIcon, bias, fameTag,
    pnl24h, ownedCount,
  };
  cache.set(key, persona);
  return persona;
}

/**
 * Decide which side a persona would forecast on, based on their bias and
 * the live market state. Reacts to real signals — momentum traders chase
 * the leader, contrarians back the underdog, loyalists pick their favourite
 * side, swing traders look for divergence, balanced players take the
 * fair-odds-weighted coin flip.
 *
 * Returns null when the persona decides to sit out this opportunity.
 */
interface MarketCtx {
  sideAPct: number;          // 0-100, current market %
  intraWindowReturnA?: number | null; // -0.05..+0.05 etc, for primary asset
}
export function personaPickSide(persona: GhostPersona, ctx: MarketCtx): "A" | "B" | null {
  const { bias } = persona;
  const diff = ctx.sideAPct - 50; // positive = A leading
  const ret = ctx.intraWindowReturnA ?? 0;

  switch (bias) {
    case "momentum":
      // Chase the leader if it's gained ≥7% from neutral
      if (Math.abs(diff) < 7) return null;
      return diff > 0 ? "A" : "B";
    case "contrarian":
      // Back the underdog if they're below 40%
      if (ctx.sideAPct < 40) return "A";
      if (ctx.sideAPct > 60) return "B";
      return null;
    case "loyalist":
      // Always pick A — these are the "BTC Up forever" types
      return "A";
    case "swing":
      // React to the live underlying — pick the side reality is confirming
      if (Math.abs(ret) < 0.001) return null;
      return ret > 0 ? "A" : "B";
    case "balanced":
    default:
      // Fair-odds-weighted: A more likely when A is favoured, but still some entropy
      return Math.random() < (ctx.sideAPct / 100) ? "A" : "B";
  }
}
