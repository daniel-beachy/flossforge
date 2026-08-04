/**
 * styles/alpha.js -- "alpha" patterns: the pixel-grid family that carries words
 * and pictures. One knot is exactly one pixel.
 *
 * CONSTRUCTION (per friendship-bracelets.net tutorials #2 and #152)
 *
 * A long WEFT strand travels back and forth across a set of vertical BASE
 * strands -- one base strand per pixel column -- tying one knot on each.
 *
 *   weft pixel   -> the weft is the worker, so the weft's colour shows
 *   design pixel -> that column's base strand is the worker instead
 *                   (the "downward knot")
 *
 * In the four-knot model, with row 1 travelling left to right:
 *
 *              weft pixel     design pixel
 *   row -->        F               B
 *   row <--        B               F
 *
 * Both knots swap the pair, which is exactly how the weft walks one column
 * further along while the base strands hold their columns.
 *
 * THE CONSTRAINT THAT MATTERS: a base strand is one colour for its whole
 * length, so a column can only ever show its own colour or a weft colour. A
 * picture wanting column 5 red near the top and green near the bottom is not
 * tie-able from one set of strands.
 *
 * THE ESCAPE HATCH, and it is a real technique rather than an invention:
 * tutorial #152 ("string substitution during tying") keeps several weft
 * strands alive at once, letting the unused ones float across the back of the
 * work and bringing them forward when their colour is next needed. That is
 * structurally identical to carrying floats in Fair Isle knitting. So the true
 * rule is:
 *
 *   pixel(r, c) is tie-able  <=>  colour is base[c] OR any active weft colour
 *
 * planAlpha() below chooses the base colours and the weft set to satisfy as
 * much of the requested picture as possible, then repairs whatever is left
 * over to the nearest achievable colour and reports the fidelity honestly.
 */

import { applyKnot } from '../knots.js';
import { hexOf, hexToLab, labDistance } from '../palette.js';

/** Knot type for one pixel. `weftKnot` means the weft strand is the worker. */
export function alphaKnot(weftKnot, goingRight) {
  if (goingRight) return weftKnot ? 'F' : 'B';
  return weftKnot ? 'B' : 'F';
}

/**
 * Edge anchors. A knot that does not swap leaves the weft where it is, so it
 * locks the turn instead of sliding past the edge -- the "clean edge" the
 * tutorials recommend. Ending a rightward row and starting the leftward row
 * both take an FB at the right edge; the left edge takes BF.
 */
export function edgeAnchor(atRightEdge) {
  return atRightEdge ? 'FB' : 'BF';
}

const MAX_EXTRA_WEFTS = 2;

/**
 * Work out a tie-able set of strands for a requested picture.
 *
 * @param {string[][]} image rows of DMC codes, top row tied first
 * @param {string} background the colour the maker asked to be the main weft
 * @param {{maxExtraWefts?:number}} [opts]
 */
export function planAlpha(image, background, opts = {}) {
  const maxExtra = opts.maxExtraWefts ?? MAX_EXTRA_WEFTS;
  const H = image.length;
  const W = H ? image[0].length : 0;
  const out = image.map((r) => r.slice());
  if (!H || !W) {
    return { image: out, background, wefts: [background], base: [], repairs: [], fidelity: 1, weftUse: [], carries: 0, width: W, height: H };
  }

  const wefts = [background];

  // Grow the weft set greedily: assign each column the base colour that covers
  // the most of it, then adopt whichever leftover colour is costing the most.
  let base = chooseBase(out, wefts, W, H);
  for (let round = 0; round < maxExtra; round++) {
    const leftover = new Map();
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const v = out[r][c];
        if (v === base[c] || wefts.includes(v)) continue;
        leftover.set(v, (leftover.get(v) ?? 0) + 1);
      }
    }
    if (!leftover.size) break;
    const best = [...leftover.entries()].sort((a, b) => b[1] - a[1])[0];
    // Not worth a whole extra strand for a handful of knots.
    if (best[1] < 6) break;
    wefts.push(best[0]);
    base = chooseBase(out, wefts, W, H);
  }

  // Repair anything still un-tie-able to the closest colour we do have.
  const repairs = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const v = out[r][c];
      if (v === base[c] || wefts.includes(v)) continue;
      const to = nearestOf(v, [base[c], ...wefts]);
      repairs.push({ row: r, col: c, from: v, to });
      out[r][c] = to;
    }
  }

  const { weftUse, carries } = weftSchedule(out, base, wefts);

  return {
    image: out,
    background,
    wefts,
    base,
    repairs,
    fidelity: 1 - repairs.length / (H * W),
    weftUse,
    carries,
    width: W,
    height: H,
  };
}

