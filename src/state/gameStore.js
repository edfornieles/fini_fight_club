import { create } from "zustand";
import { runBattle } from "../game/battleEngine";
import { applyBattleXPAwards } from "../game/xpSystem";
import { buildDeathModeOpeningEvents, checkDeathModeReadiness, makeEmptyDeathModeConfig, resolveSimulatedDeathMode, } from "../game/deathMode";
import { generateMockMarketSignals, getManualTestSignals, } from "../game/marketSignals";
import { fetchLiveMarketSignals } from "../game/marketData";
import { applyRegimeToSignals, computeMockDailyRegime, regimeFromSignals, todayKey, } from "../game/dailyRegime";
import { applyEloResult, makeDefaultProfile, pickOpponent, snapshotFromTeam, teamFromSnapshot, } from "../game/pvp";
import { addSnapshotToPool, loadPool, loadProfile, saveProfile, updateSnapshotRating, } from "../game/pvpStorage";
import { RANKED_DRAFT_GOLD } from "../game/runConstants";
import { validateTeamSpecials } from "../game/attributes";
import { recordFiniBattle } from "../game/finiRecords";
import { loadOwnedTeam, saveOwnedTeam, clearOwnedTeam as clearOwnedTeamStorage, } from "../game/wallet";
import { mockOwnershipLedger } from "../game/ownership";
import { cloneTeam, rehydrateTeam } from "../game/finiFactory";
import { rollShop } from "../game/shop";
import { applyItemToFini } from "../game/items";
import { generateEncounterOptions, } from "../game/encounters";
import { generateEnemyTeam } from "../game/enemyGenerator";
import { createRng } from "../game/rng";
import { ENCOUNTERS_PER_STAGE, FINAL_STAGE, GOLD_REWARD_PER_BOSS_WIN, GOLD_REWARD_PER_FIGHT_WIN, POST_STAGE_GOLD_REFRESH, ROLL_COST, SELL_REFUND, STARTING_GOLD, STARTING_LIVES, TROPHIES_PER_BOSS_WIN, UNIT_COST, } from "../game/runConstants";
/** Live data cache freshness window (ms). */
const LIVE_TTL = 60_000;
function makeEmptyTeamSlots() {
    return [
        { fini: null, itemId: null },
        { fini: null, itemId: null },
        { fini: null, itemId: null },
    ];
}
function teamSlotsFilled(slots) {
    return slots.filter((s) => s.fini).length;
}
function makeBattleConfig(args) {
    return {
        mode: args.mode,
        battleWindow: args.battleWindow,
        maxRounds: 30,
        marketInfluence: 0.65,
        statInfluence: 0.35,
        enablePassives: true,
        enableXP: true,
        simulatedDeathMode: args.mode === "DEATH",
        marketRead: args.marketRead,
        // The live market drifts round-to-round during real battles — this is
        // what makes reading the market a skill instead of a one-time stat check.
        liveMarket: true,
    };
}
/**
 * Produce the market signal map for an upcoming battle, layering the
 * day's regime on top of the chosen source (live / mock / manual).
 */
