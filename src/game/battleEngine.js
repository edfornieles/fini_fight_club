import { familyMatchupWithPerks } from "./attributes";
import { ALL_COIN_FAMILIES } from "./types";
import { cloneTeam, isTeamWiped, rehydrateTeam } from "./finiFactory";
import { createRng } from "./rng";
import { applyPassiveAfterDamage, applyPassiveBeforeAttack, applyPassiveEndOfRound, applyPassiveOnDamage, applyPassiveOnFaint, applyPassiveSwapIfNeeded, createPassiveState, decideFirstAttacker, getEffectiveDefense, } from "./passiveAbilities";
import { strongestFamily } from "./marketSignals";
import { attackLine, damageLine, faintLine, familyMarketLine, marketTickLine, } from "./battleLogText";
import { computeXPAwards } from "./xpSystem";
/**
 * The battle engine is pure: same inputs => same outputs. It does NOT
 * mutate the player's persistent roster. The outer game store decides
 * when to fold XP awards back into the saved Finis.
 *
 * Damage formula (per brief):
 *   marketAttackModifier =
 *     1 + momentumScore*0.35 + volatility*volatilityAffinity*0.1
 *   effectiveAttack = strength * marketAttackModifier
 *   effectiveDefense = defense * (direction==="down" ? 1.1 : 1)
 *   damage = max(1, round(effectiveAttack - opponentEffectiveDefense*0.5))
 *
 * Then we apply the BattleConfig's marketInfluence vs statInfluence
 * weighting so the designer can tune how much the market dominates.
 */
/** A called family must clear this momentum to count as a correct read. */
const MARKET_READ_THRESHOLD = 0.1;
/** Attack bonus granted to a side whose market read lands. */
const MARKET_READ_BONUS = 0.15;
// ── Live market drift (round-to-round swings) ──────────────────────────────
/** Max per-round momentum step at volatility 1.0 (random walk amplitude). */
const DRIFT_SCALE = 0.22;
/** How strongly momentum is pulled back toward the opening read each round. */
const DRIFT_REVERSION = 0.12;
/** Minimum |momentum change| in a round before we narrate the swing. */
const TICK_THRESHOLD = 0.07;
function clampMomentum(x) {
    return Math.max(-1, Math.min(1, x));
}
/** Recompute display direction from a (possibly drifted) momentum score. */
function directionFromMomentum(m) {
    if (m > 0.07)
        return "up";
    if (m < -0.07)
        return "down";
    return "flat";
}
/** Deep copy a signal map so the engine never mutates its inputs. */
function cloneSignals(signals) {
    const out = {};
    for (const fam of ALL_COIN_FAMILIES)
        out[fam] = { ...signals[fam] };
    return out;
}
/**
 * Advance the live market one round. Each relevant family's momentum takes a
 * seeded random-walk step (bigger for volatile families) plus a gentle pull
 * back toward its opening read, so swings oscillate instead of running away.
 * Mutates `signals` in place; returns the single biggest mover that crossed
 * the narration threshold (so the log stays punchy rather than spammy).
 */
