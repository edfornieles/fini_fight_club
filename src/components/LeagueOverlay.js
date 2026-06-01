import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useLeagueStore, money, computePrizeBreakdown, PLAYER_ID, } from "../state/leagueStore";
import { useGameStore } from "../state/gameStore";
import { LeagueTournament } from "./LeagueTournament";
import { generateEnemyTeam } from "../game/enemyGenerator";
import { createRng } from "../game/rng";
const TIER_STYLE = {
    BRONZE: { chip: "bg-amber-200/70 text-amber-900", emoji: "🥉" },
    SILVER: { chip: "bg-slate-200/80 text-slate-700", emoji: "🥈" },
    GOLD: { chip: "bg-lemon/70 text-ink", emoji: "🥇" },
    DIAMOND: { chip: "bg-bubble/25 text-bubbleDark", emoji: "💎" },
};
const STATUS_STYLE = {
    OPEN: "bg-mint/25 text-mintDark",
    RUNNING: "bg-grape/15 text-grape",
    SETTLED: "bg-cloud/70 text-inkSoft",
    CANCELLED: "bg-coral/15 text-coral",
};
/**
 * Leagues — the paid-entry competition loop (the central money loop).
 *
 * A floating button (bottom-left, clear of the Stable overlay bottom-right)
 * opens the lobby: your simulated balance, tiered open leagues each with a
 * real pot of CPU buy-ins, and Join / Run actions. Your fielded wallet team
 * (from the Stable) is what competes; otherwise a training squad stands in.
 * Backed entirely by the tested pure logic in game/leagues.ts.
 */
