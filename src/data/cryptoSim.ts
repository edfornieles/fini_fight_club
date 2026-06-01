/**
 * Crypto Arena live activity simulation.
 *
 * Until the real Supabase backend is wired into the frontend, this module
 * simulates user activity using real Fini holder wallets from ghostTeams.json.
 * It maintains:
 *   - dynamic per-battle odds (drift toward the side users are picking)
 *   - dynamic per-battle volume (incremented on each simulated entry)
 *   - a rolling feed of recent predictions (wallet, side, amount, battleId)
 *
 * One tick every ~3 seconds spawns 1-3 entries across random battles. The
 * effect: cards visibly shift their Up/Down % and volume numbers while the
 * page is open, and a recent-predictions sidebar streams in real holder names.
 */

import { create } from "zustand";
import { MOCK_BATTLES, type Battle } from "./mockBattles";
import { getCachedPrices } from "../lib/priceProviders";
import { snapBattleOpening, intraWindowReturn } from "../lib/openingPrices";
import { personaFor, personaPickSide } from "../lib/ghostPersonas";

// Parse "15m" / "1h" / "24h" → milliseconds
function parseDuration(label: string): number {
  const m = /^(\d+)(m|h)$/.exec(label.trim());
  if (!m) return 60 * 60 * 1000;
  const n = Number(m[1]);
  return m[2] === "h" ? n * 60 * 60 * 1000 : n * 60 * 1000;
}

// Deterministic 0..1 hash from a battle id — used as the "destined winner"
// signal for non-asset battles (clan war, volatility) where we have no live
// price to track. Stable per battle so the bias doesn't flip-flop.
function battleSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Compute what the fair probability for side A *should* be, given:
 *  - the asset's live % change vs opening (for Up/Down battles)
 *  - the time remaining vs total duration (more time = stay closer to 50/50)
 *
 * As resolution approaches, the lead amplifies — matching real prediction
 * markets where odds compress to 95%+/5%- in the final minutes.
 */
function fairOddsForBattle(battle: Battle, initialEndsAt: number): number {
  const totalDuration = parseDuration(battle.durationLabel);
  const remaining = Math.max(0, initialEndsAt - Date.now());
  const elapsedFraction = Math.min(1, Math.max(0, (totalDuration - remaining) / totalDuration));
  // Time pressure: starts at 0.2 (mostly random), reaches 1.0 at T=0
  const tightness = 0.2 + 0.8 * Math.pow(elapsedFraction, 1.5);

  // Try to read the real lead from live prices for Up/Down battles
  if (battle.type === "updown" && battle.assets.length === 1) {
    const sym = battle.assets[0];
    const prices = getCachedPrices();
    const p = prices?.[sym];
    if (p && p.usd_24h_change != null) {
      // Use a recent slice of 24h change as a proxy for window-period change.
      // (For a true implementation we'd snapshot opening price per battle and
      // diff to current; this is a reasonable approximation.)
      const lead = p.usd_24h_change / 100; // -0.05 = 5% down, +0.03 = 3% up
      // Map lead × tightness into 5..95% range
      const skew = Math.tanh(lead * 20 * tightness); // tanh keeps it bounded
      return 0.5 + skew * 0.45;
    }
  }
  // Outperform: compare both assets' live changes
  if (battle.type === "outperform" && battle.assets.length === 2) {
    const prices = getCachedPrices();
    const pA = prices?.[battle.assets[0]];
    const pB = prices?.[battle.assets[1]];
    if (pA?.usd_24h_change != null && pB?.usd_24h_change != null) {
      const lead = (pA.usd_24h_change - pB.usd_24h_change) / 100;
      const skew = Math.tanh(lead * 30 * tightness);
      return 0.5 + skew * 0.45;
    }
  }
  // Fallback for clan-war / volatility / no-price-data: use deterministic
  // seed as the "destined winner" and let tightness amplify the bias.
  const seed = battleSeed(battle.id);
  // Seed > 0.5 → A is destined winner; <0.5 → B. Bias strength scales w/ tightness.
  const direction = seed > 0.5 ? 1 : -1;
  const intensity = Math.abs(seed - 0.5) * 2; // 0..1
  return 0.5 + direction * intensity * tightness * 0.45;
}


