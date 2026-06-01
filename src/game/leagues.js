/**
 * Leagues — the central money loop.
 *
 * A League is a paid-entry competition. Players pay a buy-in (mock ETH via
 * MockCurrencyLedger), all entries play a deterministic round-robin, and the
 * pot pays out to 1st and 2nd place. The house takes a rake.
 *
 * Design rules:
 *   - Pure economics: all prize math is integer minor units, exact, no dust
 *     lost (any rounding remainder goes to the house, documented below).
 *   - Deterministic standings: same entries + same seed → same final table,
 *     forever. Built on the deterministic battle engine.
 *   - Money moves through the ledger ONLY at join (escrow in) and settle
 *     (payout / house collect). The simulation step touches no balances.
 *   - This is the everyday loop. Death Match (NFT stakes) is a SEPARATE
 *     area — see deathMode.ts — and never mixes with league money.
 *
 *  ─────────────── FUTURE REAL LEAGUES ──────────────────────────────────
 *  Swap MockCurrencyLedger for the audited escrow contract. join() becomes
 *  an on-chain deposit; settleLeague() becomes contract-driven payout. The
 *  deterministic result is independently recomputable by anyone, so the
 *  escrow can settle optimistically with a dispute window. Keep the shapes
 *  here stable so the swap is mechanical.
 *  ──────────────────────────────────────────────────────────────────────
 */
import { teamFromSnapshot } from "./pvp";
import { runBattle } from "./battleEngine";
import { generateMockMarketSignals } from "./marketSignals";
/** Default: 10% house, then 65/35 split between 1st and 2nd. */
export const DEFAULT_PRIZE_STRUCTURE = {
    houseRakeBps: 1000,
    firstBps: 6500,
    secondBps: 3500,
};
/**
 * Pure prize math. Integer minor units in, integer minor units out.
 * Any rounding remainder ("dust") is added to the house cut so that
 * houseCut + firstPrize + secondPrize === pool exactly.
 */
export function computePrizeBreakdown(pool, prize = DEFAULT_PRIZE_STRUCTURE) {
    const houseBase = Math.floor((pool * prize.houseRakeBps) / 10000);
    const distributable = pool - houseBase;
    const firstPrize = Math.floor((distributable * prize.firstBps) / 10000);
    const secondPrize = Math.floor((distributable * prize.secondBps) / 10000);
    const dust = distributable - firstPrize - secondPrize;
    return {
        pool,
        houseCut: houseBase + dust,
        firstPrize,
        secondPrize,
    };
}
/** Buy-ins in minor units. UI divides to display ETH. */
export const TIER_BUYINS = {
    BRONZE: 10,
    SILVER: 50,
    GOLD: 250,
    DIAMOND: 1000,
};
// ─────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────
export function createLeague(config) {
    const tier = config.tier;
    return {
        config: {
            id: config.id,
            name: config.name ?? `${titleCase(tier)} League`,
            tier,
            buyIn: config.buyIn ?? TIER_BUYINS[tier],
            minEntrants: config.minEntrants ?? 2,
            maxEntrants: config.maxEntrants ?? 8,
            prize: config.prize ?? DEFAULT_PRIZE_STRUCTURE,
            battleWindow: config.battleWindow ?? "1h",
            seed: config.seed ?? 1,
        },
        status: "OPEN",
        entries: [],
    };
}
/**
 * Join a league: escrows the buy-in into the league pot and adds the entry.
 * Mutates the league and the ledger. Returns a typed result.
 */
export function joinLeague(args) {
    const { league, entry, ledger } = args;
    if (league.status !== "OPEN") {
        return { ok: false, reason: "NOT_OPEN", detail: "League is not open for entry." };
    }
    if (league.entries.length >= league.config.maxEntrants) {
        return { ok: false, reason: "FULL", detail: "League is full." };
    }
    if (league.entries.some((e) => e.playerId === entry.playerId)) {
        return { ok: false, reason: "ALREADY_JOINED", detail: "Player already entered." };
    }
    const deposited = ledger.escrowDeposit(escrowIdFor(league), entry.playerId, league.config.buyIn);
    if (!deposited) {
        return {
            ok: false,
            reason: "INSUFFICIENT_FUNDS",
            detail: "Not enough balance to cover the buy-in.",
        };
    }
    league.entries.push(entry);
    return { ok: true };
}
/** Cancel an OPEN league and refund every entrant their buy-in. */
export function cancelLeague(args) {
    const { league, ledger } = args;
    if (league.status !== "OPEN") {
        throw new Error("Only OPEN leagues can be cancelled.");
    }
    const escrowId = escrowIdFor(league);
    for (const entry of league.entries) {
        ledger.payout(escrowId, entry.playerId, league.config.buyIn);
    }
    league.status = "CANCELLED";
}
// ─────────────────────────────────────────────────────────────────────────
// Simulation (touches no money)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Run the full round-robin deterministically and compute final standings.
 * Pure with respect to money — only reads the entries. Sets status RUNNING.
 */
