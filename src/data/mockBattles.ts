import type { LivePrices } from "../hooks/useLivePrices";

export type BattleStatus = "live" | "upcoming" | "resolving" | "resolved";
export type BattleType = "updown" | "abovebelow" | "outperform" | "hitprice" | "range" | "volatility" | "clanwar";

export interface Battle {
  id: string;
  title: string;
  question: string;
  type: BattleType;
  status: BattleStatus;
  sideA: { label: string; pct: number; color: string };
  sideB: { label: string; pct: number; color: string };
  assets: string[];
  volumeK: number;
  endsInMs: number;
  familyA?: string;
  familyB?: string;
  durationLabel: string;
}

const M = 60 * 1000;
const H = 60 * M;

// Up/Down battles for every major coin
const upDownBattles: Battle[] = [
  { id: "btc-updown-15m",  title: "BTC Up or Down 15m",   question: "Will BTC close higher than its opening price in this 15-minute window?", type: "updown", status: "live",     assets: ["BTC"],  sideA: { label: "Up", pct: 54, color: "#22c55e" }, sideB: { label: "Down", pct: 46, color: "#ef4444" }, volumeK: 28,  endsInMs: 9*M,       familyA: "BTC",    durationLabel: "15m" },
  { id: "btc-updown-1h",   title: "BTC Up or Down Hourly", question: "Will BTC close higher than its opening price this hour?",                type: "updown", status: "live",     assets: ["BTC"],  sideA: { label: "Up", pct: 51, color: "#22c55e" }, sideB: { label: "Down", pct: 49, color: "#ef4444" }, volumeK: 89,  endsInMs: 37*M,      familyA: "BTC",    durationLabel: "1h"  },
  { id: "eth-updown-1h",   title: "ETH Up or Down Hourly", question: "Will ETH close higher than its opening price this hour?",                type: "updown", status: "live",     assets: ["ETH"],  sideA: { label: "Up", pct: 48, color: "#22c55e" }, sideB: { label: "Down", pct: 52, color: "#ef4444" }, volumeK: 66,  endsInMs: 22*M,      familyA: "ETH",    durationLabel: "1h"  },
  { id: "sol-updown-1h",   title: "SOL Up or Down Hourly", question: "Will SOL close higher than its opening price this hour?",                type: "updown", status: "live",     assets: ["SOL"],  sideA: { label: "Up", pct: 61, color: "#22c55e" }, sideB: { label: "Down", pct: 39, color: "#ef4444" }, volumeK: 41,  endsInMs: 51*M,      familyA: "SOL",durationLabel: "1h"  },
  { id: "doge-updown-1h",  title: "DOGE Up or Down Hourly",question: "Will DOGE close higher than its opening price this hour?",               type: "updown", status: "live",     assets: ["DOGE"], sideA: { label: "Up", pct: 67, color: "#22c55e" }, sideB: { label: "Down", pct: 33, color: "#ef4444" }, volumeK: 54,  endsInMs: 41*M,      familyA: "DOGE", durationLabel: "1h"  },
  { id: "bnb-updown-1h",   title: "BNB Up or Down Hourly", question: "Will BNB close higher than its opening price this hour?",                type: "updown", status: "live",     assets: ["BNB"],  sideA: { label: "Up", pct: 52, color: "#22c55e" }, sideB: { label: "Down", pct: 48, color: "#ef4444" }, volumeK: 29,  endsInMs: 11*H,      familyA: "BNB",    durationLabel: "1h"  },
  { id: "link-updown-1h",  title: "LINK Up or Down Hourly",question: "Will LINK close higher than its opening price this hour?",               type: "updown", status: "live", assets: ["LINK"], sideA: { label: "Up", pct: 50, color: "#22c55e" }, sideB: { label: "Down", pct: 50, color: "#ef4444" }, volumeK: 12,  endsInMs: H+20*M,    familyA: "LINK", durationLabel: "1h"  },
  { id: "avax-updown-1h",  title: "AVAX Up or Down Hourly",question: "Will AVAX close higher than its opening price this hour?",               type: "updown", status: "live", assets: ["AVAX"], sideA: { label: "Up", pct: 50, color: "#22c55e" }, sideB: { label: "Down", pct: 50, color: "#ef4444" }, volumeK: 9,   endsInMs: H+35*M,    familyA: "AVAX", durationLabel: "1h"  },
  { id: "matic-updown-1h", title: "MATIC Up or Down Hourly",question: "Will MATIC close higher than its opening price this hour?",             type: "updown", status: "live", assets: ["MATIC"],sideA: { label: "Up", pct: 50, color: "#22c55e" }, sideB: { label: "Down", pct: 50, color: "#ef4444" }, volumeK: 8,   endsInMs: H+50*M,    familyA: "MATIC",durationLabel: "1h"  },
  { id: "uni-updown-1h",   title: "UNI Up or Down Hourly", question: "Will UNI close higher than its opening price this hour?",                type: "updown", status: "live", assets: ["UNI"],  sideA: { label: "Up", pct: 50, color: "#22c55e" }, sideB: { label: "Down", pct: 50, color: "#ef4444" }, volumeK: 7,   endsInMs: 2*H,       familyA: "UNI", durationLabel: "1h"  },
];

