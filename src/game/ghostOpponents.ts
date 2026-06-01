/**
 * Ghost Opponents — the matchmaker's pool of "everyone else."
 *
 * On first call, fetches /data/ghostTeams.json (seeded from the on-chain
 * snapshot via scripts/seed-ghost-teams.mjs). Each holder maps to a 3-Fini
 * lineup, so when a live player queues a battle they're matched against a
 * real holder's roster — making the world feel populated from day 1.
 *
 * Per-token stats are generated deterministically from tokenId so the same
 * ghost is always the same Fini (no jitter between visits). Family is
 * picked from the family weights in taxonomy.json so the distribution
 * roughly matches the real collection.
 *
 * NOTE: this does NOT load per-token metadata from the API (would be 5k+
 * requests). Stats are seeded, not real traits. When real metadata is
 * wired in, replace `synthFini()` with a metadata-driven mapper.
 */

// Local Fini shape matching FightClubPage's BattleFini (flat, not the global type).
export interface GhostFini {
  id: number;
  family: string;
  clan: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  trait: string;
}

export interface GhostTeam {
  wallet: string;
  tokenIds: number[];
  ownedCount: number;
}

interface GhostTeamsFile {
  generatedAt: string;
  contract: string;
  totalHolders: number;
  teamCount: number;
  teams: GhostTeam[];
}

const FAMILIES = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];
// Rough weights from taxonomy.json — 1000 per family seemed to be the design,
// so even-weight is correct for a 10k collection.
const FAMILY_WEIGHTS = FAMILIES.map(() => 1);

const CLANS = [
  "Miners", "Cavemen Cuties", "Mystics", "Soldiers", "Artists",
  "Townspeople", "Royals", "Farmers", "Cooks", "Arms of the State",
  "Scribes", "Hourly", "Twice Daily",
];

const TRAITS = [
  "Volatility Sicko", "Late Believer", "Liquidation Burned",
  "Paper-Handed", "Diamond-Pawed", "Oracle Touched", "Self-Amend",
  "Compound Soul", "High Throughput", "Soft Gwei",
];

let _cache: GhostTeamsFile | null = null;
let _loading: Promise<GhostTeamsFile> | null = null;

/** Lazy-load and memoise the ghost teams file. */
export async function loadGhostTeams(): Promise<GhostTeamsFile> {
  if (_cache) return _cache;
  if (_loading) return _loading;
  _loading = fetch("/data/ghostTeams.json")
    .then(r => {
      if (!r.ok) throw new Error(`ghost teams not found (${r.status}) — run scripts/seed-ghost-teams.mjs`);
      return r.json() as Promise<GhostTeamsFile>;
    })
    .then(j => { _cache = j; return j; });
  return _loading;
}

// ── deterministic PRNG (matches the seed script's xmur3/mulberry32) ──────────
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFor(s: string) {
  const h = xmur3(s);
  return mulberry32(h());
}

function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Deterministically synthesise a battle-ready Fini for a tokenId.
 * Same tokenId → same Fini every time.
 */
export function synthFini(tokenId: number, powerScale = 1): GhostFini {
  const rng = rngFor(`fini:${tokenId}`);
  const family = pickWeighted(FAMILIES, FAMILY_WEIGHTS, rng);
  const clan = CLANS[Math.floor(rng() * CLANS.length)];
  const trait = TRAITS[Math.floor(rng() * TRAITS.length)];

  // Family-flavoured stat bias (matches existing generator vibes)
  const familyBias: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
    BTC:   { hp: 60, atk: 11, def: 8, spd: 4 },  // tanky
    ETH:   { hp: 55, atk: 12, def: 6, spd: 5 },
    SOL:   { hp: 45, atk: 14, def: 4, spd: 8 },  // glass cannon
    DOGE:  { hp: 50, atk: 13, def: 5, spd: 7 },
    BNB:   { hp: 52, atk: 11, def: 7, spd: 5 },
    LINK:  { hp: 55, atk: 10, def: 9, spd: 5 },
    AVAX:  { hp: 50, atk: 12, def: 6, spd: 6 },
    UNI:   { hp: 48, atk: 13, def: 5, spd: 7 },
    MATIC: { hp: 50, atk: 11, def: 6, spd: 6 },
    XTZ:   { hp: 52, atk: 11, def: 7, spd: 5 },
  };
  const b = familyBias[family] ?? familyBias.ETH;

  // Per-Fini noise so siblings differ
  const jitter = 0.85 + rng() * 0.3;
  const hp = Math.max(20, Math.round(b.hp * powerScale * jitter));
  return {
    id: tokenId,
    family,
    clan,
    hp, maxHp: hp,
    atk: Math.max(4, Math.round(b.atk * powerScale * jitter)),
    def: Math.max(2, Math.round(b.def * powerScale * jitter)),
    speed: Math.max(2, Math.round(b.spd * (0.9 + rng() * 0.2))),
    trait,
  };
}

/** Quick power estimate for a synth team, used for matchmaking band. */
export function ghostTeamPower(tokenIds: number[]): number {
  return tokenIds.map(id => synthFini(id)).reduce((sum, f) => sum + f.maxHp + f.atk * 3 + f.def * 2 + f.speed * 2, 0);
}

/**
 * Pick a ghost opponent within ±matchBand of `yourPower`.
 * Falls back to nearest team if no match within band.
 */
export async function pickGhostOpponent(yourPower: number, matchBand = 0.15): Promise<{
  wallet: string;
  finis: GhostFini[];
  ownedCount: number;
}> {
  const file = await loadGhostTeams();
  const teams = file.teams;
  if (teams.length === 0) throw new Error("ghost teams empty");

  // Power-band filter
  const min = yourPower * (1 - matchBand);
  const max = yourPower * (1 + matchBand);

  // Compute power per ghost (cached on the array)
  type ScoredTeam = GhostTeam & { power: number };
  const scored: ScoredTeam[] = teams.map(t => ({ ...t, power: ghostTeamPower(t.tokenIds) }));
  const inBand = scored.filter(t => t.power >= min && t.power <= max);

  // Pick from band, or fall back to nearest
  let chosen: ScoredTeam;
  if (inBand.length > 0) {
    chosen = inBand[Math.floor(Math.random() * inBand.length)];
  } else {
    // Sort by abs distance, take from the 10 closest for variety
    const byDist = scored.slice().sort((a, b) => Math.abs(a.power - yourPower) - Math.abs(b.power - yourPower));
    chosen = byDist[Math.floor(Math.random() * Math.min(10, byDist.length))];
  }

  // Scale per-fini power so the synth roster lands near the target
  const targetPerFini = yourPower / 3;
  const naivePerFini = chosen.power / 3;
  // Scale ghost stats to fully match the player's actual team power (which
  // already factors XP / level / items / wins via computeTeamPower). No upper
  // cap — at high levels the ghost should be a real fight, not a soft target.
  // Lower clamp at 0.5 so a vastly-overpowered player still gets *some* match.
  const scale = targetPerFini > 0 && naivePerFini > 0
    ? Math.max(0.5, targetPerFini / naivePerFini)
    : 1;

  return {
    wallet: chosen.wallet,
    ownedCount: chosen.ownedCount,
    finis: chosen.tokenIds.map(id => synthFini(id, scale)),
  };
}

/** Shorten a wallet for opponent display. */
export function shortenWallet(addr: string): string {
  if (!addr.startsWith("0x") || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
