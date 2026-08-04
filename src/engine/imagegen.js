/**
 * imagegen.js -- builds the picture a bracelet is supposed to show.
 *
 * Both pattern families end up here. An alpha (pixel-grid) bracelet knots this
 * image literally, one knot per pixel. A normal (diagonal-knot) bracelet can
 * only approximate it, because at any knot the only colours available are the
 * two strands that happen to be sitting there -- so for normal patterns this
 * image is a *target*, and the fitter finds the closest thing that can be tied.
 *
 * Everything produces the same shape: an array of rows, each an array of DMC
 * codes, no nulls.
 */

import { paintMotif, MOTIF_BY_ID, motifSize } from './data/motifs.js';
import { renderText, textWidth, GLYPH_HEIGHT } from './data/alphabet.js';

const mod = (a, n) => ((a % n) + n) % n;
const range = (n) => Array.from({ length: n }, (_, i) => i);

export const GEOMETRIES = [
  { id: 'diagonal', label: 'Diagonal stripes', hint: 'the classic candy-stripe slant' },
  { id: 'diagonal-left', label: 'Diagonal stripes (left)', hint: 'slanting the other way' },
  { id: 'chevron', label: 'Chevron', hint: 'V stripes pointing down' },
  { id: 'chevron-up', label: 'Chevron (inverted)', hint: 'V stripes pointing up' },
  { id: 'zigzag', label: 'Zigzag', hint: 'chevrons that reverse and come back' },
  { id: 'diamond', label: 'Diamonds', hint: 'a lattice of diamonds' },
  { id: 'arrowhead', label: 'Arrowheads', hint: 'steep, pointed Vs' },
  { id: 'bands', label: 'Horizontal bands', hint: 'stripes across the wrist' },
  { id: 'vertical', label: 'Vertical stripes', hint: 'stripes along the wrist' },
  { id: 'checker', label: 'Checkerboard', hint: 'alternating squares' },
  { id: 'greek-key', label: 'Greek key / meander', hint: 'the interlocking wave border' },
  { id: 'wave', label: 'Wave', hint: 'a rolling sine wave' },
  { id: 'braid-look', label: 'Woven braid', hint: 'an over-under weave illusion' },
  { id: 'gradient', label: 'Gradient bands', hint: 'colours fading into each other' },
];

export const GEOMETRY_IDS = GEOMETRIES.map((g) => g.id);

/**
 * @param {string} kind
 * @param {number} W width in knots
 * @param {number} H height in knots
 * @param {string[]} colors
 * @param {{scale?:number, thickness?:number}} [opts]
 * @returns {string[][]}
 */
export function geometric(kind, W, H, colors, opts = {}) {
  const C = Math.max(1, colors.length);
  const pick = (k) => colors[mod(Math.floor(k), C)];
  const half = (W - 1) / 2;
  const thick = Math.max(1, Math.round(opts.thickness ?? 1));
  const scale = Math.max(1, Math.round(opts.scale ?? 1));

  const at = {
    diagonal: (r, g) => pick((r - g) / 2 / thick),
    'diagonal-left': (r, g) => pick((r - (W - 1 - g)) / 2 / thick),
    chevron: (r, g) => pick((r - Math.min(g, W - 1 - g)) / 2 / thick),
    'chevron-up': (r, g) => pick((r - (half - Math.min(g, W - 1 - g))) / 2 / thick),
    arrowhead: (r, g) => pick((r - 2 * Math.min(g, W - 1 - g)) / 2 / thick),
    zigzag: (r, g) => {
      const d = Math.min(g, W - 1 - g);
      const k = Math.floor((r - d) / 2 / thick);
      const period = 2 * C;
      const p = mod(k, period);
      return colors[p < C ? p : period - 1 - p];
    },
    diamond: (r, g) => {
      const s = Math.floor(r / 2 / thick);
      const dc = Math.abs(g - half);
      const H1 = half + 1;
      return pick(Math.abs(mod(s + dc, 2 * H1) - H1) / Math.max(1, H1 / C));
    },
    bands: (r) => pick(r / (2 * thick * scale)),
    vertical: (_r, g) => pick(g / thick),
    checker: (r, g) => pick(Math.floor(r / (2 * scale)) + Math.floor(g / scale)),
    'greek-key': (r, g) => (greekKeyMask(r, g, scale) ? colors[0] : colors[C - 1]),
    wave: (r, g) => {
      const y = Math.sin(((g / Math.max(1, W - 1)) * Math.PI * 2 * scale)) * (thick + 1);
      return pick((r / 2 - y) / Math.max(1, thick));
    },
    'braid-look': (r, g) => {
      const cell = 2 * scale;
      const a = Math.floor(g / cell);
      const b = Math.floor(r / (2 * cell));
      return pick((a + b) % 2 === 0 ? a : a + 1);
    },
    gradient: (r) => pick((r / Math.max(1, H)) * C),
  };

  const fn = at[kind] ?? at.diagonal;
  return range(H).map((r) => range(W).map((g) => fn(r, g)));
}

/**
 * The Greek meander, drawn rather than derived. One unit is 8 wide and 7 tall
 * and interlocks with the next unit along.
 */
const GREEK_UNIT = [
  '########',
  '#.......',
  '#.#####.',
  '#.#...#.',
  '#.#.#.#.',
  '#...#.#.',
  '#####.#.',
];
function greekKeyMask(r, g, scale) {
  const uh = GREEK_UNIT.length * scale;
  const uw = GREEK_UNIT[0].length * scale;
  const rr = Math.floor(mod(r, uh) / scale);
  const gg = Math.floor(mod(g, uw) / scale);
  return GREEK_UNIT[rr][gg] === '#';
}