function driftMarket(args) {
    let biggest = null;
    for (const fam of args.families) {
        const sig = args.signals[fam];
        const prev = sig.momentumScore;
        const noise = (args.rng.next() * 2 - 1) * sig.volatility * DRIFT_SCALE;
        const revert = (args.opening[fam] - prev) * DRIFT_REVERSION;
        const next = clampMomentum(prev + noise + revert);
        const delta = next - prev;
        sig.momentumScore = next;
        sig.direction = directionFromMomentum(next);
        if (Math.abs(delta) >= TICK_THRESHOLD &&
            (!biggest || Math.abs(delta) > Math.abs(biggest.delta))) {
            biggest = { family: fam, direction: sig.direction, momentum: next, delta };
        }
    }
    return biggest;
}
export function runBattle(args) {
    const cfg = args.config;
    const rng = createRng(cfg.seed);
    const events = [];
    const rounds = [];
    // Always work on clones — never mutate inputs.
    let teamA = rehydrateTeam(args.teamA);
    let teamB = rehydrateTeam(args.teamB);
    // Mutable working copy of the market: when liveMarket is on, its momentum
    // drifts every round (see driftMarket). The damage formula reads momentum
    // per attack, so the swings flow through to damage automatically.
    const signals = cloneSignals(args.marketSignals);
    const battleFamilies = relevantFamilies(teamA, teamB);
    const openingMomentum = {};
    for (const fam of ALL_COIN_FAMILIES) {
        openingMomentum[fam] = args.marketSignals[fam].momentumScore;
    }
    const passiveState = createPassiveState();
    const ctx = {
        state: passiveState,
        rng,
        signals,
        events,
        enable: cfg.enablePassives,
    };
    events.push({
        type: "BATTLE_START",
        message: `Two teams enter the Finiliar arena. The market opens its mouth.`,
    });
    // Announce all family signals up front (mythic preamble).
    for (const fam of battleFamilies) {
        const sig = signals[fam];
        events.push({
            type: "FAMILY_MARKET_SIGNAL",
            family: fam,
            signal: sig,
            message: familyMarketLine(sig),
        });
    }
    // Pre-battle market read: did the caller's family actually pump?
    // A correct call grants that side a conviction bonus on attacks.
    let readMultiplierA = 1;
    let readMultiplierB = 1;
    if (cfg.marketRead) {
        const sig = signals[cfg.marketRead.predictedFamily];
        const correct = sig.momentumScore > MARKET_READ_THRESHOLD;
        if (cfg.marketRead.side === "teamA") {
            readMultiplierA = correct ? 1 + MARKET_READ_BONUS : 1;
        }
        else {
            readMultiplierB = correct ? 1 + MARKET_READ_BONUS : 1;
        }
        events.push({
            type: "MARKET_READ",
            side: cfg.marketRead.side,
            predictedFamily: cfg.marketRead.predictedFamily,
            correct,
            message: correct
                ? `Your read on ${cfg.marketRead.predictedFamily} pays off. Conviction surges through the team (+${Math.round(MARKET_READ_BONUS * 100)}% attack).`
                : `Your read on ${cfg.marketRead.predictedFamily} doesn't land. The market shrugs.`,
        });
    }
    const damageByFiniGlobal = {};
    let roundNumber = 0;
    while (!isTeamWiped(teamA) &&
        !isTeamWiped(teamB) &&
        roundNumber < cfg.maxRounds) {
        roundNumber += 1;
        const roundDmg = {};
        const roundFaints = [];
        events.push({
            type: "ROUND_START",
            roundNumber,
            message: `Round ${roundNumber}.`,
        });
        // Live market: nudge family momentum for this round and narrate the
        // biggest swing. First round keeps the opening read intact so the
        // pre-fight market panel and the read bonus still line up.
        if (cfg.liveMarket && roundNumber > 1) {
            const mover = driftMarket({
                signals,
                opening: openingMomentum,
                families: battleFamilies,
                rng,
            });
            if (mover) {
                events.push({
                    type: "MARKET_TICK",
                    roundNumber,
                    family: mover.family,
                    direction: mover.direction,
                    momentumScore: mover.momentum,
                    delta: mover.delta,
                    message: marketTickLine(mover.family, mover.direction, mover.delta),
                });
            }
        }
        // Apply potential UNI Swap at start of round.
        teamA = applyPassiveSwapIfNeeded({ team: teamA, ctx });
        teamB = applyPassiveSwapIfNeeded({ team: teamB, ctx });
        const activeA = teamA.finis.find((f) => !f.fainted && f.currentHealth > 0);
        const activeB = teamB.finis.find((f) => !f.fainted && f.currentHealth > 0);
        if (!activeA || !activeB)
            break;
        const first = decideFirstAttacker({
            attackerA: activeA,
            attackerB: activeB,
            signals,
            ctx,
        });
        const order = first === "teamA" ? ["teamA", "teamB"] : ["teamB", "teamA"];
        for (const side of order) {
            if (isTeamWiped(teamA) || isTeamWiped(teamB))
                break;
            const attackerTeam = side === "teamA" ? teamA : teamB;
            const defenderTeam = side === "teamA" ? teamB : teamA;
            const attacker = attackerTeam.finis.find((f) => !f.fainted && f.currentHealth > 0);
            const defender = defenderTeam.finis.find((f) => !f.fainted && f.currentHealth > 0);
            if (!attacker || !defender)
                continue;
            const damage = computeDamage({
                attacker,
                defender,
                signals,
                cfg,
                ctx,
                readMultiplier: side === "teamA" ? readMultiplierA : readMultiplierB,
            });
            // Tracking.
            roundDmg[attacker.id] = (roundDmg[attacker.id] ?? 0) + damage;
            damageByFiniGlobal[attacker.id] =
                (damageByFiniGlobal[attacker.id] ?? 0) + damage;
            events.push({
                type: "ATTACK",
                attackerId: attacker.id,
                defenderId: defender.id,
                damage,
                message: attackLine(attacker, defender, damage),
            });
            // Apply damage to defender.
            const updatedDefender = {
                ...defender,
                currentHealth: Math.max(0, defender.currentHealth - damage),
            };
            const remaining = updatedDefender.currentHealth;
            events.push({
                type: "DAMAGE",
                finiId: defender.id,
                amount: damage,
                remainingHealth: remaining,
                message: damageLine(defender, damage, remaining),
            });
            // Self-Amend hook (heal after damage, once per battle).
            if (remaining > 0) {
                const { heal } = applyPassiveAfterDamage({
                    defender: updatedDefender,
                    ctx,
                });
                if (heal > 0) {
                    updatedDefender.currentHealth = Math.min(updatedDefender.maxHealth, updatedDefender.currentHealth + heal);
                }
            }
            else {
                updatedDefender.fainted = true;
                roundFaints.push(updatedDefender.id);
                events.push({
                    type: "FAINT",
                    finiId: updatedDefender.id,
                    message: faintLine(updatedDefender),
                });
                applyPassiveOnFaint({ attacker, defender: updatedDefender, ctx });
            }
            // Substitute updated defender back into its team.
            if (side === "teamA") {
                teamB = substituteFini(teamB, updatedDefender);
            }
            else {
                teamA = substituteFini(teamA, updatedDefender);
            }
        }
        // End-of-round passive ticks.
        const endRound = applyPassiveEndOfRound({
            roundNumber,
            teamA,
            teamB,
            activeA: teamA.finis.find((f) => !f.fainted && f.currentHealth > 0),
            activeB: teamB.finis.find((f) => !f.fainted && f.currentHealth > 0),
            ctx,
        });
        teamA = endRound.teamA;
        teamB = endRound.teamB;
        rounds.push({
            roundNumber,
            damageByFini: roundDmg,
            faintedFiniIds: roundFaints,
        });
    }
    // Decide winner.
    const aWiped = isTeamWiped(teamA);
    const bWiped = isTeamWiped(teamB);
    let winner;
    if (aWiped && !bWiped)
        winner = "teamB";
    else if (bWiped && !aWiped)
        winner = "teamA";
    else {
        // Tie / round cap reached — go by remaining total HP.
        const hpA = teamA.finis.reduce((s, f) => s + f.currentHealth, 0);
        const hpB = teamB.finis.reduce((s, f) => s + f.currentHealth, 0);
        winner = hpA >= hpB ? "teamA" : "teamB";
    }
    const loser = winner === "teamA" ? "teamB" : "teamA";
    events.push({
        type: "BATTLE_END",
        winner,
        message: winner === "teamA"
            ? `${args.teamA.name} survives the market.`
            : `${args.teamB.name} survives the market.`,
    });
    // Summary stats.
    const highestDamageDealerId = Object.entries(damageByFiniGlobal).sort((a, b) => b[1] - a[1])[0]?.[0];
    const strongestMarket = strongestFamily(signals);
    // "Best Fini": survivor on the winning team with highest damage dealt,
    // else best survivor by HP fraction.
    const winningFinis = winner === "teamA" ? teamA.finis : teamB.finis;
    const bestSurvivor = [...winningFinis]
        .filter((f) => !f.fainted && f.currentHealth > 0)
        .sort((a, b) => (damageByFiniGlobal[b.id] ?? 0) - (damageByFiniGlobal[a.id] ?? 0))[0];
    const bestFiniId = bestSurvivor?.id ?? highestDamageDealerId ?? winningFinis[0].id;
    const partial = {
        winner,
        loser,
        rounds,
        events,
        finalTeams: {
            teamA: teamA.finis.map((f) => ({ ...f })),
            teamB: teamB.finis.map((f) => ({ ...f })),
        },
        xpAwards: [],
        levelUps: [],
        summary: {
            totalRounds: rounds.length,
            bestFiniId,
            strongestMarketFamily: strongestMarket,
            highestDamageDealerId,
        },
    };
    // XP awards — only when enableXP is true. Death Mode events get
    // appended later by the caller (so the engine stays pure of ownership
    // concerns).
    if (cfg.enableXP) {
        partial.xpAwards = computeXPAwards({
            result: partial,
            teamA: args.teamA,
            teamB: args.teamB,
        });
    }
    return partial;
}
function relevantFamilies(teamA, teamB) {
    const set = new Set();
    for (const f of [...teamA.finis, ...teamB.finis])
        set.add(f.family);
    // Keep canonical order.
    return ALL_COIN_FAMILIES.filter((fam) => set.has(fam));
}
function substituteFini(team, updated) {
    const idx = team.finis.findIndex((f) => f.id === updated.id);
    if (idx < 0)
        return team;
    const next = [...team.finis];
    next[idx] = updated;
    return { ...team, finis: next };
}
function computeDamage(args) {
    const { attacker, defender, signals, cfg, ctx, readMultiplier } = args;
    // Passive: before-attack modifiers.
    const beforeAtk = applyPassiveBeforeAttack({ attacker, defender, ctx });
    const beforeDef = applyPassiveOnDamage({
        attacker,
        defender,
        incomingDamage: 0,
        ctx,
    });
    const sigAtk = signals[attacker.family];
    const sigDef = signals[defender.family];
    const marketAttackModifier = 1 +
        sigAtk.momentumScore * 0.35 +
        sigAtk.volatility * attacker.volatilityAffinity * 0.1;
    const effectiveAttack = attacker.strength *
        marketAttackModifier *
        beforeAtk.attackMultiplier *
        readMultiplier;
    const baseDefense = getEffectiveDefense(defender, ctx);
    const defenseDirMult = sigDef.direction === "down" ? 1.1 : 1;
    const effectiveDefense = baseDefense * defenseDirMult * beforeDef.defenseMultiplier;
    // Raw market+stat damage from the brief's formula.
    const rawMarketStat = effectiveAttack - effectiveDefense * 0.5 + beforeAtk.bonusDamage;
    // Pure-stat baseline so config can re-weight market vs stat influence.
    // pureStat = strength - defense*0.5 (no market multipliers).
    const pureStat = attacker.strength - defender.defense * 0.5;
    // Weighted combo: market influence dominates, but stats matter.
    const m = clamp01(cfg.marketInfluence);
    const s = clamp01(cfg.statInfluence);
    const totalW = m + s || 1;
    let damage = (rawMarketStat * m + pureStat * s) / totalW;
    // Tiny chaos contribution from attacker cuteness.
    const chaos = (ctx.rng.next() - 0.5) * (attacker.cuteness * 0.6);
    damage += chaos;
    // Level scaling: +5% damage per level above 1.
    damage *= 1 + (attacker.level - 1) * 0.05;
    // Family counter-triangle (×0.9–1.1 soft advantage/disadvantage).
    // NAKAMOTO mythical makes a Fini immune to counter penalties.
    const nakamatoActive = defender.mythicalPerk === "NAKAMOTO";
    if (!nakamatoActive) {
        const matchupMult = familyMatchupWithPerks(attacker.family, attacker.specialPerk, defender.family);
        damage *= matchupMult;
    }
    return Math.max(1, Math.round(damage));
}
function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}
// ─────────────────────────────────────────────────────────────────────────
// Convenience exports used by store/tests
// ─────────────────────────────────────────────────────────────────────────
export function quickBattle(args) {
    return runBattle({
        teamA: cloneTeam(args.teamA),
        teamB: cloneTeam(args.teamB),
        marketSignals: args.signals,
        config: {
            mode: "FREE",
            battleWindow: "1h",
            maxRounds: 30,
            marketInfluence: 0.65,
            statInfluence: 0.35,
            enablePassives: true,
            enableXP: true,
            liveMarket: true,
            seed: args.seed,
        },
    });
}
