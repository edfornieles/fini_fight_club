import { useMemo, useState } from "react";
import {
  useLeagueStore,
  money,
  computePrizeBreakdown,
  PLAYER_ID,
} from "../state/leagueStore";
import { useGameStore } from "../state/gameStore";
import { LeagueTournament } from "./LeagueTournament";
import { generateEnemyTeam } from "../game/enemyGenerator";
import { createRng } from "../game/rng";
import type { Fini, Team } from "../game/types";
import type { League, LeagueResult, LeagueTier } from "../game/leagues";

const TIER_STYLE: Record<LeagueTier, { chip: string; emoji: string }> = {
  BRONZE: { chip: "bg-amber-200/70 text-amber-900", emoji: "🥉" },
  SILVER: { chip: "bg-slate-200/80 text-slate-700", emoji: "🥈" },
  GOLD: { chip: "bg-lemon/70 text-ink", emoji: "🥇" },
  DIAMOND: { chip: "bg-bubble/25 text-bubbleDark", emoji: "💎" },
};

const STATUS_STYLE: Record<League["status"], string> = {
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
  const team: Team = useMemo(() => {
    if (savedTeam && savedTeam.finis.length >= 3) {
      return {
        id: "you",
        playerId: PLAYER_ID,
        name: "You",
        finis: savedTeam.finis.slice(0, 3) as [Fini, Fini, Fini],
      };
    }
    const t = generateEnemyTeam({
      stage: 2,
      rng: createRng(777),
      packName: "Training Squad",
    });
    return { ...t, id: "you", playerId: PLAYER_ID, name: "Training Squad" };
  }, [savedTeam]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6">
          <div className="w-full max-w-4xl my-4 space-y-3">
            {/* header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-display font-bold text-2xl text-ink drop-shadow-sm">
                🏆 Leagues
              </h2>
              <div className="flex items-center gap-2">
                <span className="lcd px-3 py-1 text-sm" title="Simulated balance (no real funds)">
                  {money(balance)}
                </span>
                <button onClick={topUp} className="kbtn kbtn-ghost px-3 py-1.5 text-xs">
                  + Add {money(100)}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="kbtn kbtn-ghost px-3 py-1.5 text-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* record + fielded team */}
            <div className="kcard p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="chip bg-lemon/40 text-ink">🥇 {record.firsts}</span>
                <span className="chip bg-cloud/70 text-inkSoft">🥈 {record.seconds}</span>
                <span className="chip bg-bubble/15 text-bubbleDark">played {record.played}</span>
                <span className="chip bg-mint/20 text-mintDark">winnings {money(record.earnings)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="label-soft text-[10px]">
                  {usingOwned ? "competing as" : "🐣 training squad"}
                </span>
                {team.finis.map((f) => (
                  <span
                    key={f.id}
                    className={`chip text-[10px] ${
                      usingOwned ? "bg-grape/12 text-grape" : "bg-cloud/70 text-inkSoft"
                    }`}
                  >
                    {f.name} · {f.family}
                  </span>
                ))}
                {!usingOwned && (
                  <span className="chip bg-bubble/15 text-bubbleDark text-[10px]">
                    field your wallet Finis in the Stable to compete as your own
                  </span>
                )}
              </div>
            </div>

            {message && (
              <div className="chip bg-bubble/15 text-bubbleDark w-full justify-center py-1.5 text-[12px]">
                {message}
              </div>
            )}

            {/* league grid */}
            <div className="grid sm:grid-cols-2 gap-3">
              {leagues.map((lg) => (
                <LeagueCard
                  key={lg.config.id}
                  league={lg}
                  pot={potOf(lg.config.id)}
                  entered={isEntered(lg.config.id)}
                  canAfford={balance >= lg.config.buyIn}
                  hasTeam={true}
                  onJoin={() => joinWithTeam(lg.config.id, team)}
                  onRun={() => runAndSettle(lg.config.id)}
                />
              ))}
            </div>

            {/* results */}
            {lastResult && (
              <ResultsPanel
                leagueName={
                  leagues.find((l) => l.config.id === lastResult.leagueId)?.config.name ??
                  "League"
                }
                result={lastResult.result}
              />
            )}

            <div className="flex flex-col items-center gap-1 pt-1">
              <button onClick={refreshOpenLeagues} className="kbtn kbtn-ghost px-4 py-2 text-xs">
                ♻️ Refresh open leagues
              </button>
              <p className="text-[11px] text-inkSoft text-center px-4">
                Simulated money for testing. Each league fills 7 CPU rivals + you into an 8-team
                knockout bracket — Quarterfinals → Semifinals → Final. Watch it play out; the
                champion takes 1st, runner-up 2nd, the house takes 10%.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* The watchable knockout bracket overlays everything once a league runs. */}
      {activeTournament && <LeagueTournament />}
    </>
  );
}

