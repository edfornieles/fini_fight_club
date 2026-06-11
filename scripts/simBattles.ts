/**
 * Monte-Carlo fairness audit of the Fight Club turn engine.
 * Replicates BattleView.runTurn exactly (damage formula, turn order, crit,
 * role triangle, random targeting) and measures win rates across scenarios.
 *
 * Run: npx vite-node scripts/simBattles.ts
 */
import { synthFini, ghostTeamPower, type GhostFini } from "../src/game/ghostOpponents";
import { familyDamageMultiplier } from "../src/game/familyRoles";
import { readFileSync } from "node:fs";

type F = Pick<GhostFini, "id" | "family" | "maxHp" | "atk" | "def" | "speed">;

const power = (t: F[]) => t.reduce((s, f) => s + f.maxHp + f.atk * 3 + f.def * 2 + f.speed * 2, 0);

function fight(team: F[], opp: F[], coinFlip = false): "you" | "them" | "draw" {
  const th = team.map(f => f.maxHp);
  const oh = opp.map(f => f.maxHp);
  let turn = 0;
  const youFirst = coinFlip ? Math.random() < 0.5 : true;
  for (let guard = 0; guard < 600; guard++) {
    const teamAlive = th.some(h => h > 0);
    const oppAlive = oh.some(h => h > 0);
    if (!teamAlive || !oppAlive) {
      return teamAlive && !oppAlive ? "you" : oppAlive && !teamAlive ? "them" : "draw";
    }
    const youAttack = (turn % 2 === 0) === youFirst;
    const atkArr = youAttack ? team : opp;
    const defArr = youAttack ? opp : team;
    const atkHp = youAttack ? th : oh;
    const defHp = youAttack ? oh : th;
    const aliveA = atkArr.map((f, i) => ({ f, i })).filter(x => atkHp[x.i] > 0);
    const aliveD = defArr.map((f, i) => ({ f, i })).filter(x => defHp[x.i] > 0);
    if (!aliveA.length || !aliveD.length) { turn++; continue; }
    const atk = aliveA[turn % aliveA.length];
    const def = aliveD[Math.floor(Math.random() * aliveD.length)];
    const variance = Math.floor(Math.random() * 5) - 2;
    const base = atk.f.atk - Math.floor(def.f.def / 2);
    const crit = Math.random() < (atk.f.speed > def.f.speed ? 0.18 : 0.08);
    const roleMult = familyDamageMultiplier(atk.f.family, def.f.family);
    let dmg = Math.max(1, Math.round((base + variance) * roleMult));
    if (crit) dmg = Math.round(dmg * 1.5);
    defHp[def.i] = Math.max(0, defHp[def.i] - dmg);
    turn++;
  }
  return "draw";
}

function winRate(team: F[], oppPick: () => F[], n = 4000) {
  let w = 0, l = 0, d = 0;
  for (let i = 0; i < n; i++) {
    const r = fight(team, oppPick());
    if (r === "you") w++; else if (r === "them") l++; else d++;
  }
  return { winPct: ((w / n) * 100).toFixed(1), lossPct: ((l / n) * 100).toFixed(1), drawPct: ((d / n) * 100).toFixed(1) };
}

// Ghost pool from the real snapshot
const file = JSON.parse(readFileSync("public/data/ghostTeams.json", "utf8")) as { teams: { wallet: string; tokenIds: number[] }[] };
const pool = file.teams.filter(t => t.tokenIds.length >= 3);

function scaledGhost(targetPower: number): F[] {
  const t = pool[Math.floor(Math.random() * pool.length)];
  const ids = t.tokenIds.slice(0, 3);
  const p = ghostTeamPower(ids);
  const scale = Math.max(0.5, targetPower / 3 / (p / 3));
  return ids.map(id => synthFini(id, scale));
}

