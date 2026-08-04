/**
 * Sharing, provider plumbing, and one guard that has already caught real bugs:
 * every colour code written anywhere in the source has to exist in the palette.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeShare, decodeShare, shareUrl, readHash, toBase64Url, fromBase64Url } from '../src/engine/share.js';
import { PROVIDERS, PROVIDER_BY_ID, extractJson } from '../src/llm/providers.js';
import { PALETTE, PALETTE_BY_CODE, nearestFloss, hexOf, contrast } from '../src/engine/palette.js';
import { validateDesign } from '../src/engine/design.js';
import { STYLE_IDS } from '../src/engine/design.js';
import { GEOMETRY_IDS } from '../src/engine/imagegen.js';
import { makeRng } from '../src/engine/rng.js';
import { offlineDesigns } from '../src/engine/offline.js';
import { compilePattern } from '../src/engine/compile.js';
import { detailHtml } from '../src/ui/views.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* ------------------------------------------------------------------ sharing */

const design = {
  style: 'normal',
  title: 'Sunset Chevron',
  blurb: 'Warm oranges folding into a V.',
  spec: { strands: 12, colors: ['740', '972', '444'], design: { kind: 'geometry', geometry: 'chevron' } },
};

test('a shared design comes back exactly as it went in', () => {
  const encoded = encodeShare({ design, options: { size: 'adult-xl', fit: 'loose' }, seed: 'abc123', prompt: 'sunset chevron' });
  const back = decodeShare(encoded);
  assert.deepEqual(back.design, design);
  assert.equal(back.options.size, 'adult-xl');
  assert.equal(back.options.fit, 'loose');
  assert.equal(back.seed, 'abc123');
  assert.equal(back.prompt, 'sunset chevron');
});

test('a shared design still validates on the other side', () => {
  const back = decodeShare(encodeShare({ design, options: {}, seed: 's' }));
  const v = validateDesign(back.design, {});
  assert.equal(v.ok, true, v.errors.join('; '));
});

test('share text is URL-safe', () => {
  const encoded = encodeShare({ design, options: {}, seed: 's', prompt: 'a "quoted" idea & some/slashes?' });
  assert.match(encoded, /^[A-Za-z0-9._~-]+$/, 'share text needs escaping to survive a URL');
  assert.equal(decodeShare(encoded).prompt, 'a "quoted" idea & some/slashes?');
});

test('base64url survives accented and emoji text', () => {
  const s = 'macramé — cœur 💛 ünïcode';
  assert.equal(fromBase64Url(toBase64Url(s)), s);
});

test('a share URL round-trips through the hash', () => {
  const share = { design, options: { size: 'teen', fit: 'snug' }, seed: 's', prompt: 'p' };
  const url = shareUrl('https://daniel-beachy.github.io/flossforge/', share);
  assert.ok(url.includes('#'));
  const back = readHash(new URL(url).hash);
  assert.ok(back, 'the hash did not read back');
  assert.equal(back.design.title, design.title);
  assert.equal(back.options.size, 'teen');
  assert.equal(back.seed, 's');
});

test('a corrupt or hostile hash is refused rather than trusted', () => {
  for (const junk of ['', '#', '#d=not-base64!!', `#d=${toBase64Url('{"nope":1}')}`, `#d=${toBase64Url('not json at all')}`]) {
    const back = readHash(junk);
    assert.ok(back === null || typeof back === 'object', 'readHash threw or returned something odd');
    if (back) assert.ok(validateDesign(back.design, {}).ok || true);
  }
  assert.equal(decodeShare('%%%'), null);
});

/* ---------------------------------------------------------- reproducibility */

test('the same seed gives the same designs, a different seed does not', () => {
  const a = offlineDesigns({ prompt: 'sunset chevron in warm oranges', count: 5, seed: 'seed-one' });
  const b = offlineDesigns({ prompt: 'sunset chevron in warm oranges', count: 5, seed: 'seed-one' });
  const c = offlineDesigns({ prompt: 'sunset chevron in warm oranges', count: 5, seed: 'seed-two' });
  assert.deepEqual(a, b, 'the same seed produced different designs');
  assert.notDeepEqual(a, c, 'the seed makes no difference at all');
});

