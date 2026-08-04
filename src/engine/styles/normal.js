/**
 * styles/normal.js -- "normal" patterns: the diagonal-knot family.
 *
 * Layout (verified against braceletbook / friendship-bracelets.net conventions):
 * rows alternate between n/2 knots on pairs (0,1)(2,3)... and n/2-1 knots on
 * pairs (1,2)(3,4)..., with the outer strands idle on the short rows. That
 * brickwork stagger is what makes every classic pattern lean diagonally.
 *
 * Two ways to get a pattern here:
 *
 *   1. A TEMPLATE. The knot types are known exactly (candy stripe is every knot
 *      forward; a chevron is forward on the left half, backward on the right,
 *      forward at the join). We then *solve* for the strand order that makes the
 *      stripes come out in the order the design asked for, because the printed
 *      pattern is a steady-state repeat and the naive left-to-right order does
 *      not give you left-to-right stripes.
 *
 *   2. A TARGET IMAGE. The design says what it wants the fabric to look like and
 *      the engine searches for the closest knot sequence that can physically be
 *      tied. At any knot only two colours are available, so most pictures are
 *      not exactly reachable -- the fitter reports how close it got, and the
 *      caller decides whether to keep it, repair it or reject it.
 */

import { simulate, rowPositions, fitRowsToTarget, KNOT_SWAPS } from '../knots.js';

export const NORMAL_TEMPLATES = {
  'candy-stripe': {
    label: 'Candy stripe',
    blurb: 'Every knot is a forward knot. Each colour walks across the bracelet in turn as a diagonal stripe.',
    mirrored: false,
    knot: () => 'F',
  },
  'candy-stripe-left': {
    label: 'Candy stripe (leaning left)',
    blurb: 'Every knot is a backward knot, so the stripes lean the other way.',
    mirrored: false,
    knot: () => 'B',
  },
  chevron: {
    label: 'Chevron',
    blurb: 'Forward knots on the left half, backward knots on the right half, joined in the middle. Makes the classic V.',
    mirrored: true,
    knot: (pos, n) => {
      const centre = n / 2 - 1;
      if (pos < centre) return 'F';
      if (pos > centre) return 'B';
      return 'F';
    },
  },
  'chevron-up': {
    label: 'Chevron (pointing up)',
    blurb: 'The chevron run backwards: colours travel out from the middle instead of in, so the Vs point up the arm.',
    mirrored: true,
    knot: (pos, n) => {
      const centre = n / 2 - 1;
      if (pos < centre) return 'B';
      if (pos > centre) return 'F';
      return 'B';
    },
  },
};

export const NORMAL_TEMPLATE_IDS = Object.keys(NORMAL_TEMPLATES);

/** Build the knot grid for a template. Knot types never depend on colour. */
export function templateRows(templateId, strandCount, rowCount) {
  const t = NORMAL_TEMPLATES[templateId] ?? NORMAL_TEMPLATES['candy-stripe'];
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    rows.push(rowPositions(strandCount, r).map((pos) => ({ pos, knot: t.knot(pos, strandCount) })));
  }
  return rows;
}

/**
 * Work out which strand leads each visible diagonal, then hand those diagonals
 * the colours the design asked for, in order.
 *
 * Printed patterns are one tile of an infinite repeat, so row 1 already has
 * knots belonging to stripes that started "before" it. Laying the floss out in
 * plain left-to-right colour order therefore does NOT give left-to-right
 * stripes -- you have to run the simulation to find out which strand shows up
 * where, and place the colours accordingly.
 *
 * @returns {{setup:string[], groups:number[][]}}
 */
export function solveSetup(rows, strandCount, colorCycle, { mirrored = false } = {}) {
  const identity = Array.from({ length: strandCount }, (_, i) => i);
  const sim = simulate(identity, rows);

  const groups = [];
  const claimed = new Set();
  for (let r = 0; r < sim.knots.length; r++) {
    const row = sim.knots[r];
    if (!row.length || row[0].pos !== 0) continue; // only full rows start a diagonal
    const lead = row[0].shown;
    if (claimed.has(lead)) continue;
    const group = [lead];
    if (mirrored) {
      const partner = row[row.length - 1].shown;
      if (partner !== lead && !claimed.has(partner)) group.push(partner);
    }
    group.forEach((id) => claimed.add(id));
    groups.push(group);
  }

  const colorOf = new Map();
  groups.forEach((group, i) => {
    const c = colorCycle[i % colorCycle.length];
    group.forEach((id) => colorOf.set(id, c));
  });
  let spare = groups.length;
  for (const id of identity) {
    if (!colorOf.has(id)) colorOf.set(id, colorCycle[spare++ % colorCycle.length]);
  }
  return { setup: identity.map((id) => colorOf.get(id)), groups };
}

/**
 * How many grid rows make one complete visual repeat -- i.e. after how many
 * rows the strand order comes back to where it started.
 */