// Every coin vs every other coin (outperform) — 2h window
const COINS = ["BTC","ETH","SOL","DOGE","BNB","LINK","AVAX","MATIC","UNI","XTZ"];
const FAMILIES: Record<string, string> = {
  BTC: "BTC", ETH: "ETH", SOL: "SOL", DOGE: "DOGE",
  BNB: "BNB", LINK: "LINK", AVAX: "AVAX",
  MATIC: "MATIC", UNI: "UNI", XTZ: "XTZ",
};
// Seeded pseudo-random for stable odds
function seedPct(a: string, b: string): number {
  const hash = (a + b).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0);
  return 35 + (hash % 30); // 35–65%
}
function seedVol(a: string, b: string): number {
  const hash = (a + b).split("").reduce((h, c) => (h * 17 + c.charCodeAt(0)) & 0xffff, 0);
  return 10 + (hash % 150);
}
function seedTime(i: number): number {
  const times = [8*M, 22*M, 37*M, 51*M, H+5*M, H+20*M, H+40*M, 2*H, 2*H+30*M, 3*H];
  return times[i % times.length];
}

const outperformBattles: Battle[] = [];
let idx = 0;
for (let i = 0; i < COINS.length; i++) {
  for (let j = i + 1; j < COINS.length; j++) {
    const a = COINS[i], b = COINS[j];
    const pctA = seedPct(a, b);
    // Every battle in a recurring series is always live until it ends —
    // there's no waiting state. The next round spawns the moment one closes.
    const status: BattleStatus = "live";
    outperformBattles.push({
      id: `${a.toLowerCase()}-vs-${b.toLowerCase()}-2h`,
      title: `${FAMILIES[a]} vs ${FAMILIES[b]}`,
      question: `Will ${a} outperform ${b} over the next 2 hours?`,
      type: "outperform",
      status,
      assets: [a, b],
      sideA: { label: a, pct: pctA,       color: "#627eea" },
      sideB: { label: b, pct: 100-pctA,   color: "#9945ff" },
      volumeK: seedVol(a, b),
      endsInMs: seedTime(idx),
      familyA: FAMILIES[a],
      familyB: FAMILIES[b],
      durationLabel: "2h",
    });
    idx++;
  }
}

// Special battles
const specialBattles: Battle[] = [
  { id: "daily-clan-war",       title: "Daily Clan War",       question: "Which Fini family performs best over the next 24 hours?",    type: "clanwar",   status: "live",  assets: ["BTC","ETH","SOL","DOGE"], sideA: { label: "BTC", pct: 31, color: "#f7931a" }, sideB: { label: "ETH", pct: 28, color: "#627eea" }, volumeK: 204, endsInMs: 18*H, familyA: "BTC", familyB: "ETH", durationLabel: "24h" },
  { id: "link-volatility-2h",   title: "LINK Volatility Battle",question: "Will LINK move more than 5% in either direction over 2 hours?",type: "volatility", status: "live",  assets: ["LINK"],                   sideA: { label: "Storm ≥5%", pct: 29, color: "#22c55e" }, sideB: { label: "Calm <5%",  pct: 71, color: "#ef4444" }, volumeK: 18,  endsInMs: 2*H,  familyA: "LINK",             durationLabel: "2h"  },
  // Resolved/audit demos
  { id: "btc-updown-hourly-resolved",  title: "BTC Up or Down Hourly", question: "Will BTC close higher than its opening price this hour?",      type: "updown",   status: "resolved", assets: ["BTC"],      sideA: { label: "Up",  pct: 54, color: "#22c55e" }, sideB: { label: "Down", pct: 46, color: "#ef4444" }, volumeK: 89,  endsInMs: -1, familyA: "BTC",                  durationLabel: "1h"  },
  { id: "eth-sol-outperform-resolved", title: "ETH vs SOL", question: "Will ETH outperform SOL over the next 2 hours?",          type: "outperform",status: "resolved", assets: ["ETH","SOL"],sideA: { label: "ETH", pct: 57, color: "#627eea" }, sideB: { label: "SOL",  pct: 43, color: "#9945ff" }, volumeK: 142, endsInMs: -1, familyA: "ETH", familyB: "SOL", durationLabel: "2h"  },
  { id: "btc-above-100k-review",       title: "BTC Breaks the Gate",   question: "Will BTC be above $100,000 at daily close?",                   type: "abovebelow",status: "resolving", assets: ["BTC"],     sideA: { label: "Yes", pct: 44, color: "#22c55e" }, sideB: { label: "No",   pct: 56, color: "#ef4444" }, volumeK: 211, endsInMs: -1, familyA: "BTC",                  durationLabel: "24h" },
  { id: "sol-updown-15m-voided",       title: "SOL Up or Down 15m",    question: "Will SOL close higher than its opening price in this 15-minute window?", type: "updown", status: "resolved", assets: ["SOL"], sideA: { label: "Up",  pct: 61, color: "#22c55e" }, sideB: { label: "Down", pct: 39, color: "#ef4444" }, volumeK: 31,  endsInMs: -1, familyA: "SOL",              durationLabel: "15m" },
];

