import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../state/gameStore";
import { ThreeBattleStage } from "./ThreeBattleStage";
import { BattleLog } from "./BattleLog";
import { MarketSignalPanel } from "./MarketSignalPanel";
import { FiniBattleCard } from "./FiniBattleCard";
import { DeathModeModal } from "./DeathModeModal";
import { applyItemToFini } from "../game/items";
const PLAYBACK_MS = 700;
export function BattleScreen() {
    const liveA = useGameStore((s) => s.liveTeamA);
    const liveB = useGameStore((s) => s.liveTeamB);
    const enemyTeam = useGameStore((s) => s.enemyTeam);
    const teamSlots = useGameStore((s) => s.teamSlots);
    const inventory = useGameStore((s) => s.inventory);
    const playbackEvents = useGameStore((s) => s.playbackEvents);
    const playbackIndex = useGameStore((s) => s.playbackIndex);
    const playbackStatus = useGameStore((s) => s.playbackStatus);
    const advance = useGameStore((s) => s.advancePlayback);
    const skipToEnd = useGameStore((s) => s.skipToEnd);
    const mode = useGameStore((s) => s.mode);
    const deathModePending = useGameStore((s) => s.deathModePending);
    const deathMode = useGameStore((s) => s.deathMode);
    const deathConfirmInput = useGameStore((s) => s.deathConfirmInput);
    const setDeathConfirmInput = useGameStore((s) => s.setDeathConfirmInput);
    const setDeathStake = useGameStore((s) => s.setDeathStake);
    const confirmDeathMode = useGameStore((s) => s.confirmDeathMode);
    const cancelDeathMode = useGameStore((s) => s.cancelDeathMode);
    const startBattle = useGameStore((s) => s.startBattle);
    const marketSignals = useGameStore((s) => s.marketSignals);
    const marketRead = useGameStore((s) => s.marketRead);
    const marketMode = useGameStore((s) => s.marketMode);
    const [autoplay, setAutoplay] = useState(true);
    const [startError, setStartError] = useState(null);
    // Auto-advance playback on a 700ms tick.
    useEffect(() => {
        if (playbackStatus !== "playing" || !autoplay)
            return;
        const t = window.setTimeout(() => advance(), PLAYBACK_MS);
        return () => clearTimeout(t);
    }, [playbackStatus, playbackIndex, autoplay, advance]);
    // Build a "preview" player team purely for the staging area when we
    // haven't started playback yet (e.g. Death Mode modal open).
    const previewPlayerTeam = useMemo(() => {
        const finis = teamSlots
            .filter((s) => s.fini)
            .map((s) => applyItemToFini(s.fini, s.itemId ? inventory.find((it) => it.id === s.itemId) ?? null : null));
        if (finis.length === 0)
            return undefined;
        while (finis.length < 3) {
            finis.push({
                ...finis[0],
                id: `preview-empty-${finis.length}`,
                name: "(empty)",
                currentHealth: 0,
                maxHealth: 1,
            });
        }
        return {
            id: "preview-player",
            playerId: "player-a",
            name: "Your Team",
            finis: [finis[0], finis[1], finis[2]],
        };
    }, [teamSlots, inventory]);
    const showTeamA = liveA ?? previewPlayerTeam;
    const showTeamB = liveB ?? enemyTeam;
    const activeA = showTeamA?.finis.find((f) => !f.fainted && f.currentHealth > 0);
    const activeB = showTeamB?.finis.find((f) => !f.fainted && f.currentHealth > 0);
    const { animA, animB } = useMemo(() => {
        const out = {
            animA: "idle",
            animB: "idle",
        };
        if (!playbackEvents.length)
            return out;
        const last = playbackEvents[playbackIndex - 1];
        if (!last || !showTeamA)
            return out;
        if (last.type === "ATTACK") {
            const attackerOnA = showTeamA.finis.some((f) => f.id === last.attackerId);
            if (attackerOnA) {
                out.animA = "attack";
                out.animB = "hit";
            }
            else {
                out.animB = "attack";
                out.animA = "hit";
            }
        }
        else if (last.type === "PASSIVE_TRIGGER") {
            const onA = showTeamA.finis.some((f) => f.id === last.finiId);
            if (onA)
                out.animA = "passive";
            else
                out.animB = "passive";
        }
        else if (last.type === "FAINT") {
            const onA = showTeamA.finis.some((f) => f.id === last.finiId);
            if (onA)
                out.animA = "faint";
            else
                out.animB = "faint";
        }
        return out;
    }, [showTeamA, playbackEvents, playbackIndex]);
    const handleProceedDeathMode = () => {
        setStartError(null);
        const err = startBattle();
        if (err)
            setStartError(err);
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3", children: [_jsxs("div", { className: "space-y-3 min-w-0", children: [showTeamA && showTeamB && (_jsx(ThreeBattleStage, { teamA: showTeamA, teamB: showTeamB, animA: animA, animB: animB, activeAId: activeA?.id, activeBId: activeB?.id })), _jsxs("div", { className: "grid sm:grid-cols-2 gap-3", children: [_jsx(TeamColumn, { team: showTeamA, label: "Your Team", activeId: activeA?.id, stakedId: mode === "DEATH" ? deathMode.stakes.teamA.finiId : undefined }), _jsx(TeamColumn, { team: showTeamB, label: enemyTeam?.name ?? "Opponent", activeId: activeB?.id, stakedId: mode === "DEATH" ? deathMode.stakes.teamB.finiId : undefined })] }), playbackStatus === "playing" && (_jsxs("div", { className: "kcard p-3 flex flex-wrap gap-2 items-center", children: [_jsx("button", { onClick: () => setAutoplay((a) => !a), className: "kbtn kbtn-ghost px-4 py-2 text-sm", children: autoplay ? "⏸ Pause" : "▶ Resume" }), _jsx("button", { onClick: advance, className: "kbtn kbtn-ghost px-4 py-2 text-sm", children: "\uD83D\uDC63 Step" }), _jsx("button", { onClick: skipToEnd, className: "kbtn kbtn-grape px-4 py-2 text-sm", children: "\u23ED Skip" }), _jsxs("span", { className: "ml-auto lcd px-3 py-1 text-xs", children: [playbackIndex, " / ", playbackEvents.length] })] })), _jsx(BattleLog, { events: playbackEvents, visibleCount: playbackIndex })] }), _jsx("div", { className: "space-y-3", children: _jsx(MarketSignalPanel, { signals: marketSignals, predictedFamily: marketRead, source: marketMode, highlight: [
                                ...new Set([
                                    ...(showTeamA?.finis.map((f) => f.family) ?? []),
                                    ...(showTeamB?.finis.map((f) => f.family) ?? []),
                                ]),
                            ] }) })] }), previewPlayerTeam && enemyTeam && (_jsx(DeathModeModal, { open: deathModePending, onClose: cancelDeathMode, playerTeam: previewPlayerTeam, opponentTeam: enemyTeam, stakeA: deathMode.stakes.teamA.finiId, stakeB: deathMode.stakes.teamB.finiId, confirmedA: deathMode.stakes.teamA.confirmed, confirmedB: deathMode.stakes.teamB.confirmed, confirmInput: deathConfirmInput, onConfirmInput: setDeathConfirmInput, onPickStake: (side, id) => setDeathStake(side, id), onConfirm: (side) => confirmDeathMode(side), onProceed: handleProceedDeathMode, startError: startError }))] }));
}
function TeamColumn(props) {
    if (!props.team) {
        return (_jsxs("div", { className: "kcard p-3 text-inkSoft text-sm italic font-semibold", children: ["Waiting for ", props.label, "\u2026"] }));
    }
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsx("div", { className: "label-soft", children: props.label }), props.team.finis.map((f) => (_jsx(FiniBattleCard, { fini: f, active: f.id === props.activeId, staked: f.id === props.stakedId, compact: true }, f.id)))] }));
}
