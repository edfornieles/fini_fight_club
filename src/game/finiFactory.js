/**
 * Cloning utilities. Battle engine never mutates inputs — it works on
 * deep clones so the outer game state can stay stable.
 */
export function cloneFini(fini) {
    return { ...fini };
}
export function cloneTeam(team) {
    return {
        ...team,
        finis: [
            cloneFini(team.finis[0]),
            cloneFini(team.finis[1]),
            cloneFini(team.finis[2]),
        ],
    };
}
/**
 * Reset HP for every Fini. Used before a fresh battle since stats may
 * have been carried over from a previous match.
 */
export function rehydrateTeam(team) {
    const cloned = cloneTeam(team);
    for (const f of cloned.finis) {
        f.currentHealth = f.maxHealth;
        f.fainted = false;
    }
    return cloned;
}
export function isTeamWiped(team) {
    return team.finis.every((f) => f.fainted || f.currentHealth <= 0);
}
export function getActiveFini(team) {
    return team.finis.find((f) => !f.fainted && f.currentHealth > 0);
}
export function getFiniIndex(team, finiId) {
    return team.finis.findIndex((f) => f.id === finiId);
}
export function getFiniById(team, finiId) {
    return team.finis.find((f) => f.id === finiId);
}
