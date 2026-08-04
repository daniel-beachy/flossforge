/**
 * The contract with the language model. A model will cheerfully hand back a
 * bracelet that cannot exist, so everything it says has to survive this file
 * before it reaches a person's hands.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { validateDesign, STYLE_IDS, STYLES } from '../src/engine/design.js';
import { compilePattern } from '../src/engine/compile.js';
import { PALETTE_BY_CODE } from '../src/engine/palette.js';

const base = { title: 'Test', blurb: 'A test.', style: 'normal', spec: { strands: 12, colors: ['310', 'B5200', '666'], design: { kind: 'geometry', geometry: 'chevron' } } };
const clone = (over = {}) => JSON.parse(JSON.stringify({ ...base, ...over }));

test('a well-formed design passes untouched', () => {
  const v = validateDesign(clone(), {});
  assert.equal(v.ok, true, v.errors.join('; '));
  assert.equal(v.repairs.length, 0, JSON.stringify(v.repairs));
});

test('every style the model is offered is a style the engine can compile', () => {
  for (const style of STYLE_IDS) {
    const meta = STYLES.find((s) => s.id === style);
    assert.ok(meta.label && meta.blurb, `${style} has no description for the prompt`);
  }
  assert.ok(STYLE_IDS.length >= 5, 'not enough styles to give five distinct candidates');
});

/* -------------------------------------------------------------- the repairs */

test('an invented style is repaired rather than crashing the app', () => {
  const v = validateDesign(clone({ style: 'friendship-deluxe' }), {});
  assert.ok(STYLE_IDS.includes(v.design.style), 'style was not brought back into range');
  assert.ok(v.repairs.length + v.warnings.length > 0, 'the substitution was made silently');
});

test('a style the user switched off is not returned anyway', () => {
  const v = validateDesign(clone({ style: 'normal' }), { allowedStyles: ['daisy', 'braid'] });
  if (v.ok) assert.ok(['daisy', 'braid'].includes(v.design.style));
  else assert.ok(v.errors.length);
});

test('an odd number of strands is repaired, because knots come in pairs', () => {
  const v = validateDesign(clone({ spec: { ...base.spec, strands: 11 } }), {});
  assert.equal(v.design.spec.strands % 2, 0, 'a normal pattern cannot have an odd strand count');
  assert.ok(v.repairs.some((r) => /strand/i.test(r.field)));
});

test('a colour code that is not stocked is substituted and explained', () => {
  const v = validateDesign(clone({ spec: { ...base.spec, colors: ['310', '9999', '666'] } }), {});
  for (const c of v.design.spec.colors) {
    assert.ok(PALETTE_BY_CODE.has(String(c).toUpperCase()), `${c} is not in the palette`);
  }
  const said = [...v.repairs.map((r) => r.why), ...v.warnings].join(' ');
  assert.match(said, /9999|palette|substitut/i, 'the substitution was not explained');
});

test('a DMC number is never quietly read as a hex colour', () => {
  // "963" happens to parse as the shorthand hex #996633. If that ever leaks
  // through, a pink bracelet comes out brown.
  const v = validateDesign(clone({ spec: { ...base.spec, colors: ['963', '310', 'B5200'] } }), {});
  const chosen = v.design.spec.colors[0];
  const entry = PALETTE_BY_CODE.get(String(chosen).toUpperCase());
  assert.ok(entry, 'unstocked code did not resolve to a stocked one');
  assert.notEqual(entry.hex.toLowerCase(), '#996633');
});

test('a design with no colours at all still produces something tie-able', () => {
  const v = validateDesign(clone({ spec: { strands: 12, colors: [], design: { kind: 'geometry', geometry: 'chevron' } } }), {});
  assert.ok(v.design.spec.colors.length >= 2, 'you cannot knot a pattern in one colour');
});

test('a geometry the engine cannot draw is swapped for one it can', () => {
  const v = validateDesign(clone({ spec: { ...base.spec, design: { kind: 'geometry', geometry: 'mandelbrot' } } }), {});
  assert.ok(v.repairs.some((r) => /geometry/.test(r.field)));
  const out = compilePattern(v.design, { size: 'adult', fit: 'standard' });
  assert.ok(out.knots > 0);
});

test('a motif the engine does not have is reported, not drawn as a blank', () => {
  const v = validateDesign({ title: 'x', blurb: 'y', style: 'alpha', spec: { width: 13, background: '310', design: { kind: 'motif', motif: 'wyvern', colors: ['666'] } } }, {});
  const said = [...v.repairs.map((r) => r.why), ...v.warnings, ...v.errors].join(' ');
  assert.match(said, /wyvern|motif/i);
});

