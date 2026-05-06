// web/src/lib/biome/rng.ts

export type Rng = {
  next(): number;
  int(min: number, max: number): number;
  bool(p: number): boolean;
  pick<T>(items: readonly T[]): T;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    bool(p: number): boolean {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick from empty array');
      return items[Math.floor(next() * items.length)]!;
    },
  };
}