function buildBattleSignals(s) {
    let base;
    if (s.marketMode === "LIVE" && s.liveSignals) {
        base = s.liveSignals;
    }
    else if (s.marketMode === "MANUAL") {
        base = getManualTestSignals();
    }
    else {
        base = generateMockMarketSignals(s.battleWindow);
    }
    // LIVE signals already encode the real day; nudge gently. Mock signals
    // lean harder on the regime so the day feels coherent.
    const weight = s.marketMode === "LIVE" ? 0.15 : 0.35;
    return applyRegimeToSignals(base, s.dailyRegime, weight);
}
function buildPlayerBattleTeam(slots, inventory) {
    const finis = [];
    for (const slot of slots) {
        if (!slot.fini)
            continue;
        const item = slot.itemId
            ? inventory.find((it) => it.id === slot.itemId) ?? null
            : null;
        finis.push(applyItemToFini(slot.fini, item));
    }
    if (finis.length === 0)
        return null;
    // If fewer than 3 Finis, pad with a "ghost" weak filler so the engine
    // can still iterate but the battle is essentially under-strength.
    while (finis.length < 3) {
        const weak = {
            id: `ghost-${finis.length}-${Math.random().toString(36).slice(2, 8)}`,
            tokenId: undefined,
            name: "(empty slot)",
            family: "ETH",
            level: 1,
            xp: 0,
            strength: 1,
            maxHealth: 1,
            currentHealth: 1,
            speed: 1,
            defense: 0,
            volatilityAffinity: 0,
            cuteness: 0,
            passiveAbility: "COMPOUND",
        };
        finis.push(weak);
    }
    return {
        id: "team-player",
        playerId: "player-a",
        name: "Your Team",
        finis: [finis[0], finis[1], finis[2]],
    };
}
function freshRunState() {
    const rng = createRng();
    return {
        phase: "shop",
        marketRead: null,
        isRanked: false,
        currentOpponent: null,
        rankedDelta: null,
        lives: STARTING_LIVES,
        gold: STARTING_GOLD,
        trophies: 0,
        stage: 1,
        stageProgress: 0,
        teamSlots: makeEmptyTeamSlots(),
        inventory: [],
        shop: rollShop({ rng, stage: 1 }),
        encounterOptions: [],
        currentEncounter: null,
        battleResult: undefined,
        playbackEvents: [],
        playbackIndex: 0,
        playbackStatus: "idle",
        liveTeamA: undefined,
        liveTeamB: undefined,
        enemyTeam: undefined,
        deathMode: makeEmptyDeathModeConfig(),
        deathConfirmInput: "",
        deathModePending: false,
        mode: "FREE",
    };
}
export const useGameStore = create((set, get) => ({
    ...freshRunState(),
    phase: "title",
    // Battle config defaults (these survive across runs).
    mode: "FREE",
    battleWindow: "1h",
    marketMode: "MOCK",
    marketSignals: generateMockMarketSignals("1h"),
    // Market meta defaults.
    dailyRegime: computeMockDailyRegime(),
    marketRead: null,
    marketLoading: false,
    // PvP defaults (real data is lazy-loaded in startRankedLadder).
    isRanked: false,
    pvpProfile: makeDefaultProfile(),
    pvpPool: [],
    currentOpponent: null,
    rankedDelta: null,
    // Persisted wallet team (hydrated from localStorage on load).
    savedOwnedTeam: loadOwnedTeam(),
    startNewRun: () => set(() => {
        // Seed mock ownership ledger for any future Death Match.
        for (const f of [])
            mockOwnershipLedger.setOwner(f, "player-a");
        return { ...freshRunState(), phase: "shop" };
    }),
    startRankedLadder: () => set(() => {
        const profile = loadProfile();
        const pool = loadPool();
        return {
            ...freshRunState(),
            phase: "shop",
            isRanked: true,
            mode: "RANKED",
            // Fixed draft budget for the ranked team (no lives/stage economy).
            gold: RANKED_DRAFT_GOLD,
            shop: rollShop({ rng: createRng(), stage: 2 }),
            pvpProfile: profile,
            pvpPool: pool,
        };
    }),
    fieldOwnedTeam: (finis, wallet) => {
        const fielded = finis.slice(0, 3);
        // One special/mythical Fini per team — scarce and team-defining.
        if (!validateTeamSpecials(fielded)) {
            return "Only one Special or Mythical Fini per team.";
        }
        set(() => {
            const profile = loadProfile();
            const pool = loadPool();
            const slots = makeEmptyTeamSlots();
            fielded.forEach((f, i) => {
                slots[i] = { fini: { ...f, currentHealth: f.maxHealth, fainted: false }, itemId: null };
            });
            // Persist the selection so the player doesn't re-pick from their wallet
            // every session — the fielded owned team is their ranked identity.
            const saved = saveOwnedTeam({ wallet: wallet ?? "", finis: fielded });
            // Land in the ranked shop with the owned team pre-filled: the player
            // keeps their NFTs (slots are full, so no unit drafting), can optionally
            // equip items, then "Ready" queues a real ladder opponent.
            return {
                ...freshRunState(),
                phase: "shop",
                isRanked: true,
                mode: "RANKED",
                gold: RANKED_DRAFT_GOLD,
                teamSlots: slots,
                shop: rollShop({ rng: createRng(), stage: 2 }),
                pvpProfile: profile,
                pvpPool: pool,
                savedOwnedTeam: saved,
            };
        });
        return null;
    },
    clearOwnedTeam: () => set(() => {
        clearOwnedTeamStorage();
        return { savedOwnedTeam: null };
    }),
    exitToTitle: () => set(() => ({ ...freshRunState(), phase: "title" })),
    // ─────────── Shop ───────────
    rollShop: () => {
        const s = get();
        if (s.gold < ROLL_COST)
            return;
        set({
            gold: s.gold - ROLL_COST,
            shop: rollShop({ rng: createRng(), stage: s.stage }),
        });
    },
    toggleShopLock: () => set((s) => ({ shop: { ...s.shop, locked: !s.shop.locked } })),
    buyUnit: (shopIdx, slotIdx) => {
        const s = get();
        const unit = s.shop.units[shopIdx];
        if (!unit)
            return "Unit not available.";
        if (s.gold < UNIT_COST)
            return "Not enough gold.";
        const targetSlot = s.teamSlots[slotIdx];
        if (targetSlot.fini)
            return "Slot occupied. Sell first.";
        const newSlots = [
            ...s.teamSlots,
        ];
        newSlots[slotIdx] = { fini: { ...unit }, itemId: null };
        const newUnits = s.shop.units.filter((_, i) => i !== shopIdx);
        set({
            gold: s.gold - UNIT_COST,
            shop: { ...s.shop, units: newUnits },
            teamSlots: newSlots,
        });
        return null;
    },
    buyItem: (shopIdx, slotIdx) => {
        const s = get();
        const item = s.shop.items[shopIdx];
        if (!item)
            return "Item not available.";
        if (s.gold < item.cost)
            return "Not enough gold.";
        const target = s.teamSlots[slotIdx];
        if (!target.fini)
            return "Pick a Fini to equip this item on.";
        const newSlots = [
            ...s.teamSlots,
        ];
        newSlots[slotIdx] = { ...target, itemId: item.id };
        set({
            gold: s.gold - item.cost,
            shop: { ...s.shop, items: s.shop.items.filter((_, i) => i !== shopIdx) },
            inventory: [...s.inventory, item],
            teamSlots: newSlots,
        });
        return null;
    },
    sellUnit: (slotIdx) => set((s) => {
        const target = s.teamSlots[slotIdx];
        if (!target.fini)
            return s;
        const newSlots = [...s.teamSlots];
        newSlots[slotIdx] = { fini: null, itemId: null };
        return { teamSlots: newSlots, gold: s.gold + SELL_REFUND };
    }),
    swapTeamSlots: (a, b) => set((s) => {
        const next = [...s.teamSlots];
        const tmp = next[a];
        next[a] = next[b];
        next[b] = tmp;
        return { teamSlots: next };
    }),
    equipItemOnSlot: (itemId, slotIdx) => set((s) => {
        const next = [...s.teamSlots];
        if (!next[slotIdx].fini)
            return s;
        next[slotIdx] = { ...next[slotIdx], itemId };
        return { teamSlots: next };
    }),
    unequipSlot: (slotIdx) => set((s) => {
        const next = [...s.teamSlots];
        next[slotIdx] = { ...next[slotIdx], itemId: null };
        return { teamSlots: next };
    }),
    readyForEncounter: () => {
        const s = get();
        // Ranked: skip the encounter chain — queue a real opponent snapshot.
        if (s.isRanked) {
            const opponent = pickOpponent({
                pool: s.pvpPool,
                rating: s.pvpProfile.rating,
                rng: createRng(),
            });
            if (!opponent)
                return;
            set({
                phase: "battle",
                mode: "RANKED",
                currentOpponent: opponent,
                enemyTeam: teamFromSnapshot(opponent),
                marketSignals: buildBattleSignals(s),
            });
            setTimeout(() => get().startBattle(), 50);
            return;
        }
        const rng = createRng();
        const options = generateEncounterOptions({
            stage: s.stage,
            stageProgress: s.stageProgress,
            encountersPerStage: ENCOUNTERS_PER_STAGE,
            finalStage: FINAL_STAGE,
            rng,
        });
        set({ phase: "encounter", encounterOptions: options });
    },
    // ─────────── Encounter ───────────
    pickEncounter: (encounterId) => {
        const s = get();
        const enc = s.encounterOptions.find((e) => e.id === encounterId);
        if (!enc)
            return;
        switch (enc.type) {
            case "FIGHT":
            case "BOSS_FIGHT": {
                const rng = createRng();
                const enemyTeam = generateEnemyTeam({
                    stage: s.stage,
                    rng,
                    packName: enc.enemyPackName,
                    isBoss: enc.type === "BOSS_FIGHT",
                });
                set({
                    phase: "battle",
                    currentEncounter: enc,
                    enemyTeam,
                    mode: "FREE",
                    marketSignals: buildBattleSignals(s),
                });
                // Auto-start the battle so the player doesn't get stuck.
                setTimeout(() => get().startBattle(), 50);
                return;
            }
            case "DEATH_MATCH": {
                const rng = createRng();
                const enemyTeam = generateEnemyTeam({
                    stage: s.stage,
                    rng,
                    packName: "Rival Trader",
                });
                // Auto-confirm the opponent side; player still has to stake +
                // type the phrase + confirm.
                const death = makeEmptyDeathModeConfig();
                death.enabled = true;
                death.simulatedOnly = true;
                death.stakes.teamB = {
                    playerId: enemyTeam.playerId,
                    finiId: enemyTeam.finis[0].id,
                    confirmed: true,
                };
                set({
                    phase: "battle",
                    currentEncounter: enc,
                    enemyTeam,
                    mode: "DEATH",
                    deathMode: death,
                    deathConfirmInput: "",
                    deathModePending: true,
                    marketSignals: buildBattleSignals(s),
                });
                return;
            }
            case "FOUND_COINS": {
                const gold = enc.gold ?? 3;
                set({
                    gold: s.gold + gold,
                    currentEncounter: enc,
                });
                advanceStageProgress(set, get);
                return;
            }
            case "TREASURE": {
                // Generate a random item from the shop catalog as a freebie.
                const item = rollShop({ rng: createRng(), stage: s.stage }).items[0];
                set({
                    inventory: [...s.inventory, item],
                    currentEncounter: enc,
                });
                advanceStageProgress(set, get);
                return;
            }
            case "REST": {
                // Heal one lost life if not at max.
                const newLives = Math.min(STARTING_LIVES, s.lives + (enc.healAmount ?? 0));
                set({ lives: newLives, currentEncounter: enc });
                advanceStageProgress(set, get);
                return;
            }
            case "VISIT_SHOP": {
                set({
                    phase: "shop",
                    shop: rollShop({ rng: createRng(), stage: s.stage }),
                    currentEncounter: enc,
                });
                return;
            }
        }
    },
    // ─────────── Battle controls ───────────
    setMode: (m) => set(() => ({ mode: m })),
    setBattleWindow: (w) => set((s) => ({
        battleWindow: w,
        marketSignals: buildBattleSignals({ ...s, battleWindow: w }),
    })),
    setMarketMode: (m) => {
        set({ marketMode: m });
        if (m === "LIVE") {
            // Fetch real data; buildBattleSignals falls back to mock until it lands.
            void get().refreshLiveMarket();
        }
        else {
            set((s) => ({ marketSignals: buildBattleSignals({ ...s, marketMode: m }) }));
        }
    },
    regenerateMarketSignals: () => set((s) => ({ marketSignals: buildBattleSignals(s) })),
    setMarketRead: (family) => set(() => ({ marketRead: family })),
    refreshLiveMarket: async () => {
        const s = get();
        // Reuse cache if fresh.
        if (s.liveSignals &&
            s.liveFetchedAt &&
            Date.now() - s.liveFetchedAt < LIVE_TTL) {
            return;
        }
        set({ marketLoading: true, marketError: undefined });
        try {
            const { signals, fetchedAt } = await fetchLiveMarketSignals(get().battleWindow);
            // A live snapshot also defines today's regime when in LIVE mode.
            const regime = regimeFromSignals(signals, todayKey(), "live");
            set((st) => ({
                liveSignals: signals,
                liveFetchedAt: fetchedAt,
                marketLoading: false,
                dailyRegime: st.marketMode === "LIVE" ? regime : st.dailyRegime,
                marketSignals: st.marketMode === "LIVE"
                    ? applyRegimeToSignals(signals, regime, 0.15)
                    : st.marketSignals,
            }));
        }
        catch (err) {
            set({
                marketLoading: false,
                marketError: err instanceof Error ? err.message : "Live market fetch failed.",
            });
        }
    },
    setDeathStake: (side, finiId) => set((s) => {
        const teamPlayerId = side === "teamA" ? "player-a" : s.enemyTeam?.playerId ?? "cpu";
        return {
            deathMode: {
                ...s.deathMode,
                stakes: {
                    ...s.deathMode.stakes,
                    [side]: {
                        playerId: teamPlayerId,
                        finiId,
                        confirmed: side === "teamB" ? true : false,
                    },
                },
            },
        };
    }),
    setDeathConfirmInput: (str) => set(() => ({ deathConfirmInput: str })),
    confirmDeathMode: (side) => set((s) => {
        const stakes = { ...s.deathMode.stakes };
        stakes[side] = { ...stakes[side], confirmed: true };
        return { deathMode: { ...s.deathMode, stakes } };
    }),
    cancelDeathMode: () => set(() => ({
        phase: "encounter",
        deathMode: makeEmptyDeathModeConfig(),
        deathConfirmInput: "",
        deathModePending: false,
        enemyTeam: undefined,
        mode: "FREE",
    })),
    startBattle: () => {
        const s = get();
        // Build player and enemy teams.
        const playerTeam = buildPlayerBattleTeam(s.teamSlots, s.inventory);
        if (!playerTeam)
            return "Your team is empty. Buy at least 1 Fini.";
        if (teamSlotsFilled(s.teamSlots) === 0)
            return "Your team is empty.";
        const enemy = s.enemyTeam;
        if (!enemy)
            return "No opponent.";
        if (s.mode === "DEATH") {
            const readiness = checkDeathModeReadiness({
                config: s.deathMode,
                teamA: playerTeam,
                teamB: enemy,
            });
            if (!readiness.ok)
                return readiness.detail;
        }
        set({ playbackStatus: "preparing", deathModePending: false });
        const config = makeBattleConfig({
            mode: s.mode,
            battleWindow: s.battleWindow,
            marketRead: s.marketRead
                ? { side: "teamA", predictedFamily: s.marketRead }
                : undefined,
        });
        const result = runBattle({
            teamA: cloneTeam(playerTeam),
            teamB: cloneTeam(enemy),
            marketSignals: s.marketSignals,
            config,
        });
        let events = [...result.events];
        let finalResult = result;
        if (s.mode === "DEATH") {
            const opening = buildDeathModeOpeningEvents({
                config: s.deathMode,
                teamA: playerTeam,
                teamB: enemy,
            });
            const dm = resolveSimulatedDeathMode({
                result,
                config: s.deathMode,
                teamA: playerTeam,
                teamB: enemy,
            });
            events = [...opening, ...events, ...dm.events];
            finalResult = {
                ...result,
                deathModeResult: dm.deathModeResult,
                events,
            };
        }
        // XP back to roster (player Finis only).
        const ownedFinis = s.teamSlots
            .map((slot) => slot.fini)
            .filter((f) => !!f);
        const { finis: updatedRoster, levelUps } = applyBattleXPAwards({
            awards: finalResult.xpAwards,
            finis: ownedFinis,
        });
        finalResult = { ...finalResult, levelUps };
        // Fold XP back into team slots.
        const newSlots = [
            ...s.teamSlots,
        ];
        for (let i = 0; i < 3; i++) {
            const slotFini = newSlots[i].fini;
            if (!slotFini)
                continue;
            const updated = updatedRoster.find((f) => f.id === slotFini.id);
            if (updated)
                newSlots[i] = { ...newSlots[i], fini: updated };
        }
        set({
            battleResult: finalResult,
            playbackEvents: events,
            playbackStatus: "playing",
            playbackIndex: 0,
            liveTeamA: rehydrateTeam(playerTeam),
            liveTeamB: rehydrateTeam(enemy),
            teamSlots: newSlots,
        });
        return null;
    },
    advancePlayback: () => {
        const s = get();
        if (s.playbackStatus !== "playing")
            return;
        const nextIdx = s.playbackIndex + 1;
        if (nextIdx >= s.playbackEvents.length) {
            set({
                playbackIndex: s.playbackEvents.length,
                playbackStatus: "ended",
                phase: "result",
            });
            applyBattleOutcome(set, get);
            return;
        }
        const ev = s.playbackEvents[nextIdx - 1];
        let liveA = s.liveTeamA;
        let liveB = s.liveTeamB;
        if (ev && liveA && liveB) {
            if (ev.type === "DAMAGE") {
                const apply = (team) => {
                    const idx = team.finis.findIndex((f) => f.id === ev.finiId);
                    if (idx < 0)
                        return team;
                    const next = [...team.finis];
                    next[idx] = { ...next[idx], currentHealth: ev.remainingHealth };
                    return { ...team, finis: next };
                };
                liveA = apply(liveA);
                liveB = apply(liveB);
            }
            else if (ev.type === "FAINT") {
                const apply = (team) => {
                    const idx = team.finis.findIndex((f) => f.id === ev.finiId);
                    if (idx < 0)
                        return team;
                    const next = [...team.finis];
                    next[idx] = { ...next[idx], fainted: true, currentHealth: 0 };
                    return { ...team, finis: next };
                };
                liveA = apply(liveA);
                liveB = apply(liveB);
            }
        }
        set({ playbackIndex: nextIdx, liveTeamA: liveA, liveTeamB: liveB });
    },
    skipToEnd: () => {
        const s = get();
        if (!s.battleResult)
            return;
        let liveA = s.liveTeamA;
        let liveB = s.liveTeamB;
        for (const ev of s.playbackEvents) {
            if (!liveA || !liveB)
                break;
            if (ev.type === "DAMAGE") {
                const apply = (team) => {
                    const idx = team.finis.findIndex((f) => f.id === ev.finiId);
                    if (idx < 0)
                        return team;
                    const next = [...team.finis];
                    next[idx] = { ...next[idx], currentHealth: ev.remainingHealth };
                    return { ...team, finis: next };
                };
                liveA = apply(liveA);
                liveB = apply(liveB);
            }
            else if (ev.type === "FAINT") {
                const apply = (team) => {
                    const idx = team.finis.findIndex((f) => f.id === ev.finiId);
                    if (idx < 0)
                        return team;
                    const next = [...team.finis];
                    next[idx] = { ...next[idx], fainted: true, currentHealth: 0 };
                    return { ...team, finis: next };
                };
                liveA = apply(liveA);
                liveB = apply(liveB);
            }
        }
        set({
            playbackIndex: s.playbackEvents.length,
            playbackStatus: "ended",
            phase: "result",
            liveTeamA: liveA,
            liveTeamB: liveB,
        });
        applyBattleOutcome(set, get);
    },
    continueAfterResult: () => {
        const s = get();
        // Ranked: back to the draft for the next match. Team + rating persist.
        if (s.isRanked) {
            set({
                phase: "shop",
                gold: s.gold + RANKED_DRAFT_GOLD,
                shop: s.shop.locked
                    ? s.shop
                    : rollShop({ rng: createRng(), stage: 2 }),
                battleResult: undefined,
                playbackEvents: [],
                playbackIndex: 0,
                playbackStatus: "idle",
                liveTeamA: undefined,
                liveTeamB: undefined,
                enemyTeam: undefined,
                currentOpponent: null,
                rankedDelta: null,
                currentEncounter: null,
                encounterOptions: [],
            });
            return;
        }
        if (s.lives <= 0) {
            set({ phase: "gameOver" });
            return;
        }
        // Advance stage progress / stage / shop.
        const nextProgress = s.stageProgress + 1;
        if (nextProgress >= ENCOUNTERS_PER_STAGE) {
            const nextStage = s.stage + 1;
            if (nextStage > FINAL_STAGE) {
                set({ phase: "victory" });
                return;
            }
            set({
                stage: nextStage,
                stageProgress: 0,
                gold: s.gold + POST_STAGE_GOLD_REFRESH,
                phase: "shop",
                shop: s.shop.locked
                    ? s.shop
                    : rollShop({ rng: createRng(), stage: nextStage }),
                battleResult: undefined,
                playbackEvents: [],
                playbackIndex: 0,
                playbackStatus: "idle",
                liveTeamA: undefined,
                liveTeamB: undefined,
                enemyTeam: undefined,
                deathMode: makeEmptyDeathModeConfig(),
                deathConfirmInput: "",
                deathModePending: false,
                mode: "FREE",
                currentEncounter: null,
                encounterOptions: [],
            });
        }
        else {
            set({
                stageProgress: nextProgress,
                phase: "shop",
                shop: s.shop.locked
                    ? s.shop
                    : rollShop({ rng: createRng(), stage: s.stage }),
                battleResult: undefined,
                playbackEvents: [],
                playbackIndex: 0,
                playbackStatus: "idle",
                liveTeamA: undefined,
                liveTeamB: undefined,
                enemyTeam: undefined,
                deathMode: makeEmptyDeathModeConfig(),
                deathConfirmInput: "",
                deathModePending: false,
                mode: "FREE",
                currentEncounter: null,
                encounterOptions: [],
            });
        }
    },
}));
/**
 * Run-loop bookkeeping for non-fight encounter resolution.
 * Pulled out so encounter handlers can reuse it.
 */
