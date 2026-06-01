import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../state/uiStore";
import { useTournamentStore, championPrize, roundName, PLAYER_ID, } from "../state/tournamentStore";
import { ThreeBattleStage as BattleStage } from "./ThreeBattleStage";
import { FAMILY_COLOR } from "./familyColors";
import { useGameStore } from "../state/gameStore";
import { makeSeedSnapshots, teamFromSnapshot } from "../game/pvp";
import { createRng } from "../game/rng";
const TICK_MS = 430;
/** Player's fielded team, or a practice squad so it's playable with no wallet. */
function usePlayerTeam() {
    const saved = useGameStore((s) => s.savedOwnedTeam);
    return useMemo(() => {
        if (saved && saved.finis.length >= 3) {
            return { id: "you", playerId: PLAYER_ID, name: "Your Team", finis: [saved.finis[0], saved.finis[1], saved.finis[2]] };
        }
        const snap = makeSeedSnapshots(createRng(99))[3];
        const t = teamFromSnapshot({ ...snap, name: "Your Team" });
        return { ...t, playerId: PLAYER_ID };
    }, [saved]);
}
export function TournamentOverlay() {
    const [open, setOpen] = useState(false);
    const { tournamentOpen, closeTournament } = useUIStore();
    useEffect(() => { if (tournamentOpen)
        setOpen(true); }, [tournamentOpen]);
    const handleClose = () => { setOpen(false); closeTournament(); };
    const s = useTournamentStore();
    const team = usePlayerTeam();
    // auto-advance playback while a match is playing
    useEffect(() => {
        if (s.status !== "playing")
            return;
        const id = setInterval(() => useTournamentStore.getState().tick(), TICK_MS);
        return () => clearInterval(id);
    }, [s.status, s.matchId]);
    return (_jsx(_Fragment, { children: open && (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/30 backdrop-blur-sm p-3 sm:p-6", children: _jsxs("div", { className: "w-full max-w-4xl my-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display font-bold text-2xl text-ink drop-shadow-sm", children: "\uD83C\uDFDF\uFE0F Knockout Cup" }), _jsx("button", { onClick: handleClose, className: "kbtn kbtn-ghost px-3 py-1.5 text-sm", children: "Close" })] }), s.status === "idle" && (_jsxs("div", { className: "kcard p-6 text-center space-y-3", children: [_jsx("p", { className: "text-ink font-semibold", children: "8 teams. Single elimination. Quarterfinals \u2192 Semifinals \u2192 Final." }), _jsxs("p", { className: "text-[12px] text-inkSoft", children: ["Prize pool $", s.prizePool, " \u00B7 champion takes $", championPrize(s.prizePool)] }), _jsx("button", { onClick: () => s.start(team), className: "kbtn kbtn-primary px-6 py-2.5 text-sm", children: "\u25B6 Enter the Cup" })] })), (s.status === "playing" || s.status === "matchOver") && s.bracket && (_jsx(MatchStage, {})), s.status === "champion" && s.champion && (_jsxs("div", { className: "kcard p-6 text-center space-y-3 kglow", children: [_jsx("div", { className: "text-5xl animate-bobby", children: "\uD83C\uDFC6" }), _jsx("div", { className: "font-display font-bold text-2xl text-ink", children: s.champion.snapshot.name }), _jsxs("div", { className: "text-sm text-inkSoft", children: ["Champion of the Knockout Cup \u00B7 wins ", _jsxs("b", { className: "text-sol", children: ["$", championPrize(s.prizePool)] }), s.champion.playerId === PLAYER_ID && " — that's you! 🎉"] }), _jsx("button", { onClick: () => s.start(team), className: "kbtn kbtn-grape px-5 py-2 text-sm", children: "\u21BB New Cup" })] })), (s.status === "bracket" || s.status === "matchOver" || s.status === "champion") && s.bracket && (_jsx(BracketView, { bracket: s.bracket })), s.status === "bracket" && (_jsx("div", { className: "flex justify-center", children: _jsxs("button", { onClick: () => s.playNext(), className: "kbtn kbtn-primary px-6 py-2.5 text-sm shimmer", children: ["\u25B6 Play ", nextLabel(s.bracket)] }) }))] }) })) }));
}
function nextLabel(bracket) {
    if (!bracket)
        return "match";
    const total = bracket.rounds.length;
    const m = bracket.rounds.flat().find((x) => x.aId && x.bId && !x.winnerId);
    if (!m)
        return "match";
    return `${roundName(m.round, total)}${bracket.rounds[m.round].length > 1 ? ` ${m.slot + 1}` : ""}`;
}
function MatchStage() {
    const { liveA, liveB, message, floatDmg, status, bracket, matchId } = useTournamentStore();
    const cont = useTournamentStore((st) => st.continueAfterMatch);
    const skip = useTournamentStore((st) => st.skipMatch);
    if (!liveA || !liveB || !bracket)
        return null;
    const match = bracket.rounds.flat().find((m) => m.id === matchId);
    const total = bracket.rounds.length;
    const hp = (live) => {
        const f = live.team.finis.find((x) => x.id === live.activeId) ?? live.team.finis[0];
        return Math.round((f.currentHealth / f.maxHealth) * 100);
    };
    return (_jsxs("div", { className: "kcard p-3 space-y-2.5", children: [_jsx("div", { className: "text-center", children: _jsx("span", { className: "chip bg-lemon/40 text-ink font-bold", children: match ? roundName(match.round, total) : "Match" }) }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx(Side, { live: liveA, align: "left" }), _jsxs("div", { className: "flex items-center gap-2 font-display font-bold text-2xl text-ink", children: [_jsx("span", { className: "text-sol", children: liveA.score }), _jsx("span", { className: "text-inkSoft text-sm", children: "vs" }), _jsx("span", { className: "text-bubbleDark", children: liveB.score })] }), _jsx(Side, { live: liveB, align: "right" })] }), _jsxs("div", { className: "relative", children: [_jsx(BattleStage, { teamA: liveA.team, teamB: liveB.team, animA: liveA.anim, animB: liveB.anim, activeAId: liveA.activeId, activeBId: liveB.activeId }), floatDmg && (_jsxs("div", { className: `absolute top-8 ${floatDmg.side === "a" ? "left-[20%]" : "right-[20%]"} font-display font-bold text-2xl text-coral animate-bobby drop-shadow`, children: ["-", floatDmg.amount] }, floatDmg.key))] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(HpBar, { pct: hp(liveA), color: "#5fd6a4" }), _jsx(HpBar, { pct: hp(liveB), color: "#ff8fc7", right: true })] }), _jsx("p", { className: "text-center text-[12px] text-inkSoft min-h-[1.2em]", children: message }), _jsxs("div", { className: "flex justify-center gap-2", children: [status === "playing" && (_jsx("button", { onClick: skip, className: "kbtn kbtn-ghost px-4 py-1.5 text-xs", children: "\u23ED Skip" })), status === "matchOver" && (_jsx("button", { onClick: cont, className: "kbtn kbtn-primary px-5 py-2 text-sm", children: "Continue \u2192" }))] })] }));
}
function Side({ live, align }) {
    const fam = live.team.finis[0].family;
    return (_jsxs("div", { className: `flex-1 min-w-0 ${align === "right" ? "text-right" : ""}`, children: [_jsx("div", { className: "font-display font-bold text-ink truncate text-sm", children: live.team.name }), _jsx("span", { className: `chip ${FAMILY_COLOR[fam].bg} text-white text-[10px] px-1.5`, children: fam })] }));
}
function HpBar({ pct, color, right }) {
    return (_jsx("div", { className: `h-2.5 rounded-full bg-cloud/60 overflow-hidden ${right ? "scale-x-[-1]" : ""}`, children: _jsx("div", { className: "h-full rounded-full transition-[width] duration-200", style: { width: `${pct}%`, background: color } }) }));
}
function BracketView({ bracket }) {
    const total = bracket.rounds.length;
    return (_jsx("div", { className: "kcard p-3 overflow-x-auto", children: _jsx("div", { className: "flex gap-3 min-w-max", children: bracket.rounds.map((round, r) => (_jsxs("div", { className: "flex flex-col justify-around gap-2 min-w-[150px]", children: [_jsx("div", { className: "label-soft text-center", children: roundName(r, total) }), round.map((m) => (_jsx(MatchCard, { bracket: bracket, match: m }, m.id)))] }, r))) }) }));
}
function MatchCard({ bracket, match }) {
    const name = (id) => (id ? bracket.byId[id]?.snapshot.name ?? "—" : "TBD");
    const fam = (id) => (id && bracket.byId[id] ? bracket.byId[id].snapshot.finis[0].family : null);
    const isPlayer = (id) => id === PLAYER_ID;
    const row = (id) => {
        const won = match.winnerId === id;
        const f = fam(id);
        return (_jsxs("div", { className: `flex items-center gap-1.5 text-[11px] ${won ? "font-bold text-ink" : "text-inkSoft"} ${isPlayer(id) ? "underline decoration-bubble decoration-2" : ""}`, children: [f && _jsx("span", { className: `w-2 h-2 rounded-full ${FAMILY_COLOR[f].bg}` }), _jsx("span", { className: "truncate", children: name(id) }), won && _jsx("span", { className: "ml-auto", children: "\u2713" })] }));
    };
    return (_jsxs("div", { className: `kcard-soft p-2 space-y-1 ${match.winnerId ? "opacity-90" : ""}`, children: [row(match.aId), _jsx("div", { className: "kdivider" }), row(match.bId)] }));
}
