/**
 * Deterministic team names. Every wallet gets a stable, cute squad name so
 * battles read "Volatility Cult vs Gas Goblins" instead of hex vs hex.
 * The player can override theirs (persisted per wallet in localStorage).
 */

const ADJ = [
  "Volatility", "Diamond", "Midnight", "Feral", "Liquid", "Rugproof",
  "Gas", "Moon", "Crimson", "Honey", "Neon", "Slippage", "Quantum",
  "Whale", "Pixel", "Sleepless", "Golden", "Storm", "Velvet", "Iron",
];
const NOUN = [
  "Cult", "Squad", "Syndicate", "Pack", "Council", "Brigade", "Club",
  "Collective", "Goblins", "Wraiths", "Hounds", "Riders", "Circus",
  "Cartel", "Choir", "Battalion", "Society", "Parade", "Coven", "Crew",
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable generated name for any wallet/handle seed. */
export function generatedTeamName(seed: string): string {
  const h = hashStr(seed.toLowerCase());
  return `${ADJ[h % ADJ.length]} ${NOUN[Math.floor(h / 97) % NOUN.length]}`;
}

const KEY = (wallet: string) => `fini.fightclub.teamname.${wallet.toLowerCase()}`;

/** The player's team name: custom if saved, else generated from the wallet. */
export function myTeamName(wallet: string | null | undefined): string {
  if (!wallet) return "Your Team";
  try {
    const saved = localStorage.getItem(KEY(wallet));
    if (saved?.trim()) return saved.trim();
  } catch { /* private mode */ }
  return generatedTeamName(wallet);
}

export function saveMyTeamName(wallet: string, name: string) {
  try {
    if (name.trim()) localStorage.setItem(KEY(wallet), name.trim().slice(0, 28));
    else localStorage.removeItem(KEY(wallet));
  } catch { /* private mode */ }
}
