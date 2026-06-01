import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUIStore } from "../state/uiStore";
import { useCoinStore } from "../state/coinStore";
import { useCrumbStore } from "../state/crumbStore";
import { useFiniRecords, xpToNextLevel, fmtRestTime, tierFor } from "../state/finiRecords";
import { useInventory, POTIONS, type PotionId } from "../state/inventory";
import { useTicker } from "../hooks/useTicker";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { pickGhostOpponent, shortenWallet, synthFini, loadGhostTeams } from "../game/ghostOpponents";
import { useTreasury } from "../state/treasuryStore";
import { FAMILY_ROLE, ROLE_META, ITEM_SYNERGY, SYNERGY_BONUS_MULTIPLIER, hasSynergy, familyDamageMultiplier, type FamilyRole } from "../game/familyRoles";

const S = { fontFamily: "'Nunito', system-ui, sans-serif" };

const CLAN_TINTS: Record<string, string> = {
  "Arms of the State": "#b8c8d8", "Hourly": "#c8b4a0", "Townspeople": "#d4cfa0",
  "Artists": "#d4a4a0", "Soldiers": "#b0b0c8", "Twice Daily": "#a8c8d8",
  "Miners": "#b8a890", "Farmers": "#a8b8a0",
};

const FAMILY_COLOR: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
  LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", BNB: "#f3ba2f",
  MATIC: "#8247e5", XTZ: "#a6e000",
};

type Fini = {
  id: number; family: string; clan: string;
  hp: number; maxHp: number;
  atk: number; def: number; speed: number;
  trait?: string;
  item?: Item;
};

type Item = {
  name: string; icon: string;
  effect: string;
  bonus: { atk?: number; def?: number; hp?: number; speed?: number };
  /** Crumb price. Tiers: cheap ≤25, mid 30-70, rare 80-150, legendary 160+. */
  price: number;
  tier: "common" | "rare" | "legendary";
};

// 24 items — comparable to a normal Super Auto Pets game's shop pool.
// Tight SAP economy: starting 10 🍪 affords ONE common item (or 3 rerolls
// + nothing else). Rares need ~3 wins. Legendaries need ~5+ wins.
const ITEMS: Item[] = [
  // ── Common — single-stat boosters (3-7 Crumbs) ──────────────────────────
  { name: "Acorn",           icon: "🌰", effect: "+3 DEF",                  bonus: { def: 3 },              price: 3,  tier: "common" },
  { name: "Pebble",          icon: "🪨", effect: "+4 ATK",                  bonus: { atk: 4 },              price: 3,  tier: "common" },
  { name: "Spring Water",    icon: "💧", effect: "+6 HP",                   bonus: { hp: 6 },               price: 3,  tier: "common" },
  { name: "Sneakers",        icon: "👟", effect: "+2 SPD",                  bonus: { speed: 2 },            price: 4,  tier: "common" },
  { name: "Twig Stick",      icon: "🪵", effect: "+5 ATK",                  bonus: { atk: 5 },              price: 5,  tier: "common" },
  { name: "Leaf Vest",       icon: "🍃", effect: "+5 DEF",                  bonus: { def: 5 },              price: 5,  tier: "common" },
  { name: "Berry Juice",     icon: "🍓", effect: "+10 HP",                  bonus: { hp: 10 },              price: 6,  tier: "common" },
  { name: "Quick Cloak",     icon: "🧣", effect: "+3 SPD",                  bonus: { speed: 3 },            price: 7,  tier: "common" },

  // ── Rare — combo boosters (10-20 Crumbs, ~2-3 wins to afford) ───────────
  { name: "Diamond Shell",   icon: "💎", effect: "+10 DEF",                 bonus: { def: 10 },             price: 10, tier: "rare" },
  { name: "Volatility Spike",icon: "⚡", effect: "+8 ATK",                  bonus: { atk: 8 },              price: 10, tier: "rare" },
  { name: "Oracle Tonic",    icon: "🔮", effect: "+15 HP",                  bonus: { hp: 15 },              price: 12, tier: "rare" },
  { name: "Speed Boots",     icon: "🥾", effect: "+5 SPD",                  bonus: { speed: 5 },            price: 12, tier: "rare" },
  { name: "Battle Scar",     icon: "🩹", effect: "+5 ATK · +5 DEF",         bonus: { atk: 5, def: 5 },      price: 14, tier: "rare" },
  { name: "Meme Charm",      icon: "🍀", effect: "+12 HP · +3 SPD",         bonus: { hp: 12, speed: 3 },    price: 14, tier: "rare" },
  { name: "Cookie Pendant",  icon: "🍪", effect: "+8 HP · +4 ATK",          bonus: { hp: 8, atk: 4 },       price: 16, tier: "rare" },
  { name: "Honey Pot",       icon: "🍯", effect: "+10 HP · +3 DEF",         bonus: { hp: 10, def: 3 },      price: 17, tier: "rare" },
  { name: "Crystal Lens",    icon: "🔍", effect: "+6 ATK · +4 SPD",         bonus: { atk: 6, speed: 4 },    price: 18, tier: "rare" },
  { name: "Rune Stone",      icon: "🗿", effect: "+8 DEF · +4 SPD",         bonus: { def: 8, speed: 4 },    price: 18, tier: "rare" },

  // ── Legendary — all-rounders & extreme stats (25-60 Crumbs) ─────────────
  { name: "Phoenix Feather", icon: "🪶", effect: "+15 HP · +6 ATK",         bonus: { hp: 15, atk: 6 },      price: 26, tier: "legendary" },
  { name: "Ancient Helm",    icon: "🪖", effect: "+12 DEF · +8 HP",         bonus: { def: 12, hp: 8 },      price: 28, tier: "legendary" },
  { name: "Dragon Scale",    icon: "🐉", effect: "+10 ATK · +10 DEF",       bonus: { atk: 10, def: 10 },    price: 34, tier: "legendary" },
  { name: "Lightning Sigil", icon: "⚡", effect: "+12 ATK · +6 SPD",        bonus: { atk: 12, speed: 6 },   price: 38, tier: "legendary" },
  { name: "Aurora Mantle",   icon: "🌌", effect: "+8 / +8 / +8 / +4",       bonus: { hp: 8, atk: 8, def: 8, speed: 4 }, price: 48, tier: "legendary" },
  { name: "Eternal Idol",    icon: "🏆", effect: "+25 HP · +6 DEF · +6 ATK", bonus: { hp: 25, def: 6, atk: 6 }, price: 60, tier: "legendary" },
];

const STARTING_TEAM: Fini[] = [
  { id: 4104, family: "BTC", clan: "Arms of the State", hp: 60, maxHp: 60, atk: 12, def: 8, speed: 4, trait: "Diamond Body" },
  { id: 2847, family: "ETH", clan: "Artists",           hp: 50, maxHp: 50, atk: 14, def: 5, speed: 7, trait: "Meme Spike" },
  { id: 3201, family: "SOL", clan: "Soldiers",          hp: 45, maxHp: 45, atk: 16, def: 4, speed: 9, trait: "Late Believer" },
];

const STARTING_BENCH: Fini[] = [
  { id: 5102, family: "DOGE", clan: "Miners",     hp: 48, maxHp: 48, atk: 13, def: 6, speed: 6, trait: "Diamond Pawed" },
  { id: 6010, family: "LINK", clan: "Twice Daily",hp: 55, maxHp: 55, atk: 10, def: 9, speed: 5, trait: "Oracle Touched" },
  { id: 9100, family: "XTZ",  clan: "Farmers",    hp: 52, maxHp: 52, atk: 11, def: 7, speed: 5, trait: "Self-Amend" },
];

