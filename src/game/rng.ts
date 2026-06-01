/**
 * Deterministic-ish RNG. We use a Mulberry32 PRNG so battles with the
 * same seed reproduce exactly. Without a seed we fall back to Math.random.
 *
 * Pure logic, no React deps.
 */

export type RNG = {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
};

export function createRng(seed?: number): RNG {
  if (seed === undefined) {
    return {
      next: () => Math.random(),
      range: (a, b) => a + Math.random() * (b - a),
      int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
      chance: (p) => Math.random() < p,
      pick: <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]!,
    };
  }
  let s = (seed | 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)]!,
  };
}
