/**
 * knots.js -- the physical rules of friendship-bracelet knotting.
 *
 * A bracelet in progress is an ordered array of strand positions, left to right.
 * Every knot is made by TWO adjacent strands and is two half-hitches.
 *
 * There are exactly four knots. Each is fully described by two independent
 * binary choices:
 *
 *   which strand does the knotting  -> that strand's colour is what you SEE
 *   whether the pair swaps places   -> a single knot swaps, a doubled-back
 *                                      knot returns the knotter to its side
 *
 *   knot | symbol | knotter | colour shown | positions after
 *   -----+--------+---------+--------------+-----------------
 *   F    |   /    | left    | left         | SWAPPED   (left strand ends right)
 *   B    |   \    | right   | right        | SWAPPED   (right strand ends left)
 *   FB   |   >    | left    | left         | UNCHANGED (left strand stays left)
 *   BF   |   <    | right   | right        | UNCHANGED (right strand stays right)
 *
 * F  = forward knot            (left over right, "4" shape, twice)
 * B  = backward knot           (right over left, mirrored "4", twice)
 * FB = forward-backward knot   (one forward half-hitch, then one backward)
 * BF = backward-forward knot   (one backward half-hitch, then one forward)
 *
 * Consequence used all over the engine: at any knot the only two colours you
 * can possibly show are the colours of the two strands currently sitting there.
 * That single constraint is what makes "repair" meaningful -- a language model
 * can ask for a picture that no arrangement of strands can produce, and the
 * engine has to find the closest thing that can actually be tied.
 */

export const KNOTS = ['F', 'B', 'FB', 'BF'];

export const KNOT_SYMBOL = { F: '/', B: '\\', FB: '>', BF: '<' };

export const KNOT_NAME = {
  F: 'forward knot',
  B: 'backward knot',
  FB: 'forward-backward knot',
  BF: 'backward-forward knot',
};

export const KNOT_SHORT = { F: 'FF', B: 'BB', FB: 'FB', BF: 'BF' };

/** Does this knot swap the two strands' positions? */
export const KNOT_SWAPS = { F: true, B: true, FB: false, BF: false };

/** Which side does the colour come from? 'L' or 'R'. */
export const KNOT_SOURCE = { F: 'L', B: 'R', FB: 'L', BF: 'R' };

/** Inverse lookup: (colour source, swaps?) -> knot */
export function knotFor(source, swaps) {
  if (source === 'L') return swaps ? 'F' : 'FB';
  return swaps ? 'B' : 'BF';
}

export const KNOT_TIE_TEXT = {
  F: 'Make a "4" with the LEFT string over the right one, pull the tail through the loop and slide the knot to the top. Do it a second time in exactly the same direction. The left string is now on the right.',
  B: 'Make a backwards "4" with the RIGHT string over the left one, pull the tail through the loop and slide it up. Do it a second time in the same direction. The right string is now on the left.',
  FB: 'Make a "4" with the LEFT string over the right and tighten (one half knot), then make a backwards "4" with that same string and tighten. The string ends up back on the LEFT where it started.',
  BF: 'Make a backwards "4" with the RIGHT string over the left and tighten (one half knot), then make a forward "4" with that same string and tighten. The string ends up back on the RIGHT where it started.',
};

/**
 * Apply one knot to a pair of colours.
 * @returns {{shown:string,left:string,right:string}}
 */
export function applyKnot(type, leftColor, rightColor) {
  const shown = KNOT_SOURCE[type] === 'L' ? leftColor : rightColor;
  if (KNOT_SWAPS[type]) return { shown, left: rightColor, right: leftColor };
  return { shown, left: leftColor, right: rightColor };
}

/**
 * A knot row: a list of {pos, knot} where `pos` is the index of the LEFT
 * strand of the pair. Positions in one row must be non-overlapping and sorted.
 */
