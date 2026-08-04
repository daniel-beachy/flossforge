/**
 * Sizing and floss arithmetic. The point of this file is that the numbers the
 * app prints can be checked by hand, so the fixtures recompute the formula
 * independently rather than calling into sizing.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SIZES, FITS, sizeById, fitById, bandLength, cutLength, formatCut, formatLen,
  rowsForBand, skeinsFor, INCHES_PER_KNOT, SETUP_ALLOWANCE_IN, TAIL_ALLOWANCE_IN, SAFETY, SKEIN_INCHES,
} from '../src/engine/sizing.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/cut-length.json', import.meta.url), 'utf8'));

test('the published constants are the ones the arithmetic actually uses', () => {
  assert.equal(INCHES_PER_KNOT, 0.38);
  assert.equal(SETUP_ALLOWANCE_IN, 4);
  assert.equal(TAIL_ALLOWANCE_IN, 5);
  assert.equal(SAFETY, 1.15);
  assert.equal(SKEIN_INCHES, 8.7 * 36);
});

test('cut lengths match the formula worked out on paper', () => {
  for (const c of fx.cases) {
    const got = cutLength({ knots: c.knots, bandInches: c.bandInches, extraTravel: c.extraTravel });
    assert.equal(got.inches, c.cut, `${c.knots} knots over ${c.bandInches} in`);
  }
});

test('the arithmetic is shown, and the shown steps add up to the answer', () => {
  const got = cutLength({ knots: 250, bandInches: 8 });
  assert.ok(Array.isArray(got.steps) && got.steps.length >= 4, 'no working shown');
  const text = got.steps.join(' ');
  assert.match(text, /0\.38/, 'the per-knot figure should be visible');
  assert.match(text, /1\.15|15%/, 'the safety margin should be visible');
  assert.match(text, /250 knots/, 'the knot count should be visible');
  // Recompute from scratch; if these ever disagree the printed working is a lie.
  const raw = 8 + 250 * 0.38 + 4 + 2 * 5;
  assert.equal(got.inches, Math.ceil(raw * 1.15));
  assert.match(got.steps.at(-1), new RegExp(String(got.inches)), 'the last step should state the answer');
});

test('more knots always needs more floss', () => {
  let last = 0;
  for (const knots of [0, 50, 200, 800, 2000]) {
    const cut = cutLength({ knots, bandInches: 7 }).inches;
    assert.ok(cut > last, `${knots} knots should need more than the step before`);
    last = cut;
  }
});

/* ------------------------------------------------------------------- sizes */

test('every size has a wrist measurement and a group', () => {
  assert.ok(SIZES.length >= 6, 'not many sizes on offer');
  for (const s of SIZES) {
    assert.ok(s.id && s.label && s.group, `${s.id} is incomplete`);
    assert.ok(s.wrist > 0, `${s.id} has no wrist measurement`);
  }
  assert.ok(SIZES.some((s) => /child/i.test(s.label)), 'no child size');
  assert.ok(SIZES.some((s) => /xl/i.test(s.label)), 'no XL size');
  assert.ok(SIZES.some((s) => /anklet/i.test(s.label)));
  assert.ok(SIZES.some((s) => /bookmark/i.test(s.label)));
  assert.ok(SIZES.some((s) => s.id === 'custom'));
});

test('fits change the finished length in the direction they claim to', () => {
  const snug = bandLength({ size: 'adult', fit: 'snug' });
  const std = bandLength({ size: 'adult', fit: 'standard' });
  const loose = bandLength({ size: 'adult', fit: 'loose' });
  assert.ok(snug.inches < std.inches, 'snug should be shorter than standard');
  assert.ok(loose.inches > std.inches, 'loose should be longer than standard');
  assert.equal(fitById('snug').ease < fitById('loose').ease, true);
});

test('a bigger size makes a longer band', () => {
  const child = bandLength({ size: 'child-s', fit: 'standard' }).inches;
  const adult = bandLength({ size: 'adult', fit: 'standard' }).inches;
  const xl = bandLength({ size: 'adult-xl', fit: 'standard' }).inches;
  assert.ok(child < adult && adult < xl, `${child} / ${adult} / ${xl}`);
});

test('a custom length is used as given, not as a wrist measurement to pad', () => {
  const b = bandLength({ size: 'custom', fit: 'standard', customInches: 9 });
  assert.equal(Math.round(b.inches), 9);
});

test('sizes that should not take ease do not take ease', () => {
  for (const s of SIZES.filter((x) => x.noEase)) {
    const a = bandLength({ size: s.id, fit: 'snug' }).inches;
    const b = bandLength({ size: s.id, fit: 'loose' }).inches;
    assert.equal(a, b, `${s.id} should ignore fit`);
  }
});

test('sizeById and fitById fall back rather than returning nothing', () => {
  assert.ok(sizeById('nonsense'));
  assert.ok(fitById('nonsense'));
});

/* --------------------------------------------------------------- row counts */

test('rows scale with the length of the band', () => {
  for (const style of ['normal', 'alpha']) {
    const short = rowsForBand(style, 5);
    const long = rowsForBand(style, 10);
    assert.ok(long > short, `${style} rows should grow with the band`);
    assert.ok(Number.isInteger(short) && short > 0);
  }
});

test('an alpha row is taller than a diagonal row, so a band needs fewer of them', () => {
  // Each alpha row is a full pass of the weft across the band; a normal-pattern
  // row is a staggered half-row, so it advances the band less.
  assert.ok(rowsForBand('alpha', 7) < rowsForBand('normal', 7));
});

/* ------------------------------------------------------------------ output */

test('lengths are printed in both inches and centimetres', () => {
  const t = formatCut(47);
  assert.match(t, /47 in/);
  assert.match(t, /3 ft 11 in/);
  assert.match(t, /119 cm/);
  assert.match(formatLen(7), /cm/);
});

test('skeins are counted whole, and one skein covers a small bracelet', () => {
  assert.equal(skeinsFor(1), 1);
  assert.equal(skeinsFor(SKEIN_INCHES), 1);
  assert.equal(skeinsFor(SKEIN_INCHES + 1), 2);
  assert.ok(Number.isInteger(skeinsFor(1234)));
});