function generateOpponent(seed: number, targetPower: number): Fini[] {
  const families = ["BTC", "ETH", "SOL", "DOGE", "LINK", "UNI", "AVAX", "BNB", "MATIC", "XTZ"];
  const clans = ["Arms of the State", "Hourly", "Townspeople", "Artists", "Soldiers"];
  const traits = ["Volatility Sicko", "Late Believer", "Liquidation Burned", "Paper-Handed", "Diamond-Pawed"];
  // Scale stats roughly proportional to per-fini target power (target / 3)
  const perFiniPower = targetPower / 3;
  const scale = Math.max(0.7, Math.min(2.5, perFiniPower / 100));
  return [0, 1, 2].map(i => {
    const idx = (seed * 7 + i * 13) % families.length;
    const baseHp = 45 + ((seed + i) * 5) % 25;
    const hp = Math.round(baseHp * scale);
    return {
      id: 80000 + seed * 10 + i,
      family: families[idx],
      clan: clans[(seed + i) % clans.length],
      hp, maxHp: hp,
      atk: Math.round((10 + ((seed * 3 + i) % 8)) * scale),
      def: Math.round((4 + ((seed * 2 + i) % 6)) * scale),
      speed: 4 + ((seed + i * 2) % 7),
      trait: traits[(seed + i) % traits.length],
    };
  });
}