export function validateRow(row, strandCount) {
  const errors = [];
  let last = -2;
  for (const k of row) {
    if (!Number.isInteger(k.pos)) errors.push(`knot position ${k.pos} is not an integer`);
    if (k.pos < 0 || k.pos + 1 >= strandCount)
      errors.push(`knot at ${k.pos} reaches outside the ${strandCount} strands`);
    if (k.pos <= last) errors.push(`knot at ${k.pos} overlaps the previous knot at ${last}`);
    if (!KNOTS.includes(k.knot)) errors.push(`"${k.knot}" is not one of ${KNOTS.join(', ')}`);
    last = k.pos + 1;
  }
  return errors;
}

/**
 * Simulate a whole pattern.
 *
 * @param {string[]} setup      colours of each strand, left to right, before row 1
 * @param {Array<Array<{pos:number,knot:string}>>} rows
 * @returns {{
 *   states: string[][],        strand colours before each row (states[0] === setup)
 *   final: string[],           strand colours after the last row
 *   knots: Array<Array<{pos:number,knot:string,shown:string,left:string,right:string}>>
 * }}
 */
export function simulate(setup, rows) {
  let state = setup.slice();
  const states = [state.slice()];
  const knots = [];
  for (const row of rows) {
    const out = [];
    const nextState = state.slice();
    for (const k of row) {
      const L = state[k.pos];
      const R = state[k.pos + 1];
      const res = applyKnot(k.knot, L, R);
      nextState[k.pos] = res.left;
      nextState[k.pos + 1] = res.right;
      out.push({ pos: k.pos, knot: k.knot, shown: res.shown, left: L, right: R });
    }
    knots.push(out);
    state = nextState;
    states.push(state.slice());
  }
  return { states, final: state, knots };
}

/**
 * The "normal" (diagonal-knot) pattern grid used by every classic friendship
 * bracelet: rows alternate between n/2 knots on even strand pairs and n/2 - 1
 * knots on odd pairs, so the knots tile the fabric like brickwork.
 *
 *   n = 8      row 1 (offset 0):  0-1  2-3  4-5  6-7      (4 knots)
 *              row 2 (offset 1):       1-2  3-4  5-6      (3 knots, ends idle)
 *
 * @returns {number[]} left-strand indices for a row
 */
export function rowPositions(strandCount, rowIndex) {
  const offset = rowIndex % 2 === 0 ? 0 : 1;
  const out = [];
  for (let p = offset; p + 1 < strandCount; p += 2) out.push(p);
  return out;
}

/** How many knots a normal-pattern row of this index contains. */
export function rowKnotCount(strandCount, rowIndex) {
  return rowPositions(strandCount, rowIndex).length;
}

/** Total knots in a set of rows. */
export function countKnots(rows) {
  return rows.reduce((a, r) => a + r.length, 0);
}

/**
 * Given strand colours and a target colour for every knot slot, choose knots.
 * Colour is forced (you can only show one of the two strands present); the
 * SWAP decision is free, and it is the swap decisions that determine which
 * colours are available further down. So this is a search, not a mapping.
 *
 * Beam search over swap choices, scoring exact colour matches.
 *
 * @param {string[]} setup
 * @param {Array<Array<{pos:number,want:string}>>} targetRows
 * @param {{beam?:number, distance?:(a:string,b:string)=>number}} [opts]
 * @returns {{rows:Array<Array<{pos:number,knot:string}>>, matched:number, total:number, misses:Array}}
 */
