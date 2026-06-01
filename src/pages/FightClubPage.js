import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUIStore } from "../state/uiStore";
import { useCoinStore } from "../state/coinStore";
import { useCrumbStore } from "../state/crumbStore";
import { useFiniRecords, xpToNextLevel, fmtRestTime, tierFor } from "../state/finiRecords";
import { useInventory, POTIONS } from "../state/inventory";
import { useTicker } from "../hooks/useTicker";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { pickGhostOpponent, shortenWallet, synthFini, loadGhostTeams } from "../game/ghostOpponents";
const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
const CLAN_TINTS = {
    "Arms of the State": "#b8c8d8", "Hourly": "#c8b4a0", "Townspeople": "#d4cfa0",
    "Artists": "#d4a4a0", "Soldiers": "#b0b0c8", "Twice Daily": "#a8c8d8",
    "Miners": "#b8a890", "Farmers": "#a8b8a0",
};
const FAMILY_COLOR = {
    BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
    LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", BNB: "#f3ba2f",
    MATIC: "#8247e5", XTZ: "#a6e000",
};
// 24 items — comparable to a normal Super Auto Pets game's shop pool.
// SAP-restrained pricing: starting 30 🍪 affords any common; rares need ~4
// battle wins; legendaries need ~10 wins or perfect frugality.
const ITEMS = [
    // ── Common — single-stat boosters (5-15 Crumbs) ─────────────────────────
    { name: "Acorn", icon: "🌰", effect: "+3 DEF", bonus: { def: 3 }, price: 5, tier: "common" },
    { name: "Pebble", icon: "🪨", effect: "+4 ATK", bonus: { atk: 4 }, price: 6, tier: "common" },
    { name: "Spring Water", icon: "💧", effect: "+6 HP", bonus: { hp: 6 }, price: 6, tier: "common" },
    { name: "Sneakers", icon: "👟", effect: "+2 SPD", bonus: { speed: 2 }, price: 8, tier: "common" },
    { name: "Twig Stick", icon: "🪵", effect: "+5 ATK", bonus: { atk: 5 }, price: 10, tier: "common" },
    { name: "Leaf Vest", icon: "🍃", effect: "+5 DEF", bonus: { def: 5 }, price: 10, tier: "common" },
    { name: "Berry Juice", icon: "🍓", effect: "+10 HP", bonus: { hp: 10 }, price: 12, tier: "common" },
    { name: "Quick Cloak", icon: "🧣", effect: "+3 SPD", bonus: { speed: 3 }, price: 14, tier: "common" },
    // ── Rare — combo boosters (20-40 Crumbs, ~3-4 wins to afford) ────────────
    { name: "Diamond Shell", icon: "💎", effect: "+10 DEF", bonus: { def: 10 }, price: 22, tier: "rare" },
    { name: "Volatility Spike", icon: "⚡", effect: "+8 ATK", bonus: { atk: 8 }, price: 22, tier: "rare" },
    { name: "Oracle Tonic", icon: "🔮", effect: "+15 HP", bonus: { hp: 15 }, price: 24, tier: "rare" },
    { name: "Speed Boots", icon: "🥾", effect: "+5 SPD", bonus: { speed: 5 }, price: 24, tier: "rare" },
    { name: "Battle Scar", icon: "🩹", effect: "+5 ATK · +5 DEF", bonus: { atk: 5, def: 5 }, price: 28, tier: "rare" },
    { name: "Meme Charm", icon: "🍀", effect: "+12 HP · +3 SPD", bonus: { hp: 12, speed: 3 }, price: 28, tier: "rare" },
    { name: "Cookie Pendant", icon: "🍪", effect: "+8 HP · +4 ATK", bonus: { hp: 8, atk: 4 }, price: 32, tier: "rare" },
    { name: "Honey Pot", icon: "🍯", effect: "+10 HP · +3 DEF", bonus: { hp: 10, def: 3 }, price: 34, tier: "rare" },
    { name: "Crystal Lens", icon: "🔍", effect: "+6 ATK · +4 SPD", bonus: { atk: 6, speed: 4 }, price: 38, tier: "rare" },
    { name: "Rune Stone", icon: "🗿", effect: "+8 DEF · +4 SPD", bonus: { def: 8, speed: 4 }, price: 38, tier: "rare" },
    // ── Legendary — all-rounders & extreme stats (50-120 Crumbs) ────────────
    { name: "Phoenix Feather", icon: "🪶", effect: "+15 HP · +6 ATK", bonus: { hp: 15, atk: 6 }, price: 55, tier: "legendary" },
    { name: "Ancient Helm", icon: "🪖", effect: "+12 DEF · +8 HP", bonus: { def: 12, hp: 8 }, price: 55, tier: "legendary" },
    { name: "Dragon Scale", icon: "🐉", effect: "+10 ATK · +10 DEF", bonus: { atk: 10, def: 10 }, price: 70, tier: "legendary" },
    { name: "Lightning Sigil", icon: "⚡", effect: "+12 ATK · +6 SPD", bonus: { atk: 12, speed: 6 }, price: 75, tier: "legendary" },
    { name: "Aurora Mantle", icon: "🌌", effect: "+8 / +8 / +8 / +4", bonus: { hp: 8, atk: 8, def: 8, speed: 4 }, price: 100, tier: "legendary" },
    { name: "Eternal Idol", icon: "🏆", effect: "+25 HP · +6 DEF · +6 ATK", bonus: { hp: 25, def: 6, atk: 6 }, price: 120, tier: "legendary" },
];
const STARTING_TEAM = [
    { id: 4104, family: "BTC", clan: "Arms of the State", hp: 60, maxHp: 60, atk: 12, def: 8, speed: 4, trait: "Diamond Body" },
    { id: 2847, family: "ETH", clan: "Artists", hp: 50, maxHp: 50, atk: 14, def: 5, speed: 7, trait: "Meme Spike" },
    { id: 3201, family: "SOL", clan: "Soldiers", hp: 45, maxHp: 45, atk: 16, def: 4, speed: 9, trait: "Late Believer" },
];
const STARTING_BENCH = [
    { id: 5102, family: "DOGE", clan: "Miners", hp: 48, maxHp: 48, atk: 13, def: 6, speed: 6, trait: "Diamond Pawed" },
    { id: 6010, family: "LINK", clan: "Twice Daily", hp: 55, maxHp: 55, atk: 10, def: 9, speed: 5, trait: "Oracle Touched" },
    { id: 9100, family: "XTZ", clan: "Farmers", hp: 52, maxHp: 52, atk: 11, def: 7, speed: 5, trait: "Self-Amend" },
];
function generateOpponent(seed, targetPower) {
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
function slugify(s) { return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
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
    const isResting = useFiniRecords(s => s.isResting);
    const resetRecords = useFiniRecords(s => s.reset);
    // "busted" → can't afford the entry stake → run is over until you restart
    const [runStatus, setRunStatus] = useState("playing");
    // Watch for bust after balance changes from battle settlement.
    // (Cash-out tier is deliberately disabled until launch — keep this loop pure.)
    useEffect(() => {
        if (!walletAddress)
            return;
        if (balance < RUN_STAKE && runStatus === "playing")
            setRunStatus("busted");
    }, [balance, walletAddress, runStatus]);
    function restartRun() {
        resetRecords(); // wipe all XP, levels, rest cooldowns, items
        setBalance(RUN_STARTING_BANK);
        useCrumbStore.getState().resetRun(); // crumbs reset too — fresh tactical wallet
        setRunStatus("playing");
    }
    const [view, setView] = useState("workshop");
    const [team, setTeam] = useState(STARTING_TEAM);
    const [bench, setBench] = useState(STARTING_BENCH);
    const [collection, setCollection] = useState([]);
    // Load the connected/impersonated wallet's real roster from the snapshot.
    // First 3 owned Finis → starting team; next 3 → bench; rest → collection.
    // Falls back to the hardcoded sample if the wallet isn't a Fini holder.
    useEffect(() => {
        if (!walletAddress)
            return;
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
            fetch("/data/ownership.json").then(r => r.json()).then((own) => {
                const allMine = [];
                for (const [tok, owner] of Object.entries(own.tokenOwners)) {
                    if (owner.toLowerCase() === w)
                        allMine.push(Number(tok));
                }
                // Synthesize Finis first, then sort by family → clan → tokenId so the
                // user's roster always reads in the same family-clan order everywhere.
                const FAMILY_ORDER = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];
                const allFinis = allMine.map(id => synthFini(id));
                allFinis.sort((a, b) => {
                    if (a.family !== b.family) {
                        const ai = FAMILY_ORDER.indexOf(a.family);
                        const bi = FAMILY_ORDER.indexOf(b.family);
                        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
                    }
                    if (a.clan !== b.clan)
                        return a.clan.localeCompare(b.clan);
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
                if (benchTokens.length > 0)
                    setBench(benchTokens);
                setCollection(collectionTokens);
                console.info(`[FightClub] loaded ${allMine.length} Finis for ${w.slice(0, 6)}…${w.slice(-4)} — 3 starters · ${benchTokens.length} bench · ${collectionTokens.length} in collection`);
            }).catch(e => console.warn("[FightClub] ownership.json load failed", e));
        }).catch(e => console.warn("[FightClub] ghost teams load failed", e));
    }, [walletAddress]);
    const [opponent, setOpponent] = useState([]);
    const [opponentName, setOpponentName] = useState("");
    const [shop, setShop] = useState(ITEMS.slice(0, 3));
    const [stake] = useState(100);
    const [winner, setWinner] = useState(null);
    if (!walletAddress) {
        return (_jsxs("div", { style: { ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8f9fa" }, children: [_jsx("div", { style: { fontSize: 48 }, children: "\u2694\uFE0F" }), _jsx("div", { style: { fontSize: 20, fontWeight: 800, color: "#111" }, children: "Connect wallet to enter the Fight Club" }), _jsx(ConnectWalletButton, {})] }));
    }
    function findOpponent() {
        // Use actual battle stats (HP/ATK/DEF/SPD with items factored in) so
        // ghost matchmaking reflects how lethal the player ACTUALLY is — not
        // just their XP/level. Items add directly to f.atk/f.def/f.maxHp/f.speed,
        // so summing those properly captures equipment power too.
        const yourBattleStats = team.reduce((s, f) => s + f.maxHp + f.atk * 3 + f.def * 2 + f.speed * 2, 0);
        const yourPower = yourBattleStats; // used downstream for tier display
        // Try to match against a real Fini holder's ghost team (±15% power band).
        // Falls back to the synthetic generator if the seed file isn't loaded.
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
        if (team.length < 3) {
            alert("You need 3 starters to enter the arena");
            return;
        }
        const restingFini = team.find(f => isResting(f.id));
        if (restingFini) {
            alert(`Fini #${restingFini.id} is still resting. Swap it out from the bench.`);
            return;
        }
        if (!opponent.length)
            findOpponent();
        spend(stake);
        setWinner(null);
        setView("battle");
    }
    async function onBattleEnd(result) {
        setWinner(result);
        setView("result");
        const outcome = result === "you" ? "win" : result === "them" ? "loss" : "draw";
        const payout = outcome === "win" ? stake * 2 : outcome === "draw" ? stake : 0;
        const battleId = `fc:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        const teamTokenIds = team.map(f => f.id);
        // Optimistic local update so the UI feels instant
        applyBatch(teamTokenIds.map(tokenId => ({ tokenId, outcome })));
        if (result === "you")
            earn(stake * 2);
        else if (result === "draw")
            earn(stake);
        // Drip Crumbs after every battle. Outcome-dependent: win=25, loss=10, draw=17.
        // SAP-style restraint — you only earn enough for interesting choices by
        // stringing wins together.
        useCrumbStore.getState().rewardBattle(outcome);
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
            if (syncFromServer)
                await syncFromServer(teamTokenIds);
        }
        catch (e) {
            console.warn("[battle] server settle failed, local-only update used:", e);
        }
    }
    function swapWithBench(teamIdx, benchIdx) {
        const newTeam = [...team];
        const newBench = [...bench];
        [newTeam[teamIdx], newBench[benchIdx]] = [newBench[benchIdx], newTeam[teamIdx]];
        setTeam(newTeam);
        setBench(newBench);
    }
    /** Swap a specific collection Fini with a specific bench slot. */
    function sendToBench(collectionIdx, benchIdx) {
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
    function returnToCollection(benchIdx) {
        if (collection.length === 0)
            return;
        const newBench = [...bench];
        const newCollection = [...collection];
        [newBench[benchIdx], newCollection[0]] = [newCollection[0], newBench[benchIdx]];
        setBench(newBench);
        setCollection(newCollection);
    }
    function equipItem(target, idx, item) {
        // Deduct the Crumb price first. Bail if the player can't afford it.
        const ok = useCrumbStore.getState().spend(item.price);
        if (!ok) {
            alert(`Not enough 🍪 Crumbs (${item.price} needed)`);
            return;
        }
        if (target === "team") {
            const next = [...team];
            const f = { ...next[idx], item, atk: next[idx].atk + (item.bonus.atk ?? 0), def: next[idx].def + (item.bonus.def ?? 0), maxHp: next[idx].maxHp + (item.bonus.hp ?? 0), hp: next[idx].hp + (item.bonus.hp ?? 0), speed: next[idx].speed + (item.bonus.speed ?? 0) };
            next[idx] = f;
            setTeam(next);
        }
        else {
            const next = [...bench];
            const f = { ...next[idx], item, atk: next[idx].atk + (item.bonus.atk ?? 0), def: next[idx].def + (item.bonus.def ?? 0), maxHp: next[idx].maxHp + (item.bonus.hp ?? 0), hp: next[idx].hp + (item.bonus.hp ?? 0), speed: next[idx].speed + (item.bonus.speed ?? 0) };
            next[idx] = f;
            setBench(next);
        }
        setShop(shop.filter(s => s.name !== item.name));
    }
    function rerollShop() {
        // SAP-style: reroll is cheap (5 🍪) so it's a frequent decision.
        const ok = useCrumbStore.getState().spend(5);
        if (!ok) {
            alert("Not enough 🍪 Crumbs to reroll (5 needed)");
            return;
        }
        const shuffled = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
        setShop(shuffled);
    }
    // ── Render ──
    return (_jsxs("div", { style: { ...S, background: "#f8f9fa", minHeight: "100vh" }, children: [view === "workshop" && (_jsx(WorkshopView, { team: team, bench: bench, collection: collection, shop: shop, opponent: opponent, opponentName: opponentName, stake: stake, onSwap: swapWithBench, onSendToBench: sendToBench, onReturnToCollection: returnToCollection, onEquip: equipItem, onFindOpponent: findOpponent, onReroll: rerollShop, onStartBattle: startBattle })), view === "battle" && (_jsx(BattleView, { team: team, opponent: opponent, opponentName: opponentName, onBattleEnd: onBattleEnd })), view === "result" && winner && (_jsx(ResultView, { winner: winner, stake: stake, onReturn: () => { setView("workshop"); setOpponent([]); setOpponentName(""); } })), runStatus === "busted" && (_jsx(RunStatusModal, { balance: balance, onRestart: restartRun }))] }));
}
/** Bust modal — shown when player can no longer afford the entry stake. */
function RunStatusModal({ balance, onRestart }) {
    return (_jsx("div", { style: {
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
        }, children: _jsxs("div", { style: {
                background: "#fff", borderRadius: 24, padding: 32,
                maxWidth: 480, width: "100%", textAlign: "center",
                boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                border: "3px solid #ef4444",
            }, children: [_jsx("div", { style: { fontSize: 64, marginBottom: 12 }, children: "\uD83D\uDC80" }), _jsx("div", { style: { fontSize: 24, fontWeight: 900, color: "#dc2626", marginBottom: 8 }, children: "Your run busted" }), _jsxs("div", { style: { fontSize: 14, color: "#555", lineHeight: 1.5, marginBottom: 20 }, children: ["You're down to ", _jsxs("b", { children: [balance.toLocaleString(), " FINI$"] }), " \u2014 not enough to enter another battle. Your Finis remember every battle, but a fresh run gives them a clean slate."] }), _jsx("button", { onClick: onRestart, style: {
                        background: "linear-gradient(135deg, #f472b6, #ec4899)",
                        color: "#fff", border: "none", borderRadius: 100,
                        padding: "12px 28px", fontSize: 14, fontWeight: 800,
                        cursor: "pointer", boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
                    }, children: "\uD83D\uDD04 Restart Run" }), _jsx("div", { style: { fontSize: 11, color: "#888", marginTop: 16, lineHeight: 1.5 }, children: "Restart will reset all your Finis' XP, levels, items, and rest cooldowns. Your collection (which Finis you own) stays the same." })] }) }));
}
// ── Workshop ──────────────────────────────────────────────────────────────────
function WorkshopView({ team, bench, collection, shop, opponent, opponentName, stake, onSwap, onSendToBench, onReturnToCollection, onEquip, onFindOpponent, onReroll, onStartBattle, }) {
    // When user clicks "→ Add to Bench" on a collection Fini, we enter
    // "pick a bench slot" mode and the 3 bench tiles highlight as drop targets.
    const [pickBenchFor, setPickBenchFor] = useState(null);
    useTicker(1000); // for rest-timer updates
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedPotion, setSelectedPotion] = useState(null);
    const [equipTarget, setEquipTarget] = useState(null);
    const balance = useCoinStore(s => s.balance);
    const earn = useCoinStore(s => s.earn);
    const crumbs = useCrumbStore(s => s.crumbs);
    const isResting = useFiniRecords(s => s.isResting);
    const restoreFully = useFiniRecords(s => s.restoreFully);
    const shortenRest = useFiniRecords(s => s.shortenRest);
    const grantXp = useFiniRecords(s => s.grantXp);
    const inventory = useInventory(s => s.items);
    const addPotion = useInventory(s => s.add);
    const consumePotion = useInventory(s => s.consume);
    const anyResting = team.some(f => isResting(f.id));
    // Battle-stat-based power (matches what the engine fights with): HP + 3×ATK + 2×DEF + 2×SPD per Fini.
    // Includes item bonuses (which mutate f.atk/f.def/etc. directly).
    function battleStatPower(finis) {
        return finis.reduce((s, f) => s + f.maxHp + f.atk * 3 + f.def * 2 + f.speed * 2, 0);
    }
    const teamPowerNum = battleStatPower(team);
    const oppPowerNum = battleStatPower(opponent);
    const tT = tierFor(teamPowerNum), tO = tierFor(oppPowerNum);
    const teamPower = { total: teamPowerNum, tier: tT.name, tierColor: tT.color };
    const oppPower = opponent.length ? { total: oppPowerNum, tier: tO.name, tierColor: tO.color } : null;
    function buyPotion(id) {
        const p = POTIONS[id];
        // Pay in Crumbs, not FINI$
        if (!useCrumbStore.getState().spend(p.price))
            return;
        addPotion(id);
    }
    function applyPotionToFini(id, tokenId) {
        const ok = consumePotion(id);
        if (!ok)
            return;
        if (id === "energy_potion" || id === "full_revive")
            restoreFully(tokenId);
        else if (id === "quick_snack")
            shortenRest(tokenId, 15 * 60 * 1000);
        else if (id === "xp_truffle")
            grantXp(tokenId, 20);
        setSelectedPotion(null);
    }
    void earn;
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: { background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px 24px" }, children: _jsxs("div", { style: { maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }, children: "\u2694\uFE0F Fight Club" }), _jsx("p", { style: { fontSize: 14, color: "#888", marginTop: 4 }, children: "Equip, position, and lead your team into the arena" })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [_jsxs("div", { style: { textAlign: "right" }, children: [_jsx("div", { style: { fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }, children: "Team Power" }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 900, color: "#111" }, children: teamPower.total.toLocaleString() }), _jsx("span", { style: { fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 100, background: teamPower.tierColor + "22", color: teamPower.tierColor }, children: teamPower.tier })] })] }), _jsx("div", { style: { width: 1, height: 36, background: "#e5e7eb" } }), _jsxs("div", { style: { textAlign: "right" }, children: [_jsx("div", { style: { fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }, children: "Entry \u00B7 Prize pot" }), _jsxs("div", { style: { fontSize: 18, fontWeight: 900, color: "#111" }, children: [stake, " ", _jsx("span", { style: { fontSize: 12, color: "#aaa" }, children: "\u2192" }), " ", " ", _jsx("span", { style: { color: "#16a34a" }, children: stake * 2 }), _jsx("span", { style: { fontSize: 13, color: "#854d0e" }, children: " FINI$" })] }), _jsx("div", { style: { fontSize: 10, color: "#888", marginTop: 2 }, children: "Winner takes opponent's stake" })] }), opponent.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: onStartBattle, disabled: balance < stake || anyResting, title: anyResting ? "One of your starters is resting — swap them out, use a potion, or wake the team" : "", style: {
                                                background: (balance < stake || anyResting) ? "#e5e7eb" : "linear-gradient(135deg, #f472b6, #ec4899)",
                                                color: (balance < stake || anyResting) ? "#aaa" : "#fff",
                                                border: "none", borderRadius: 100,
                                                padding: "14px 32px", fontSize: 15, fontWeight: 800,
                                                cursor: (balance < stake || anyResting) ? "not-allowed" : "pointer",
                                                boxShadow: (balance < stake || anyResting) ? "none" : "0 4px 14px rgba(244,114,182,0.35)",
                                            }, children: anyResting ? "💤 Starter resting" : "⚔️ Enter Arena" }), anyResting && (_jsx("button", { onClick: () => team.forEach(f => restoreFully(f.id)), title: "Dev: clear all rest cooldowns on your starters", style: {
                                                background: "transparent", color: "#888",
                                                border: "1.5px dashed #ddd", borderRadius: 100,
                                                padding: "12px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                                            }, children: "\u2615 Wake team" }))] })) : (_jsx("button", { onClick: onFindOpponent, style: {
                                        background: "#111", color: "#fff",
                                        border: "none", borderRadius: 100,
                                        padding: "14px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer",
                                    }, children: "\uD83D\uDD0D Find Opponent" }))] })] }) }), _jsxs("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "32px 48px", display: "flex", flexDirection: "column", gap: 22 }, children: [opponent.length > 0 && oppPower && (_jsx(Card, { title: "\uD83C\uDFAF Opponent Found", subtitle: `Player ${opponentName} · matched within ±15% power · staking ${stake} FINI$`, accent: "#f472b6", headerExtra: _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }, children: [_jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 700 }, children: "OPPONENT POWER" }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 900, color: "#111" }, children: oppPower.total.toLocaleString() }), _jsx("span", { style: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 100, background: oppPower.tierColor + "22", color: oppPower.tierColor }, children: oppPower.tier })] }), _jsxs("div", { style: { fontSize: 11, color: "#666", fontWeight: 700 }, children: ["vs You: ", _jsxs("span", { style: { color: oppPower.total > teamPower.total ? "#dc2626" : oppPower.total < teamPower.total ? "#16a34a" : "#888" }, children: [oppPower.total > teamPower.total ? "+" : "", ((oppPower.total - teamPower.total) / teamPower.total * 100).toFixed(1), "%"] })] })] }), children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }, children: opponent.map((f, i) => (_jsx(FiniBattleCard, { fini: f, position: `Enemy ${i + 1}`, onClick: () => { }, highlighted: false, active: false }, i))) }) })), _jsx(Card, { title: "Starting Lineup", subtitle: selectedItem !== null ? "Pick a Fini to equip" : "Click a slot to view, equip, or swap", accent: "#22c55e", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }, children: team.map((f, i) => (_jsx(FiniBattleCard, { fini: f, position: `Starter ${i + 1}`, onClick: () => {
                                    if (selectedPotion !== null) {
                                        applyPotionToFini(selectedPotion, f.id);
                                    }
                                    else if (selectedItem !== null) {
                                        onEquip("team", i, shop[selectedItem]);
                                        setSelectedItem(null);
                                    }
                                    else {
                                        setEquipTarget({ target: "team", idx: i });
                                    }
                                }, highlighted: selectedItem !== null || selectedPotion !== null, active: equipTarget?.target === "team" && equipTarget.idx === i }, i))) }) }), _jsx(Card, { title: "\uD83D\uDED2 Item Shop", subtitle: "3 items at a time. Reroll for a fresh lineup.", accent: "#fbbf24", headerExtra: _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsxs("span", { style: {
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        padding: "8px 16px", borderRadius: 100,
                                        background: "linear-gradient(135deg, #fef9c3, #fde047)",
                                        border: "1.5px solid #ca8a04",
                                        color: "#713f12", fontWeight: 900, fontSize: 14,
                                    }, children: ["\uD83C\uDF6A ", _jsx("span", { children: crumbs.toLocaleString() })] }), _jsx("button", { onClick: onReroll, disabled: crumbs < 5, style: {
                                        background: crumbs < 5 ? "#e5e7eb" : "#fff", color: crumbs < 5 ? "#aaa" : "#666",
                                        border: "1.5px solid #e5e7eb", borderRadius: 100,
                                        padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: crumbs < 5 ? "not-allowed" : "pointer",
                                    }, children: "\uD83C\uDFB2 Reroll (5 \uD83C\uDF6A)" })] }), children: shop.length === 0 ? (_jsx("div", { style: { textAlign: "center", padding: "24px 0", color: "#bbb", fontSize: 13 }, children: "All items equipped. Reroll to find new gear." })) : (_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }, children: shop.map((item, i) => {
                                const tierColor = item.tier === "legendary" ? "#a855f7" : item.tier === "rare" ? "#3b82f6" : "#888";
                                const cantAfford = crumbs < item.price;
                                return (_jsxs("button", { onClick: () => { if (!cantAfford)
                                        setSelectedItem(selectedItem === i ? null : i); }, disabled: cantAfford, style: {
                                        background: selectedItem === i ? "#fef3c7" : "#fff",
                                        border: selectedItem === i ? "2px solid #fbbf24" : `1.5px solid ${tierColor}33`,
                                        borderRadius: 14, padding: "14px",
                                        cursor: cantAfford ? "not-allowed" : "pointer", textAlign: "left",
                                        transition: "all 0.15s",
                                        opacity: cantAfford ? 0.45 : 1,
                                        position: "relative",
                                    }, onMouseEnter: e => { if (selectedItem !== i && !cantAfford)
                                        e.currentTarget.style.transform = "translateY(-2px)"; }, onMouseLeave: e => e.currentTarget.style.transform = "", children: [_jsx("div", { style: {
                                                position: "absolute", top: 8, right: 8,
                                                fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100,
                                                background: tierColor + "20", color: tierColor, textTransform: "uppercase", letterSpacing: 0.5,
                                            }, children: item.tier }), _jsx("div", { style: { fontSize: 32, marginBottom: 4 }, children: item.icon }), _jsx("div", { style: { fontSize: 13, fontWeight: 800, color: "#111" }, children: item.name }), _jsx("div", { style: { fontSize: 11, color: "#888", marginTop: 2 }, children: item.effect }), _jsxs("div", { style: { marginTop: 8, fontSize: 12, fontWeight: 800, color: cantAfford ? "#aaa" : "#854d0e" }, children: ["\uD83C\uDF6A ", item.price] }), selectedItem === i && (_jsx("div", { style: { marginTop: 8, fontSize: 11, fontWeight: 800, color: "#be185d" }, children: "Click a Fini to equip \u2192" }))] }, i));
                            }) })) }), _jsxs(Card, { title: "\uD83E\uDDEA Potions & Snacks", subtitle: "Heal up tired Finis with consumables", accent: "#ef4444", children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }, children: "Your inventory" }), _jsx("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: Object.keys(POTIONS).map(id => {
                                            const p = POTIONS[id];
                                            const have = inventory[id] ?? 0;
                                            const active = selectedPotion === id;
                                            return (_jsxs("button", { disabled: have === 0, onClick: () => setSelectedPotion(active ? null : id), style: {
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    padding: "8px 14px", borderRadius: 100,
                                                    border: active ? `2px solid ${p.color}` : "1.5px solid #f0f0f0",
                                                    background: active ? p.color + "18" : have === 0 ? "#f9fafb" : "#fff",
                                                    cursor: have === 0 ? "not-allowed" : "pointer",
                                                    opacity: have === 0 ? 0.45 : 1,
                                                    fontSize: 13, fontWeight: 700, color: "#111",
                                                }, children: [_jsx("span", { style: { fontSize: 18 }, children: p.icon }), _jsx("span", { children: p.name }), _jsxs("span", { style: {
                                                            background: active ? p.color : "#f3f4f6",
                                                            color: active ? "#fff" : "#666",
                                                            padding: "1px 8px", borderRadius: 100, fontSize: 11, fontWeight: 800,
                                                        }, children: ["\u00D7", have] })] }, id));
                                        }) }), selectedPotion && (_jsxs("div", { style: { marginTop: 10, padding: "10px 14px", background: POTIONS[selectedPotion].color + "12", borderRadius: 10, fontSize: 12, color: POTIONS[selectedPotion].color, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("span", { children: ["\u2191 Click a Fini to use ", POTIONS[selectedPotion].name, " \u2014 ", POTIONS[selectedPotion].effect] }), _jsx("button", { onClick: () => setSelectedPotion(null), style: { background: "transparent", border: "none", color: POTIONS[selectedPotion].color, fontWeight: 800, cursor: "pointer" }, children: "cancel" })] }))] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }, children: "Shop \u2014 buy with FINI$" }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }, children: Object.keys(POTIONS).map(id => {
                                            const p = POTIONS[id];
                                            const cantAfford = crumbs < p.price;
                                            return (_jsxs("div", { style: { background: "#fff", border: "1.5px solid #f0f0f0", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("div", { style: { width: 36, height: 36, borderRadius: 10, background: p.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }, children: p.icon }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 800, color: "#111" }, children: p.name }), _jsx("div", { style: { fontSize: 10, color: p.color, fontWeight: 700 }, children: p.effect })] })] }), _jsx("div", { style: { fontSize: 11, color: "#888", lineHeight: 1.5 }, children: p.description }), _jsxs("button", { onClick: () => buyPotion(id), disabled: cantAfford, style: {
                                                            marginTop: 4,
                                                            background: cantAfford ? "#f3f4f6" : p.color,
                                                            color: cantAfford ? "#aaa" : "#fff",
                                                            border: "none", borderRadius: 100,
                                                            padding: "7px 0", fontSize: 12, fontWeight: 800,
                                                            cursor: cantAfford ? "not-allowed" : "pointer",
                                                        }, children: ["Buy \u00B7 ", p.price, " \uD83C\uDF6A"] })] }, id));
                                        }) })] })] }), _jsx("div", { "data-bench-card": true, children: _jsxs(Card, { title: "Bench", subtitle: "Reserves \u2014 swap into the lineup or equip items", accent: "#a78bfa", children: [_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }, children: bench.map((f, i) => {
                                        const isDropTarget = pickBenchFor !== null;
                                        return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, position: "relative" }, children: [_jsxs("div", { style: { position: "relative" }, children: [isDropTarget && (_jsx("div", { onClick: () => { if (pickBenchFor !== null) {
                                                                onSendToBench(pickBenchFor, i);
                                                                setPickBenchFor(null);
                                                            } }, style: {
                                                                position: "absolute", inset: 0,
                                                                background: "rgba(139,92,246,0.85)", color: "#fff",
                                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                                fontWeight: 800, fontSize: 14, zIndex: 5,
                                                                borderRadius: 16, cursor: "pointer",
                                                            }, children: "\u2193 Place here" })), _jsx(FiniBattleCard, { fini: f, position: `Bench ${i + 1}`, onClick: () => {
                                                                if (selectedPotion !== null) {
                                                                    applyPotionToFini(selectedPotion, f.id);
                                                                }
                                                                else if (selectedItem !== null) {
                                                                    onEquip("bench", i, shop[selectedItem]);
                                                                    setSelectedItem(null);
                                                                }
                                                                else {
                                                                    setEquipTarget({ target: "bench", idx: i });
                                                                }
                                                            }, highlighted: selectedItem !== null || selectedPotion !== null, active: equipTarget?.target === "bench" && equipTarget.idx === i, showSwap: equipTarget?.target === "team", onSwap: () => { if (equipTarget?.target === "team") {
                                                                onSwap(equipTarget.idx, i);
                                                                setEquipTarget(null);
                                                            } } })] }), _jsx("button", { onClick: () => onReturnToCollection(i), style: {
                                                        background: "transparent", color: "#666",
                                                        border: "1.5px solid #e5e7eb", borderRadius: 100,
                                                        padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer",
                                                    }, title: "Send this Fini back into your collection (swaps with the first collection Fini)", children: "\u21A9 Return to Collection" })] }, i));
                                    }) }), equipTarget?.target === "team" && (_jsxs("div", { style: { marginTop: 14, padding: "10px 14px", background: "#fdf0f7", borderRadius: 10, fontSize: 13, color: "#be185d", fontWeight: 700, textAlign: "center" }, children: ["\u2191 Click a bench slot to swap with Starter ", equipTarget.idx + 1, _jsx("button", { onClick: () => setEquipTarget(null), style: { marginLeft: 12, background: "transparent", border: "none", color: "#be185d", fontWeight: 800, cursor: "pointer" }, children: "cancel" })] })), pickBenchFor !== null && (_jsxs("div", { style: { marginTop: 14, padding: "10px 14px", background: "#f5f3ff", borderRadius: 10, fontSize: 13, color: "#7c3aed", fontWeight: 700, textAlign: "center" }, children: ["\u2191 Click a bench slot to place Fini #", collection[pickBenchFor]?.id, _jsx("button", { onClick: () => setPickBenchFor(null), style: { marginLeft: 12, background: "transparent", border: "none", color: "#7c3aed", fontWeight: 800, cursor: "pointer" }, children: "cancel" })] }))] }) }), collection.length > 0 && (() => {
                        const byFamily = {};
                        for (const f of collection) {
                            const fam = f.family || "Unknown";
                            const clan = f.clan || "(none)";
                            byFamily[fam] = byFamily[fam] || {};
                            byFamily[fam][clan] = byFamily[fam][clan] || [];
                            byFamily[fam][clan].push(f);
                        }
                        const FAMILY_ORDER = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];
                        const FAMILY_COLORS = {
                            BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c2a633",
                            BNB: "#f3ba2f", LINK: "#2a5ada", AVAX: "#e84142", UNI: "#ff007a",
                            MATIC: "#8247e5", XTZ: "#2c7df7",
                        };
                        const families = Object.keys(byFamily).sort((a, b) => {
                            const ai = FAMILY_ORDER.indexOf(a);
                            const bi = FAMILY_ORDER.indexOf(b);
                            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
                        });
                        return (_jsx(Card, { title: `Your Collection (${collection.length})`, subtitle: "Grouped by family and clan. Tap a Fini to inspect.", accent: "#22c55e", children: _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 22 }, children: families.map(family => {
                                    const clans = byFamily[family];
                                    const familyTotal = Object.values(clans).reduce((n, arr) => n + arr.length, 0);
                                    const color = FAMILY_COLORS[family] ?? "#999";
                                    return (_jsxs("div", { children: [_jsxs("div", { style: {
                                                    display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                                                    paddingBottom: 8, borderBottom: `1.5px solid ${color}22`,
                                                }, children: [_jsx("span", { style: {
                                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                            width: 24, height: 24, borderRadius: 999, background: color, color: "#fff",
                                                            fontWeight: 800, fontSize: 11,
                                                        }, children: family[0] }), _jsx("span", { style: { fontSize: 15, fontWeight: 800, color: "#111" }, children: family }), _jsxs("span", { style: { fontSize: 12, color: "#888", fontWeight: 600 }, children: ["(", familyTotal, ")"] })] }), Object.entries(clans).map(([clan, list]) => (_jsxs("div", { style: { marginBottom: 14 }, children: [_jsxs("div", { style: {
                                                            fontSize: 11, fontWeight: 800, color: "#6b7280",
                                                            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
                                                        }, children: [clan, " ", _jsxs("span", { style: { color: "#bbb", fontWeight: 600 }, children: ["\u00B7 ", list.length] })] }), _jsx("div", { style: {
                                                            display: "grid",
                                                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                                            gap: 14,
                                                        }, children: list.map(f => {
                                                            const colIdx = collection.indexOf(f);
                                                            return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [_jsx(FiniBattleCard, { fini: f, position: f.family, onClick: () => { }, highlighted: false, active: false }), _jsx("button", { onClick: () => {
                                                                            setPickBenchFor(colIdx);
                                                                            // Scroll the Bench card into view so the slot picker is visible
                                                                            setTimeout(() => {
                                                                                document.querySelector("[data-bench-card]")?.scrollIntoView({ behavior: "smooth", block: "center" });
                                                                            }, 50);
                                                                        }, style: {
                                                                            background: pickBenchFor === colIdx
                                                                                ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                                                                                : "linear-gradient(135deg, #a78bfa, #8b5cf6)",
                                                                            color: "#fff", border: "none", borderRadius: 100,
                                                                            padding: "6px 0", fontSize: 11, fontWeight: 800,
                                                                            cursor: "pointer",
                                                                            boxShadow: "0 2px 8px rgba(139,92,246,0.25)",
                                                                        }, title: "Swap this Fini into your bench \u2014 you'll pick which slot", children: pickBenchFor === colIdx ? "↑ Pick a bench slot" : "→ Add to Bench" })] }, f.id));
                                                        }) })] }, clan)))] }, family));
                                }) }) }));
                    })()] })] }));
}
// ── Battle view ───────────────────────────────────────────────────────────────
function BattleView({ team, opponent, opponentName, onBattleEnd }) {
    const [teamHp, setTeamHp] = useState(team.map(f => f.hp));
    const [oppHp, setOppHp] = useState(opponent.map(f => f.hp));
    const [log, setLog] = useState([]);
    const [round, setRound] = useState(0);
    const [attacker, setAttacker] = useState(null);
    const [defender, setDefender] = useState(null);
    // Playback speed: 1× = 1100ms/turn (default), 2× = 550ms, 4× = 275ms
    const [speed, setSpeed] = useState(1);
    const speedRef = useRef(speed);
    speedRef.current = speed;
    const tickRef = useRef(null);
    const battleRef = useRef({ teamHp: team.map(f => f.hp), oppHp: opponent.map(f => f.hp), turn: 0 });
    useEffect(() => {
        // Opening narration
        setLog([{ side: "system", msg: `⚔️ Battle begins — ${team.length}v${opponent.length}`, details: `You vs ${opponentName}`, key: Date.now() }]);
        function nextTick() {
            const intervalMs = 1100 / speedRef.current;
            tickRef.current = setTimeout(() => {
                runTurn();
                nextTick();
            }, intervalMs);
        }
        function runTurn() {
            const { teamHp: th, oppHp: oh, turn } = battleRef.current;
            const teamAlive = th.some(h => h > 0);
            const oppAlive = oh.some(h => h > 0);
            if (!teamAlive || !oppAlive) {
                if (tickRef.current)
                    clearTimeout(tickRef.current);
                tickRef.current = null;
                const result = teamAlive && !oppAlive ? "you" : oppAlive && !teamAlive ? "them" : "draw";
                const verdict = result === "you" ? "🏆 Victory!" : result === "them" ? "💀 Defeat" : "🤝 Draw";
                setLog(l => [...l.slice(-8), { side: "system", msg: verdict, details: result === "you" ? "Your team is the last standing." : result === "them" ? "Your team has fallen." : "Both sides knocked out.", key: Date.now() + Math.random() }]);
                setTimeout(() => onBattleEnd(result), 1200 / speedRef.current);
                return;
            }
            const attackerSide = turn % 2 === 0 ? "you" : "them";
            const attackerArr = attackerSide === "you" ? team : opponent;
            const defenderArr = attackerSide === "you" ? opponent : team;
            const aliveAttackers = attackerArr.map((f, i) => ({ f, i, hp: (attackerSide === "you" ? th : oh)[i] })).filter(x => x.hp > 0);
            const aliveDefenders = defenderArr.map((f, i) => ({ f, i, hp: (attackerSide === "you" ? oh : th)[i] })).filter(x => x.hp > 0);
            if (!aliveAttackers.length || !aliveDefenders.length) {
                battleRef.current.turn++;
                setRound(r => r + 1);
                return;
            }
            const atk = aliveAttackers[turn % aliveAttackers.length];
            const def = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)];
            // Damage formula: ATK - DEF/2 + ±2 variance, min 1
            const variance = Math.floor(Math.random() * 5) - 2; // -2..+2
            const base = atk.f.atk - Math.floor(def.f.def / 2);
            const crit = Math.random() < (atk.f.speed > def.f.speed ? 0.18 : 0.08);
            let dmg = Math.max(1, base + variance);
            if (crit)
                dmg = Math.round(dmg * 1.5);
            setAttacker({ side: attackerSide, idx: atk.i });
            setDefender({ side: attackerSide === "you" ? "them" : "you", idx: def.i });
            const defHpBefore = attackerSide === "you" ? oh[def.i] : th[def.i];
            const defHpAfter = Math.max(0, defHpBefore - dmg);
            const kos = defHpAfter === 0;
            if (attackerSide === "you") {
                const nextOh = [...oh];
                nextOh[def.i] = defHpAfter;
                battleRef.current.oppHp = nextOh;
                setOppHp(nextOh);
            }
            else {
                const nextTh = [...th];
                nextTh[def.i] = defHpAfter;
                battleRef.current.teamHp = nextTh;
                setTeamHp(nextTh);
            }
            // Rich log entry: attacker, defender, damage, KO + item flavor if equipped
            const item = atk.f.item ? ` ${atk.f.item.icon}` : "";
            const headline = `${atk.f.family} #${atk.f.id}${item} ${crit ? "lands a CRIT on" : "strikes"} ${def.f.family} #${def.f.id} — ${dmg} dmg`;
            const details = (kos ? `KO! ${def.f.family} #${def.f.id} is knocked out. ` : `${def.f.family} #${def.f.id}: ${defHpAfter}/${def.f.maxHp} HP. `) +
                `(${atk.f.atk} ATK vs ${def.f.def} DEF, ${variance >= 0 ? "+" : ""}${variance} variance${crit ? ", ×1.5 crit" : ""})`;
            setLog(l => [...l.slice(-8), { side: attackerSide, msg: headline, details, key: Date.now() + Math.random() }]);
            battleRef.current.turn++;
            setRound(r => r + 1);
            // Clear attacker animation (scaled by speed)
            setTimeout(() => { setAttacker(null); setDefender(null); }, 600 / speedRef.current);
        }
        nextTick();
        return () => { if (tickRef.current)
            clearTimeout(tickRef.current); };
        // We intentionally don't depend on team/opponent — battle inputs are
        // captured by closure on mount. Speed changes are read live from speedRef.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsx("div", { style: { minHeight: "calc(100vh - 64px)", background: "linear-gradient(180deg, #fff5f7 0%, #fce8f3 100%)", padding: "32px 48px" }, children: _jsxs("div", { style: { maxWidth: 1200, margin: "0 auto" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }, children: [_jsx("div", { style: { width: 120 } }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: "0.08em" }, children: ["Round ", round] }), _jsxs("div", { style: { fontSize: 22, fontWeight: 900, color: "#111", marginTop: 4 }, children: ["You vs ", opponentName] })] }), _jsx("div", { style: { display: "flex", gap: 4, background: "#fff", borderRadius: 100, padding: 4, border: "1.5px solid #f0e0ea" }, children: [1, 2, 4].map(s => (_jsxs("button", { onClick: () => setSpeed(s), style: {
                                    background: speed === s ? "linear-gradient(135deg, #f472b6, #ec4899)" : "transparent",
                                    color: speed === s ? "#fff" : "#666",
                                    border: "none", borderRadius: 100,
                                    padding: "6px 14px", fontSize: 12, fontWeight: 800,
                                    cursor: "pointer", minWidth: 36,
                                }, title: s === 1 ? "Normal speed" : s === 2 ? "2× — twice as fast" : "4× — blitz", children: [s, "\u00D7"] }, s))) })] }), _jsx(BattleSide, { finis: opponent, hpArr: oppHp, label: `${opponentName}'s team`, side: "them", attackingIdx: attacker?.side === "them" ? attacker.idx : null, defendingIdx: defender?.side === "them" ? defender.idx : null, mirrored: true }), _jsxs("div", { style: { margin: "20px 0", display: "flex", alignItems: "center", gap: 20 }, children: [_jsx("div", { style: { flex: 1, height: 1, background: "#f0f0f0" } }), _jsx("div", { style: {
                                background: "#fff", border: "1.5px solid #f0e0ea", borderRadius: 100,
                                padding: "8px 20px", fontSize: 14, fontWeight: 900, color: "#be185d",
                                boxShadow: "0 2px 12px rgba(244,114,182,0.10)",
                            }, children: "\u2694\uFE0F VS" }), _jsx("div", { style: { flex: 1, height: 1, background: "#f0f0f0" } })] }), _jsx(BattleSide, { finis: team, hpArr: teamHp, label: "Your team", side: "you", attackingIdx: attacker?.side === "you" ? attacker.idx : null, defendingIdx: defender?.side === "you" ? defender.idx : null }), _jsxs("div", { style: { marginTop: 24, background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", padding: "16px 20px", maxHeight: 300, overflow: "auto" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }, children: "Battle Log" }), _jsxs("div", { style: { fontSize: 10, color: "#bbb", fontWeight: 600 }, children: [round, " ", round === 1 ? "turn" : "turns", " played \u00B7 ", speed, "\u00D7 speed"] })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [log.length === 0 && _jsx("div", { style: { fontSize: 13, color: "#bbb", fontStyle: "italic" }, children: "Battle starting\u2026" }), log.map(entry => {
                                    const isSystem = entry.side === "system";
                                    const sideColor = isSystem ? "#7c3aed" : entry.side === "you" ? "#16a34a" : "#dc2626";
                                    const bg = isSystem ? "#faf5ff" : entry.side === "you" ? "#f0fdf4" : "#fef2f2";
                                    return (_jsxs("div", { style: {
                                            background: bg,
                                            borderLeft: `3px solid ${sideColor}`,
                                            borderRadius: 6,
                                            padding: "8px 12px",
                                        }, children: [_jsxs("div", { style: { fontSize: 13, color: sideColor, fontWeight: 800, lineHeight: 1.3 }, children: [isSystem ? "" : entry.side === "you" ? "→ " : "← ", entry.msg] }), entry.details && (_jsx("div", { style: { fontSize: 11, color: "#666", fontWeight: 500, marginTop: 3, lineHeight: 1.4 }, children: entry.details }))] }, entry.key));
                                })] })] })] }) }));
}
function BattleSide({ finis, hpArr, label, side, attackingIdx, defendingIdx, mirrored }) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: side === "you" ? "#16a34a" : "#dc2626", marginBottom: 10, textAlign: mirrored ? "right" : "left" }, children: label }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }, children: finis.map((f, i) => (_jsx(BattleFiniCard, { fini: f, hp: hpArr[i], maxHp: f.maxHp, attacking: attackingIdx === i, defending: defendingIdx === i, ko: hpArr[i] <= 0 }, i))) })] }));
}
function BattleFiniCard({ fini, hp, maxHp, attacking, defending, ko }) {
    const hpPct = (hp / maxHp) * 100;
    return (_jsxs("div", { style: {
            borderRadius: 16, overflow: "hidden",
            border: "1.5px solid #f0f0f0", background: "#fff",
            transform: attacking ? "translateY(-6px) scale(1.04)" : defending ? "translateX(4px)" : "",
            opacity: ko ? 0.4 : 1,
            transition: "transform 0.3s, opacity 0.3s",
            boxShadow: attacking ? "0 8px 24px rgba(244,114,182,0.30)" : defending ? "0 0 0 3px #ef4444" : "0 1px 3px rgba(0,0,0,0.06)",
        }, children: [_jsxs("div", { style: { background: CLAN_TINTS[fini.clan] ?? "#ddd", height: 100, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }, children: [_jsx("img", { src: `/clan-art/${slugify(fini.clan)}.gif`, alt: "", style: { height: 76, width: "auto", objectFit: "contain", filter: ko ? "grayscale(1)" : "none" }, onError: e => { e.target.style.display = "none"; } }), fini.item && (_jsx("div", { title: fini.item.name, style: {
                            position: "absolute", top: 6, right: 6,
                            background: "#fff", borderRadius: "50%",
                            width: 24, height: 24, fontSize: 13,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        }, children: fini.item.icon })), ko && (_jsx("div", { style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 2 }, children: "K.O." }))] }), _jsxs("div", { style: { padding: "8px 10px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [_jsxs("span", { style: { fontSize: 11, fontWeight: 800, color: "#111" }, children: ["#", fini.id] }), _jsx("span", { style: { fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: (FAMILY_COLOR[fini.family] ?? "#888") + "22", color: FAMILY_COLOR[fini.family] }, children: fini.family })] }), _jsx("div", { style: { height: 6, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }, children: _jsx("div", { style: {
                                height: "100%",
                                width: `${hpPct}%`,
                                background: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444",
                                transition: "width 0.4s ease-out",
                            } }) }), _jsxs("div", { style: { fontSize: 10, color: "#888", textAlign: "right", marginTop: 2 }, children: [hp, " / ", maxHp] })] })] }));
}
// ── Result view ───────────────────────────────────────────────────────────────
function ResultView({ winner, stake, onReturn }) {
    const isWin = winner === "you";
    const isDraw = winner === "draw";
    return (_jsxs("div", { style: { minHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 24 }, children: [_jsx("div", { style: { fontSize: 72 }, children: isWin ? "🏆" : isDraw ? "🤝" : "💀" }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: { fontSize: 32, fontWeight: 900, color: isWin ? "#16a34a" : isDraw ? "#888" : "#dc2626" }, children: isWin ? "Victory!" : isDraw ? "Draw" : "Defeated" }), _jsxs("div", { style: { fontSize: 15, color: "#666", marginTop: 8 }, children: [isWin && "You won the whole pot — well fought!", isDraw && "It's a tie — stakes refunded.", winner === "them" && "Your stake went to the winner. Regroup and try again."] })] }), _jsxs("div", { style: { background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", padding: "18px 24px", minWidth: 320, fontSize: 13 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }, children: "Payout breakdown" }), _jsx(Row, { label: "Your stake", value: `-${stake}`, color: "#dc2626" }), _jsx(Row, { label: "Opponent's stake", value: `+${stake} (matched)`, color: "#888" }), isWin && (_jsxs(_Fragment, { children: [_jsx("div", { style: { height: 1, background: "#f0f0f0", margin: "8px 0" } }), _jsx(Row, { label: "Prize pot won", value: `+${stake * 2} FINI$`, color: "#16a34a", bold: true }), _jsx(Row, { label: "Net profit", value: `+${stake} FINI$`, color: "#16a34a" })] })), isDraw && (_jsxs(_Fragment, { children: [_jsx("div", { style: { height: 1, background: "#f0f0f0", margin: "8px 0" } }), _jsx(Row, { label: "Stake refund", value: `+${stake} FINI$`, color: "#888", bold: true }), _jsx(Row, { label: "Net", value: `0 FINI$`, color: "#888" })] })), winner === "them" && (_jsxs(_Fragment, { children: [_jsx("div", { style: { height: 1, background: "#f0f0f0", margin: "8px 0" } }), _jsx(Row, { label: "Net loss", value: `-${stake} FINI$`, color: "#dc2626", bold: true }), _jsxs("div", { style: { fontSize: 10, color: "#aaa", marginTop: 6, fontStyle: "italic" }, children: ["Your ", stake, " FINI$ went to ", " the winner."] })] }))] }), _jsx("button", { onClick: onReturn, style: {
                    background: "#f472b6", color: "#fff", border: "none", borderRadius: 100,
                    padding: "14px 40px", fontSize: 15, fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 6px 20px rgba(244,114,182,0.30)",
                }, children: "\u2190 Back to Workshop" }), _jsx(Link, { to: "/leaderboard", style: { fontSize: 13, color: "#888", textDecoration: "none", fontWeight: 700 }, children: "See leaderboard \u2192" })] }));
}
// ── Reusable bits ─────────────────────────────────────────────────────────────
function Card({ title, subtitle, accent, headerExtra, children }) {
    return (_jsxs("div", { style: { background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px", borderTop: accent ? `3px solid ${accent}` : undefined }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: "#111" }, children: title }), _jsx("div", { style: { fontSize: 12, color: "#aaa", marginTop: 2 }, children: subtitle })] }), headerExtra] }), children] }));
}
function FiniBattleCard({ fini, position, onClick, highlighted, active, showSwap, onSwap }) {
    useTicker(1000); // re-render every second so countdown updates live
    const record = useFiniRecords(s => s.records[fini.id]);
    const isResting = useFiniRecords(s => s.isResting(fini.id));
    const restMs = useFiniRecords(s => s.restingMsLeft(fini.id));
    const navigate = useNavigate();
    const wins = record?.wins ?? 0;
    const losses = record?.losses ?? 0;
    const level = record?.level ?? 1;
    const xp = record?.xp ?? 0;
    const xpInfo = xpToNextLevel(xp);
    return (_jsxs("div", { onClick: showSwap && onSwap ? onSwap : onClick, style: {
            borderRadius: 16, overflow: "hidden",
            border: active ? "2.5px solid #f472b6" : highlighted ? "2px dashed #fbbf24" : "1.5px solid #f0f0f0",
            background: "#fff", cursor: "pointer",
            transition: "transform 0.12s, box-shadow 0.12s",
            boxShadow: active ? "0 6px 20px rgba(244,114,182,0.25)" : highlighted ? "0 0 0 3px rgba(251,191,36,0.15)" : "none",
            position: "relative",
        }, onMouseEnter: e => { e.currentTarget.style.transform = "translateY(-3px)"; }, onMouseLeave: e => { e.currentTarget.style.transform = ""; }, children: [showSwap && (_jsx("div", { style: { position: "absolute", inset: 0, background: "rgba(244,114,182,0.85)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, zIndex: 2, borderRadius: 16 }, children: "\u2191 Swap in" })), _jsxs("div", { style: { background: CLAN_TINTS[fini.clan] ?? "#ddd", height: 120, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }, children: [_jsx("img", { src: `/clan-art/${slugify(fini.clan)}.gif`, alt: "", style: { height: 90, width: "auto", objectFit: "contain", filter: isResting ? "grayscale(0.6)" : "none" }, onError: e => { e.target.style.display = "none"; } }), fini.item && (_jsx("div", { title: fini.item.name + " — " + fini.item.effect, style: {
                            position: "absolute", top: 8, right: 8,
                            background: "#fff", borderRadius: "50%",
                            width: 30, height: 30, fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        }, children: fini.item.icon })), _jsx("div", { style: { position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.45)", padding: "2px 7px", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.06em" }, children: position }), _jsxs("div", { title: `${xp} XP · ${xpInfo.current}/${xpInfo.needed} to next level`, style: {
                            position: "absolute", bottom: 8, left: 8,
                            background: "linear-gradient(135deg, #fde047, #f59e0b)",
                            color: "#854d0e", fontSize: 10, fontWeight: 900,
                            padding: "2px 8px", borderRadius: 100,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        }, children: ["LVL ", level] }), isResting && (_jsxs("div", { style: { position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }, children: [_jsx("div", { style: { fontSize: 18 }, children: "\uD83D\uDCA4" }), _jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#666" }, children: "Resting" }), _jsx("div", { style: { fontSize: 9, color: "#888", fontFamily: "monospace" }, children: fmtRestTime(restMs) })] }))] }), _jsxs("div", { style: { padding: "10px 12px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [_jsxs("span", { style: { fontSize: 13, fontWeight: 800, color: "#111" }, children: ["#", fini.id] }), _jsx("span", { style: { fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: (FAMILY_COLOR[fini.family] ?? "#888") + "22", color: FAMILY_COLOR[fini.family] }, children: fini.family })] }), _jsx("div", { style: { fontSize: 10, color: "#888", marginBottom: 8 }, children: fini.clan }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, fontSize: 10 }, children: [_jsx(Stat, { label: "HP", v: fini.maxHp, c: "#22c55e" }), _jsx(Stat, { label: "ATK", v: fini.atk, c: "#ef4444" }), _jsx(Stat, { label: "DEF", v: fini.def, c: "#3b82f6" }), _jsx(Stat, { label: "SPD", v: fini.speed, c: "#a78bfa" })] }), fini.trait && _jsxs("div", { style: { fontSize: 10, color: "#be185d", fontWeight: 700, marginTop: 6, textAlign: "center" }, children: ["\u2726 ", fini.trait] }), _jsxs("div", { style: { marginTop: 8 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888", fontWeight: 700, marginBottom: 2 }, children: [_jsxs("span", { children: [wins, "W \u00B7 ", losses, "L"] }), _jsxs("span", { children: [xpInfo.current, "/", xpInfo.needed, " XP"] })] }), _jsx("div", { style: { height: 4, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }, children: _jsx("div", { style: { height: "100%", width: `${xpInfo.pct}%`, background: "linear-gradient(90deg, #fde047, #f59e0b)" } }) })] }), _jsx("button", { onClick: e => { e.stopPropagation(); navigate(`/fini/${fini.id}`); }, style: {
                            marginTop: 8, width: "100%", background: "none", border: "1px solid #f0f0f0",
                            borderRadius: 8, padding: "4px 0", fontSize: 10, fontWeight: 700, color: "#888",
                            cursor: "pointer",
                        }, onMouseEnter: e => { e.currentTarget.style.background = "#fdf0f7"; e.currentTarget.style.color = "#be185d"; }, onMouseLeave: e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#888"; }, children: "View Profile \u2192" })] })] }));
}
function Stat({ label, v, c }) {
    return (_jsxs("div", { style: { textAlign: "center", background: c + "12", borderRadius: 6, padding: "3px 2px" }, children: [_jsx("div", { style: { fontSize: 8, color: c, fontWeight: 700 }, children: label }), _jsx("div", { style: { fontSize: 12, fontWeight: 800, color: "#111" }, children: v })] }));
}
function Row({ label, value, color, bold }) {
    return (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }, children: [_jsx("span", { style: { color: "#666", fontWeight: bold ? 700 : 500 }, children: label }), _jsx("span", { style: { color, fontWeight: bold ? 900 : 700 }, children: value })] }));
}