function slugify(s: string) { return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

type View = "workshop" | "battle" | "result";

// SAP-style run economy. Same values for every player.
const RUN_STARTING_BANK = 1_000;
const RUN_STAKE = 100;

export function FightClubPage() {
  const { walletAddress } = useUIStore();
  const earn = useCoinStore(s => s.earn);
  const spend = useCoinStore(s => s.spend);
  const balance = useCoinStore(s => s.balance);
  const setBalance = useCoinStore(s => s.setBalance);
  const applyBatch = useFiniRecords(s => s.applyBatch);
  const isResting  = useFiniRecords(s => s.isResting);
  const resetRecords = useFiniRecords(s => s.reset);
  // "busted" → can't afford the entry stake → run is over until you restart
  const [runStatus, setRunStatus] = useState<"playing" | "busted">("playing");

  // Watch for bust after balance changes from battle settlement.
  // (Cash-out tier is deliberately disabled until launch — keep this loop pure.)
  useEffect(() => {
    if (!walletAddress) return;
    if (balance < RUN_STAKE && runStatus === "playing") setRunStatus("busted");
  }, [balance, walletAddress, runStatus]);

  function restartRun() {
    resetRecords(); // wipe all XP, levels, rest cooldowns, items
    setBalance(RUN_STARTING_BANK);
    useCrumbStore.getState().resetRun(); // crumbs reset too — fresh tactical wallet
    setRunStatus("playing");
  }

  const [view, setView] = useState<View>("workshop");
  const [team, setTeam] = useState<Fini[]>(STARTING_TEAM);
  const [bench, setBench] = useState<Fini[]>(STARTING_BENCH);
  const [collection, setCollection] = useState<Fini[]>([]);

  // Load the connected/impersonated wallet's real roster from the snapshot.
  // First 3 owned Finis → starting team; next 3 → bench; rest → collection.
  // Falls back to the hardcoded sample if the wallet isn't a Fini holder.
  useEffect(() => {
    if (!walletAddress) return;
    const w = walletAddress.toLowerCase();
    loadGhostTeams().then(file => {
      // ownership.json is keyed token→owner; rebuild owner→tokens once via the
      // ghostTeams file which carries ownedCount + ownedTokenIds.
      const mine = file.teams.find(t => t.wallet.toLowerCase() === w);
      if (!mine) {
        console.info("[FightClub] wallet has no Finis in snapshot; using sample roster");
        return;
      }
      // Fetch fuller roster from ownership.json so the bench can show extras
      fetch("/data/ownership.json").then(r => r.json()).then((own: { tokenOwners: Record<string, string> }) => {
        const allMine: number[] = [];
        for (const [tok, owner] of Object.entries(own.tokenOwners)) {
          if (owner.toLowerCase() === w) allMine.push(Number(tok));
        }
        // Synthesize Finis first, then sort by family → clan → tokenId so the
        // user's roster always reads in the same family-clan order everywhere.
        const FAMILY_ORDER = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];
        const allFinis = allMine.map(id => synthFini(id));
        allFinis.sort((a, b) => {
          if (a.family !== b.family) {
            const ai = FAMILY_ORDER.indexOf(a.family); const bi = FAMILY_ORDER.indexOf(b.family);
            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
          }
          if (a.clan !== b.clan) return a.clan.localeCompare(b.clan);
          return a.id - b.id;
        });
        const starters = allFinis.slice(0, 3);
        const benchTokens = allFinis.slice(3, 6);
        const collectionTokens = allFinis.slice(6);
        if (starters.length > 0) {
          // Pad starters to exactly 3 if wallet has <3 Finis
          while (starters.length < 3) {
            const fallback = STARTING_TEAM[starters.length];
            starters.push({ ...fallback, trait: fallback.trait ?? "Unknown" });
          }
          setTeam(starters);
        }
        if (benchTokens.length > 0) setBench(benchTokens);
        setCollection(collectionTokens);
        console.info(`[FightClub] loaded ${allMine.length} Finis for ${w.slice(0,6)}…${w.slice(-4)} — 3 starters · ${benchTokens.length} bench · ${collectionTokens.length} in collection`);
      }).catch(e => console.warn("[FightClub] ownership.json load failed", e));
    }).catch(e => console.warn("[FightClub] ghost teams load failed", e));
  }, [walletAddress]);
  const [opponent, setOpponent] = useState<Fini[]>([]);
  const [opponentName, setOpponentName] = useState("");
  const [shop, setShop] = useState<Item[]>(ITEMS.slice(0, 3));
  const [stake] = useState(100);
  const [winner, setWinner] = useState<"you" | "them" | "draw" | null>(null);

  if (!walletAddress) {
    return (
      <div style={{ ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8f9fa" }}>
        <div style={{ fontSize: 48 }}>⚔️</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>Connect wallet to enter the Fight Club</div>
        <ConnectWalletButton />
      </div>
    );
  }

  function findOpponent() {
    // Direct-challenge path: if a /challenge link dumped a pending opponent into
    // sessionStorage, use that instead of random matchmaking.
    const pendingRaw = typeof window !== "undefined" ? sessionStorage.getItem("pending-challenge") : null;
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as { from: string; teamIds: number[]; stake: number };
        sessionStorage.removeItem("pending-challenge");
        const opp = pending.teamIds.slice(0, 3).map(id => synthFini(id));
        setOpponent(opp);
        setOpponentName(shortenWallet(pending.from));
        return;
      } catch { /* fall through to normal matchmaking */ }
    }
    // Use actual battle stats (HP/ATK/DEF/SPD with items factored in) so
    // ghost matchmaking reflects how lethal the player ACTUALLY is — not
    // just their XP/level. Items add directly to f.atk/f.def/f.maxHp/f.speed,
    // so summing those properly captures equipment power too.
    const yourBattleStats = team.reduce((s, f) =>
      s + f.maxHp + f.atk * 3 + f.def * 2 + f.speed * 2, 0);
    const yourPower = yourBattleStats;
    pickGhostOpponent(yourPower).then(ghost => {
      setOpponent(ghost.finis);
      setOpponentName(shortenWallet(ghost.wallet));
    }).catch(err => {
      console.warn("[matchmaker] ghost pool unavailable, using synth fallback:", err);
      const seed = Math.floor(Math.random() * 9999);
      const targetPower = Math.round(yourPower * (0.9 + Math.random() * 0.2));
      setOpponent(generateOpponent(seed, targetPower));
      const names = ["sam_spike", "dani_eth", "0xpresley", "shl0ms", "d0unbug", "_baker_council_", "market_mage"];
      setOpponentName(names[seed % names.length]);
    });
  }

  function startBattle() {
    if (team.length < 3) { alert("You need 3 starters to enter the arena"); return; }
    const restingFini = team.find(f => isResting(f.id));
    if (restingFini) { alert(`Fini #${restingFini.id} is still resting. Swap it out from the bench.`); return; }
    if (!opponent.length) findOpponent();
    spend(stake);
    setWinner(null);
    setView("battle");
  }

  async function onBattleEnd(result: "you" | "them" | "draw") {
    setWinner(result);
    setView("result");
    const outcome: "win" | "loss" | "draw" = result === "you" ? "win" : result === "them" ? "loss" : "draw";
    const intendedPayout = outcome === "win" ? stake * 2 : outcome === "draw" ? stake : 0;
    const battleId = `fc:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const teamTokenIds = team.map(f => f.id);

    // Optimistic local update so the UI feels instant
    applyBatch(teamTokenIds.map(tokenId => ({ tokenId, outcome })));

    // Route the payout through the treasury so:
    //  - wins draw from the treasury bank (capped at daily limit per wallet)
    //  - losses + stake feed back to the treasury
    //  - the player sees a real "source of funds" instead of money appearing
    //    from the void
    const wallet = walletAddress ?? "0xunknown";
    const { actualPayout, cappedAt } = useTreasury.getState().settleGhostBattle(
      wallet, intendedPayout, stake
    );
    if (actualPayout > 0) earn(actualPayout);
    if (cappedAt) {
      console.warn(`[treasury] daily cap hit (${cappedAt} FINI$/day). Payout capped from ${intendedPayout} to ${actualPayout}.`);
    }

    // Drip Crumbs after every battle. Outcome-dependent: win=8, loss=3, draw=avg.
    useCrumbStore.getState().rewardBattle(outcome);

    // Payout for downstream API call (server settlement when backend is live)
    const payout = actualPayout;

    // Authoritative server settlement (records battle, applies stat changes, credits payout).
    // Stake debit happens here too — startBattle's `spend()` was the optimistic cache update only.
    try {
      const { api } = await import("../lib/api");
      await api.recordBattle({
        battleId, battleType: "fight-club",
        teamTokenIds, outcome, stake, payout,
      });
      // Pull fresh records from server so any client/server drift is corrected
      const syncFromServer = useFiniRecords.getState().syncFromServer;
      if (syncFromServer) await syncFromServer(teamTokenIds);
    } catch (e) {
      console.warn("[battle] server settle failed, local-only update used:", e);
    }
  }

  function swapWithBench(teamIdx: number, benchIdx: number) {
    const newTeam = [...team]; const newBench = [...bench];
    [newTeam[teamIdx], newBench[benchIdx]] = [newBench[benchIdx], newTeam[teamIdx]];
    setTeam(newTeam); setBench(newBench);
  }

  /** Swap a specific collection Fini with a specific bench slot. */
  function sendToBench(collectionIdx: number, benchIdx: number) {
    const newBench = [...bench];
    const newCollection = [...collection];
    const incoming = newCollection[collectionIdx];
    const outgoing = newBench[benchIdx];
    newBench[benchIdx] = incoming;
    newCollection[collectionIdx] = outgoing;
    setBench(newBench);
    setCollection(newCollection);
  }

  /** Move a bench Fini back into the collection. Swaps with the first
   *  collection Fini so the bench slot is always filled. */
  function returnToCollection(benchIdx: number) {
    if (collection.length === 0) return;
    const newBench = [...bench];
    const newCollection = [...collection];
    [newBench[benchIdx], newCollection[0]] = [newCollection[0], newBench[benchIdx]];
    setBench(newBench);
    setCollection(newCollection);
  }

  function equipItem(target: "team" | "bench", idx: number, item: Item) {
    // Deduct the Crumb price first. Bail if the player can't afford it.
    const ok = useCrumbStore.getState().spend(item.price);
    if (!ok) { alert(`Not enough 🍪 Crumbs (${item.price} needed)`); return; }
    // Apply role synergy: items get +50% bonus on a same-role Fini.
    const arr = target === "team" ? team : bench;
    const target_fini = arr[idx];
    const synergize = hasSynergy(item.name, target_fini.family);
    const mult = synergize ? SYNERGY_BONUS_MULTIPLIER : 1;
    const atkB   = Math.round((item.bonus.atk ?? 0)   * mult);
    const defB   = Math.round((item.bonus.def ?? 0)   * mult);
    const hpB    = Math.round((item.bonus.hp ?? 0)    * mult);
    const spdB   = Math.round((item.bonus.speed ?? 0) * mult);
    const buffed = {
      ...target_fini, item,
      atk: target_fini.atk + atkB, def: target_fini.def + defB,
      maxHp: target_fini.maxHp + hpB, hp: target_fini.hp + hpB,
      speed: target_fini.speed + spdB,
    };
    if (target === "team") { const next = [...team]; next[idx] = buffed; setTeam(next); }
    else                   { const next = [...bench]; next[idx] = buffed; setBench(next); }
    setShop(shop.filter(s => s.name !== item.name));
  }

  function rerollShop() {
    // SAP-style: reroll is cheap (5 🍪) so it's a frequent decision.
    const ok = useCrumbStore.getState().spend(3);
    if (!ok) { alert("Not enough 🍪 Crumbs to reroll (3 needed)"); return; }
    const shuffled = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
    setShop(shuffled);
  }

  // ── Render ──
  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {view === "workshop" && (
        <WorkshopView
          team={team} bench={bench} collection={collection} shop={shop}
          opponent={opponent} opponentName={opponentName}
          stake={stake}
          onSwap={swapWithBench}
          onSendToBench={sendToBench}
          onReturnToCollection={returnToCollection}
          onEquip={equipItem}
          onFindOpponent={findOpponent}
          onReroll={rerollShop}
          onStartBattle={startBattle}
        />
      )}
      {view === "battle" && (
        <BattleView
          team={team} opponent={opponent} opponentName={opponentName}
          onBattleEnd={onBattleEnd}
        />
      )}
      {view === "result" && winner && (
        <ResultView
          winner={winner} stake={stake}
          opponentName={opponentName}
          opponentTeamIds={opponent.map(f => f.id)}
          onReturn={() => { setView("workshop"); setOpponent([]); setOpponentName(""); }}
        />
      )}

      {/* Bust modal — fires when player can't afford the next entry stake */}
      {runStatus === "busted" && (
        <RunStatusModal
          balance={balance}
          onRestart={restartRun}
        />
      )}
    </div>
  );
}

/** Bust modal — shown when player can no longer afford the entry stake. */
function RunStatusModal({ balance, onRestart }: { balance: number; onRestart: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, padding: 32,
        maxWidth: 480, width: "100%", textAlign: "center",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        border: "3px solid #ef4444",
      }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>💀</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#dc2626", marginBottom: 8 }}>
          Your run busted
        </div>
        <div style={{ fontSize: 14, color: "#555", lineHeight: 1.5, marginBottom: 20 }}>
          You're down to <b>{balance.toLocaleString()} FINI$</b> — not enough to enter another battle.
          Your Finis remember every battle, but a fresh run gives them a clean slate.
        </div>
        <button onClick={onRestart} style={{
          background: "linear-gradient(135deg, #f472b6, #ec4899)",
          color: "#fff", border: "none", borderRadius: 100,
          padding: "12px 28px", fontSize: 14, fontWeight: 800,
          cursor: "pointer", boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
        }}>🔄 Restart Run</button>
        <div style={{ fontSize: 11, color: "#888", marginTop: 16, lineHeight: 1.5 }}>
          Restart will reset all your Finis' XP, levels, items, and rest cooldowns.
          Your collection (which Finis you own) stays the same.
        </div>
      </div>
    </div>
  );
}

// ── Workshop ──────────────────────────────────────────────────────────────────

function WorkshopView({
  team, bench, collection, shop, opponent, opponentName, stake,
  onSwap, onSendToBench, onReturnToCollection, onEquip, onFindOpponent, onReroll, onStartBattle,
}: {
  team: Fini[]; bench: Fini[]; collection: Fini[]; shop: Item[];
  opponent: Fini[]; opponentName: string; stake: number;
  onSwap: (t: number, b: number) => void;
  onSendToBench: (collectionIdx: number, benchIdx: number) => void;
  onReturnToCollection: (benchIdx: number) => void;
  onEquip: (target: "team" | "bench", idx: number, item: Item) => void;
  onFindOpponent: () => void;
  onReroll: () => void;
  onStartBattle: () => void;
}) {
  // When user clicks "→ Add to Bench" on a collection Fini, we enter
  // "pick a bench slot" mode and the 3 bench tiles highlight as drop targets.
  const [pickBenchFor, setPickBenchFor] = useState<number | null>(null);
  useTicker(1000); // for rest-timer updates
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [selectedPotion, setSelectedPotion] = useState<PotionId | null>(null);
  const [equipTarget, setEquipTarget] = useState<{ target: "team" | "bench"; idx: number } | null>(null);
  const balance = useCoinStore(s => s.balance);
  const earn  = useCoinStore(s => s.earn);
  const crumbs = useCrumbStore(s => s.crumbs);
  const isResting = useFiniRecords(s => s.isResting);
  const restoreFully = useFiniRecords(s => s.restoreFully);
  const shortenRest  = useFiniRecords(s => s.shortenRest);
  const grantXp      = useFiniRecords(s => s.grantXp);
  const inventory  = useInventory(s => s.items);
  const addPotion  = useInventory(s => s.add);
  const consumePotion = useInventory(s => s.consume);
  const anyResting = team.some(f => isResting(f.id));
  // Battle-stat-based power (matches what the engine fights with): HP + 3×ATK + 2×DEF + 2×SPD per Fini.
  // Includes item bonuses (which mutate f.atk/f.def/etc. directly).
  function battleStatPower(finis: Fini[]) {
    return finis.reduce((s, f) => s + f.maxHp + f.atk * 3 + f.def * 2 + f.speed * 2, 0);
  }
  const teamPowerNum = battleStatPower(team);
  const oppPowerNum  = battleStatPower(opponent);
  const tT = tierFor(teamPowerNum), tO = tierFor(oppPowerNum);
  const teamPower = { total: teamPowerNum, tier: tT.name, tierColor: tT.color };
  const oppPower  = opponent.length ? { total: oppPowerNum, tier: tO.name, tierColor: tO.color } : null;

  function buyPotion(id: PotionId) {
    const p = POTIONS[id];
    // Pay in Crumbs, not FINI$
    if (!useCrumbStore.getState().spend(p.price)) return;
    addPotion(id);
  }

  function applyPotionToFini(id: PotionId, tokenId: number) {
    const ok = consumePotion(id);
    if (!ok) return;
    if (id === "energy_potion" || id === "full_revive") restoreFully(tokenId);
    else if (id === "quick_snack") shortenRest(tokenId, 15 * 60 * 1000);
    else if (id === "xp_truffle") grantXp(tokenId, 20);
    setSelectedPotion(null);
  }
  void earn;

  return (
    <>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }}>⚔️ Fight Club</h1>
            <p style={{ fontSize: 14, color: "#888", marginTop: 4 }}>Equip, position, and lead your team into the arena</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Team Power */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Team Power</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>{teamPower.total.toLocaleString()}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 100, background: teamPower.tierColor + "22", color: teamPower.tierColor }}>
                  {teamPower.tier}
                </span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: "#e5e7eb" }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Entry · Prize pot</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>
                {stake} <span style={{ fontSize: 12, color: "#aaa" }}>→</span> {" "}
                <span style={{ color: "#16a34a" }}>{stake * 2}</span>
                <span style={{ fontSize: 13, color: "#854d0e" }}> FINI$</span>
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Winnings paid by the Fini Treasury (beta)</div>
            </div>
            {opponent.length > 0 ? (
              <><button onClick={onStartBattle} disabled={balance < stake || anyResting} title={anyResting ? "One of your starters is resting — swap them out, use a potion, or wake the team" : ""} style={{
                background: (balance < stake || anyResting) ? "#e5e7eb" : "linear-gradient(135deg, #f472b6, #ec4899)",
                color: (balance < stake || anyResting) ? "#aaa" : "#fff",
                border: "none", borderRadius: 100,
                padding: "14px 32px", fontSize: 15, fontWeight: 800,
                cursor: (balance < stake || anyResting) ? "not-allowed" : "pointer",
                boxShadow: (balance < stake || anyResting) ? "none" : "0 4px 14px rgba(244,114,182,0.35)",
              }}>
                {anyResting ? "💤 Starter resting" : "⚔️ Enter Arena"}
              </button>
              {anyResting && (
                <button
                  onClick={() => team.forEach(f => restoreFully(f.id))}
                  title="Dev: clear all rest cooldowns on your starters"
                  style={{
                    background: "transparent", color: "#888",
                    border: "1.5px dashed #ddd", borderRadius: 100,
                    padding: "12px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  ☕ Wake team
                </button>
              )}</>
            ) : (
              <button onClick={onFindOpponent} style={{
                background: "#111", color: "#fff",
                border: "none", borderRadius: 100,
                padding: "14px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer",
              }}>
                🔍 Find Opponent
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Opponent preview */}
        {opponent.length > 0 && oppPower && (
          <Card
            title="🎯 Opponent Found"
            subtitle={`Player ${opponentName} · matched within ±15% power · staking ${stake} FINI$`}
            accent="#f472b6"
            headerExtra={
              <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700 }}>OPPONENT POWER</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>{oppPower.total.toLocaleString()}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 100, background: oppPower.tierColor + "22", color: oppPower.tierColor }}>
                    {oppPower.tier}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>
                  vs You: <span style={{ color: oppPower.total > teamPower.total ? "#dc2626" : oppPower.total < teamPower.total ? "#16a34a" : "#888" }}>
                    {oppPower.total > teamPower.total ? "+" : ""}{((oppPower.total - teamPower.total) / teamPower.total * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {opponent.map((f, i) => (
                <FiniBattleCard
                  key={i}
                  fini={f}
                  position={`Enemy ${i + 1}`}
                  onClick={() => { /* opponent cards are read-only */ }}
                  highlighted={false}
                  active={false}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Starting team */}
        <Card
          title="Starting Lineup"
          subtitle={selectedItem !== null ? "Pick a Fini to equip" : "Click a slot to view, equip, or swap"}
          accent="#22c55e"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {team.map((f, i) => (
              <FiniBattleCard
                key={i}
                fini={f}
                position={`Starter ${i + 1}`}
                onClick={() => {
                  if (selectedPotion !== null) {
                    applyPotionToFini(selectedPotion, f.id);
                  } else if (selectedItem !== null) {
                    onEquip("team", i, shop[selectedItem]);
                    setSelectedItem(null);
                  } else {
                    setEquipTarget({ target: "team", idx: i });
                  }
                }}
                highlighted={selectedItem !== null || selectedPotion !== null}
                active={equipTarget?.target === "team" && equipTarget.idx === i}
              />
            ))}
          </div>
        </Card>

        {/* Item shop */}
        <Card
          title="🛒 Item Shop"
          subtitle="3 items at a time. Reroll for a fresh lineup."
          accent="#fbbf24"
          headerExtra={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 100,
                background: "linear-gradient(135deg, #fef9c3, #fde047)",
                border: "1.5px solid #ca8a04",
                color: "#713f12", fontWeight: 900, fontSize: 14,
              }}>
                🍪 <span>{crumbs.toLocaleString()}</span>
              </span>
              <button onClick={onReroll} disabled={crumbs < 3} style={{
                background: crumbs < 3 ? "#e5e7eb" : "#fff", color: crumbs < 3 ? "#aaa" : "#666",
                border: "1.5px solid #e5e7eb", borderRadius: 100,
                padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: crumbs < 3 ? "not-allowed" : "pointer",
              }}>
                🎲 Reroll (3 🍪)
              </button>
            </div>
          }
        >
          {shop.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#bbb", fontSize: 13 }}>
              All items equipped. Reroll to find new gear.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {shop.map((item, i) => {
                const tierColor = item.tier === "legendary" ? "#a855f7" : item.tier === "rare" ? "#3b82f6" : "#888";
                const cantAfford = crumbs < item.price;
                return (
                  <button
                    key={i}
                    onClick={() => { if (!cantAfford) setSelectedItem(selectedItem === i ? null : i); }}
                    disabled={cantAfford}
                    style={{
                      background: selectedItem === i ? "#fef3c7" : "#fff",
                      border: selectedItem === i ? "2px solid #fbbf24" : `1.5px solid ${tierColor}33`,
                      borderRadius: 14, padding: "14px",
                      cursor: cantAfford ? "not-allowed" : "pointer", textAlign: "left",
                      transition: "all 0.15s",
                      opacity: cantAfford ? 0.45 : 1,
                      position: "relative",
                    }}
                    onMouseEnter={e => { if (selectedItem !== i && !cantAfford) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ""}
                  >
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100,
                      background: tierColor + "20", color: tierColor, textTransform: "uppercase", letterSpacing: 0.5,
                    }}>{item.tier}</div>
                    <div style={{ fontSize: 32, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{item.effect}</div>
                    {/* Synergy hint — which role this item pairs with */}
                    {(() => {
                      const syn = ITEM_SYNERGY[item.name];
                      if (!syn) return (
                        <div style={{ marginTop: 4, fontSize: 9, fontWeight: 700, color: "#aaa" }}>Universal</div>
                      );
                      const meta = ROLE_META[syn as FamilyRole];
                      return (
                        <div title={`+50% bonus on a ${meta.name} Fini`} style={{
                          marginTop: 4, fontSize: 9, fontWeight: 800,
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: meta.bgTint, color: meta.color,
                          padding: "2px 7px", borderRadius: 100,
                        }}>
                          <span>{meta.icon}</span>
                          <span>{meta.name} +50%</span>
                        </div>
                      );
                    })()}
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: cantAfford ? "#aaa" : "#854d0e" }}>
                      🍪 {item.price}
                    </div>
                    {selectedItem === i && (
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: "#be185d" }}>
                        Click a Fini to equip →
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Potions / consumables */}
        <Card
          title="🧪 Potions & Snacks"
          subtitle="Heal up tired Finis with consumables"
          accent="#ef4444"
        >
          {/* Inventory row */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Your inventory</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(Object.keys(POTIONS) as PotionId[]).map(id => {
                const p = POTIONS[id];
                const have = inventory[id] ?? 0;
                const active = selectedPotion === id;
                return (
                  <button
                    key={id}
                    disabled={have === 0}
                    onClick={() => setSelectedPotion(active ? null : id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 14px", borderRadius: 100,
                      border: active ? `2px solid ${p.color}` : "1.5px solid #f0f0f0",
                      background: active ? p.color + "18" : have === 0 ? "#f9fafb" : "#fff",
                      cursor: have === 0 ? "not-allowed" : "pointer",
                      opacity: have === 0 ? 0.45 : 1,
                      fontSize: 13, fontWeight: 700, color: "#111",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <span>{p.name}</span>
                    <span style={{
                      background: active ? p.color : "#f3f4f6",
                      color: active ? "#fff" : "#666",
                      padding: "1px 8px", borderRadius: 100, fontSize: 11, fontWeight: 800,
                    }}>×{have}</span>
                  </button>
                );
              })}
            </div>
            {selectedPotion && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: POTIONS[selectedPotion].color + "12", borderRadius: 10, fontSize: 12, color: POTIONS[selectedPotion].color, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>↑ Click a Fini to use {POTIONS[selectedPotion].name} — {POTIONS[selectedPotion].effect}</span>
                <button onClick={() => setSelectedPotion(null)} style={{ background: "transparent", border: "none", color: POTIONS[selectedPotion].color, fontWeight: 800, cursor: "pointer" }}>cancel</button>
              </div>
            )}
          </div>

          {/* Shop row */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Shop — buy with FINI$</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {(Object.keys(POTIONS) as PotionId[]).map(id => {
                const p = POTIONS[id];
                const cantAfford = crumbs < p.price;
                return (
                  <div key={id} style={{ background: "#fff", border: "1.5px solid #f0f0f0", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                        {p.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: p.color, fontWeight: 700 }}>{p.effect}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>{p.description}</div>
                    <button
                      onClick={() => buyPotion(id)}
                      disabled={cantAfford}
                      style={{
                        marginTop: 4,
                        background: cantAfford ? "#f3f4f6" : p.color,
                        color: cantAfford ? "#aaa" : "#fff",
                        border: "none", borderRadius: 100,
                        padding: "7px 0", fontSize: 12, fontWeight: 800,
                        cursor: cantAfford ? "not-allowed" : "pointer",
                      }}
                    >
                      Buy · {p.price} 🍪
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Bench — reserves you can swap into the lineup */}
        <div data-bench-card>
        <Card
          title="Bench"
          subtitle="Reserves — swap into the lineup or equip items"
          accent="#a78bfa"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {bench.map((f, i) => {
              const isDropTarget = pickBenchFor !== null;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                  <div style={{ position: "relative" }}>
                    {/* Drop-target overlay shown when picking a slot for an incoming collection Fini */}
                    {isDropTarget && (
                      <div
                        onClick={() => { if (pickBenchFor !== null) { onSendToBench(pickBenchFor, i); setPickBenchFor(null); } }}
                        style={{
                          position: "absolute", inset: 0,
                          background: "rgba(139,92,246,0.85)", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 14, zIndex: 5,
                          borderRadius: 16, cursor: "pointer",
                        }}
                      >
                        ↓ Place here
                      </div>
                    )}
                    <FiniBattleCard
                      fini={f}
                      position={`Bench ${i + 1}`}
                      onClick={() => {
                        if (selectedPotion !== null) {
                          applyPotionToFini(selectedPotion, f.id);
                        } else if (selectedItem !== null) {
                          onEquip("bench", i, shop[selectedItem]);
                          setSelectedItem(null);
                        } else {
                          setEquipTarget({ target: "bench", idx: i });
                        }
                      }}
                      highlighted={selectedItem !== null || selectedPotion !== null}
                      active={equipTarget?.target === "bench" && equipTarget.idx === i}
                      showSwap={equipTarget?.target === "team"}
                      onSwap={() => { if (equipTarget?.target === "team") { onSwap(equipTarget.idx, i); setEquipTarget(null); } }}
                    />
                  </div>
                  <button
                    onClick={() => onReturnToCollection(i)}
                    style={{
                      background: "transparent", color: "#666",
                      border: "1.5px solid #e5e7eb", borderRadius: 100,
                      padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                    title="Send this Fini back into your collection (swaps with the first collection Fini)"
                  >
                    ↩ Return to Collection
                  </button>
                </div>
              );
            })}
          </div>
          {equipTarget?.target === "team" && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#fdf0f7", borderRadius: 10, fontSize: 13, color: "#be185d", fontWeight: 700, textAlign: "center" }}>
              ↑ Click a bench slot to swap with Starter {equipTarget.idx + 1}
              <button onClick={() => setEquipTarget(null)} style={{ marginLeft: 12, background: "transparent", border: "none", color: "#be185d", fontWeight: 800, cursor: "pointer" }}>cancel</button>
            </div>
          )}
          {pickBenchFor !== null && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#f5f3ff", borderRadius: 10, fontSize: 13, color: "#7c3aed", fontWeight: 700, textAlign: "center" }}>
              ↑ Click a bench slot to place Fini #{collection[pickBenchFor]?.id}
              <button onClick={() => setPickBenchFor(null)} style={{ marginLeft: 12, background: "transparent", border: "none", color: "#7c3aed", fontWeight: 800, cursor: "pointer" }}>cancel</button>
            </div>
          )}
        </Card>
        </div>

        {/* Your Collection — every other Fini in the wallet, grouped by family then clan */}
        {collection.length > 0 && (() => {
          const byFamily: Record<string, Record<string, Fini[]>> = {};
          for (const f of collection) {
            const fam = f.family || "Unknown";
            const clan = f.clan || "(none)";
            byFamily[fam] = byFamily[fam] || {};
            byFamily[fam][clan] = byFamily[fam][clan] || [];
            byFamily[fam][clan].push(f);
          }
          const FAMILY_ORDER = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];
          const FAMILY_COLORS: Record<string, string> = {
            BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c2a633",
            BNB: "#f3ba2f", LINK: "#2a5ada", AVAX: "#e84142", UNI: "#ff007a",
            MATIC: "#8247e5", XTZ: "#2c7df7",
          };
          const families = Object.keys(byFamily).sort((a, b) => {
            const ai = FAMILY_ORDER.indexOf(a); const bi = FAMILY_ORDER.indexOf(b);
            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
          });
          return (
            <Card
              title={`Your Collection (${collection.length})`}
              subtitle="Grouped by family and clan. Tap a Fini to inspect."
              accent="#22c55e"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {families.map(family => {
                  const clans = byFamily[family];
                  const familyTotal = Object.values(clans).reduce((n, arr) => n + arr.length, 0);
                  const color = FAMILY_COLORS[family] ?? "#999";
                  return (
                    <div key={family}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                        paddingBottom: 8, borderBottom: `1.5px solid ${color}22`,
                      }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 24, height: 24, borderRadius: 999, background: color, color: "#fff",
                          fontWeight: 800, fontSize: 11,
                        }}>{family[0]}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>{family}</span>
                        <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>({familyTotal})</span>
                      </div>
                      {Object.entries(clans).map(([clan, list]) => (
                        <div key={clan} style={{ marginBottom: 14 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 800, color: "#6b7280",
                            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
                          }}>
                            {clan} <span style={{ color: "#bbb", fontWeight: 600 }}>· {list.length}</span>
                          </div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: 14,
                          }}>
                            {list.map(f => {
                              const colIdx = collection.indexOf(f);
                              return (
                                <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <FiniBattleCard
                                    fini={f}
                                    position={f.family}
                                    onClick={() => { /* card has its own Profile button */ }}
                                    highlighted={false}
                                    active={false}
                                  />
                                  <button
                                    onClick={() => {
                                      setPickBenchFor(colIdx);
                                      // Scroll the Bench card into view so the slot picker is visible
                                      setTimeout(() => {
                                        document.querySelector("[data-bench-card]")?.scrollIntoView({ behavior: "smooth", block: "center" });
                                      }, 50);
                                    }}
                                    style={{
                                      background: pickBenchFor === colIdx
                                        ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                                        : "linear-gradient(135deg, #a78bfa, #8b5cf6)",
                                      color: "#fff", border: "none", borderRadius: 100,
                                      padding: "6px 0", fontSize: 11, fontWeight: 800,
                                      cursor: "pointer",
                                      boxShadow: "0 2px 8px rgba(139,92,246,0.25)",
                                    }}
                                    title="Swap this Fini into your bench — you'll pick which slot"
                                  >
                                    {pickBenchFor === colIdx ? "↑ Pick a bench slot" : "→ Add to Bench"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}
      </div>
    </>
  );
}

// ── Battle view ───────────────────────────────────────────────────────────────

function BattleView({ team, opponent, opponentName, onBattleEnd }: {
  team: Fini[]; opponent: Fini[]; opponentName: string;
  onBattleEnd: (result: "you" | "them" | "draw") => void;
}) {
  const [teamHp, setTeamHp]   = useState(team.map(f => f.hp));
  const [oppHp,  setOppHp]    = useState(opponent.map(f => f.hp));
  type LogEntry = { side: "you" | "them" | "system"; msg: string; details?: string; key: number };
  const [log, setLog] = useState<LogEntry[]>([]);
  const [round, setRound] = useState(0);
  const [attacker, setAttacker] = useState<{ side: "you" | "them"; idx: number } | null>(null);
  const [defender, setDefender] = useState<{ side: "you" | "them"; idx: number } | null>(null);
  // Playback speed: 1× = 1100ms/turn (default), 2× = 550ms, 4× = 275ms
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const battleRef = useRef({ teamHp: team.map(f => f.hp), oppHp: opponent.map(f => f.hp), turn: 0 });

  useEffect(() => {
    // Opening narration
    setLog([{ side: "system", msg: `⚔️ Battle begins — ${team.length}v${opponent.length}`, details: `You vs ${opponentName}`, key: Date.now() }]);

    let ended = false; // bug-fix: was double-firing onBattleEnd via the nextTick chain

    function nextTick() {
      if (ended) return; // hard guard against the re-entrant schedule bug
      const intervalMs = 1100 / speedRef.current;
      tickRef.current = setTimeout(() => {
        runTurn();
        if (!ended) nextTick();
      }, intervalMs);
    }

    function runTurn() {
      if (ended) return; // belt-and-braces: never re-enter after settlement
      const { teamHp: th, oppHp: oh, turn } = battleRef.current;
      const teamAlive = th.some(h => h > 0);
      const oppAlive  = oh.some(h => h > 0);

      if (!teamAlive || !oppAlive) {
        ended = true;
        if (tickRef.current) clearTimeout(tickRef.current);
        tickRef.current = null;
        const result = teamAlive && !oppAlive ? "you" : oppAlive && !teamAlive ? "them" : "draw";
        const verdict = result === "you" ? "🏆 Victory!" : result === "them" ? "💀 Defeat" : "🤝 Draw";
        setLog(l => [...l.slice(-8), { side: "system", msg: verdict, details: result === "you" ? "Your team is the last standing." : result === "them" ? "Your team has fallen." : "Both sides knocked out.", key: Date.now() + Math.random() }]);
        setTimeout(() => onBattleEnd(result), 1200 / speedRef.current);
        return;
      }

      const attackerSide: "you" | "them" = turn % 2 === 0 ? "you" : "them";
      const attackerArr = attackerSide === "you" ? team : opponent;
      const defenderArr = attackerSide === "you" ? opponent : team;
      const aliveAttackers  = attackerArr.map((f, i) => ({ f, i, hp: (attackerSide === "you" ? th : oh)[i] })).filter(x => x.hp > 0);
      const aliveDefenders  = defenderArr.map((f, i) => ({ f, i, hp: (attackerSide === "you" ? oh : th)[i] })).filter(x => x.hp > 0);
      if (!aliveAttackers.length || !aliveDefenders.length) { battleRef.current.turn++; setRound(r => r + 1); return; }

      const atk = aliveAttackers[turn % aliveAttackers.length];
      const def = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)];
      // Damage formula: ATK - DEF/2 + ±2 variance, min 1, with family-role
      // type advantage (Tank > Striker > Healer > Tank) multiplying by 1.3 /
      // 0.7 / 1.0 — and a crit boost when SPD outpaces the target.
      const variance = Math.floor(Math.random() * 5) - 2; // -2..+2
      const base = atk.f.atk - Math.floor(def.f.def / 2);
      const crit = Math.random() < (atk.f.speed > def.f.speed ? 0.18 : 0.08);
      const roleMult = familyDamageMultiplier(atk.f.family, def.f.family);
      let dmg = Math.max(1, Math.round((base + variance) * roleMult));
      if (crit) dmg = Math.round(dmg * 1.5);

      setAttacker({ side: attackerSide, idx: atk.i });
      setDefender({ side: attackerSide === "you" ? "them" : "you", idx: def.i });

      const defHpBefore = attackerSide === "you" ? oh[def.i] : th[def.i];
      const defHpAfter  = Math.max(0, defHpBefore - dmg);
      const kos = defHpAfter === 0;

      if (attackerSide === "you") {
        const nextOh = [...oh]; nextOh[def.i] = defHpAfter;
        battleRef.current.oppHp = nextOh;
        setOppHp(nextOh);
      } else {
        const nextTh = [...th]; nextTh[def.i] = defHpAfter;
        battleRef.current.teamHp = nextTh;
        setTeamHp(nextTh);
      }

      // Rich log entry: attacker, defender, damage, KO + item flavor + type
      // advantage if applicable (Tank > Striker > Healer > Tank).
      const item = atk.f.item ? ` ${atk.f.item.icon}` : "";
      const atkRole = ROLE_META[FAMILY_ROLE[atk.f.family] ?? "striker"];
      const defRole = ROLE_META[FAMILY_ROLE[def.f.family] ?? "striker"];
      const advTag = roleMult >= 1.3 ? " 💥 SUPER EFFECTIVE"
                  : roleMult <= 0.7 ? " 🛡 resisted"
                  : "";
      const verb = crit ? "lands a CRIT on" : roleMult >= 1.3 ? "smashes into" : roleMult <= 0.7 ? "scrapes" : "strikes";
      const headline = `${atk.f.family} #${atk.f.id}${item} ${verb} ${def.f.family} #${def.f.id} — ${dmg} dmg${advTag}`;
      const roleNote = roleMult === 1
        ? ""
        : ` ${atkRole.icon}${atkRole.name} ${roleMult >= 1.3 ? ">" : "<"} ${defRole.icon}${defRole.name} (×${roleMult.toFixed(1)})`;
      const details =
        (kos ? `KO! ${def.f.family} #${def.f.id} is knocked out. ` : `${def.f.family} #${def.f.id}: ${defHpAfter}/${def.f.maxHp} HP. `) +
        `(${atk.f.atk} ATK vs ${def.f.def} DEF${roleNote}${crit ? ", ×1.5 crit" : ""}${variance !== 0 ? `, ${variance > 0 ? "+" : ""}${variance} variance` : ""})`;
      setLog(l => [...l.slice(-8), { side: attackerSide, msg: headline, details, key: Date.now() + Math.random() }]);

      battleRef.current.turn++;
      setRound(r => r + 1);

      // Clear attacker animation (scaled by speed)
      setTimeout(() => { setAttacker(null); setDefender(null); }, 600 / speedRef.current);
    }

    nextTick();
    return () => { if (tickRef.current) clearTimeout(tickRef.current); };
  // We intentionally don't depend on team/opponent — battle inputs are
  // captured by closure on mount. Speed changes are read live from speedRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", background: "linear-gradient(180deg, #fff5f7 0%, #fce8f3 100%)", padding: "32px 48px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ width: 120 }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: "0.08em" }}>Round {round}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111", marginTop: 4 }}>You vs {opponentName}</div>
          </div>
          {/* Speed control — watch the battle 1×, 2×, or 4× speed */}
          <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 100, padding: 4, border: "1.5px solid #f0e0ea" }}>
            {([1, 2, 4] as const).map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  background: speed === s ? "linear-gradient(135deg, #f472b6, #ec4899)" : "transparent",
                  color: speed === s ? "#fff" : "#666",
                  border: "none", borderRadius: 100,
                  padding: "6px 14px", fontSize: 12, fontWeight: 800,
                  cursor: "pointer", minWidth: 36,
                }}
                title={s === 1 ? "Normal speed" : s === 2 ? "2× — twice as fast" : "4× — blitz"}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Opponent battlefield */}
        <BattleSide
          finis={opponent} hpArr={oppHp}
          label={`${opponentName}'s team`}
          side="them"
          attackingIdx={attacker?.side === "them" ? attacker.idx : null}
          defendingIdx={defender?.side === "them" ? defender.idx : null}
          mirrored
        />

        {/* VS divider with battle log */}
        <div style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
          <div style={{
            background: "#fff", border: "1.5px solid #f0e0ea", borderRadius: 100,
            padding: "8px 20px", fontSize: 14, fontWeight: 900, color: "#be185d",
            boxShadow: "0 2px 12px rgba(244,114,182,0.10)",
          }}>
            ⚔️ VS
          </div>
          <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
        </div>

        {/* Your battlefield */}
        <BattleSide
          finis={team} hpArr={teamHp}
          label="Your team"
          side="you"
          attackingIdx={attacker?.side === "you" ? attacker.idx : null}
          defendingIdx={defender?.side === "you" ? defender.idx : null}
        />

        {/* Battle log */}
        <div style={{ marginTop: 24, background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", padding: "16px 20px", maxHeight: 300, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Battle Log</div>
            <div style={{ fontSize: 10, color: "#bbb", fontWeight: 600 }}>{round} {round === 1 ? "turn" : "turns"} played · {speed}× speed</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {log.length === 0 && <div style={{ fontSize: 13, color: "#bbb", fontStyle: "italic" }}>Battle starting…</div>}
            {log.map(entry => {
              const isSystem = entry.side === "system";
              const sideColor = isSystem ? "#7c3aed" : entry.side === "you" ? "#16a34a" : "#dc2626";
              const bg = isSystem ? "#faf5ff" : entry.side === "you" ? "#f0fdf4" : "#fef2f2";
              return (
                <div key={entry.key} style={{
                  background: bg,
                  borderLeft: `3px solid ${sideColor}`,
                  borderRadius: 6,
                  padding: "8px 12px",
                }}>
                  <div style={{ fontSize: 13, color: sideColor, fontWeight: 800, lineHeight: 1.3 }}>
                    {isSystem ? "" : entry.side === "you" ? "→ " : "← "}{entry.msg}
                  </div>
                  {entry.details && (
                    <div style={{ fontSize: 11, color: "#666", fontWeight: 500, marginTop: 3, lineHeight: 1.4 }}>
                      {entry.details}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BattleSide({ finis, hpArr, label, side, attackingIdx, defendingIdx, mirrored }: {
  finis: Fini[]; hpArr: number[]; label: string;
  side: "you" | "them";
  attackingIdx: number | null; defendingIdx: number | null;
  mirrored?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: side === "you" ? "#16a34a" : "#dc2626", marginBottom: 10, textAlign: mirrored ? "right" : "left" }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {finis.map((f, i) => (
          <BattleFiniCard
            key={i} fini={f} hp={hpArr[i]} maxHp={f.maxHp}
            attacking={attackingIdx === i}
            defending={defendingIdx === i}
            ko={hpArr[i] <= 0}
          />
        ))}
      </div>
    </div>
  );
}

function BattleFiniCard({ fini, hp, maxHp, attacking, defending, ko }: { fini: Fini; hp: number; maxHp: number; attacking: boolean; defending: boolean; ko: boolean }) {
  const hpPct = (hp / maxHp) * 100;
  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      border: "1.5px solid #f0f0f0", background: "#fff",
      transform: attacking ? "translateY(-6px) scale(1.04)" : defending ? "translateX(4px)" : "",
      opacity: ko ? 0.4 : 1,
      transition: "transform 0.3s, opacity 0.3s",
      boxShadow: attacking ? "0 8px 24px rgba(244,114,182,0.30)" : defending ? "0 0 0 3px #ef4444" : "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ background: CLAN_TINTS[fini.clan] ?? "#ddd", height: 100, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={`/clan-art/${slugify(fini.clan)}.gif`} alt="" style={{ height: 76, width: "auto", objectFit: "contain", filter: ko ? "grayscale(1)" : "none" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        {fini.item && (
          <div title={fini.item.name} style={{
            position: "absolute", top: 6, right: 6,
            background: "#fff", borderRadius: "50%",
            width: 24, height: 24, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}>{fini.item.icon}</div>
        )}
        {ko && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>
            K.O.
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>#{fini.id}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: (FAMILY_COLOR[fini.family] ?? "#888") + "22", color: FAMILY_COLOR[fini.family] }}>{fini.family}</span>
        </div>
        <div style={{ height: 6, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${hpPct}%`,
            background: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444",
            transition: "width 0.4s ease-out",
          }} />
        </div>
        <div style={{ fontSize: 10, color: "#888", textAlign: "right", marginTop: 2 }}>
          {hp} / {maxHp}
        </div>
      </div>
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({ winner, stake, opponentName, opponentTeamIds, onReturn }: {
  winner: "you" | "them" | "draw"; stake: number;
  opponentName: string; opponentTeamIds: number[];
  onReturn: () => void;
}) {
  const isWin = winner === "you";
  const isDraw = winner === "draw";
  // Build a challenge-back URL pointing at the same opponent's roster
  const opponentLooksLikeWallet = /^0x[0-9a-f]{4}…[0-9a-f]{4}$/i.test(opponentName) || opponentName.startsWith("0x");
  const challengeBackUrl = opponentLooksLikeWallet && opponentTeamIds.length > 0
    ? `${window.location.origin}/challenge?from=${opponentName.replace("…", "")}&team=${opponentTeamIds.join(",")}&stake=${stake}`
    : null;
  function tweetResult() {
    const verb = isWin ? "Just beat" : isDraw ? "Drew with" : "Just lost to";
    const text = `⚔️ ${verb} ${opponentName} in Fini Fight Club!\n${isWin ? `+${stake} FINI$ 💸` : isDraw ? "Honors even." : `-${stake} FINI$ — running it back.`}\n${window.location.origin}/fight-club`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  }
  return (
    <div style={{ minHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 24 }}>
      <div style={{ fontSize: 72 }}>{isWin ? "🏆" : isDraw ? "🤝" : "💀"}</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: isWin ? "#16a34a" : isDraw ? "#888" : "#dc2626" }}>
          {isWin ? "Victory!" : isDraw ? "Draw" : "Defeated"}
        </div>
        <div style={{ fontSize: 15, color: "#666", marginTop: 8 }}>
          {isWin && "You won the whole pot — well fought!"}
          {isDraw && "It's a tie — stakes refunded."}
          {winner === "them" && "Your stake went to the winner. Regroup and try again."}
        </div>
      </div>

      {/* Payout breakdown */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", padding: "18px 24px", minWidth: 320, fontSize: 13 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Payout breakdown</div>
        <Row label="Your stake"        value={`-${stake}`}                     color="#dc2626" />
        <Row label="Treasury contribution"  value={`+${stake} (beta-funded)`}    color="#888" />
        {isWin && (
          <>
            <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
            <Row label="Prize pot won"   value={`+${stake * 2} FINI$`}           color="#16a34a" bold />
            <Row label="Net profit"      value={`+${stake} FINI$`}               color="#16a34a" />
          </>
        )}
        {isDraw && (
          <>
            <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
            <Row label="Stake refund"    value={`+${stake} FINI$`}               color="#888" bold />
            <Row label="Net"             value={`0 FINI$`}                       color="#888" />
          </>
        )}
        {winner === "them" && (
          <>
            <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
            <Row label="Net loss"        value={`-${stake} FINI$`}               color="#dc2626" bold />
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 6, fontStyle: "italic" }}>Your {stake} FINI$ went to {/* opponent */} the winner.</div>
          </>
        )}
      </div>
      {/* Primary + share actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={onReturn} style={{
          background: "#f472b6", color: "#fff", border: "none", borderRadius: 100,
          padding: "14px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer",
          boxShadow: "0 6px 20px rgba(244,114,182,0.30)",
        }}>
          ← Back to Workshop
        </button>
        {challengeBackUrl && (
          <a href={challengeBackUrl} style={{
            background: "#fff", color: "#be185d",
            border: "2px solid #f472b6", borderRadius: 100,
            padding: "12px 26px", fontSize: 14, fontWeight: 800,
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            🔄 Run it back
          </a>
        )}
        <button onClick={tweetResult} style={{
          background: "#fff", color: "#1d9bf0",
          border: "1.5px solid #1d9bf0", borderRadius: 100,
          padding: "12px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          🐦 Tweet result
        </button>
      </div>
      <Link to="/leaderboard" style={{ fontSize: 13, color: "#888", textDecoration: "none", fontWeight: 700 }}>
        See leaderboard →
      </Link>
    </div>
  );
}

// ── Reusable bits ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, accent, headerExtra, children }: {
  title: string; subtitle: string; accent?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px", borderTop: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{subtitle}</div>
        </div>
        {headerExtra}
      </div>
      {children}
    </div>
  );
}

function FiniBattleCard({ fini, position, onClick, highlighted, active, showSwap, onSwap }: {
  fini: Fini; position: string;
  onClick: () => void; highlighted: boolean; active: boolean;
  showSwap?: boolean; onSwap?: () => void;
}) {
  useTicker(1000); // re-render every second so countdown updates live
  const record = useFiniRecords(s => s.records[fini.id]);
  const isResting = useFiniRecords(s => s.isResting(fini.id));
  const restMs    = useFiniRecords(s => s.restingMsLeft(fini.id));
  const navigate = useNavigate();
  const wins   = record?.wins ?? 0;
  const losses = record?.losses ?? 0;
  const level  = record?.level ?? 1;
  const xp     = record?.xp ?? 0;
  const xpInfo = xpToNextLevel(xp);
  return (
    <div
      onClick={showSwap && onSwap ? onSwap : onClick}
      style={{
        borderRadius: 16, overflow: "hidden",
        border: active ? "2.5px solid #f472b6" : highlighted ? "2px dashed #fbbf24" : "1.5px solid #f0f0f0",
        background: "#fff", cursor: "pointer",
        transition: "transform 0.12s, box-shadow 0.12s",
        boxShadow: active ? "0 6px 20px rgba(244,114,182,0.25)" : highlighted ? "0 0 0 3px rgba(251,191,36,0.15)" : "none",
        position: "relative",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
    >
      {showSwap && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(244,114,182,0.85)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, zIndex: 2, borderRadius: 16 }}>
          ↑ Swap in
        </div>
      )}
      <div style={{ background: CLAN_TINTS[fini.clan] ?? "#ddd", height: 120, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <img src={`/clan-art/${slugify(fini.clan)}.gif`} alt="" style={{ height: 90, width: "auto", objectFit: "contain", filter: isResting ? "grayscale(0.6)" : "none" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        {fini.item && (
          <div title={fini.item.name + " — " + fini.item.effect} style={{
            position: "absolute", top: 8, right: 8,
            background: "#fff", borderRadius: "50%",
            width: 30, height: 30, fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}>{fini.item.icon}</div>
        )}
        <div style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.45)", padding: "2px 7px", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.06em" }}>{position}</div>
        {/* Role chip — Tank / Striker / Healer */}
        {(() => {
          const role = FAMILY_ROLE[fini.family];
          if (!role) return null;
          const meta = ROLE_META[role];
          return (
            <div title={meta.description} style={{
              position: "absolute", top: 8, right: fini.item ? 46 : 8,
              background: meta.bgTint, color: meta.color,
              fontSize: 9, fontWeight: 800,
              padding: "3px 8px", borderRadius: 100,
              boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <span>{meta.icon}</span>
              <span>{meta.name}</span>
            </div>
          );
        })()}
        {/* Level badge */}
        <div title={`${xp} XP · ${xpInfo.current}/${xpInfo.needed} to next level`} style={{
          position: "absolute", bottom: 8, left: 8,
          background: "linear-gradient(135deg, #fde047, #f59e0b)",
          color: "#854d0e", fontSize: 10, fontWeight: 900,
          padding: "2px 8px", borderRadius: 100,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}>
          LVL {level}
        </div>
        {/* Resting overlay */}
        {isResting && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <div style={{ fontSize: 18 }}>💤</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#666" }}>Resting</div>
            <div style={{ fontSize: 9, color: "#888", fontFamily: "monospace" }}>{fmtRestTime(restMs)}</div>
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>#{fini.id}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: (FAMILY_COLOR[fini.family] ?? "#888") + "22", color: FAMILY_COLOR[fini.family] }}>{fini.family}</span>
        </div>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 8 }}>{fini.clan}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, fontSize: 10 }}>
          <Stat label="HP"  v={fini.maxHp} c="#22c55e" />
          <Stat label="ATK" v={fini.atk}   c="#ef4444" />
          <Stat label="DEF" v={fini.def}   c="#3b82f6" />
          <Stat label="SPD" v={fini.speed} c="#a78bfa" />
        </div>
        {fini.trait && <div style={{ fontSize: 10, color: "#be185d", fontWeight: 700, marginTop: 6, textAlign: "center" }}>✦ {fini.trait}</div>}
        {/* XP bar */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888", fontWeight: 700, marginBottom: 2 }}>
            <span>{wins}W · {losses}L</span>
            <span>{xpInfo.current}/{xpInfo.needed} XP</span>
          </div>
          <div style={{ height: 4, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${xpInfo.pct}%`, background: "linear-gradient(90deg, #fde047, #f59e0b)" }} />
          </div>
        </div>
        {/* Profile link */}
        <button
          onClick={e => { e.stopPropagation(); navigate(`/fini/${fini.id}`); }}
          style={{
            marginTop: 8, width: "100%", background: "none", border: "1px solid #f0f0f0",
            borderRadius: 8, padding: "4px 0", fontSize: 10, fontWeight: 700, color: "#888",
            cursor: "pointer",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fdf0f7"; (e.currentTarget as HTMLElement).style.color = "#be185d"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#888"; }}
        >
          View Profile →
        </button>
      </div>
    </div>
  );
}

function Stat({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div style={{ textAlign: "center", background: c + "12", borderRadius: 6, padding: "3px 2px" }}>
      <div style={{ fontSize: 8, color: c, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>{v}</div>
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
      <span style={{ color: "#666", fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 900 : 700 }}>{value}</span>
    </div>
  );
}