interface GhostTeam { wallet: string; ownedCount: number }
// We use the TOP 100 by ownedCount as the active automated-trader pool.
// These are the players the crypto arena feed populates with — recognisable
// personas, deterministic biases, reacting to real market signals.
const TOP_N_ACTIVE_TRADERS = 100;
let ghostWallets: GhostTeam[] = [];
let walletsLoaded = false;

async function loadWallets() {
  if (walletsLoaded) return;
  walletsLoaded = true;
  try {
    const r = await fetch("/data/ghostTeams.json");
    if (r.ok) {
      const j = await r.json();
      // Sort by holdings desc and take the top 100 — these are our active
      // automated traders. Bigger holders show up more often, larger bets.
      const all: GhostTeam[] = j.teams ?? [];
      ghostWallets = all
        .slice()
        .sort((a, b) => b.ownedCount - a.ownedCount)
        .slice(0, TOP_N_ACTIVE_TRADERS);
    }
  } catch { /* fall back to empty */ }
}

export interface SimEntry {
  id: string;
  battleId: string;
  battleTitle: string;
  wallet: string;       // 0x… real Fini holder
  shortWallet: string;  // "0x18ce…16a6"
  side: "A" | "B";
  sideLabel: string;
  asset: string;        // e.g. BTC
  amount: number;       // FINI$ staked
  at: number;           // epoch ms
}

interface SimState {
  battles: Battle[];        // augmented with live-ish numbers
  feed: SimEntry[];         // newest first, cap 50
  started: boolean;
  start: () => void;
  stop: () => void;
}

let timer: ReturnType<typeof setInterval> | null = null;
let lastTickId = 0;
// Each battle's "endsAt" snapped at sim start. Lets us compute time-remaining
// for fair-odds calculations without re-anchoring every tick.
const battleEndsAt = new Map<string, number>();