export function fitRowsToTarget(setup, targetRows, opts = {}) {
  const beamWidth = opts.beam ?? 32;
  const innerWidth = opts.inner ?? Math.max(8, Math.round(beamWidth / 2));
  // Branching on the far strand as well as the near one doubles the work and,
  // measured across every geometry in the library, changes no fidelity number:
  // what limits a normal pattern is which colours are physically present in the
  // current strand order, not the choice between them. Greedy by default.
  const greedy = opts.greedy ?? true;
  const distance = opts.distance ?? ((a, b) => (a === b ? 0 : 1));

  let beam = [{ state: setup.slice(), rows: [], cost: 0, matched: 0, misses: [] }];

  for (let r = 0; r < targetRows.length; r++) {
    const target = targetRows[r];
    const next = [];
    for (const cand of beam) {
      // Each knot slot: 2 colour sources x 2 swap options.
      let variants = [{ state: cand.state.slice(), row: [], cost: 0, matched: 0, misses: [] }];
      for (const slot of target) {
        const grown = [];
        const seen = new Set();
        for (const v of variants) {
          const L = v.state[slot.pos];
          const R = v.state[slot.pos + 1];
          const dL = distance(L, slot.want);
          const dR = distance(R, slot.want);
          // Branch on BOTH strands even when one is obviously closer. Taking a
          // wrong colour now is sometimes the only way to have the right strand
          // in the right column three rows later, and a purely greedy choice
          // can never discover that.
          const sources = greedy && dL !== dR ? [dL < dR ? 'L' : 'R'] : ['L', 'R'];
          for (const source of sources) {
            for (const swaps of [true, false]) {
              const knot = knotFor(source, swaps);
              const res = applyKnot(knot, L, R);
              const state = v.state.slice();
              state[slot.pos] = res.left;
              state[slot.pos + 1] = res.right;
              const d = source === 'L' ? dL : dR;
              const cost = v.cost + d;
              // Two routes to the same strand order at the same cost are the
              // same thing as far as the rest of the pattern is concerned.
              const key = `${cost}#${state.join('|')}`;
              if (seen.has(key)) continue;
              seen.add(key);
              grown.push({
                state,
                row: v.row.concat({ pos: slot.pos, knot }),
                cost,
                matched: v.matched + (d === 0 ? 1 : 0),
                misses:
                  d === 0
                    ? v.misses
                    : v.misses.concat({ row: r, pos: slot.pos, want: slot.want, got: res.shown }),
              });
            }
          }
        }
        // prune within the row so width doesn't explode across many knots
        grown.sort((a, b) => a.cost - b.cost);
        variants = grown.slice(0, innerWidth);
      }
      for (const v of variants) {
        next.push({
          state: v.state,
          rows: cand.rows.concat([v.row]),
          cost: cand.cost + v.cost,
          matched: cand.matched + v.matched,
          misses: cand.misses.concat(v.misses),
        });
      }
    }
    next.sort((a, b) => a.cost - b.cost || lookaheadTieBreak(a, b));
    beam = dedupe(next).slice(0, beamWidth);
  }

  const best = pickBest(beam, opts.closeTo);
  const total = targetRows.reduce((a, r) => a + r.length, 0);
  return { rows: best.rows, matched: best.matched, total, misses: best.misses, final: best.state };
}

/**
 * A pattern is only a repeatable tile if the strands finish in the order they
 * started, so when a caller asks for that, prefer a slightly worse-looking fit
 * that closes the loop over a prettier one that drifts forever.
 */
function pickBest(beam, closeTo) {
  if (!closeTo) return beam[0];
  const key = closeTo.join('|');
  const closed = beam.filter((b) => b.state.join('|') === key);
  if (closed.length) return closed[0];
  const drift = (b) => b.state.reduce((a, c, i) => a + (c === closeTo[i] ? 0 : 1), 0);
  return beam.slice().sort((a, b) => a.cost + 2 * drift(a) - (b.cost + 2 * drift(b)))[0];
}

function lookaheadTieBreak(a, b) {
  // prefer states with more colour variety left available -- keeps options open
  return varietyScore(b.state) - varietyScore(a.state);
}

function varietyScore(state) {
  let s = 0;
  for (let i = 0; i + 1 < state.length; i++) if (state[i] !== state[i + 1]) s++;
  return s;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.state.join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