export function LeagueOverlay() {
    const [open, setOpen] = useState(false);
    const leagues = useLeagueStore((s) => s.leagues);
    const balance = useLeagueStore((s) => s.balance);
    const record = useLeagueStore((s) => s.record);
    const message = useLeagueStore((s) => s.message);
    const lastResult = useLeagueStore((s) => s.lastResult);
    const joinWithTeam = useLeagueStore((s) => s.joinWithTeam);
    const runAndSettle = useLeagueStore((s) => s.runAndSettle);
    const refreshOpenLeagues = useLeagueStore((s) => s.refreshOpenLeagues);
    const topUp = useLeagueStore((s) => s.topUp);
    const potOf = useLeagueStore((s) => s.potOf);
    const isEntered = useLeagueStore((s) => s.isEntered);
    const activeTournament = useLeagueStore((s) => s.activeTournament);
    const savedTeam = useGameStore((s) => s.savedOwnedTeam);
    const usingOwned = !!(savedTeam && savedTeam.finis.length >= 3);
    // Your fielded wallet team competes if you have one; otherwise a deterministic
    // "training squad" stands in so anyone can play the money loop without owning
    // Finis yet. Training-squad ids aren't "owned-…", so their results never touch
    // any real Fini's battle record.
    const team = useMemo(() => {
        if (savedTeam && savedTeam.finis.length >= 3) {
            return {
                id: "you",
                playerId: PLAYER_ID,
                name: "You",
                finis: savedTeam.finis.slice(0, 3),
            };
        }
        const t = generateEnemyTeam({
            stage: 2,
            rng: createRng(777),
            packName: "Training Squad",
        });
        return { ...t, id: "you", playerId: PLAYER_ID, name: "Training Squad" };
    }, [savedTeam]);
    return (_jsxs(_Fragment, { children: [open && (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6", children: _jsxs("div", { className: "w-full max-w-4xl my-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsx("h2", { className: "font-display font-bold text-2xl text-ink drop-shadow-sm", children: "\uD83C\uDFC6 Leagues" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "lcd px-3 py-1 text-sm", title: "Simulated balance (no real funds)", children: money(balance) }), _jsxs("button", { onClick: topUp, className: "kbtn kbtn-ghost px-3 py-1.5 text-xs", children: ["+ Add ", money(100)] }), _jsx("button", { onClick: () => setOpen(false), className: "kbtn kbtn-ghost px-3 py-1.5 text-sm", children: "\u2715 Close" })] })] }), _jsxs("div", { className: "kcard p-3 flex items-center justify-between flex-wrap gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap text-[11px]", children: [_jsxs("span", { className: "chip bg-lemon/40 text-ink", children: ["\uD83E\uDD47 ", record.firsts] }), _jsxs("span", { className: "chip bg-cloud/70 text-inkSoft", children: ["\uD83E\uDD48 ", record.seconds] }), _jsxs("span", { className: "chip bg-bubble/15 text-bubbleDark", children: ["played ", record.played] }), _jsxs("span", { className: "chip bg-mint/20 text-mintDark", children: ["winnings ", money(record.earnings)] })] }), _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx("span", { className: "label-soft text-[10px]", children: usingOwned ? "competing as" : "🐣 training squad" }), team.finis.map((f) => (_jsxs("span", { className: `chip text-[10px] ${usingOwned ? "bg-grape/12 text-grape" : "bg-cloud/70 text-inkSoft"}`, children: [f.name, " \u00B7 ", f.family] }, f.id))), !usingOwned && (_jsx("span", { className: "chip bg-bubble/15 text-bubbleDark text-[10px]", children: "field your wallet Finis in the Stable to compete as your own" }))] })] }), message && (_jsx("div", { className: "chip bg-bubble/15 text-bubbleDark w-full justify-center py-1.5 text-[12px]", children: message })), _jsx("div", { className: "grid sm:grid-cols-2 gap-3", children: leagues.map((lg) => (_jsx(LeagueCard, { league: lg, pot: potOf(lg.config.id), entered: isEntered(lg.config.id), canAfford: balance >= lg.config.buyIn, hasTeam: true, onJoin: () => joinWithTeam(lg.config.id, team), onRun: () => runAndSettle(lg.config.id) }, lg.config.id))) }), lastResult && (_jsx(ResultsPanel, { leagueName: leagues.find((l) => l.config.id === lastResult.leagueId)?.config.name ??
                                "League", result: lastResult.result })), _jsxs("div", { className: "flex flex-col items-center gap-1 pt-1", children: [_jsx("button", { onClick: refreshOpenLeagues, className: "kbtn kbtn-ghost px-4 py-2 text-xs", children: "\u267B\uFE0F Refresh open leagues" }), _jsx("p", { className: "text-[11px] text-inkSoft text-center px-4", children: "Simulated money for testing. Each league fills 7 CPU rivals + you into an 8-team knockout bracket \u2014 Quarterfinals \u2192 Semifinals \u2192 Final. Watch it play out; the champion takes 1st, runner-up 2nd, the house takes 10%." })] })] }) })), activeTournament && _jsx(LeagueTournament, {})] }));
}
function LeagueCard(props) {
    const { league, pot, entered, canAfford, hasTeam } = props;
    const cfg = league.config;
    const style = TIER_STYLE[cfg.tier];
    const prize = computePrizeBreakdown(Math.max(pot, cfg.buyIn * cfg.minEntrants), cfg.prize);
    const canRun = entered && league.entries.length >= cfg.minEntrants && league.status === "OPEN";
    return (_jsxs("div", { className: "kcard p-3.5 space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: `chip ${style.chip} text-[11px] font-bold`, children: [style.emoji, " ", cfg.name] }), entered && _jsx("span", { className: "chip bg-mint/25 text-mintDark text-[10px]", children: "\u2713 entered" })] }), _jsx("span", { className: `chip ${STATUS_STYLE[league.status]} text-[10px]`, children: league.status.toLowerCase() })] }), _jsxs("div", { className: "grid grid-cols-3 gap-1.5 text-center", children: [_jsx(Cell, { label: "buy-in", value: money(cfg.buyIn) }), _jsx(Cell, { label: "pot", value: money(pot) }), _jsx(Cell, { label: "entrants", value: `${league.entries.length}/${cfg.maxEntrants}` })] }), _jsxs("div", { className: "flex items-center justify-between text-[10px] text-inkSoft font-semibold", children: [_jsxs("span", { children: ["\uD83E\uDD47 ", money(prize.firstPrize)] }), _jsxs("span", { children: ["\uD83E\uDD48 ", money(prize.secondPrize)] }), _jsxs("span", { className: "opacity-70", children: ["house ", money(prize.houseCut)] })] }), league.status === "SETTLED" ? (_jsx("div", { className: "chip bg-cloud/60 text-inkSoft w-full justify-center py-1.5 text-[11px]", children: "Settled \u2014 see results below" })) : entered ? (_jsxs("button", { onClick: props.onRun, disabled: !canRun, className: "kbtn kbtn-primary w-full py-2 text-sm disabled:opacity-50", children: ["\u25B6\uFE0F Run League (", league.entries.length, " in)"] })) : (_jsx("button", { onClick: props.onJoin, disabled: !hasTeam || !canAfford, className: "kbtn kbtn-mint w-full py-2 text-sm disabled:opacity-50", title: !hasTeam
                    ? "Field a team in your Stable first"
                    : !canAfford
                        ? "Not enough balance — use the faucet"
                        : undefined, children: canAfford ? `Join · ${money(cfg.buyIn)}` : "Insufficient balance" }))] }));
}
function Cell(props) {
    return (_jsxs("div", { className: "lcd px-1 py-1 leading-tight", children: [_jsx("div", { className: "text-[8px] text-inkSoft", children: props.label }), _jsx("div", { className: "text-xs font-display font-bold text-ink", children: props.value })] }));
}
function ResultsPanel(props) {
    const { result } = props;
    const medal = (rank) => rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
    return (_jsxs("div", { className: "kcard p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "label-soft", children: ["\uD83D\uDCCA ", props.leagueName, " \u2014 final table"] }), _jsxs("span", { className: "chip bg-grape/15 text-grape text-[10px]", children: ["pot ", money(result.prize.pool)] })] }), _jsx("div", { className: "space-y-1", children: result.standings.map((s) => {
                    const isYou = s.playerId === PLAYER_ID;
                    const payout = result.payouts.find((p) => p.playerId === s.playerId);
                    return (_jsxs("div", { className: `flex items-center justify-between rounded-xl px-3 py-1.5 text-[12px] ${isYou ? "bg-mint/15 ring-1 ring-mint/50" : "bg-white/50"}`, children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "w-6 text-center font-display font-bold", children: medal(s.rank) }), _jsx("span", { className: `truncate font-semibold ${isYou ? "text-mintDark" : "text-ink"}`, children: isYou ? "You" : s.name })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("span", { className: "text-inkSoft", children: [s.wins, "W\u2013", s.losses, "L"] }), payout && (_jsxs("span", { className: "chip bg-lemon/40 text-ink text-[10px]", children: ["+", money(payout.amount)] }))] })] }, s.playerId));
                }) })] }));
}
