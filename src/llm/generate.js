/**
 * llm/generate.js -- ask for designs, keep the ones that are real.
 *
 * The model is treated as an unreliable but imaginative collaborator. Anything
 * it returns goes straight through validateDesign(), and anything that cannot
 * be repaired into a tie-able bracelet is dropped and counted rather than
 * shown. If the provider rate-limits us halfway through we keep whatever
 * arrived instead of losing the lot -- which is exactly the situation a free
 * tier puts you in.
 */

import { PROVIDER_BY_ID, extractJson } from './providers.js';
import { systemPrompt, userPrompt, EXAMPLES } from './prompt.js';
import { validateDesign, STYLE_IDS } from '../engine/design.js';
import { compilePattern } from '../engine/compile.js';
import { makeRng, newSeed } from '../engine/rng.js';
import { offlineDesigns } from '../engine/offline.js';

/**
 * @param {object} p
 * @param {string} p.providerId
 * @param {string} p.key
 * @param {string} p.model
 * @param {string} p.prompt      what the person typed
 * @param {number} [p.count]     how many candidates to aim for
 * @param {string[]} [p.allowedStyles]
 * @param {object} [p.options]   size / fit, passed to the compiler
 * @param {Array<{mime:string,data:string}>} [p.images]
 * @param {(e:object)=>void} [p.onProgress]
 */
export async function generateDesigns({
  providerId, key, model, prompt, count = 5, allowedStyles = STYLE_IDS,
  options = {}, images = [], seed = newSeed(), signal, onProgress = () => {},
}) {
  const provider = PROVIDER_BY_ID.get(providerId);
  if (!provider) throw new Error(`unknown provider "${providerId}"`);
  if (!key) throw new Error('no API key');

  const rng = makeRng(seed);
  const system = `${systemPrompt({ allowedStyles, count })}\n\n${EXAMPLES}`;
  const patterns = [];
  const problems = [];
  const seen = new Set();
  let rateLimited = false;
  let lastError = null;

  for (let attempt = 0; attempt < 3 && patterns.length < count; attempt++) {
    const want = count - patterns.length;
    onProgress({ phase: attempt === 0 ? 'asking' : 'asking-more', have: patterns.length, want: count });

    let text;
    try {
      text = await provider.complete({
        key,
        model,
        system,
        user: userPrompt({
          prompt,
          count: Math.max(want, attempt === 0 ? count : want + 1),
          allowedStyles,
          size: options.sizeLabel,
          seed: `${seed}-${attempt}-${rng.int(0, 9999)}`,
          avoid: patterns.map((p) => p.title),
          hasImage: images.length > 0,
        }),
        images: provider.vision ? images : [],
        temperature: attempt === 0 ? 0.9 : 1.05,
        signal,
      });
    } catch (err) {
      lastError = err;
      if (err.status === 429) { rateLimited = true; break; }
      if (!err.retryable || attempt === 2) break;
      await sleep(700 * (attempt + 1));
      continue;
    }

    const parsed = extractJson(text);
    const list = Array.isArray(parsed) ? parsed : parsed?.designs ?? parsed?.bracelets ?? (parsed?.style ? [parsed] : []);
    if (!list.length) {
      problems.push('the model replied with something that was not a list of designs');
      continue;
    }

    onProgress({ phase: 'checking', have: patterns.length, want: count, got: list.length });

    for (const raw of list) {
      if (patterns.length >= count) break;
      const built = buildOne(raw, { allowedStyles, options, source: provider.label });
      if (!built.ok) { problems.push(built.error); continue; }
      const key2 = fingerprint(built.pattern);
      if (seen.has(key2)) continue;
      seen.add(key2);
      patterns.push(built.pattern);
    }
  }

  // A free tier that ran dry mid-way should still leave you with a bracelet.
  let filledOffline = 0;
  if (patterns.length < count) {
    for (const d of offlineDesigns({ prompt, count: count - patterns.length, allowedStyles, seed: `${seed}-fill` })) {
      const built = buildOne(d, { allowedStyles, options, source: 'built in' });
      if (!built.ok) continue;
      const k = fingerprint(built.pattern);
      if (seen.has(k)) continue;
      seen.add(k);
      patterns.push(built.pattern);
      filledOffline++;
    }
  }

  return {
    patterns,
    seed,
    problems,
    rateLimited,
    filledOffline,
    error: patterns.length ? null : lastError,
  };
}

/** Validate, repair and compile a single raw design. */
export function buildOne(raw, { allowedStyles, options, source = '' }) {
  const v = validateDesign(raw, { allowedStyles });
  if (!v.ok) return { ok: false, error: `"${raw?.title ?? 'untitled'}": ${v.errors.join('; ')}` };
  try {
    const pattern = compilePattern(v.design, options);
    pattern.repairs = v.repairs;
    pattern.warnings = [...pattern.warnings, ...v.warnings];
    pattern.source = source;
    return { ok: true, pattern };
  } catch (err) {
    return { ok: false, error: `"${v.design.title}": ${err.message}` };
  }
}

/** Two designs that would knot up identically are the same design. */
function fingerprint(p) {
  const spec = JSON.stringify(p.design.spec);
  return `${p.style}:${spec}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