function advanceStageProgress(set, get) {
    const s = get();
    const nextProgress = s.stageProgress + 1;
    if (nextProgress >= ENCOUNTERS_PER_STAGE) {
        const nextStage = s.stage + 1;
        if (nextStage > FINAL_STAGE) {
            set(() => ({ phase: "victory" }));
            return;
        }
        set(() => ({
            stage: nextStage,
            stageProgress: 0,
            gold: get().gold + POST_STAGE_GOLD_REFRESH,
            phase: "shop",
            shop: rollShop({ rng: createRng(), stage: nextStage }),
            encounterOptions: [],
            currentEncounter: null,
        }));
    }
    else {
        set(() => ({
            stageProgress: nextProgress,
            phase: "shop",
            shop: get().shop.locked
                ? get().shop
                : rollShop({ rng: createRng(), stage: get().stage }),
            encounterOptions: [],
            currentEncounter: null,
        }));
    }
}
/**
 * After a battle finishes, update lives / gold / trophies.
 * Run is over when lives hit 0.
 */
function applyBattleOutcome(set, get) {
    const s = get();
    const result = s.battleResult;
    if (!result)
        return;
    const playerWon = result.winner === "teamA";
    // Ranked: ELO update + persist snapshots. No lives/gold/stage economy.
    if (s.isRanked && s.currentOpponent) {
        const opp = s.currentOpponent;
        const elo = applyEloResult({
            ratingA: s.pvpProfile.rating,
            ratingB: opp.rating,
            aWon: playerWon,
        });
        const newProfile = {
            ...s.pvpProfile,
            rating: elo.ratingA,
            wins: s.pvpProfile.wins + (playerWon ? 1 : 0),
            losses: s.pvpProfile.losses + (playerWon ? 0 : 1),
            streak: playerWon
                ? Math.max(1, s.pvpProfile.streak + 1)
                : Math.min(-1, s.pvpProfile.streak - 1),
        };
        saveProfile(newProfile);
        // Update the opponent's rating in the pool…
        updateSnapshotRating(opp.id, elo.ratingB, !playerWon);
        // …and drop the player's drafted team into the pool as a new ghost
        // at their fresh rating, so future queues can fight it.
        const playerTeam = buildPlayerBattleTeam(s.teamSlots, s.inventory);
        let pool;
        if (playerTeam) {
            const snap = snapshotFromTeam({
                team: playerTeam,
                name: newProfile.name,
                rating: elo.ratingA,
                origin: "player",
            });
            pool = addSnapshotToPool(snap);
        }
        else {
            pool = loadPool();
        }
        // Record per-token battle history + level for any wallet-owned Finis on
        // the fielded team, so the collection codex shows real records over time.
        for (const slot of s.teamSlots) {
            const f = slot.fini;
            if (!f || !f.id.startsWith("owned-"))
                continue;
            const tid = Number(f.tokenId);
            if (!Number.isFinite(tid))
                continue;
            recordFiniBattle({ tokenId: tid, won: playerWon, level: f.level, xp: f.xp });
        }
        set({
            pvpProfile: newProfile,
            pvpPool: pool,
            rankedDelta: elo.deltaA,
        });
        return;
    }
    const isBoss = s.currentEncounter?.type === "BOSS_FIGHT";
    if (playerWon) {
        const gold = isBoss ? GOLD_REWARD_PER_BOSS_WIN : GOLD_REWARD_PER_FIGHT_WIN;
        set({
            gold: s.gold + gold,
            trophies: s.trophies + (isBoss ? TROPHIES_PER_BOSS_WIN : 0),
        });
    }
    else {
        const newLives = s.lives - 1;
        set({ lives: newLives });
    }
}