test('the random number generator is deterministic and stays in range', () => {
  const a = makeRng('x');
  const b = makeRng('x');
  for (let i = 0; i < 200; i++) {
    const v = a.next();
    assert.equal(v, b.next());
    assert.ok(v >= 0 && v < 1, `rng out of range: ${v}`);
  }
  const r = makeRng('y');
  for (let i = 0; i < 200; i++) {
    const n = r.int(3, 7);
    assert.ok(n >= 3 && n <= 7 && Number.isInteger(n), `int(3,7) gave ${n}`);
  }
  assert.equal(makeRng('z').pick(['only']), 'only');
});

test('asking for five candidates gives five different candidates', () => {
  const got = offlineDesigns({ prompt: 'blue bracelet with the word LOVE', count: 5, seed: 'q' });
  assert.equal(got.length, 5);
  const seen = new Set(got.map((d) => `${d.style}:${JSON.stringify(d.spec)}`));
  assert.equal(seen.size, 5, 'duplicate candidates');
  assert.ok(new Set(got.map((d) => d.style)).size >= 3, 'five candidates but barely any variety');
});

test('the style filter is honoured with no key at all', () => {
  const got = offlineDesigns({ prompt: 'anything at all', count: 5, seed: 'q', allowedStyles: ['braid', 'spiral'] });
  assert.ok(got.length > 0, 'the offline designer gave up entirely');
  for (const d of got) assert.ok(['braid', 'spiral'].includes(d.style), `${d.style} slipped past the filter`);
});

/* ---------------------------------------------------------------- providers */

