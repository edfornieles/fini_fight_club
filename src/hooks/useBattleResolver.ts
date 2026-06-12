/**
 * useBattleResolver — drives Crypto Arena entry settlement.
 *
 * Runs a 2-second tick that checks every open MyEntry against the current
 * sim state. When an entry's timer has expired:
 *   1. Look up the corresponding battle in the sim
 *   2. Determine the winning side from current odds (live-price-driven for
 *      Up/Down + Outperform, seed-driven for others)
 *   3. Call useMyEntries.resolveEntry → marks the entry settled
 *   4. Credit the player's CUTE$ via useCoinStore.earn (winners + voids only)
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
import { useStrategies } from "../state/strategiesStore";
import { intraWindowReturn, openingFor } from "../lib/openingPrices";
import { getCachedPrices } from "../lib/priceProviders";
import { isOnline } from "../lib/supabase";
import { fetchMyPredictions, fetchBattleResults } from "../data/arenaServer";

interface BattleForResolve {
  id: string;
  type: string;
  assets: string[];
  sideA: { pct: number };
  sideB: { pct: number };
}

interface ResolveOutcome {
  winningSide: "A" | "B" | null;
  /** Per-asset price snapshot for the notification — opening, close, % move. */
  audit: { sym: string; opening: number | null; close: number | null; movePct: number | null }[];
}

/**
 * Returns the winning side AND the underlying price audit for a settled battle.
 *
 * Up/Down  : compares current price to the snapped opening price. Side A (Up)
 *            wins iff close > opening. No more guessing — if BTC actually
 *            moved up, Up wins. If we don't have an opening snapshot, falls
 *            back to the sim's final odds majority.
 *
 * Outperform: picks whichever asset had the bigger % return over the window.
 *
 * Others   : falls back to sim % majority.
 *
 * Tie band  ±0.05% on Up/Down → call it a draw and refund.
 */
function resolveBattle(battle: BattleForResolve): ResolveOutcome {
  const audit: ResolveOutcome["audit"] = [];

  if (battle.type === "updown" && battle.assets.length === 1) {
    const sym = battle.assets[0];
    const opening = openingFor(battle.id, sym);
    const close = getCachedPrices()?.[sym]?.usd ?? null;
    const movePct = opening != null && close != null && opening > 0
      ? ((close - opening) / opening) * 100
      : null;
    audit.push({ sym, opening, close, movePct });

    if (movePct != null) {
      // The question is "Will it close HIGHER than open?" — so Up (A) wins iff
      // close > open; anything else (down OR exactly flat) is Down (B). No tie
      // band: a real price almost never lands on the exact cent, and if it does,
      // "not higher" = Down by the literal question. Never void on real data.
      return { winningSide: close! > opening! ? "A" : "B", audit };
    }
    // No price data at all — fall through to sim-majority below
  }

  if (battle.type === "outperform" && battle.assets.length === 2) {
    const aSym = battle.assets[0], bSym = battle.assets[1];
    const aRet = intraWindowReturn(battle.id, aSym);
    const bRet = intraWindowReturn(battle.id, bSym);
    const prices = getCachedPrices();
    audit.push({ sym: aSym, opening: openingFor(battle.id, aSym), close: prices?.[aSym]?.usd ?? null, movePct: aRet != null ? aRet * 100 : null });
    audit.push({ sym: bSym, opening: openingFor(battle.id, bSym), close: prices?.[bSym]?.usd ?? null, movePct: bRet != null ? bRet * 100 : null });
    if (aRet != null && bRet != null) {
      // Whichever asset returned more wins. Exact equality is essentially
      // impossible with real returns, but if it happens, break the tie
      // deterministically (asset A by convention) rather than voiding.
      return { winningSide: aRet >= bRet ? "A" : "B", audit };
    }
  }

  // Fallback: sim's % majority. Used for clanwar / abovebelow / volatility /
  // and price battles where we genuinely never got opening prices.
  // Deterministic tiebreak (A) on an exact 50/50 — only void if there's truly
  // no signal at all (shouldn't happen).
  if (battle.sideA.pct === battle.sideB.pct) return { winningSide: "A", audit };
  return { winningSide: battle.sideA.pct > battle.sideB.pct ? "A" : "B", audit };
}