/** For each column, the non-weft colour that covers the most of that column. */
function chooseBase(image, wefts, W, H) {
  const base = [];
  for (let c = 0; c < W; c++) {
    const tally = new Map();
    for (let r = 0; r < H; r++) {
      const v = image[r][c];
      if (wefts.includes(v)) continue;
      tally.set(v, (tally.get(v) ?? 0) + 1);
    }
    if (!tally.size) { base.push(null); continue; }
    base.push([...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  // A column that never shows a design pixel still needs a strand in it. Reuse
  // a neighbour's colour so the shopping list stays short.
  for (let c = 0; c < W; c++) {
    if (base[c]) continue;
    let pick = null;
    for (let d = 1; d < W && !pick; d++) pick = base[c - d] ?? base[c + d] ?? null;
    base[c] = pick ?? wefts[0];
  }
  return base;
}

function nearestOf(code, options) {
  const target = hexToLab(hexOf(code));
  let best = options[0];
  let bestD = Infinity;
  for (const o of options) {
    if (!o) continue;
    const d = labDistance(target, hexToLab(hexOf(o)));
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

/**
 * Which weft is doing the work where. Every knot is made by either a weft or
 * the column's base strand; a weft that is not the one currently in hand has
 * to be picked up, and the one it replaces put aside behind the work.
 */
function weftSchedule(image, base, wefts) {
  const H = image.length;
  const W = H ? image[0].length : 0;
  const weftUse = [];
  let carries = 0;
  let inHand = wefts[0];

  for (let r = 0; r < H; r++) {
    const goingRight = r % 2 === 0;
    const cols = goingRight ? range(W) : range(W).reverse();
    const segments = [];
    for (const c of cols) {
      const v = image[r][c];
      // Prefer a base knot when the column's own colour is what we want: it
      // needs no strand juggling at all.
      const owner = v === base[c] ? null : v;
      const last = segments[segments.length - 1];
      if (last && last.color === owner) { last.count++; last.to = c; continue; }
      segments.push({ color: owner, count: 1, from: c, to: c });
    }
    for (const s of segments) {
      if (s.color == null) continue;
      if (s.color !== inHand) { carries++; inHand = s.color; }
    }
    weftUse.push({ row: r, goingRight, segments });
  }
  return { weftUse, carries };
}

/**
 * Tie the whole thing knot by knot and check every pixel came out right.
 *
 * Unlike a normal pattern, alpha knots inside a row are strictly sequential --
 * the weft has to reach a column before it can knot there -- so the generic
 * row simulator in knots.js does not apply.
 */
export function simulateAlpha(plan) {
  const { image, base, wefts, width: W, height: H } = plan;
  const primary = wefts[0];

  // slots 0..W hold the travelling weft plus the W base strands
  const state = [primary, ...base];
  const ids = ['weft', ...base.map((_, i) => `b${i}`)];

  const rows = [];
  const counts = { weft: new Map(), base: new Array(W).fill(0), edges: 0 };
  const misses = [];
  for (const w of wefts) counts.weft.set(w, 0);

  for (let r = 0; r < H; r++) {
    const goingRight = r % 2 === 0;
    const cols = goingRight ? range(W) : range(W).reverse();
    const knots = [];
    let inHand = primary;

    for (const c of cols) {
      const want = image[r][c];
      const useWeft = want !== base[c];
      if (useWeft && want !== inHand) inHand = want;

      // The weft always sits immediately behind the column it is about to
      // knot, so the pair is (c, c+1) whichever way the row is running: going
      // right the weft is the left half, going left it is the right half.
      const gap = c;
      if (useWeft) state[goingRight ? gap : gap + 1] = inHand;

      const knot = alphaKnot(useWeft, goingRight);
      const res = applyKnot(knot, state[gap], state[gap + 1]);
      if (res.shown !== want) misses.push({ row: r, col: c, want, got: res.shown });
      state[gap] = res.left;
      state[gap + 1] = res.right;
      const t = ids[gap]; ids[gap] = ids[gap + 1]; ids[gap + 1] = t;

      knots.push({ col: c, knot, shown: res.shown, weft: useWeft ? inHand : null });
      if (useWeft) counts.weft.set(inHand, (counts.weft.get(inHand) ?? 0) + 1);
      else counts.base[c]++;
    }

    counts.edges += 1;
    rows.push({ index: r, goingRight, knots, anchor: edgeAnchor(goingRight), runs: runLengthRow(knots) });
  }

  return { rows, counts, misses, ok: misses.length === 0, width: W, height: H };
}

const range = (n) => Array.from({ length: n }, (_, i) => i);

/**
 * "7 black knots, then 3 white" reads far better on a phone than 10 separate
 * steps, so collapse each row into runs of identical knots.
 */
export function runLengthRow(knots) {
  const runs = [];
  for (const k of knots) {
    const last = runs[runs.length - 1];
    if (last && last.knot === k.knot && last.shown === k.shown) { last.count++; last.to = k.col; continue; }
    runs.push({ knot: k.knot, shown: k.shown, count: 1, from: k.col, to: k.col, weft: k.weft });
  }
  return runs;
}

/** Knot totals per physical strand, which is what the cut lengths are built on. */
export function alphaKnotCounts(sim) {
  const weft = {};
  for (const [color, n] of sim.counts.weft) weft[color] = n;
  return {
    weft,
    base: sim.counts.base,
    edges: sim.counts.edges,
    total: sim.rows.reduce((a, r) => a + r.knots.length, 0),
  };
}
