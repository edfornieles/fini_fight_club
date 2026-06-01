import { mockOwnershipLedger } from "./ownership";
import { deathModeClosingLines, deathModeOpeningLines, deathModeStakeLine, } from "./battleLogText";
/**
 * Death Mode design rules (MVP):
 *   - Simulated transfers ONLY. We never touch on-chain state.
 *   - Both stakes must be present AND both must be confirmed:true before
 *     the battle is allowed to start.
 *   - The result includes a clear DeathModeResult object with the
 *     simulatedTransferComplete flag and an audit-style log entry.
 *
 *  ─────────────── FUTURE REAL DEATH MODE ─────────────────────────────
 *  Do NOT implement on-chain transfers in this file.
 *  When the audited escrow contract is ready:
 *    1. Add a DeathModeEscrow interface (deposit/lock/cancel/claim).
 *    2. Add an oracle bridge that publishes the BattleResult to the
 *       contract.
 *    3. The contract MUST require:
 *         - approvals before deposit
 *         - both parties' explicit confirmTx
 *         - a lock event that prevents cancellation
 *         - a claim window after battle resolution
 *         - emergency cancel BEFORE lock only
 *    4. Test on a public testnet for weeks.
 *    5. External audit.
 *    6. Then expose a real DeathModeEscrowAdapter implementation that
 *       this module can call instead of the mockOwnershipLedger.
 *  ──────────────────────────────────────────────────────────────────────
 */
export const DEATH_MODE_CONFIRM_PHRASE = "I ACCEPT DEATH MODE";
export function makeEmptyDeathModeConfig() {
    return {
        enabled: false,
        simulatedOnly: true,
        stakes: {
            teamA: { playerId: "", finiId: "", confirmed: false },
            teamB: { playerId: "", finiId: "", confirmed: false },
        },
    };
}
export function checkDeathModeReadiness(args) {
    const { config, teamA, teamB } = args;
    if (!config.enabled) {
        return {
            ok: false,
            reason: "DISABLED",
            detail: "Death Mode is not enabled.",
        };
    }
    const { teamA: sA, teamB: sB } = config.stakes;
    if (!sA.finiId) {
        return {
            ok: false,
            reason: "MISSING_STAKE_A",
            detail: "Team A must select a staked Fini.",
        };
    }
    if (!sB.finiId) {
        return {
            ok: false,
            reason: "MISSING_STAKE_B",
            detail: "Team B must select a staked Fini.",
        };
    }
    if (!teamA.finis.some((f) => f.id === sA.finiId)) {
        return {
            ok: false,
            reason: "STAKE_NOT_ON_TEAM",
            detail: "Team A's staked Fini is not on its roster.",
        };
    }
    if (!teamB.finis.some((f) => f.id === sB.finiId)) {
        return {
            ok: false,
            reason: "STAKE_NOT_ON_TEAM",
            detail: "Team B's staked Fini is not on its roster.",
        };
    }
    if (!sA.confirmed) {
        return {
            ok: false,
            reason: "UNCONFIRMED_A",
            detail: "Team A has not confirmed Death Mode.",
        };
    }
    if (!sB.confirmed) {
        return {
            ok: false,
            reason: "UNCONFIRMED_B",
            detail: "Team B has not confirmed Death Mode.",
        };
    }
    return { ok: true };
}
/**
 * Inject Death Mode opening events into the BattleResult event stream.
 * Called BEFORE runBattle so opening lines appear at the top of the log.
 */
export function buildDeathModeOpeningEvents(args) {
    const { config, teamA, teamB } = args;
    const events = [];
    const stakeA = teamA.finis.find((f) => f.id === config.stakes.teamA.finiId);
    const stakeB = teamB.finis.find((f) => f.id === config.stakes.teamB.finiId);
    if (!stakeA || !stakeB)
        return events;
    for (const line of deathModeOpeningLines()) {
        events.push({
            type: "DEATH_MODE_STAKE",
            finiId: stakeA.id,
            playerId: config.stakes.teamA.playerId,
            message: line,
        });
    }
    events.push({
        type: "DEATH_MODE_STAKE",
        finiId: stakeA.id,
        playerId: config.stakes.teamA.playerId,
        message: deathModeStakeLine(stakeA),
    });
    events.push({
        type: "DEATH_MODE_STAKE",
        finiId: stakeB.id,
        playerId: config.stakes.teamB.playerId,
        message: deathModeStakeLine(stakeB),
    });
    return events;
}
/**
 * Compute the DeathModeResult AFTER a battle finishes.
 *
 * MVP: simulated only — we mutate the in-memory ownership ledger.
 * Returns the result + an event to append to the battle log.
 */
export function resolveSimulatedDeathMode(args) {
    const { result, config, teamA, teamB } = args;
    const winningStake = result.winner === "teamA" ? config.stakes.teamA : config.stakes.teamB;
    const losingStake = result.winner === "teamA" ? config.stakes.teamB : config.stakes.teamA;
    // SIMULATED transfer: update the mock ledger only. Real production
    // Death Mode must go through audited escrow — see the comment at the
    // top of this file. We deliberately do not import or call any wallet
    // libraries here.
    mockOwnershipLedger.transfer(losingStake.finiId, losingStake.playerId, winningStake.playerId);
    const wonFini = (result.winner === "teamA" ? teamB : teamA).finis.find((f) => f.id === losingStake.finiId) ?? null;
    const lostFini = (result.winner === "teamA" ? teamA : teamB).finis.find((f) => f.id === winningStake.finiId) ?? null;
    const dmr = {
        winnerPlayerId: winningStake.playerId,
        loserPlayerId: losingStake.playerId,
        wonFiniId: losingStake.finiId,
        lostFiniId: winningStake.finiId,
        simulatedTransferComplete: true,
    };
    const events = [];
    events.push({
        type: "DEATH_MODE_TRANSFER",
        winnerPlayerId: dmr.winnerPlayerId,
        loserPlayerId: dmr.loserPlayerId,
        wonFiniId: dmr.wonFiniId,
        message: `Simulated transfer complete. ${wonFini?.family ?? "?"} Fini #${wonFini?.tokenId ?? wonFini?.id ?? dmr.wonFiniId} now belongs to ${dmr.winnerPlayerId}.`,
    });
    for (const closing of deathModeClosingLines(wonFini?.family ?? "BTC", wonFini?.tokenId ?? wonFini?.id ?? dmr.wonFiniId)) {
        events.push({
            type: "DEATH_MODE_TRANSFER",
            winnerPlayerId: dmr.winnerPlayerId,
            loserPlayerId: dmr.loserPlayerId,
            wonFiniId: dmr.wonFiniId,
            message: closing,
        });
    }
    // Reference the loser side so unused-args warnings stay quiet.
    void lostFini;
    return { deathModeResult: dmr, events };
}
/**
 * Hook for future on-chain Death Mode adapter. Do NOT implement here.
 *
 * TODO(real-death-mode):
 *   - Replace this stub with an adapter pattern.
 *   - The adapter MUST require both wallet signatures.
 *   - The adapter MUST verify both stakes are deposited before
 *     `lockMatch()` is called.
 *   - Any post-lock cancellation MUST be impossible.
 *   - All escrow contracts must be audited before mainnet deployment.
 */
export async function realDeathModeTransfer(_args) {
    throw new Error("Real Death Mode NFT transfer is not implemented. " +
        "Wire up the audited escrow contract before enabling.");
}
