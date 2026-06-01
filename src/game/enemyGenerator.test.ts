import { describe, expect, it } from "vitest";
import { generateEnemyTeam } from "./enemyGenerator";
import { createRng } from "./rng";

describe("enemy generator", () => {
  it("makes a team of 3 with positive HP", () => {
    const t = generateEnemyTeam({
      stage: 2,
      rng: createRng(1),
      packName: "Shiba Pack",
    });
    expect(t.finis).toHaveLength(3);
    for (const f of t.finis) {
      expect(f.maxHealth).toBeGreaterThan(0);
      expect(f.currentHealth).toBe(f.maxHealth);
    }
  });

  it("boss frontline is meaningfully stronger than a plain stage-3 frontline", () => {
    const reg = generateEnemyTeam({ stage: 3, rng: createRng(11) });
    const boss = generateEnemyTeam({
      stage: 3,
      rng: createRng(11),
      isBoss: true,
    });
    expect(boss.finis[0]!.maxHealth).toBeGreaterThan(reg.finis[0]!.maxHealth);
  });

  it("pack name biases family selection", () => {
    const t = generateEnemyTeam({
      stage: 1,
      rng: createRng(99),
      packName: "Shiba Pack",
    });
    // All three should be DOGE due to pack bias.
    expect(t.finis.every((f) => f.family === "DOGE")).toBe(true);
  });
});