test('junk in gets an error out, not an exception', () => {
  for (const junk of [null, undefined, 42, 'a bracelet', [], {}, { style: 'normal' }]) {
    const v = validateDesign(junk, {});
    assert.equal(typeof v.ok, 'boolean');
    if (!v.ok) assert.ok(v.errors.length, 'a failure with no explanation');
  }
});

/* ------------------------------------------------- it has to actually knot */

test('every style compiles into a pattern a person could follow', () => {
  const samples = {
    normal: base,
    alpha: { title: 'A', blurb: 'b', style: 'alpha', spec: { width: 13, background: '310', design: { kind: 'text', text: 'HI', color: 'B5200' } } },
    daisy: { title: 'D', blurb: 'b', style: 'daisy', spec: { petal: 'B5200', centre: '444', stem: '700', spacing: 8, petalsPerSide: 3 } },
    braid: { title: 'B', blurb: 'b', style: 'braid', spec: { kind: 'braid-3', colors: ['310', '666', 'B5200'] } },
    spiral: { title: 'S', blurb: 'b', style: 'spiral', spec: { kind: 'staircase', core: ['310'], sequence: [{ color: '666', hitches: 10 }] } },
    macrame: { title: 'M', blurb: 'b', style: 'macrame', spec: { kind: 'square', working: ['310', '666'], core: ['B5200'] } },
    kumihimo: { title: 'K', blurb: 'b', style: 'kumihimo', spec: { colors: ['310', '666', 'B5200', '444'] } },
  };
  for (const style of STYLE_IDS) {
    assert.ok(samples[style], `no sample for style ${style}`);
    const v = validateDesign(samples[style], {});
    assert.ok(v.ok, `${style}: ${v.errors.join('; ')}`);
    const p = compilePattern(v.design, { size: 'adult', fit: 'standard' });

    assert.ok(p.materials.length > 0, `${style} needs no materials?`);
    assert.ok(p.totals.strands > 0, `${style} uses no strands`);
    assert.ok(p.steps.length >= 3, `${style} has almost no instructions`);
    assert.equal(p.steps[0].kind, 'materials', `${style} does not start by telling you what to cut`);
    assert.ok(p.steps.some((s) => s.kind === 'finish'), `${style} never tells you how to finish`);
    assert.ok(p.timeMinutes > 0, `${style} claims to take no time`);
    assert.ok(p.fidelity > 0 && p.fidelity <= 1, `${style} fidelity out of range`);
    for (const m of p.materials) {
      assert.ok(PALETTE_BY_CODE.has(m.code.toUpperCase()), `${style} uses unstocked ${m.code}`);
      assert.ok(m.cutInches > 0 && Number.isFinite(m.cutInches), `${style} ${m.code} has a nonsense cut length`);
      assert.ok(m.roles.length > 0, `${style} ${m.code} has no stated purpose`);
    }
  }
});

test('the same design and the same options always give the same pattern', () => {
  const v = validateDesign(clone(), {});
  const a = compilePattern(v.design, { size: 'adult', fit: 'standard' });
  const b = compilePattern(v.design, { size: 'adult', fit: 'standard' });
  assert.equal(JSON.stringify(a.chart), JSON.stringify(b.chart));
  assert.equal(a.knots, b.knots);
  assert.deepEqual(a.materials.map((m) => m.cutInches), b.materials.map((m) => m.cutInches));
});

test('a bigger bracelet needs more knots and more floss', () => {
  const v = validateDesign(clone(), {});
  const small = compilePattern(v.design, { size: 'child-s', fit: 'snug' });
  const big = compilePattern(v.design, { size: 'anklet-l', fit: 'loose' });
  assert.ok(big.knots > small.knots);
  assert.ok(big.totals.inches > small.totals.inches);
});

test('strand roles read as ranges, not as a list of thirteen near-identical labels', () => {
  const v = validateDesign(clone({ spec: { ...base.spec, strands: 16, colors: ['310', 'B5200'] } }), {});
  const p = compilePattern(v.design, { size: 'adult', fit: 'standard' });
  for (const m of p.materials) {
    assert.ok(m.roles.length <= 4, `${m.code} lists ${m.roles.length} roles: ${m.roles.join(', ')}`);
  }
});