export function useBattleResolver() {
  useEffect(() => {
    // Boot the arena store (server-mirror when online, sim offline). Idempotent.
    useCryptoSim.getState().start();

    // ── Online: settle from SERVER truth ─────────────────────────────────────
    // Manual bets settle from the player's own server prediction (pari-mutuel
    // payout). Strategy (Automated Attack) entries keep their segregated local
    // budget but resolve on the real battle winning side, not a cached-price
    // guess. Balance is always refreshed from the server (authoritative).
    if (isOnline) {
      let stopped = false;
      async function settleOnline() {
        const w = useMyEntries.getState().activeWallet;
        const entries = useMyEntries.getState().entries;
        const due = entries.filter(e => e.status === "open" && e.endsAt <= Date.now() + 2000);
        if (due.length === 0) return;
        const pushNotif = useNotifications.getState().push;
        const manual = due.filter(e => !e.strategyId);
        const strat = due.filter(e => e.strategyId);

        // Manual bets → player's server prediction status + payout.
        if (manual.length && w) {
          try {
            const preds = await fetchMyPredictions(w, manual.map(e => e.battleId));
            let settledAny = false;
            for (const e of manual) {
              const sp = preds.get(e.battleId);
              if (!sp || (sp.status !== "resolved" && sp.status !== "voided")) continue;
              const settled = useMyEntries.getState().settleServer(e.battleId, sp.status, Number(sp.payout ?? 0));
              if (!settled || !settled.result) continue;
              settledAny = true;
              if (settled.status === "won") {
                pushNotif({ tone: "win", icon: "🎉", title: `You won ${settled.result.payout.toLocaleString()} CUTE$!`, body: `${e.battleTitle} — ${e.sideLabel} carried the day. Net +${settled.result.netProfit.toLocaleString()} CUTE$.`, href: `/battle/${e.battleId}`, durationMs: 12_000 });
              } else if (settled.status === "lost") {
                pushNotif({ tone: "loss", icon: "💀", title: `Lost ${e.stake} CUTE$`, body: `${e.battleTitle} — ${e.sideLabel} didn't carry. Tough break.`, href: `/battle/${e.battleId}`, durationMs: 8_000 });
              } else if (settled.status === "voided") {
                pushNotif({ tone: "info", icon: "↩️", title: `Battle voided — ${e.stake} CUTE$ refunded`, body: `${e.battleTitle} — too close to call, stake returned.`, href: `/battle/${e.battleId}`, durationMs: 8_000 });
              }
            }
            if (settledAny) void useCoinStore.getState().refresh(w);
          } catch { /* retry next tick */ }
        }

        // Strategy entries → real battle outcome, settled into the strategy budget.
        if (strat.length) {
          try {
            const results = await fetchBattleResults(strat.map(e => e.battleId));
            for (const e of strat) {
              const r = results.get(e.battleId);
              if (!r || !r.settled) continue;
              const settled = useMyEntries.getState().resolveEntry(e.battleId, r.winningSide);
              if (!settled || !settled.result) continue;
              const kind = settled.status === "won" ? "win" : settled.status === "lost" ? "loss" : "voided";
              useStrategies.getState().recordOutcome(e.strategyId!, kind, e.stake, settled.result.payout);
            }
          } catch { /* retry next tick */ }
        }

        useMyEntries.getState().pruneSettled(5 * 60 * 1000);
      }
      void settleOnline();
      const t = setInterval(() => { if (!stopped) void settleOnline(); }, 3000);
      return () => { stopped = true; clearInterval(t); };
    }

    // ── Offline / dev fallback: settle locally against cached prices ──────────
    function check() {
      const now = Date.now();
      const entries = useMyEntries.getState().entries;
      const openExpired = entries.filter(e => e.status === "open" && e.endsAt <= now);
      if (openExpired.length === 0) return;
      const battles = useCryptoSim.getState().battles;

      for (const entry of openExpired) {
        const battle = battles.find(b => b.id === entry.battleId);
        const resolution = battle
          ? resolveBattle(battle)
          : { winningSide: null as "A" | "B" | null, audit: [] };
        const { winningSide, audit } = resolution;

        const settled = useMyEntries.getState().resolveEntry(entry.battleId, winningSide);
        if (!settled || !settled.result) continue;

        // Format a humble "price move" string for the toast body
        const auditLine = audit
          .filter(a => a.movePct != null && a.close != null)
          .map(a => {
            const arrow = (a.movePct ?? 0) >= 0 ? "▲" : "▼";
            const sign = (a.movePct ?? 0) >= 0 ? "+" : "";
            const closeFmt = (a.close ?? 0) >= 1
              ? `$${(a.close ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
              : `$${(a.close ?? 0).toFixed(4)}`;
            return `${a.sym} closed ${closeFmt} ${arrow} ${sign}${(a.movePct ?? 0).toFixed(2)}%`;
          })
          .join(" · ");

        // Route the payout based on where the forecast came from:
        //  - Strategy-placed: the strategy debited its own budget when the
        //    forecast was placed, so the payout flows back to the strategy
        //    (compound or save). NOT to the wallet.
        //  - Player-placed: wallet gets the payout directly.
        if (entry.strategyId) {
          const outcomeKind = settled.status === "won" ? "win" : settled.status === "lost" ? "loss" : "voided";
          useStrategies.getState().recordOutcome(
            entry.strategyId,
            outcomeKind,
            entry.stake,
            settled.result.payout,
          );
        } else if (settled.result.payout > 0) {
          useCoinStore.getState().earn(settled.result.payout);
        }

        // Toast (only for manually-placed entries — automated strategies are
        // background noise, surfacing every one would be too loud)
        if (entry.strategyId) continue;
        const pushNotif = useNotifications.getState().push;
        if (settled.status === "won") {
          pushNotif({
            tone: "win",
            icon: "🎉",
            title: `You won ${settled.result.payout.toLocaleString()} CUTE$!`,
            body: `${entry.battleTitle} — ${entry.sideLabel} carried the day. Net +${settled.result.netProfit.toLocaleString()} CUTE$.${auditLine ? `\n${auditLine}` : ""}`,
            href: `/battle/${entry.battleId}`,
            durationMs: 12_000,
          });
        } else if (settled.status === "lost") {
          pushNotif({
            tone: "loss",
            icon: "💀",
            title: `Lost ${entry.stake} CUTE$`,
            body: `${entry.battleTitle} — ${entry.sideLabel} didn't carry.${auditLine ? `\n${auditLine}` : " Tough break."}`,
            href: `/battle/${entry.battleId}`,
            durationMs: 8_000,
          });
        } else if (settled.status === "voided") {
          pushNotif({
            tone: "info",
            icon: "↩️",
            title: `Battle voided — ${entry.stake} CUTE$ refunded`,
            body: `${entry.battleTitle} — too close to call, stake back in your bankroll.${auditLine ? `\n${auditLine}` : ""}`,
            href: `/battle/${entry.battleId}`,
            durationMs: 8_000,
          });
        }
      }

      // Garbage-collect settled entries older than 5 minutes so the My Active
      // Battles list eventually trims itself.
      useMyEntries.getState().pruneSettled(5 * 60 * 1000);
    }
    // Run immediately on mount so a battle whose timer hit 0 while the page
    // was loading resolves NOW, not after a delay. Then tick fast (500ms)
    // so the player never sits watching "Awaiting price oracle".
    check();
    const tick = setInterval(check, 500);
    return () => clearInterval(tick);
  }, []);
}