export function runLeague(league) {
    if (league.status !== "OPEN" && league.status !== "RUNNING") {
        throw new Error(`Cannot run a league in status ${league.status}.`);
    }
    if (league.entries.length < league.config.minEntrants) {
        throw new Error(`League needs at least ${league.config.minEntrants} entrants to run.`);
    }
    league.status = "RUNNING";
    const n = league.entries.length;
    const wins = new Array(n).fill(0);
    const losses = new Array(n).fill(0);
    const survivorScore = new Array(n).fill(0);
    const matches = [];
    let matchIndex = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            // Each pairing gets its own deterministic market + battle seed so
            // different matchups face different market weather (team vs market
            // is the skill). Derived from the league seed so it's reproducible.
            const matchSeed = mixSeed(league.config.seed, matchIndex);
            const signals = generateMockMarketSignals(league.config.battleWindow, matchSeed);
            const teamA = teamFromSnapshot(league.entries[i].snapshot);
            const teamB = teamFromSnapshot(league.entries[j].snapshot);
            const result = runBattle({
                teamA,
                teamB,
                marketSignals: signals,
                config: {
                    mode: "RANKED",
                    battleWindow: league.config.battleWindow,
                    maxRounds: 30,
                    marketInfluence: 0.65,
                    statInfluence: 0.35,
                    enablePassives: true,
                    // Leagues do not award XP — snapshots stay frozen so standings
                    // are reproducible. Level progression happens elsewhere.
                    enableXP: false,
                    seed: matchSeed,
                },
            });
            const aWon = result.winner === "teamA";
            const winnerIdx = aWon ? i : j;
            const loserIdx = aWon ? j : i;
            wins[winnerIdx] += 1;
            losses[loserIdx] += 1;
            // Survivor tiebreak: count the winner's Finis still standing.
            const finalWinTeam = aWon ? result.finalTeams.teamA : result.finalTeams.teamB;
            survivorScore[winnerIdx] += finalWinTeam.filter((f) => !f.fainted && f.currentHealth > 0).length;
            matches.push({
                homeIndex: i,
                awayIndex: j,
                winnerPlayerId: league.entries[winnerIdx].playerId,
                loserPlayerId: league.entries[loserIdx].playerId,
            });
            matchIndex += 1;
        }
    }
    // Build + sort standings: wins desc, then survivorScore desc, then
    // entry order asc (stable, deterministic tiebreak of last resort).
    const standings = league.entries.map((e, idx) => ({
        rank: 0,
        playerId: e.playerId,
        name: e.snapshot.name,
        wins: wins[idx],
        losses: losses[idx],
        survivorScore: survivorScore[idx],
    }));
    const order = league.entries.map((_, idx) => idx);
    order.sort((a, b) => {
        if (wins[b] !== wins[a])
            return wins[b] - wins[a];
        if (survivorScore[b] !== survivorScore[a])
            return survivorScore[b] - survivorScore[a];
        return a - b;
    });
    const sorted = order.map((idx, place) => {
        const s = standings.find((st) => st.playerId === league.entries[idx].playerId);
        s.rank = place + 1;
        return s;
    });
    const prize = computePrizeBreakdown(league.config.buyIn * league.entries.length, league.config.prize);
    // 1st always pays; 2nd only if there's a second entrant (guards a league
    // configured with minEntrants:1). Any unpaid 2nd-place share stays in the pot
    // and is swept to the house at settle, so money is still conserved.
    const payouts = [
        { playerId: sorted[0].playerId, place: 1, amount: prize.firstPrize },
    ];
    if (sorted.length >= 2) {
        payouts.push({ playerId: sorted[1].playerId, place: 2, amount: prize.secondPrize });
    }
    return { standings: sorted, matches, prize, payouts };
}
// ─────────────────────────────────────────────────────────────────────────
// Settlement (moves money)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Pay out the league result through the ledger: 1st, 2nd, then the house
 * collects its cut (which includes any rounding dust). Sets status SETTLED.
 * Idempotency is the caller's responsibility — do not settle twice.
 */
export function settleLeague(args) {
    const { league, result, ledger } = args;
    if (league.status !== "RUNNING") {
        throw new Error(`Cannot settle a league in status ${league.status}.`);
    }
    const escrowId = escrowIdFor(league);
    for (const p of result.payouts) {
        ledger.payout(escrowId, p.playerId, p.amount);
    }
    // House sweeps whatever remains after winners are paid. In a normal league
    // that's exactly the rake (first+second+house = pool); if a payout was
    // skipped (e.g. a lone entrant has no 2nd place) the leftover also goes to
    // the house, so `sum(balances)+house` is conserved in every case.
    ledger.houseCollect(escrowId, ledger.escrowBalance(escrowId));
    league.status = "SETTLED";
}
// ─────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────
export function escrowIdFor(league) {
    return `league:${league.config.id}`;
}
/** Deterministic seed mixing so each match in a league is independent. */
function mixSeed(base, index) {
    // Knuth multiplicative hash, kept in uint32 range.
    return (Math.imul(base ^ (index + 1), 2654435761) >>> 0) % 2_000_000_000;
}
function titleCase(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
