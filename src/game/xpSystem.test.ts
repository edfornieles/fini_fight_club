import { describe, expect, it } from "vitest";
import { applyBattleXPAwards, awardXP, checkLevelUp } from "./xpSystem";
import { mockFinis } from "./mockTeams";

describe("xpSystem", () => {
  it("awards XP additively", () => {
    const before = mockFinis[0]!;
    const after = awardXP(before, 2);
    expect(after.xp).toBe(before.xp + 2);
  });

  it("levels up and increases stats", () => {
    const base = { ...mockFinis[0]!, xp: 3, level: 1 };
    const { fini, records } = checkLevelUp(base);
    expect(records.length).toBe(1);
    expect(fini.level).toBe(2);
    expect(fini.strength).toBe(base.strength + 1);
    expect(fini.maxHealth).toBe(base.maxHealth + 2);
    expect(fini.currentHealth).toBe(fini.maxHealth);
  });

  it("can chain multiple level ups", () => {
    const base = { ...mockFinis[0]!, xp: 100, level: 1 };
    const { fini, records } = checkLevelUp(base);
    expect(records.length).toBeGreaterThan(1);
    expect(fini.level).toBeGreaterThan(2);
  });

  it("applyBattleXPAwards updates roster and emits level ups", () => {
    const roster = mockFinis.slice(0, 3).map((f) => ({ ...f }));
    const awards = [
      { finiId: roster[0]!.id, amount: 4, reasons: [] },
      { finiId: roster[1]!.id, amount: 1, reasons: [] },
    ];
    const { finis, levelUps } = applyBattleXPAwards({ awards, finis: roster });
    expect(finis[0]!.level).toBeGreaterThanOrEqual(2);
    expect(levelUps.find((l) => l.finiId === finis[0]!.id)).toBeTruthy();
    expect(finis[1]!.xp).toBe(1);
  });
});