// Scenario 1: random ghost trio vs power-matched random ghost trio (engine fairness)
{
  const sample = scaledGhost(500);
  console.log("S1 — random vs power-matched random (first-mover advantage):");
  let agg = { w: 0, l: 0, d: 0 };
  for (let k = 0; k < 40; k++) {
    const team = scaledGhost(500);
    const tp = power(team);
    for (let i = 0; i < 100; i++) {
      const r = fight(team, scaledGhost(tp));
      if (r === "you") agg.w++; else if (r === "them") agg.l++; else agg.d++;
    }
  }
  const n = agg.w + agg.l + agg.d;
  console.log(`  win ${(agg.w / n * 100).toFixed(1)}% / loss ${(agg.l / n * 100).toFixed(1)}% / draw ${(agg.d / n * 100).toFixed(1)}%`);
  void sample;
}

// Scenario 2: the user's all-BTC (all-Tank) trio vs power-matched ghosts
{
  const team = [102, 1390, 2202].map(id => synthFini(id));
  const tp = power(team);
  console.log(`S2 — all-BTC trio #102/#1390/#2202 (power ${tp}) vs power-matched ghosts:`);
  console.log(" ", winRate(team, () => scaledGhost(tp)));
}

// Scenario 3: same trio but boosted ~15% (levels/items) vs power-matched ghosts
// (matchmaker matches the boosted power — tests whether scaling keeps it fair)
{
  const team = [102, 1390, 2202].map(id => synthFini(id, 1.15));
  const tp = power(team);
  console.log(`S3 — boosted all-BTC trio (power ${tp}) vs power-matched ghosts:`);
  console.log(" ", winRate(team, () => scaledGhost(tp)));
}

// Scenario 4: coin-flip initiative — the fix. Expect ~50/50.
{
  let agg = { w: 0, l: 0, d: 0 };
  for (let k = 0; k < 40; k++) {
    const team = scaledGhost(500);
    const tp = power(team);
    for (let i = 0; i < 100; i++) {
      const r = fight(team, scaledGhost(tp), true);
      if (r === "you") agg.w++; else if (r === "them") agg.l++; else agg.d++;
    }
  }
  const n = agg.w + agg.l + agg.d;
  console.log(`S4 — coin-flip initiative: win ${(agg.w / n * 100).toFixed(1)}% / loss ${(agg.l / n * 100).toFixed(1)}%`);
}

// Scenario 6: mirror match + coin flip — engine sanity check, must be ~50%.
{
  let agg = { w: 0, l: 0 };
  for (let i = 0; i < 4000; i++) {
    const team = scaledGhost(500);
    const r = fight(team, team.map(f => ({ ...f })), true);
    if (r === "you") agg.w++; else if (r === "them") agg.l++;
  }
  console.log(`S6 — mirror + coin flip: win ${(agg.w / 4000 * 100).toFixed(1)}%`);
}

// Scenario 7: corrected ghost scaling (speed-aware) + coin flip — target ~50%.
function scaledGhostFixed(targetPower: number): F[] {
  const t = pool[Math.floor(Math.random() * pool.length)];
  const ids = t.tokenIds.slice(0, 3);
  const base = ids.map(id => synthFini(id));
  const speedTerm = base.reduce((s, f) => s + f.speed * 2, 0);
  const scalable = base.reduce((s, f) => s + f.maxHp + f.atk * 3 + f.def * 2, 0);
  const r = Math.max(0.5, (targetPower - speedTerm) / scalable);
  return ids.map(id => synthFini(id, r));
}
{
  let agg = { w: 0, l: 0 };
  for (let k = 0; k < 40; k++) {
    const team = scaledGhostFixed(500);
    const tp = power(team);
    for (let i = 0; i < 100; i++) {
      const r = fight(team, scaledGhostFixed(tp), true);
      if (r === "you") agg.w++; else if (r === "them") agg.l++;
    }
  }
  const n = agg.w + agg.l;
  console.log(`S7 — speed-aware scaling + coin flip: win ${(agg.w / n * 100).toFixed(1)}%`);
}

// Scenario 5: user's trio with coin-flip initiative
{
  const team = [102, 1390, 2202].map(id => synthFini(id));
  const tp = power(team);
  let agg = { w: 0, l: 0 };
  for (let i = 0; i < 4000; i++) {
    const r = fight(team, scaledGhost(tp), true);
    if (r === "you") agg.w++; else if (r === "them") agg.l++;
  }
  console.log(`S5 — all-BTC trio, coin-flip initiative: win ${(agg.w / 4000 * 100).toFixed(1)}%`);
}
