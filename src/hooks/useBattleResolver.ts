/**
 * useBattleResolver — drives Crypto Arena entry settlement.
 *
 * Runs a 2-second tick that checks every open MyEntry against the current
 * sim state. When an entry's timer has expired:
 *   1. Look up the corresponding battle in the sim
 *   2. Determine the winning side from current odds (live-price-driven for
 *      Up/Down + Outperform, seed-driven for others)
 *   3. Call useMyEntries.resolveEntry → marks the entry settled
 *   4. Credit the player's FINI$ via useCoinStore.earn (winners + voids only)
 *   5. Push a celebratory/condolence notification to useNotifications
 *
 * Mounted globally from <App /> so settlement happens regardless of which
 * page the user is on. Idempotent — already-settled entries are skipped.
 */
import { useEffect } from "react";
import { useMyEntries } from "../state/myEntriesStore";
import { useCryptoSim } from "../data/cryptoSim";
import { useCoinStore } from "../state/coinStore";
import { useNotifications } from "../state/notificationsStore";

/**
 * Returns the winning side ("A" | "B" | null=void) for a settled battle.
 *
 * The sim's fair-odds logic already drifts each battle toward its likely
 * winner using live-price data (for updown/outperform) and a deterministic
 * seed (for everything else). So at expiry, the side with >50% has the win.
 * Simpler than re-querying prices and handles every battle type uniformly.
 */
function decideWinner(battle: { sideA: { pct: number }; sideB: { pct: number } }): "A" | "B" | null {
  // Margin-of-error tie band: within 1% → call it a draw and refund stakes.
  if (Math.abs(battle.sideA.pct - battle.sideB.pct) <= 1) return null;
  return battle.sideA.pct > battle.sideB.pct ? "A" : "B";
}

export function useBattleResolver() {
  useEffect(() => {
    // Make sure the crypto-sim is running globally so the resolver always has
    // up-to-date battle state to read winning odds from. start() is idempotent.
    useCryptoSim.getState().start();

    const tick = setInterval(() => {
      const now = Date.now();
      const entries = useMyEntries.getState().entries;
      const openExpired = entries.filter(e => e.status === "open" && e.endsAt <= now);
      if (openExpired.length === 0) return;
      const battles = useCryptoSim.getState().battles;

      for (const entry of openExpired) {
        const battle = battles.find(b => b.id === entry.battleId);
        const winningSide: "A" | "B" | null = battle ? decideWinner(battle) : null;

        const settled = useMyEntries.getState().resolveEntry(entry.battleId, winningSide);
        if (!settled || !settled.result) continue;

        // Credit FINI$ if there's a payout (winners get 2× stake, void/draw refunds 1×)
        if (settled.result.payout > 0) {
          useCoinStore.getState().earn(settled.result.payout);
        }

        // Toast
        const pushNotif = useNotifications.getState().push;
        if (settled.status === "won") {
          pushNotif({
            tone: "win",
            icon: "🎉",
            title: `You won ${settled.result.payout.toLocaleString()} FINI$!`,
            body: `${entry.battleTitle} — ${entry.sideLabel} carried the day. Net +${settled.result.netProfit.toLocaleString()} FINI$.`,
            href: `/battle/${entry.battleId}`,
            durationMs: 12_000,  // wins are loud — keep on screen longer
          });
        } else if (settled.status === "lost") {
          pushNotif({
            tone: "loss",
            icon: "💀",
            title: `Lost ${entry.stake} FINI$`,
            body: `${entry.battleTitle} — ${entry.sideLabel} didn't carry. Tough break, run it back.`,
            href: `/battle/${entry.battleId}`,
            durationMs: 8_000,
          });
        } else if (settled.status === "voided") {
          pushNotif({
            tone: "info",
            icon: "↩️",
            title: `Battle voided — ${entry.stake} FINI$ refunded`,
            body: `${entry.battleTitle} — too close to call, stake back in your bankroll.`,
            href: `/battle/${entry.battleId}`,
            durationMs: 8_000,
          });
        }
      }

      // Garbage-collect settled entries older than 5 minutes so the My Active
      // Battles list eventually trims itself.
      useMyEntries.getState().pruneSettled(5 * 60 * 1000);
    }, 2000);

    return () => clearInterval(tick);
  }, []);
}