/**
 * Lay a motif out repeatedly down the band.
 * @param {{motif:string, colors:string[], background:string, W:number, H:number,
 *          gapY?:number, stagger?:boolean, columns?:number}} p
 */
export function tileMotif({ motif, colors, background, W, H, gapY = 2, stagger = false, columns = 1 }) {
  const m = typeof motif === 'string' ? MOTIF_BY_ID.get(motif) : motif;
  if (!m) return solid(W, H, background);
  const painted = paintMotif(m, colors);
  const { w: mw, h: mh } = motifSize(m);
  const img = solid(W, H, background);
  const cols = Math.max(1, Math.min(columns, Math.floor(W / mw) || 1));
  const slotW = W / cols;
  const stepY = mh + gapY;
  for (let r0 = 0; r0 < H + mh; r0 += stepY) {
    const band = Math.floor(r0 / stepY);
    for (let c = 0; c < cols; c++) {
      const shift = stagger && band % 2 === 1 ? slotW / 2 : 0;
      const x0 = Math.round(c * slotW + (slotW - mw) / 2 + shift);
      stamp(img, painted, x0, r0, W, H);
    }
  }
  return img;
}

/** Alternate two motifs down the band, e.g. daisy / watermelon / daisy. */
export function tileAlternating({ motifs, background, W, H, gapY = 2 }) {
  const img = solid(W, H, background);
  const prepared = motifs
    .map((entry) => {
      const m = typeof entry.motif === 'string' ? MOTIF_BY_ID.get(entry.motif) : entry.motif;
      return m ? { painted: paintMotif(m, entry.colors), ...motifSize(m) } : null;
    })
    .filter(Boolean);
  if (!prepared.length) return img;
  let y = 0;
  let i = 0;
  while (y < H + 2) {
    const p = prepared[i % prepared.length];
    stamp(img, p.painted, Math.round((W - p.w) / 2), y, W, H);
    y += p.h + gapY;
    i++;
  }
  return img;
}

/** Word running down the band, letters reading along the wrist. */
/**
 * Text down a bracelet.
 *
 * On a real alpha name bracelet the letters stack one above the other and you
 * read the word by holding the band vertically -- there is almost never room
 * to write across a wrist. So stacking is the default, and the side-by-side
 * layout is only used when the whole word genuinely fits the width.
 */
export function textImage({ text, color, background, W, H, spacing = 1, gapY = 3, layout = 'auto' }) {
  const across = textWidth(text, spacing);
  const useAcross = layout === 'across' || (layout === 'auto' && across <= W - 2);

  if (useAcross) {
    const glyphRows = renderText(text, { spacing });
    const tw = glyphRows[0].length;
    const gh = glyphRows.length;
    const painted = glyphRows.map((row) => row.map((on) => (on ? color : null)));
    const img = solid(W, H, background);
    const step = gh + gapY;
    for (let y = 0; y < H + gh; y += step) stamp(img, painted, Math.round((W - tw) / 2), y, W, H);
    return { image: img, layout: 'across', textWidth: tw, glyphHeight: gh, repeatEvery: step };
  }

  const chars = [...text].filter((ch) => ch !== ' ' || true);
  const tiles = chars.map((ch) => {
    const rows = renderText(ch, { spacing: 0 });
    return rows.map((row) => row.map((on) => (on ? color : null)));
  });
  const letterStep = GLYPH_HEIGHT + gapY;
  const wordHeight = tiles.length * letterStep + gapY * 2; // extra breath between repeats
  const img = solid(W, H, background);
  for (let base = 0; base < H + wordHeight; base += wordHeight) {
    tiles.forEach((tile, i) => {
      const tw = tile[0].length;
      stamp(img, tile, Math.round((W - tw) / 2), base + i * letterStep, W, H);
    });
  }
  return { image: img, layout: 'stacked', textWidth: Math.max(...tiles.map((t) => t[0].length)), glyphHeight: GLYPH_HEIGHT, repeatEvery: wordHeight };
}

/**
 * Parse the compact grid a model returns:
 *   pixels: ["..aa..", ".aabb."]   legend: {a:"666", b:"310", ".":"3846"}
 */
export function fromPixels(pixels, legend, fallback) {
  const w = Math.max(...pixels.map((p) => p.length));
  return pixels.map((row) =>
    Array.from(row.padEnd(w, '.'), (ch) => legend[ch] ?? legend['.'] ?? fallback)
  );
}

export function solid(W, H, color) {
  return range(H).map(() => range(W).fill(color));
}

/** Draw `sprite` (may contain nulls for transparency) into `img`. */
export function stamp(img, sprite, x0, y0, W, H) {
  for (let r = 0; r < sprite.length; r++) {
    const y = y0 + r;
    if (y < 0 || y >= H) continue;
    for (let c = 0; c < sprite[r].length; c++) {
      const x = x0 + c;
      if (x < 0 || x >= W) continue;
      const v = sprite[r][c];
      if (v != null) img[y][x] = v;
    }
  }
  return img;
}

/** Repeat/crop an image to an exact height, so it fills the whole band. */
export function fitHeight(img, H) {
  if (!img.length) return img;
  if (img.length === H) return img;
  const out = [];
  for (let r = 0; r < H; r++) out.push(img[r % img.length].slice());
  return out;
}

/** Add symmetric side borders, the way most alpha bracelets are edged. */
export function addBorder(img, color, width = 1) {
  if (width <= 0) return img;
  const edge = Array(width).fill(color);
  return img.map((row) => [...edge, ...row, ...edge]);
}

export function imageColors(img) {
  const s = new Set();
  for (const row of img) for (const c of row) s.add(c);
  return [...s];
}