const shortWallet = (a: string) => a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export const useCryptoSim = create<SimState>((set, get) => ({
  // Deep-clone the seed battles so we can mutate per-battle stats without
  // touching the canonical export.
  battles: MOCK_BATTLES.map(b => ({ ...b, sideA: { ...b.sideA }, sideB: { ...b.sideB } })),
  feed: [],
  started: false,
  start: () => {
    if (get().started) return;
    set({ started: true });
    loadWallets();
    // Snap an endsAt for each battle so fair-odds tracks consistent elapsed time
    for (const b of get().battles) {
      if (!battleEndsAt.has(b.id)) battleEndsAt.set(b.id, Date.now() + b.endsInMs);
      // Also snap opening asset prices — strategies use these as the fair-value
      // reference instead of a 24h-change proxy.
      snapBattleOpening(b.id, b.assets);
    }
    timer = setInterval(() => {
      if (ghostWallets.length === 0) return;
      const battles = get().battles;
      const liveBattles = battles.filter(b => b.status === "live");
      if (liveBattles.length === 0) return;
      // Best-effort opening-price snap each tick (idempotent — re-snap is a noop
      // if already taken). Catches battles where prices hadn't loaded at sim start.
      for (const b of liveBattles) snapBattleOpening(b.id, b.assets);

      // Pick a battle weighted by lateness — late-stage battles get a "burst"
      // of bot activity, mimicking real arb pile-ons as resolution approaches.
      const weighted: { battle: typeof liveBattles[0]; weight: number; pA: number }[] = liveBattles.map(b => {
        const endsAt = battleEndsAt.get(b.id) ?? Date.now() + b.endsInMs;
        const totalDur = parseDuration(b.durationLabel);
        const remaining = Math.max(0, endsAt - Date.now());
        const elapsedFraction = Math.min(1, (totalDur - remaining) / totalDur);
        // Bursts: 1× weight when fresh, up to 4× weight in final 10% of duration
        const burstMultiplier = elapsedFraction > 0.9 ? 4 : elapsedFraction > 0.75 ? 2 : 1;
        return { battle: b, weight: burstMultiplier, pA: fairOddsForBattle(b, endsAt) };
      });
      const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

      // Spawn 1-3 entries this tick (more if any battle is in burst window)
      const anyBurst = weighted.some(w => w.weight >= 4);
      const numEntries = anyBurst ? 3 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 3);
      const newEntries: SimEntry[] = [];
      const battleUpdates = new Map<string, { sideA: number; sideB: number; volumeK: number }>();

      function pickWeightedBattle() {
        let r = Math.random() * totalWeight;
        for (const w of weighted) { r -= w.weight; if (r <= 0) return w; }
        return weighted[weighted.length - 1];
      }

      // Up to numEntries attempts — some personas will sit out, so we may
      // produce fewer actual entries than attempts. This is healthy: traders
      // shouldn't all act every tick.
      let attempts = 0;
      while (newEntries.length < numEntries && attempts < numEntries * 3) {
        attempts++;
        const picked = pickWeightedBattle();
        const battle = picked.battle;
        // Weight wallet selection by holdings (bigger holders trade more often)
        const w = ghostWallets[Math.floor(Math.random() * ghostWallets.length)];
        const persona = personaFor(w.wallet, w.ownedCount);

        // Persona decides whether and how to act. Reads live signals —
        // intra-window return for swing traders, market % for momentum/contrarian.
        const primaryAsset = battle.assets[0];
        const ret = intraWindowReturn(battle.id, primaryAsset);
        const side = personaPickSide(persona, {
          sideAPct: battle.sideA.pct,
          intraWindowReturnA: ret,
        });
        if (!side) continue; // persona sat this one out

        // Bet size scales with holdings + adds a small persona-specific jitter
        const baseAmount = 50 + Math.floor(Math.random() * 200);
        const amount = baseAmount + Math.floor(Math.sqrt(w.ownedCount) * 25);
        const sideLabel = side === "A" ? battle.sideA.label : battle.sideB.label;
        lastTickId++;
        newEntries.push({
          id: `entry-${Date.now()}-${lastTickId}`,
          battleId: battle.id,
          battleTitle: battle.title,
          wallet: w.wallet,
          shortWallet: shortWallet(w.wallet),
          side,
          sideLabel,
          asset: battle.assets[0],
          amount,
          at: Date.now(), // real wall-clock so the battle log reads rationally
        });

        // Drift the battle's odds toward the side that was just picked,
        // weighted by amount / (volume + amount). Volume grows.
        const current = battleUpdates.get(battle.id) ?? { sideA: battle.sideA.pct, sideB: battle.sideB.pct, volumeK: battle.volumeK };
        const totalUSD = current.volumeK * 1000;
        const newTotal = totalUSD + amount;
        const shift = (amount / newTotal) * 100;
        const newSideA = side === "A"
          ? Math.min(95, current.sideA + shift)
          : Math.max(5,  current.sideA - shift);
        battleUpdates.set(battle.id, {
          sideA: newSideA,
          sideB: 100 - newSideA,
          volumeK: Math.round((newTotal) / 1000),
        });
      }

      set(state => ({
        battles: state.battles.map(b => {
          const u = battleUpdates.get(b.id);
          if (!u) return b;
          return {
            ...b,
            sideA: { ...b.sideA, pct: Math.round(u.sideA) },
            sideB: { ...b.sideB, pct: Math.round(u.sideB) },
            volumeK: u.volumeK,
          };
        }),
        feed: [...newEntries, ...state.feed].slice(0, 50),
      }));
    }, 2500); // tick every 2.5s — feels live but not frantic
  },
  stop: () => {
    if (timer) { clearInterval(timer); timer = null; }
    set({ started: false });
  },
}));

/** Convenience hook for components that just want the augmented battles. */
export function useSimBattles() {
  return useCryptoSim(s => s.battles);
}
/** Convenience hook for the activity feed. */
export function useSimFeed() {
  return useCryptoSim(s => s.feed);
}
