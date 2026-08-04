/**
 * The LLM path, end to end, with the network stubbed.
 *
 * This is the one part of the app I cannot exercise with the rest of the suite
 * without a real API key and a real request, so instead the provider's fetch is
 * replaced and fed the kind of answer a model actually returns: fenced JSON,
 * an extra prose sentence, a style name that is close but not exact, a colour
 * given as a word rather than a DMC code, and one design that simply cannot be
 * tied. What comes back has to be five finished patterns regardless.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { generateDesigns, buildOne } from '../src/llm/generate.js';
import { PROVIDER_BY_ID } from '../src/llm/providers.js';

const GOOD = [
  {
    title: 'Watermelon Daisies',
    blurb: 'Daisies with a watermelon slice between each one.',
    style: 'daisy',
    spec: { petal: 'B5200', centre: '444', stem: '700', spacing: 8, petalsPerSide: 3 },
  },
  {
    title: 'Watermelon Repeat',
    blurb: 'A row of watermelon slices down the band.',
    style: 'alpha',
    spec: { width: 13, background: '3811', design: { kind: 'motif', motif: 'watermelon', gapY: 2 } },
  },
  {
    // Style name a model would plausibly use, but not one of our ids.
    title: 'Melon Chevron',
    blurb: 'A chevron in melon colours.',
    style: 'chevron',
    spec: { strands: 12, colors: ['666', '3811', '700'], design: { kind: 'geometry', geometry: 'chevron' } },
  },
  {
    // Colours as words, which the engine has to snap to real floss.
    title: 'Melon Spiral',
    blurb: 'A spiral in pink and green.',
    style: 'spiral',
    spec: { kind: 'chinese-staircase', core: ['pink'], sequence: [{ color: 'green', hitches: 10 }] },
  },
  {
    title: 'Melon Braid',
    blurb: 'A four-strand round braid.',
    style: 'braid',
    spec: { kind: 'braid-4-round', colors: ['666', 'B5200', '700', '3811'] },
  },
];

const UNTIEABLE = {
  title: 'Impossible Band',
  blurb: 'Nine hundred strands.',
  style: 'banana',
  spec: { strands: 4000, colors: [] },
};

/** Wrap designs the way a model really replies: fenced, with chatter around it. */
const reply = (designs) =>
  `Here are some ideas for you!\n\n\`\`\`json\n${JSON.stringify({ designs })}\n\`\`\`\n\nHave fun knotting.`;

function stubFetch(bodies) {
  const calls = [];
  let i = 0;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const body = bodies[Math.min(i++, bodies.length - 1)];
    if (body instanceof Error) throw body;
    if (typeof body === 'number') {
      return { ok: false, status: body, statusText: 'nope', text: async () => '{"error":"rate"}' };
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  return calls;
}

/** The Gemini response envelope, which is what the app's default provider parses. */
const gemini = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });

const original = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = original; });

test('a realistic model reply becomes five finished patterns', async () => {
  const calls = stubFetch([gemini(reply([...GOOD, UNTIEABLE]))]);

  const out = await generateDesigns({
    providerId: 'gemini', key: 'test-key', model: 'gemini-2.5-flash',
    prompt: 'daisy chain with little watermelons between them',
    seed: 'fixed-seed',
  });

  assert.equal(out.patterns.length, 5);
  assert.equal(calls.length, 1, 'one good reply should not need a retry');

  for (const p of out.patterns) {
    assert.ok(p.title && p.blurb, 'every pattern needs a name and a description');
    assert.ok(p.materials.length >= 1, `${p.title} has no materials`);
    assert.ok(p.steps.length >= 3, `${p.title} has too few steps`);
    assert.ok(p.totals.strands >= 2, `${p.title} has too few strands`);
    // Cut lengths have to be real numbers a person can measure.
    for (const m of p.materials) {
      assert.ok(Number.isFinite(m.cutInches) && m.cutInches > 0, `${p.title}: bad cut length`);
    }
  }
});

test('the design the model got wrong is repaired, not passed through', async () => {
  stubFetch([gemini(reply(GOOD))]);
  const out = await generateDesigns({
    providerId: 'gemini', key: 'k', model: 'm', prompt: 'watermelons', seed: 's',
  });
  // "chevron" is not one of our style ids; it has to have been snapped to the
  // diagonal-knot family rather than dropped.
  const snapped = out.patterns.find((p) => p.title === 'Melon Chevron');
  assert.ok(snapped, 'the chevron design was dropped instead of snapped');
  assert.equal(snapped.style, 'normal');

  // "pink" and "green" are not DMC codes. They have to have become real floss.
  const spiral = out.patterns.find((p) => p.title === 'Melon Spiral');
  assert.ok(spiral);
  for (const m of spiral.materials) assert.match(m.code, /^(B5200|BLANC|ECRU|\d{3,4})$/);
});