export function repeatLength(rows, setup, max = 512) {
  const start = setup.join('|');
  let state = setup.slice();
  for (let r = 0; r < Math.min(max, rows.length); r++) {
    state = simulate(state, [rows[r]]).final;
    if (state.join('|') === start && r > 0) return r + 1;
  }
  return null;
}

/**
 * Fit a target picture with real knots.
 *
 * `target[r][g]` is the colour wanted at gap g of row r; row r only uses the
 * gaps its brickwork row actually contains.
 */
/**
 * Fit a target picture with real knots.
 *
 * The target is in KNOT SPACE, which is how these charts are actually drawn:
 * `target[r][j]` is the colour wanted at the j-th knot of row r. Even rows
 * have n/2 knots, odd rows have n/2 - 1 and sit half a knot to the right --
 * the brickwork stagger you see on every printed pattern. Drawing the target
 * at full strand resolution instead would silently throw away half the picture,
 * because a row simply has no knot at the positions the other row uses.
 */
export function fitTarget(setup, target, strandCount, opts = {}) {
  const targetRows = target.map((row, r) =>
    rowPositions(strandCount, r).map((pos, j) => ({ pos, want: row[j] }))
  );
  return fitRowsToTarget(setup, targetRows, opts);
}

/**
 * Try several plausible strand orders and keep whichever can be tied closest to
 * the target. This is the repair step: a model can ask for a picture no strand
 * order can produce, and rather than fail we find the best physically real
 * version of it and say how close it is.
 */
export function fitBestSetup(target, strandCount, colors, opts = {}) {
  const candidates = setupCandidates(target, strandCount, colors);
  let best = null;
  for (const setup of candidates) {
    const res = fitTarget(setup, target, strandCount, { ...opts, closeTo: opts.close ? setup : undefined });
    const score = res.matched / Math.max(1, res.total);
    const closed = res.final ? res.final.join('|') === setup.join('|') : false;
    const rank = score + (closed ? 0.05 : 0);
    if (!best || rank > best.rank) best = { ...res, setup, score, closed, rank };
    if (best.score === 1 && best.closed) break;
  }
  return best;
}

/** Sensible starting orders to try: what the picture asks for, plus mirrors. */
function setupCandidates(target, strandCount, colors) {
  const out = [];
  const seen = new Set();
  const add = (arr) => {
    if (!arr || arr.length !== strandCount) return;
    const k = arr.join('|');
    if (seen.has(k)) return;
    seen.add(k);
    out.push(arr.slice());
  };

  // whatever colours the first row wants, spread across the strands
  const firstRow = target[0] ?? [];
  const wanted = firstRow.filter(Boolean);
  const spread = [];
  for (let i = 0; i < strandCount; i++) spread.push(wanted[Math.floor(i / 2) % Math.max(1, wanted.length)] ?? colors[0]);
  add(spread);

  const cycle = [];
  for (let i = 0; i < strandCount; i++) cycle.push(colors[i % colors.length]);
  add(cycle);

  const mirrorHalf = [];
  const half = strandCount / 2;
  for (let i = 0; i < half; i++) mirrorHalf.push(colors[i % colors.length]);
  add([...mirrorHalf, ...mirrorHalf.slice().reverse()]);

  const paired = [];
  for (let i = 0; i < strandCount; i++) paired.push(colors[Math.floor(i / 2) % colors.length]);
  add(paired);

  for (let shift = 1; shift < Math.min(colors.length, 5); shift++) {
    add(cycle.map((_, i) => colors[(i + shift) % colors.length]));
  }
  return out;
}

/**
 * Turn a simulated pattern into the picture it actually makes, in knot space:
 * `image[r][j]` is the colour of the j-th knot of row r. Odd rows are one knot
 * shorter and are drawn offset half a knot to the right.
 */
export function renderNormalImage(setup, rows) {
  const sim = simulate(setup, rows);
  const half = Math.floor(setup.length / 2);
  return {
    sim,
    image: sim.knots.map((row) => {
      const line = new Array(half).fill(null);
      row.forEach((k, j) => { line[j] = k.shown; });
      return line;
    }),
    positions: sim.knots.map((row) => row.map((k) => k.pos)),
  };
}

/** Where each strand sits at the start of each row -- used to draw the diagram. */
export function strandPaths(setup, rows) {
  const sim = simulate(setup, rows);
  return sim.states;
}

/** Count how many knots each starting strand ties, for cut lengths. */
export function knotsPerStrand(setup, rows) {
  const n = setup.length;
  let ids = Array.from({ length: n }, (_, i) => i);
  const counts = new Array(n).fill(0);
  for (const row of rows) {
    const next = ids.slice();
    for (const k of row) {
      const worker = knotWorkerSide(k.knot) === 'L' ? ids[k.pos] : ids[k.pos + 1];
      counts[worker] += 1;
      if (KNOT_SWAPS[k.knot]) {
        next[k.pos] = ids[k.pos + 1];
        next[k.pos + 1] = ids[k.pos];
      }
    }
    ids = next;
  }
  return counts;
}

function knotWorkerSide(knot) {
  return knot === 'F' || knot === 'FB' ? 'L' : 'R';
}
