/**
 * The four knots. Everything else in the engine is built on top of these, so if
 * this file is wrong nothing downstream can be right.
 *
 * The fixture was worked out from the physical action of the half-hitches, not
 * read off a chart -- see tests/fixtures/README.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  KNOTS, KNOT_SYMBOL, KNOT_SWAPS, KNOT_SOURCE, knotFor, applyKnot,
  simulate, rowPositions, rowKnotCount, countKnots, validateRow,
} from '../src/engine/knots.js';

const truth = JSON.parse(readFileSync(new URL('./fixtures/knot-truth.json', import.meta.url), 'utf8'));

test('every knot in the library is one of the four real ones', () => {
  assert.deepEqual(KNOTS, ['F', 'B', 'FB', 'BF']);
});

test('symbols match the ones used on published charts', () => {
  assert.equal(KNOT_SYMBOL.F, '/');
  assert.equal(KNOT_SYMBOL.B, '\\');
  assert.equal(KNOT_SYMBOL.FB, '>');
  assert.equal(KNOT_SYMBOL.BF, '<');
});

test('applyKnot reproduces the hand-derived truth table', () => {
  for (const c of truth.cases) {
    const got = applyKnot(c.knot, c.left, c.right);
    assert.equal(got.shown, c.shown, `${c.knot} on ${c.left}/${c.right} should show ${c.shown}`);
    assert.deepEqual([got.left, got.right], c.after, `${c.knot} on ${c.left}/${c.right} strand order`);
  }
});

test('a knot is exactly a colour source plus a swap decision', () => {
  for (const [knot, { source, swaps }] of Object.entries(truth.sources)) {
    assert.equal(KNOT_SOURCE[knot], source);
    assert.equal(KNOT_SWAPS[knot], swaps);
    assert.equal(knotFor(source, swaps), knot, `knotFor(${source}, ${swaps})`);
  }
});

test('the four combinations of source and swap cover the four knots exactly', () => {
  const made = new Set();
  for (const source of ['L', 'R']) for (const swaps of [true, false]) made.add(knotFor(source, swaps));
  assert.equal(made.size, 4);
  assert.deepEqual([...made].sort(), [...KNOTS].sort());
});

test('swapping knots move strands, non-swapping knots do not', () => {
  for (const knot of KNOTS) {
    const r = applyKnot(knot, 'left', 'right');
    const moved = r.left !== 'left' || r.right !== 'right';
    assert.equal(moved, KNOT_SWAPS[knot], `${knot} swap behaviour`);
  }
});

test('a knot can only ever show a colour that was already hanging there', () => {
  for (const knot of KNOTS) {
    const r = applyKnot(knot, 'red', 'blue');
    assert.ok(r.shown === 'red' || r.shown === 'blue', `${knot} invented a colour`);
  }
});

/* ------------------------------------------------------------ row geometry */

test('rows alternate n/2 and n/2 - 1 knots, offset by half a knot', () => {
  assert.deepEqual(rowPositions(8, 0), [0, 2, 4, 6]);
  assert.deepEqual(rowPositions(8, 1), [1, 3, 5]);
  assert.deepEqual(rowPositions(4, 0), [0, 2]);
  assert.deepEqual(rowPositions(4, 1), [1]);
  assert.equal(rowKnotCount(12, 0), 6);
  assert.equal(rowKnotCount(12, 1), 5);
});

test('a row may not knot the same strand twice or run off the edge', () => {
  // validateRow returns the list of problems it found, so an empty list is a
  // clean row.
  assert.deepEqual(validateRow([{ pos: 0, knot: 'F' }, { pos: 2, knot: 'F' }], 4), []);
  assert.ok(validateRow([{ pos: 0, knot: 'F' }, { pos: 1, knot: 'F' }], 4).length, 'overlapping knots');
  assert.ok(validateRow([{ pos: 3, knot: 'F' }], 4).length, 'knot hanging off the right edge');
  assert.ok(validateRow([{ pos: 0, knot: 'Z' }], 4).length, 'unknown knot type');
});

test('countKnots counts knots, not rows', () => {
  assert.equal(countKnots([[{ pos: 0, knot: 'F' }, { pos: 2, knot: 'F' }], [{ pos: 1, knot: 'F' }]]), 3);
});

/* ------------------------------------------------------ the classic pattern */

const candy = JSON.parse(readFileSync(new URL('./fixtures/candy-stripe-4.json', import.meta.url), 'utf8'));

test('candy stripe on four strands matches the hand simulation row by row', () => {
  const rows = candy.rows.map((r) => r.positions.map((pos, i) => ({ pos, knot: r.knots[i] })));
  const sim = simulate(candy.setup, rows);

  assert.equal(sim.knots.length, candy.rows.length);
  candy.rows.forEach((want, i) => {
    const got = sim.knots[i];
    assert.deepEqual(got.map((k) => k.shown), want.shown, `row ${want.row} colours`);
    assert.deepEqual(got.map((k) => k.pos), want.positions, `row ${want.row} knot positions`);
    assert.deepEqual(sim.states[i + 1], want.stateAfter, `strand order after row ${want.row}`);
  });
});

test('candy stripe closes: after eight rows the strands are back where they started', () => {
  const rows = candy.rows.map((r) => r.positions.map((pos, i) => ({ pos, knot: r.knots[i] })));
  const sim = simulate(candy.setup, rows);
  assert.deepEqual(sim.final, candy.setup);
  assert.equal(candy.repeatRows, 8);
});

test('candy stripe really does draw diagonals', () => {
  // Independent check on the fixture itself: each colour should appear at the
  // recorded (row, knot) cells and each of those runs should step exactly one
  // knot to the right per row. If this fails the fixture is not a candy stripe.
  const rows = candy.rows.map((r) => r.positions.map((pos, i) => ({ pos, knot: r.knots[i] })));
  const sim = simulate(candy.setup, rows);
  for (const [color, cells] of Object.entries(candy.diagonals)) {
    if (color === 'note') continue;
    cells.forEach(([row, pos], i) => {
      const knot = sim.knots[row - 1].find((k) => k.pos === pos);
      assert.ok(knot, `${color}: row ${row} has no knot at strand position ${pos}`);
      assert.equal(knot.shown, color, `${color} at row ${row}, strand position ${pos}`);
      if (i > 0) assert.equal(pos - cells[i - 1][1], 1, `${color} steps one strand right per row`);
    });
  }
});