test('an un-tie-able design is rejected with a reason, and the rest still arrive', () => {
  const built = buildOne(UNTIEABLE, { options: {} });
  assert.equal(built.ok, false);
  assert.ok(built.error && built.error.length > 0, 'a rejection has to say why');
});

test('a rate-limited free tier still hands back five bracelets', async () => {
  stubFetch([429]);
  const out = await generateDesigns({
    providerId: 'gemini', key: 'k', model: 'm',
    prompt: 'sunset chevron in warm oranges', seed: 'rl',
  });
  assert.equal(out.rateLimited, true);
  assert.equal(out.patterns.length, 5, 'the offline designer should have filled in');
  assert.equal(out.filledOffline, 5);
  assert.equal(out.error, null);
});

test('a model that returns prose instead of designs is retried, then filled in', async () => {
  const calls = stubFetch([gemini('I am sorry, I cannot help with that.')]);
  const out = await generateDesigns({
    providerId: 'gemini', key: 'k', model: 'm', prompt: 'greek wave', seed: 'prose',
  });
  assert.ok(calls.length > 1, 'a useless reply should be retried');
  assert.equal(out.patterns.length, 5);
  assert.ok(out.problems.length > 0, 'the failure should be reported, not hidden');
});

test('a half-empty reply is topped up rather than shown short', async () => {
  stubFetch([gemini(reply(GOOD.slice(0, 2))), gemini(reply([]))]);
  const out = await generateDesigns({
    providerId: 'gemini', key: 'k', model: 'm', prompt: 'watermelons', seed: 'half',
  });
  assert.equal(out.patterns.length, 5);
  assert.ok(out.filledOffline >= 1);
});

test('duplicate designs in one reply are not shown twice', async () => {
  stubFetch([gemini(reply([GOOD[0], GOOD[0], GOOD[0], GOOD[1], GOOD[2]]))]);
  const out = await generateDesigns({
    providerId: 'gemini', key: 'k', model: 'm', prompt: 'watermelons', seed: 'dupe',
  });
  const titles = out.patterns.map((p) => p.title);
  assert.equal(new Set(titles).size, titles.length, `repeated designs got through: ${titles}`);
});

test('the request actually carries the key, the model and the image', async () => {
  const calls = stubFetch([gemini(reply(GOOD))]);
  await generateDesigns({
    providerId: 'gemini', key: 'secret-key', model: 'gemini-2.5-flash',
    prompt: 'a picture of this', seed: 'img',
    images: [{ mime: 'image/png', data: 'iVBORw0KGgo=' }],
  });
  const { url, init } = calls[0];
  assert.match(url, /gemini-2\.5-flash/);
  const sent = `${url} ${JSON.stringify(init.headers ?? {})}`;
  assert.ok(sent.includes('secret-key'), 'the key never reached the provider');
  const body = JSON.parse(init.body);
  const parts = JSON.stringify(body);
  assert.ok(parts.includes('iVBORw0KGgo='), 'the uploaded image was not sent');
  assert.ok(parts.includes('a picture of this'), 'the prompt was not sent');
});

test('no key is an error the UI can show, not a crash', async () => {
  await assert.rejects(
    () => generateDesigns({ providerId: 'gemini', key: '', model: 'm', prompt: 'x' }),
    /no API key/,
  );
  await assert.rejects(
    () => generateDesigns({ providerId: 'nope', key: 'k', model: 'm', prompt: 'x' }),
    /unknown provider/,
  );
});

test('every provider builds a request without throwing', async () => {
  for (const id of ['gemini', 'groq', 'openrouter', 'anthropic']) {
    const provider = PROVIDER_BY_ID.get(id);
    const calls = stubFetch([
      id === 'gemini' ? gemini(reply(GOOD))
        : id === 'anthropic' ? { content: [{ type: 'text', text: reply(GOOD) }] }
          : { choices: [{ message: { content: reply(GOOD) } }] },
    ]);
    const text = await provider.complete({
      key: 'k', model: provider.models[0].id, system: 'sys', user: 'usr', images: [], temperature: 1,
    });
    assert.ok(text.includes('Watermelon Daisies'), `${id} did not return the model's text`);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith('https://'), `${id} used a non-https endpoint`);
  }
});
