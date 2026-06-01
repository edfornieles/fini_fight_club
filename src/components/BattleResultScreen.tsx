import type { BattleResult, Team } from "../game/types";
import { FiniAvatar, moodFromHp } from "./FiniAvatar";

export function BattleResultScreen(props: {
  result: BattleResult;
  playerTeam: Team;
  opponentTeam: Team;
  onPlayAgain: () => void;
}) {
  const { result, playerTeam, opponentTeam, onPlayAgain } = props;
  const winningTeam = result.winner === "teamA" ? playerTeam : opponentTeam;
  const winnerFinal =
    result.winner === "teamA" ? result.finalTeams.teamA : result.finalTeams.teamB;

  const survivors = winnerFinal.filter((f) => !f.fainted && f.currentHealth > 0);
  const damageTotals = new Map<string, number>();
  for (const r of result.rounds) {
    for (const [id, dmg] of Object.entries(r.damageByFini)) {
      damageTotals.set(id, (damageTotals.get(id) ?? 0) + dmg);
    }
  }
  const allFinis = [...result.finalTeams.teamA, ...result.finalTeams.teamB];
  const bestCharacter = allFinis.find((f) => f.id === result.summary.bestFiniId);
  const topDamageId = result.summary.highestDamageDealerId;
  const topDamage = topDamageId ? allFinis.find((f) => f.id === topDamageId) : undefined;
  const strongestFam = result.summary.strongestMarketFamily;

  return (
    <div className="kcard p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="label-soft mb-1">🏁 Result</div>
          <h2 className="text-2xl font-display font-bold text-ink">
            {winningTeam.name} survives the market! 🎀
          </h2>
          <p className="text-ink/60 text-sm mt-1 font-display font-semibold">
            {result.summary.totalRounds} rounds · winning side {result.winner.toUpperCase()}
          </p>
        </div>
        <button onClick={onPlayAgain} className="kbtn kbtn-grape px-5 py-2.5">
          Play again
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="kcard-soft p-3">
          <div className="label-soft mb-1.5">🔥 Top market family</div>
          <div className="flex items-center gap-2">
            <FiniAvatar family={strongestFam} mood="happy" size={36} wobble />
            <div className="text-sm text-ink/70 font-semibold">
              Family pressure tilted this battle.
            </div>
          </div>
        </div>

        <div className="kcard-soft p-3">
          <div className="label-soft mb-1.5">⭐ Best Fini</div>
          {bestCharacter ? (
            <div className="flex items-center gap-2">
              <FiniAvatar family={bestCharacter.family} mood="happy" size={32} />
              <div>
                <div className="font-display font-bold text-ink">{bestCharacter.name}</div>
                <div className="text-xs text-inkSoft font-display font-semibold">
                  Lv {bestCharacter.level} · ⚔ {bestCharacter.strength}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-inkSoft text-sm font-semibold">No standout.</div>
          )}
        </div>

        <div className="kcard-soft p-3">
          <div className="label-soft mb-1.5">💥 Top damage</div>
          {topDamage ? (
            <div className="flex items-center gap-2">
              <FiniAvatar family={topDamage.family} mood="ok" size={32} />
              <div>
                <div className="font-display font-bold text-ink">{topDamage.name}</div>
                <div className="text-xs text-coral font-display font-semibold">
                  {damageTotals.get(topDamage.id) ?? 0} dmg
                </div>
              </div>
            </div>
          ) : (
            <div className="text-inkSoft text-sm font-semibold">—</div>
          )}
        </div>
      </div>

      <div>
        <div className="label-soft mb-2">💚 Survivors</div>
        {survivors.length === 0 ? (
          <div className="text-inkSoft text-sm italic font-semibold">
            No survivors. Pyrrhic victory. 🥀
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {survivors.map((f) => (
              <div key={f.id} className="kcard-soft px-2.5 py-1.5 flex items-center gap-2">
                <FiniAvatar
                  family={f.family}
                  mood={moodFromHp(f.currentHealth / f.maxHealth)}
                  size={28}
                />
                <div className="text-sm">
                  <div className="font-display font-bold leading-tight text-ink">{f.name}</div>
                  <div className="text-[10px] text-inkSoft font-display font-semibold">
                    {f.currentHealth} / {f.maxHealth} HP
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="label-soft mb-2">✨ XP gained</div>
        {result.xpAwards.length === 0 ? (
          <div className="text-inkSoft text-sm italic font-semibold">No XP awarded.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-1.5">
            {result.xpAwards.map((a) => {
              const f = allFinis.find((x) => x.id === a.finiId);
              if (!f) return null;
              return (
                <div
                  key={a.finiId}
                  className="kcard-soft px-2 py-1.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FiniAvatar family={f.family} mood="happy" size={24} />
                    <div className="text-sm font-display font-semibold text-ink">{f.name}</div>
                  </div>
                  <div className="text-mintDark font-display font-bold text-xs">
                    +{a.amount} XP
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {result.levelUps.length > 0 && (
        <div>
          <div className="label-soft mb-2">🆙 Level ups</div>
          <div className="flex flex-wrap gap-1.5">
            {result.levelUps.map((lu, i) => {
              const f = allFinis.find((x) => x.id === lu.finiId);
              return (
                <div
                  key={i}
                  className="chip bg-mint/20 text-mintDark text-xs !rounded-2xl px-3 py-1.5"
                >
                  {f?.name ?? lu.finiId} {lu.fromLevel}→{lu.toLevel}
                  <span className="text-inkSoft ml-1">
                    (+{lu.statDeltas.strength}⚔ +{lu.statDeltas.maxHealth}❤)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.deathModeResult && (
        <div className="kcard-soft p-3 !bg-coral/10 !border-coral/40">
          <div className="label-soft mb-1 !text-coral">💀 Death Mode complete</div>
          <div className="text-sm text-ink font-semibold">
            Winner: <span className="font-display font-bold">{result.deathModeResult.winnerPlayerId}</span>{" "}
            · Claimed: <span className="font-mono">{result.deathModeResult.wonFiniId}</span>{" "}
            · Lost: <span className="font-mono">{result.deathModeResult.lostFiniId}</span>
          </div>
          <div className="text-[10px] text-inkSoft mt-2 font-semibold">
            Simulated transfer applied to mock ownership ledger only. No on-chain action occurred.
          </div>
        </div>
      )}
    </div>
  );
}
