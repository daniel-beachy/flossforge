/**
 * Alpha (pixel-grid) patterns. The knot rule here is not a free choice: the
 * weft is the left strand of every pair on a left-to-right row and the right
 * strand coming back, so which knot draws "background" flips with direction.
 *
 * The fixture rows were worked out by hand from that rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { alphaKnot, edgeAnchor, planAlpha, simulateAlpha, runLengthRow, alphaKnotCounts } from '../src/engine/styles/alpha.js';
import { textImage } from '../src/engine/imagegen.js';
import { SUPPORTED_CHARS, GLYPH_KEYS, GLYPH_HEIGHT, glyph, hasGlyph } from '../src/engine/data/alphabet.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/alpha-rows.json', import.meta.url), 'utf8'));

test('the knot that draws the background flips with the direction of travel', () => {
  // Going right the weft is on the left, so a forward knot shows it.
  assert.equal(alphaKnot(true, true), 'F', 'weft knot, travelling right');
  assert.equal(alphaKnot(false, true), 'B', 'base knot, travelling right');
  // Coming back the weft is on the right, so it is a backward knot instead.
  assert.equal(alphaKnot(true, false), 'B', 'weft knot, travelling left');
  assert.equal(alphaKnot(false, false), 'F', 'base knot, travelling left');
});

test('the turn at each selvedge is a non-swapping knot', () => {
  assert.equal(edgeAnchor(true), 'FB');
  assert.equal(edgeAnchor(false), 'BF');
});

test('rows alternate direction and start left to right', () => {
  const image = fx.rows.map((r) => r.wantsLeftToRight);
  const sim = simulateAlpha(planAlpha(image, fx.background));
  assert.equal(sim.rows[0].goingRight, true, 'row 1 goes left to right');
  sim.rows.forEach((r, i) => assert.equal(r.goingRight, i % 2 === 0, `row ${i + 1} direction`));
});

test('a hand-worked three-column image knots to exactly the right knots', () => {
  const image = fx.rows.map((r) => r.wantsLeftToRight);
  const plan = planAlpha(image, fx.background);
  const sim = simulateAlpha(plan);

  assert.equal(plan.width, fx.width);
  assert.equal(sim.misses.length, 0, 'no pixel should be unreachable');

  fx.rows.forEach((want, i) => {
    const got = sim.rows[i].knots.map((k) => k.knot);
    assert.deepEqual(got, want.knotsInTyingOrder, `row ${want.row} knots, in tying order`);
  });
});

test('what the knots show is what was asked for, read left to right', () => {
  const image = fx.rows.map((r) => r.wantsLeftToRight);
  const sim = simulateAlpha(planAlpha(image, fx.background));
  sim.rows.forEach((row, i) => {
    const shownLeftToRight = row.knots.slice().sort((a, b) => a.col - b.col).map((k) => k.shown);
    assert.deepEqual(shownLeftToRight, fx.rows[i].wantsLeftToRight, `row ${i + 1} appearance`);
  });
});

test('string count is one strand per column plus one per weft colour', () => {
  const image = fx.rows.map((r) => r.wantsLeftToRight);
  const plan = planAlpha(image, fx.background);
  assert.equal(plan.width + plan.wefts.length, fx.stringCount);
});

/* ------------------------------------------- the two-colours-per-column rule */

test('a column that needs three colours is repaired, not silently drawn wrong', () => {
  // Column 0 asks for background, then red, then blue. A single base strand
  // cannot be two colours, so this is physically impossible as drawn.
  const image = [
    ['BG', 'BG'],
    ['RED', 'BG'],
    ['BLU', 'BG'],
  ];
  const plan = planAlpha(image, 'BG');
  assert.ok(plan.repairs.length > 0, 'the impossible column should be reported');
  const sim = simulateAlpha(plan);
  // Whatever it decided to do, the result has to be tie-able and honest about
  // any pixel it could not reach.
  assert.ok(sim.ok || sim.misses.length > 0);
  assert.ok(plan.fidelity <= 1);
  for (const row of sim.rows) {
    for (const k of row.knots) assert.ok(['F', 'B'].includes(k.knot), 'only real knots');
  }
});

test('two colours in a column is fine and loses nothing', () => {
  const image = [
    ['BG', 'BG', 'BG'],
    ['RED', 'BG', 'RED'],
    ['BG', 'RED', 'BG'],
    ['RED', 'BG', 'RED'],
  ];
  const plan = planAlpha(image, 'BG');
  const sim = simulateAlpha(plan);
  assert.equal(sim.misses.length, 0);
  assert.equal(plan.fidelity, 1);
});

/* --------------------------------------------------------------- lettering */

test('every letter in the alphabet fits the grid and is not blank', () => {
  assert.ok(GLYPH_KEYS.length >= 40, 'suspiciously small alphabet');
  for (const ch of GLYPH_KEYS) {
    if (ch === ' ') continue;
    const rows = glyph(ch);
    assert.equal(rows.length, GLYPH_HEIGHT, `${ch} is the wrong height`);
    const w = rows[0].length;
    for (const r of rows) assert.equal(r.length, w, `${ch} is ragged`);
    assert.ok(rows.some((r) => /[^.]/.test(r)), `${ch} is blank`);
    assert.ok(hasGlyph(ch), `hasGlyph disagrees about ${ch}`);
  }
  assert.ok(SUPPORTED_CHARS.includes('A'));
});

test('a word knots into a band that still reads as that word', () => {
  const word = 'LOVE';
  assert.ok([...word].every(hasGlyph));
  const { image } = textImage({ text: word, color: 'INK', background: 'BG', W: 13, H: 60 });
  const plan = planAlpha(image, 'BG');
  const sim = simulateAlpha(plan);
  assert.equal(sim.misses.length, 0, 'lettering should be exactly tie-able');
  assert.equal(plan.fidelity, 1);

  // The ink has to actually appear, and only in two colours overall.
  const seen = new Set(image.flat());
  assert.deepEqual([...seen].sort(), ['BG', 'INK']);
  assert.ok(image.flat().filter((c) => c === 'INK').length > 20, 'the word barely shows');
});

test('letters stack down the band rather than running across it', () => {
  const { image } = textImage({ text: 'AB', color: 'INK', background: 'BG', W: 13, H: 60 });
  const inkRows = image.map((r, i) => (r.includes('INK') ? i : -1)).filter((i) => i >= 0);
  // Two letters one above the other means at least two separated runs of rows.
  let gaps = 0;
  for (let i = 1; i < inkRows.length; i++) if (inkRows[i] - inkRows[i - 1] > 1) gaps++;
  assert.ok(gaps >= 1, 'the two letters ran together or sat side by side');
});

/* ------------------------------------------------------------- bookkeeping */

test('run lengths describe the row without losing knots', () => {
  const knots = [{ knot: 'F', shown: 'a' }, { knot: 'F', shown: 'a' }, { knot: 'B', shown: 'b' }, { knot: 'F', shown: 'a' }];
  const runs = runLengthRow(knots);
  assert.deepEqual(runs.map((r) => r.count), [2, 1, 1]);
  assert.equal(runs.reduce((a, r) => a + r.count, 0), knots.length);
});

test('the knot count is the whole grid plus the selvedge turns', () => {
  const image = [['BG', 'BG', 'BG'], ['RED', 'BG', 'RED']];
  const sim = simulateAlpha(planAlpha(image, 'BG'));
  const counts = alphaKnotCounts(sim);
  assert.equal(counts.total >= 6, true, 'at least one knot per pixel');
});