function LeagueCard(props: {
  league: League;
  pot: number;
  entered: boolean;
  canAfford: boolean;
  hasTeam: boolean;
  onJoin: () => void;
  onRun: () => void;
}) {
  const { league, pot, entered, canAfford, hasTeam } = props;
  const cfg = league.config;
  const style = TIER_STYLE[cfg.tier];
  const prize = computePrizeBreakdown(Math.max(pot, cfg.buyIn * cfg.minEntrants), cfg.prize);
  const canRun = entered && league.entries.length >= cfg.minEntrants && league.status === "OPEN";

  return (
    <div className="kcard p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`chip ${style.chip} text-[11px] font-bold`}>
            {style.emoji} {cfg.name}
          </span>
          {entered && <span className="chip bg-mint/25 text-mintDark text-[10px]">✓ entered</span>}
        </div>
        <span className={`chip ${STATUS_STYLE[league.status]} text-[10px]`}>
          {league.status.toLowerCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Cell label="buy-in" value={money(cfg.buyIn)} />
        <Cell label="pot" value={money(pot)} />
        <Cell label="entrants" value={`${league.entries.length}/${cfg.maxEntrants}`} />
      </div>

      <div className="flex items-center justify-between text-[10px] text-inkSoft font-semibold">
        <span>🥇 {money(prize.firstPrize)}</span>
        <span>🥈 {money(prize.secondPrize)}</span>
        <span className="opacity-70">house {money(prize.houseCut)}</span>
      </div>

      {league.status === "SETTLED" ? (
        <div className="chip bg-cloud/60 text-inkSoft w-full justify-center py-1.5 text-[11px]">
          Settled — see results below
        </div>
      ) : entered ? (
        <button
          onClick={props.onRun}
          disabled={!canRun}
          className="kbtn kbtn-primary w-full py-2 text-sm disabled:opacity-50"
        >
          ▶️ Run League ({league.entries.length} in)
        </button>
      ) : (
        <button
          onClick={props.onJoin}
          disabled={!hasTeam || !canAfford}
          className="kbtn kbtn-mint w-full py-2 text-sm disabled:opacity-50"
          title={
            !hasTeam
              ? "Field a team in your Stable first"
              : !canAfford
                ? "Not enough balance — use the faucet"
                : undefined
          }
        >
          {canAfford ? `Join · ${money(cfg.buyIn)}` : "Insufficient balance"}
        </button>
      )}
    </div>
  );
}

function Cell(props: { label: string; value: string }) {
  return (
    <div className="lcd px-1 py-1 leading-tight">
      <div className="text-[8px] text-inkSoft">{props.label}</div>
      <div className="text-xs font-display font-bold text-ink">{props.value}</div>
    </div>
  );
}

function ResultsPanel(props: { leagueName: string; result: LeagueResult }) {
  const { result } = props;
  const medal = (rank: number) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;

  return (
    <div className="kcard p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="label-soft">📊 {props.leagueName} — final table</div>
        <span className="chip bg-grape/15 text-grape text-[10px]">pot {money(result.prize.pool)}</span>
      </div>

      <div className="space-y-1">
        {result.standings.map((s) => {
          const isYou = s.playerId === PLAYER_ID;
          const payout = result.payouts.find((p) => p.playerId === s.playerId);
          return (
            <div
              key={s.playerId}
              className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-[12px] ${
                isYou ? "bg-mint/15 ring-1 ring-mint/50" : "bg-white/50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 text-center font-display font-bold">{medal(s.rank)}</span>
                <span className={`truncate font-semibold ${isYou ? "text-mintDark" : "text-ink"}`}>
                  {isYou ? "You" : s.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-inkSoft">
                  {s.wins}W–{s.losses}L
                </span>
                {payout && (
                  <span className="chip bg-lemon/40 text-ink text-[10px]">+{money(payout.amount)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
