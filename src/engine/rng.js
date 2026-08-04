// Deterministic, seedable RNG. Same seed => same numbers, in any JS engine.

/** xmur3 string hash -> 32-bit seed generator */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a RNG object from any seed value (string or number). */
export function makeRng(seed) {
  const seedStr = String(seed);
  const next = hashSeed(seedStr);
  const rand = mulberry32(next());
  return {
    seed: seedStr,
    /** float in [0,1) */
    next: rand,
    /** integer in [min,max] inclusive */
    int(min, max) {
      return min + Math.floor(rand() * (max - min + 1));
    },
    /** pick one element */
    pick(arr) {
      return arr[Math.floor(rand() * arr.length)];
    },
    /** pick n distinct elements (or fewer if arr is short) */
    sample(arr, n) {
      const copy = arr.slice();
      const out = [];
      while (out.length < n && copy.length) {
        out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
      }
      return out;
    },
    bool(p = 0.5) {
      return rand() < p;
    },
  };
}

/** Short, URL-safe, human-typeable random seed. */
export function newSeed() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}
