// Mulberry32 — fast, high-quality 32-bit seeded PRNG
let state = Date.now() | 0;

export function seedRandom(seed) {
  state = seed | 0;
}

export function random() {
  state |= 0;
  state = state + 0x6D2B79F5 | 0;
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

export function randomInt(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
