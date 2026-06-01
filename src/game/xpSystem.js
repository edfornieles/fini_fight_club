export const XP_TO_LEVEL = {
    1: 3,
    2: 6,
    3: 10,
    4: 15,
};
function xpToNext(level) {
    // Past the table we extrapolate linearly so Finis don't stall.
    return XP_TO_LEVEL[level] ?? Math.round(15 + (level - 4) * 6);
}
export function awardXP(fini, amount) {
    if (amount <= 0)
        return fini;
    return { ...fini, xp: fini.xp + amount };
}
/**
 * Greedily consume xp into level ups. Returns a possibly-leveled Fini
 * plus a list of LevelUpRecords describing the deltas.
 *
 * At level up:
 *   strength += 1
 *   maxHealth += 2
 *   currentHealth = maxHealth (heal to full)
 */
export function checkLevelUp(fini) {
    let cur = { ...fini };
    const records = [];
    while (cur.xp >= xpToNext(cur.level)) {
        const cost = xpToNext(cur.level);
        const fromLevel = cur.level;
        cur = {
            ...cur,
            xp: cur.xp - cost,
            level: cur.level + 1,
            strength: cur.strength + 1,
            maxHealth: cur.maxHealth + 2,
            currentHealth: cur.maxHealth + 2,
        };
        records.push({
            finiId: cur.id,
            fromLevel,
            toLevel: cur.level,
            statDeltas: { strength: 1, maxHealth: 2 },
        });
    }
    return { fini: cur, records };
}
/**
 * Compute XP awards from a finished battle.
 *
 * Base rules:
 *  - Every participating Fini gains base XP (1).
 *  - Winning team members gain +2.
 *  - Surviving members gain +1.
 *  - Highest damage dealer gains +1.
 *  - Death Mode winner staked Fini gains +1 (badge feel, not OP).
 */
export function computeXPAwards(args) {
    const { result, teamA, teamB } = args;
    const awardMap = new Map();
    const ensure = (id) => {
        if (!awardMap.has(id)) {
            awardMap.set(id, { finiId: id, amount: 0, reasons: [] });
        }
        return awardMap.get(id);
    };
    const bump = (id, amount, reason) => {
        const a = ensure(id);
        a.amount += amount;
        a.reasons.push(reason);
    };
    for (const f of [...teamA.finis, ...teamB.finis]) {
        bump(f.id, 1, "Participated");
    }
    const winningTeam = result.winner === "teamA" ? teamA : teamB;
    for (const f of winningTeam.finis) {
        bump(f.id, 2, "On winning team");
    }
    const finalWinningTeamFinis = result.winner === "teamA" ? result.finalTeams.teamA : result.finalTeams.teamB;
    for (const f of finalWinningTeamFinis) {
        if (!f.fainted && f.currentHealth > 0) {
            bump(f.id, 1, "Survived");
        }
    }
    if (result.summary.highestDamageDealerId) {
        bump(result.summary.highestDamageDealerId, 1, "Top damage dealer");
    }
    if (result.deathModeResult) {
        bump(result.deathModeResult.wonFiniId, 1, "Death Mode victor");
    }
    return Array.from(awardMap.values());
}
/**
 * Apply XP awards to teams and return updated Finis + level-up records.
 *
 * NOTE: This is meant to be called by the outer game store / persistence
 * layer AFTER a battle finishes. The pure battle engine never mutates
 * the player's persistent roster.
 */
export function applyBattleXPAwards(args) {
    const byId = new Map(args.finis.map((f) => [f.id, f]));
    const levelUps = [];
    for (const award of args.awards) {
        const base = byId.get(award.finiId);
        if (!base)
            continue;
        const awarded = awardXP(base, award.amount);
        const { fini, records } = checkLevelUp(awarded);
        byId.set(award.finiId, fini);
        levelUps.push(...records);
    }
    return { finis: Array.from(byId.values()), levelUps };
}