export const MOCK_BATTLES: Battle[] = [...upDownBattles, ...outperformBattles, ...specialBattles];

export function getBattlesByAsset(asset: string): Battle[] {
  const a = asset.toUpperCase();
  return MOCK_BATTLES.filter(b => b.assets.some(x => x === a));
}

export function getBattleById(id: string): Battle | undefined {
  return MOCK_BATTLES.find(b => b.id === id);
}

export const ASSET_META: Record<string, {
  name: string; symbol: string; coingeckoId: string;
  family: string; tagline: string; emoji: string; color: string;
}> = {
  BTC:  { name: "Bitcoin",   symbol: "BTC",  coingeckoId: "bitcoin",       family: "BTC",     tagline: "Gravity & tanks — the heaviest hitters in the arena",         emoji: "👑", color: "#f7931a" },
  ETH:  { name: "Ethereum",  symbol: "ETH",  coingeckoId: "ethereum",      family: "ETH",     tagline: "Cathedral mages — volatile, brilliant, unpredictable",        emoji: "🔮", color: "#627eea" },
  SOL:  { name: "Solana",    symbol: "SOL",  coingeckoId: "solana",        family: "SOL", tagline: "Speed demons — fastest clan, highest chaos ceiling",          emoji: "⚡", color: "#9945ff" },
  DOGE: { name: "Dogecoin",  symbol: "DOGE", coingeckoId: "dogecoin",      family: "DOGE",  tagline: "Meme chaos — impossible to predict, impossible to stop",      emoji: "🐕", color: "#c3a634" },
  LINK: { name: "Chainlink", symbol: "LINK", coingeckoId: "chainlink",     family: "LINK",  tagline: "Oracle monks — slow, reliable, deadly on reversal",           emoji: "🔗", color: "#2a5ada" },
  UNI:  { name: "Uniswap",   symbol: "UNI",  coingeckoId: "uniswap",       family: "UNI",  tagline: "Market makers — shift probabilities mid-battle",             emoji: "🦄", color: "#ff007a" },
  AVAX: { name: "Avalanche", symbol: "AVAX", coingeckoId: "avalanche-2",   family: "AVAX",  tagline: "Mountain warriors — high altitude, high variance",            emoji: "🏔", color: "#e84142" },
  BNB:  { name: "BNB",       symbol: "BNB",  coingeckoId: "binancecoin",   family: "BNB",     tagline: "Exchange fighters — disciplined, organised, hard to beat",   emoji: "⭕", color: "#f3ba2f" },
  MATIC:{ name: "Polygon",   symbol: "MATIC",coingeckoId: "matic-network", family: "MATIC", tagline: "Layer 2 runners — low cost, high frequency, swarm tactics",  emoji: "🔷", color: "#8247e5" },
  XTZ:  { name: "Tezos",     symbol: "XTZ",  coingeckoId: "tezos",         family: "XTZ",    tagline: "Self-amending council — patient, resilient, underestimated", emoji: "🧊", color: "#a6e000" },
};

export function computeOdds(change24h: number): { pctA: number; pctB: number } {
  const bias = Math.min(15, Math.max(-15, change24h * 1.5));
  const pctA = Math.round(50 + bias);
  return { pctA, pctB: 100 - pctA };
}

export function liveVolume(_prices: LivePrices, asset: string): number {
  const base: Record<string, number> = { BTC: 120, ETH: 90, SOL: 60, DOGE: 50, BNB: 40 };
  return base[asset] ?? 20;
}