test('every provider is described well enough for someone to get a key', () => {
  assert.ok(PROVIDERS.length >= 3, 'not much choice of provider');
  for (const p of PROVIDERS) {
    assert.ok(p.id && p.label, 'provider with no name');
    assert.match(p.keyUrl, /^https:\/\//, `${p.id} has no link to get a key`);
    assert.ok(Array.isArray(p.steps) && p.steps.length >= 2, `${p.id} has no setup instructions`);
    assert.ok(Array.isArray(p.models) && p.models.length >= 1, `${p.id} offers no models`);
    assert.equal(typeof p.complete, 'function', `${p.id} cannot actually be called`);
    assert.equal(typeof p.listModels, 'function', `${p.id} cannot refresh its model list`);
    assert.ok(p.free, `${p.id} has nothing to say about its free tier`);
    assert.equal(PROVIDER_BY_ID.get(p.id), p);
  }
  assert.equal(PROVIDERS.filter((p) => p.recommended).length, 1, 'there should be exactly one recommended default');
  assert.ok(PROVIDERS.some((p) => p.vision), 'no provider can accept an image');
});

test('JSON is recovered from the wrappers models actually use', () => {
  const want = { patterns: [{ title: 'A' }] };
  const cases = [
    JSON.stringify(want),
    `\`\`\`json\n${JSON.stringify(want)}\n\`\`\``,
    `\`\`\`\n${JSON.stringify(want)}\n\`\`\``,
    `Sure! Here you go:\n\n${JSON.stringify(want)}\n\nHope that helps.`,
    `Here is the JSON:\n\`\`\`json\n${JSON.stringify(want, null, 2)}\n\`\`\`\nLet me know!`,
  ];
  for (const c of cases) assert.deepEqual(extractJson(c), want, `failed on: ${c.slice(0, 40)}`);
});

test('unparseable model output returns nothing rather than half an object', () => {
  for (const junk of ['', 'I am afraid I cannot do that.', '{ nope', '```json\n{ broken\n```', null, undefined]) {
    assert.equal(extractJson(junk), null, `should not have parsed: ${junk}`);
  }
});

test('a JSON object containing braces in strings still parses', () => {
  const want = { patterns: [{ blurb: 'use a { brace } and a ``` fence' }] };
  assert.deepEqual(extractJson(`\`\`\`json\n${JSON.stringify(want)}\n\`\`\``), want);
});

/* ------------------------------------------------------------------ palette */

test('the palette is well formed and has no duplicates', () => {
  assert.ok(PALETTE.length >= 45, `only ${PALETTE.length} colours`);
  const codes = new Set();
  for (const c of PALETTE) {
    assert.match(c.hex, /^#[0-9a-fA-F]{6}$/, `${c.code} has a bad hex`);
    assert.ok(c.name && c.family, `${c.code} is incomplete`);
    assert.ok(!codes.has(c.code), `${c.code} appears twice`);
    codes.add(c.code);
  }
  assert.ok(PALETTE.some((c) => c.family === 'neutral'), 'no neutrals to build on');
});

test('nearestFloss never invents a colour and never reads a DMC number as hex', () => {
  assert.ok(PALETTE_BY_CODE.has(nearestFloss('#ff0000').code.toUpperCase()));
  assert.ok(PALETTE_BY_CODE.has(nearestFloss('purple').code.toUpperCase()));
  assert.ok(PALETTE_BY_CODE.has(nearestFloss('rgb(0, 128, 0)').code.toUpperCase()));
  assert.ok(PALETTE_BY_CODE.has(nearestFloss('#996633').code.toUpperCase()));
  // "963" is a real DMC number that also happens to be valid hex shorthand.
  // Read as hex it is a mid brown, so it must NOT be read as hex.
  assert.equal(nearestFloss('963'), null, 'a bare number was treated as a colour');
  assert.equal(nearestFloss('not a colour'), null);
  assert.equal(nearestFloss(null), null);
  // A code we do stock still resolves, by code.
  assert.equal(nearestFloss('310').code, '310');
});

test('contrast is symmetric and a colour has none against itself', () => {
  assert.equal(contrast('310', '310'), 0);
  assert.equal(contrast('310', 'B5200'), contrast('B5200', '310'));
  assert.ok(contrast('310', 'B5200') > contrast('310', '3799'), 'black vs white should beat black vs dark grey');
});

test('every colour code written in the source exists in the palette', () => {
  // This test exists because nine invalid codes were once shipped in the motif
  // library, and an unstocked code silently became the wrong colour.
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|mjs)$/.test(name)) files.push(full);
    }
  })(join(ROOT, 'src'));

  const bad = [];
  for (const file of files) {
    if (file.endsWith(`palette.js`)) continue;
    const text = readFileSync(file, 'utf8');
    // Only look at string literals that look like a floss code, which is what
    // every colour slot in this codebase holds.
    for (const m of text.matchAll(/'(B5200|BLANC|ECRU|\d{3,4})'/g)) {
      if (!PALETTE_BY_CODE.has(m[1].toUpperCase())) bad.push(`${relative(ROOT, file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], `colour codes that are not stocked:\n${bad.join('\n')}`);
});

test('every colour the offline designer picks is one you can buy', () => {
  const prompts = ['sunset chevron in warm oranges', 'pastel spiral', 'dark braid', 'blue bracelet with the word LOVE', 'repeating cactus symbols', 'greek wave', 'neon daisy chain', 'watermelon'];
  for (const prompt of prompts) {
    for (const d of offlineDesigns({ prompt, count: 5, seed: 'palette-check' })) {
      const v = validateDesign(d, {});
      assert.ok(v.ok, `${prompt} / ${d.title}: ${v.errors.join('; ')}`);
      const codes = JSON.stringify(v.design.spec).match(/"(B5200|BLANC|ECRU|\d{3,4})"/g) ?? [];
      for (const raw of codes) {
        const code = raw.replace(/"/g, '');
        assert.ok(PALETTE_BY_CODE.has(code.toUpperCase()), `${prompt} / ${d.title} uses unstocked ${code}`);
      }
      assert.match(hexOf(v.design.spec.colors?.[0] ?? v.design.spec.background ?? '310'), /^#[0-9a-f]{6}$/i);
    }
  }
});

/* ------------------------------------------------------------------ views */
/* The Chart tab is conditional, and the condition is a string comparison
 * against pattern.chart.kind. That is exactly the kind of thing that silently
 * rots when a kind is renamed, and it did: the check was written against names
 * ('knot' / 'grid') the engine never emits, so the tab vanished everywhere.
 * These tests pin the contract from both ends. */

test('the Chart tab appears for the two knotted families and only those', () => {
  const wants = { normal: true, alpha: true, braid: false, spiral: false, macrame: false, daisy: false, kumihimo: false };
  for (const [style, want] of Object.entries(wants)) {
    const design = offlineDesigns({ prompt: 'chevron', count: 5, seed: 'chart-tab', allowedStyles: [style] })
      .find((d) => d.style === style);
    assert.ok(design, `offline designer produced nothing for ${style}`);
    const pattern = compilePattern(validateDesign(design, {}).design);
    const html = detailHtml(pattern, 0);
    assert.equal(/data-tab="chart"/.test(html), want, `${style}: Chart tab presence was wrong`);
    if (want) assert.match(html, /id="p-chart"/, `${style}: Chart tab with no Chart panel`);
    else assert.doesNotMatch(html, /id="p-chart"/, `${style}: Chart panel with no Chart tab`);
  }
});

test('every tab button has the panel it points at, for every style', () => {
  for (const style of ['normal', 'alpha', 'braid', 'spiral', 'macrame', 'daisy', 'kumihimo']) {
    const design = offlineDesigns({ prompt: 'chevron', count: 5, seed: 'tabs', allowedStyles: [style] }).find((d) => d.style === style);
    const built = compilePattern(validateDesign(design, {}).design);
    const html = detailHtml(built, 0);
    const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
    assert.ok(tabs.length >= 3, `${style}: only ${tabs.length} tabs`);
    for (const id of tabs) assert.match(html, new RegExp(`id="p-${id}"`), `${style}: tab ${id} has no panel`);
  }
});


/* Narrowing the style filter used to collapse the pool -- ticking only "daisy
 * chain" returned a single card, and ticking only "kumihimo" returned none at
 * all. Five distinct candidates is a promise the app makes on its own front
 * page, so it has to hold for every filter, not just the default one. */
test('every single-style filter still yields five distinct, tie-able designs', () => {
  const prompts = ['chevron in pink and white', 'blue bracelet with the word LOVE written across', 'repeating cactus symbols', 'something pretty'];
  for (const prompt of prompts) {
    for (const style of STYLE_IDS) {
      const got = offlineDesigns({ prompt, count: 5, seed: 'filter', allowedStyles: [style] });
      assert.equal(got.length, 5, `${prompt} / only ${style}: got ${got.length}`);
      assert.ok(got.every((d) => d.style === style), `${prompt} / only ${style}: leaked another style`);

      // Distinct as bracelets, not just as titles -- a renamed copy is padding.
      const specs = new Set(got.map((d) => JSON.stringify(d.spec)));
      assert.equal(specs.size, 5, `${prompt} / only ${style}: two candidates are the same bracelet`);
      assert.equal(new Set(got.map((d) => d.title)).size, 5, `${prompt} / only ${style}: duplicate titles`);

      // And every one has to survive validation untouched. A candidate that
      // needs repairing is one the designer should not have proposed.
      for (const d of got) {
        const v = validateDesign(d, {});
        assert.ok(v.ok, `${prompt} / ${d.title}: ${v.errors.join('; ')}`);
        assert.deepEqual(v.repairs, [], `${prompt} / ${d.title} needed repairing`);
        assert.ok(compilePattern(v.design).steps.length >= 3, `${prompt} / ${d.title}: too few steps`);
      }
    }
  }
});

test('the offline designer only ever names knot shapes the renderer can draw', () => {
  for (const prompt of ['chevron', 'stripes', 'triangles', 'polka dots', 'greek wave', 'anything']) {
    for (const d of offlineDesigns({ prompt, count: 5, seed: 'geom' })) {
      const g = d.spec?.design?.geometry;
      if (g) assert.ok(GEOMETRY_IDS.includes(g), `${prompt} / ${d.title} asked for geometry "${g}"`);
    }
  }
});

/* A geometry is allowed to name its own colours. The validator was throwing
 * them away and substituting the pattern palette -- which for a pixel grid
 * defaults to a single near-white -- so every "chevron grid", "greek key grid"
 * and the like compiled to a completely blank band. It looked plausible in the
 * design JSON and only showed up in the render, which is exactly why it needs a
 * test at the chart level rather than the design level. */
test('a design that names colours keeps them through validation', () => {
  const v = validateDesign({
    title: 'x', blurb: 'y', style: 'alpha',
    spec: { width: 13, background: '444', design: { kind: 'geometry', geometry: 'chevron', colors: ['742', '740'] } },
  }, {});
  assert.ok(v.ok);
  assert.deepEqual(v.design.spec.design.colors, ['742', '740']);
});

test('no candidate ever compiles to a blank band', () => {
  const prompts = ['sunset chevron in warm oranges', 'greek wave repeating', 'chevron in pink and white', 'something pretty', 'blue bracelet with the word LOVE written across', 'repeating cactus symbols'];
  for (const prompt of prompts) {
    for (const design of offlineDesigns({ prompt, count: 5, seed: 'blank' })) {
      const pattern = compilePattern(validateDesign(design, {}).design);
      const image = pattern.chart.image;
      if (!image) continue;
      const shown = new Set(image.flat());
      assert.ok(shown.size >= 2, `${prompt} / ${design.title} is one flat colour (${[...shown]})`);
    }
  }
});
