// Seeded PRNG (mulberry32) and helper functions for procedural city generation and gameplay.

export function createRandom(seed) {
  let s = seed >>> 0;

  function next() {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t ^ Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(next() * arr.length)];
  }

  function chance(probability) {
    return next() < probability;
  }

  return { next, range, int, pick, chance };
}
