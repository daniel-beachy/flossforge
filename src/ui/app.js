/**
 * ui/app.js -- wiring.
 *
 * State lives in one object, the URL hash carries a whole design so it can be
 * shared, and nothing here knows anything about knots: it asks the engine and
 * shows what comes back.
 */

import { SIZES, FITS } from '../engine/sizing.js';
import { STYLES, STYLE_IDS } from '../engine/design.js';
import { offlineDesigns } from '../engine/offline.js';
import { generateDesigns, buildOne } from '../llm/generate.js';
import { PROVIDERS, PROVIDER_BY_ID } from '../llm/providers.js';
import { encodeShare, decodeShare, shareUrl, readHash, newSeed } from '../engine/share.js';
import {
  cardHtml, detailHtml, followFrames, followFrameHtml, providerHelpHtml, KNOT_HELP,
} from './views.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STORE = 'flossforge.v1';

const state = {
  patterns: [],
  chosen: -1,
  frames: [],
  frame: 0,
  image: null,
  busy: false,
  prefs: load(),
};

function load() {
  try {
    return { provider: 'gemini', key: '', model: '', styles: STYLE_IDS.slice(), ...JSON.parse(localStorage.getItem(STORE) ?? '{}') };
  } catch {
    return { provider: 'gemini', key: '', model: '', styles: STYLE_IDS.slice() };
  }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state.prefs)); } catch { /* private mode */ }
}

/* =================================================================== boot */

function boot() {
  fillSizes();
  fillStyles();
  fillProviders();
  fillKnotHelp();
  wire();
  markKey();
  $('#seed').value = newSeed();
  restoreFromHash();
}

function fillSizes() {
  const sel = $('#size');
  const groups = new Map();
  for (const s of SIZES) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push(s);
  }
  sel.innerHTML = [...groups.entries()].map(([g, list]) =>
    `<optgroup label="${g}">${list.map((s) =>
      `<option value="${s.id}">${s.label}${s.wrist ? ` — ${s.wrist}"` : ''}</option>`).join('')}</optgroup>`).join('');
  sel.value = state.prefs.size ?? 'adult';

  $('#fit').innerHTML = FITS.map((f) => `<option value="${f.id}">${f.label}</option>`).join('');
  $('#fit').value = state.prefs.fit ?? 'standard';
  syncCustom();
}

function syncCustom() {
  const custom = SIZES.find((s) => s.id === $('#size').value)?.custom;
  $('#custom').hidden = !custom;
  $('#custom-label').hidden = !custom;
}

function fillStyles() {
  const on = new Set(state.prefs.styles?.length ? state.prefs.styles : STYLE_IDS);
  $('#stylegrid').innerHTML = STYLES.map((s) =>
    `<label class="styletog" title="${s.blurb.replace(/"/g, '&quot;')}">
      <input type="checkbox" value="${s.id}" ${on.has(s.id) ? 'checked' : ''}>
      <span>${s.label}</span>
    </label>`).join('');
}

function fillProviders() {
  $('#provider').innerHTML = PROVIDERS.map((p) =>
    `<option value="${p.id}">${p.label}${p.recommended ? ' — recommended' : ''}</option>`).join('');
  $('#provider').value = state.prefs.provider ?? 'gemini';
  syncProvider();
}

function syncProvider(keepModel = false) {
  const p = PROVIDER_BY_ID.get($('#provider').value);
  $('#provider-help').innerHTML = providerHelpHtml(p);
  const want = keepModel ? $('#model').value : (state.prefs.provider === p.id ? state.prefs.model : '');
  $('#model').innerHTML = p.models.map((m) =>
    `<option value="${m.id}">${m.label}${m.note ? ` — ${m.note}` : ''}</option>`).join('');
  if (want && p.models.some((m) => m.id === want)) $('#model').value = want;
  $('#apikey').value = state.prefs.provider === p.id ? (state.prefs.key ?? '') : '';
  $('#image').disabled = !p.vision;
  $('#image').closest('.field').style.opacity = p.vision ? '' : '.55';
}

function fillKnotHelp() {
  $('#knotlist').innerHTML = KNOT_HELP.map(([sym, name, how]) =>
    `<li><b>${sym === '\\' ? '\\' : sym}</b><span><strong>${name}</strong> — ${how}</span></li>`).join('');
}

function markKey() {
  const has = Boolean(state.prefs.key);
  $('#key-dot').classList.toggle('on', has);
  const p = PROVIDER_BY_ID.get(state.prefs.provider);
  $('#gonote').textContent = has
    ? `Designing with ${p?.label ?? 'your model'}.`
    : 'No AI key yet — using the built-in designer. Add a key for much better ideas.';
}

/* =================================================================== wiring */

function wire() {
  $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
  $('#size').addEventListener('change', syncCustom);
  $('#reseed').addEventListener('click', () => { $('#seed').value = newSeed(); });

  $('#examples').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    $('#prompt').value = b.textContent.trim();
    $('#prompt').focus();
  });

  $$('[data-open]').forEach((b) => b.addEventListener('click', () => $(`#${b.dataset.open}`).showModal()));

  $('#provider').addEventListener('change', () => syncProvider());
  $('#peek').addEventListener('click', () => {
    const f = $('#apikey');
    f.type = f.type === 'password' ? 'text' : 'password';
  });
  $('#save-key').addEventListener('click', saveKey);
  $('#test-key').addEventListener('click', testKey);
  $('#refresh-models').addEventListener('click', refreshModels);

  $('#image').addEventListener('change', pickImage);
  $('#clear-image').addEventListener('click', clearImage);

  $('#cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) choose(Number(b.dataset.pick));
  });

  $('#detail').addEventListener('click', detailClick);
  document.addEventListener('keydown', keys);
  window.addEventListener('hashchange', restoreFromHash);
}

/* ================================================================ generate */

async function run() {
  if (state.busy) return;
  const prompt = $('#prompt').value.trim();
  if (!prompt) return;

  const opts = readOptions();
  state.prefs.size = opts.size;
  state.prefs.fit = opts.fit;
  state.prefs.styles = opts.styles;
  save();

  busy(true);
  showSkeletons();

  const seed = $('#seed').value.trim() || newSeed();
  let note = '';
  let problems = [];

  try {
    if (state.prefs.key) {
      const res = await generateDesigns({
        providerId: state.prefs.provider,
        key: state.prefs.key,
        model: state.prefs.model || PROVIDER_BY_ID.get(state.prefs.provider).models[0].id,
        prompt,
        count: 5,
        allowedStyles: opts.styles,
        options: opts.compile,
        images: state.image ? [state.image] : [],
        seed,
        onProgress: (e) => progress(e),
      });
      state.patterns = res.patterns;
      problems = res.problems;
      if (res.rateLimited) note = 'The provider rate-limited us partway through, so this is what got through. Wait a minute and try again for more.';
      if (res.filledOffline) note += `${note ? ' ' : ''}${res.filledOffline} of these came from the built-in designer.`;
      if (!res.patterns.length && res.error) throw res.error;
    } else {
      state.patterns = offlineList(prompt, opts, seed);
      note = 'Built-in designer — no AI key set.';
    }
  } catch (err) {
    console.error(err);
    state.patterns = offlineList(prompt, opts, seed);
    note = `${err.message ?? err} Falling back to the built-in designer.`;
  }

  busy(false);
  showResults(note, problems);
}

function offlineList(prompt, opts, seed) {
  return offlineDesigns({ prompt, count: 5, allowedStyles: opts.styles, seed })
    .map((d) => buildOne(d, { allowedStyles: opts.styles, options: opts.compile, source: 'built in' }))
    .filter((r) => r.ok)
    .map((r) => r.pattern);
}

function readOptions() {
  const styles = $$('#stylegrid input:checked').map((i) => i.value);
  const size = $('#size').value;
  const fit = $('#fit').value;
  const sizeDef = SIZES.find((s) => s.id === size);
  return {
    size, fit, styles: styles.length ? styles : STYLE_IDS,
    compile: { size, fit, custom: Number($('#custom').value) || undefined, sizeLabel: `${sizeDef?.label ?? size}, ${fit} fit` },
  };
}

function busy(on) {
  state.busy = on;
  const b = $('#go');
  b.disabled = on;
  b.classList.toggle('busy', on);
  $('.go-label', b).textContent = on ? 'Designing' : 'Design 5 bracelets';
}

function progress(e) {
  const label = {
    asking: 'Asking the model', 'asking-more': 'Asking for a few more', checking: 'Checking they can be tied',
  }[e.phase];
  if (label) $('.go-label', $('#go')).textContent = label;
}

function showSkeletons() {
  $('#results').hidden = false;
  $('#detail').hidden = true;
  $('#results-title').textContent = 'Designing…';
  $('#results-note').textContent = '';
  $('#results-problems').hidden = true;
  $('#cards').innerHTML = Array.from({ length: 5 }, () => '<div class="skel"></div>').join('');
  $('#results').scrollIntoView({ block: 'start' });
}

function showResults(note, problems = []) {
  const n = state.patterns.length;
  $('#results-title').textContent = n === 1 ? 'One idea' : `${['No', 'One', 'Two', 'Three', 'Four', 'Five'][n] ?? n} ideas`;
  $('#results-note').textContent = note ?? '';
  $('#cards').innerHTML = n
    ? state.patterns.map((p, i) => cardHtml(p, i)).join('')
    : '<p class="muted">Nothing came back. Try rewording it, or check your key.</p>';

  const box = $('#results-problems');
  if (problems.length) {
    box.hidden = false;
    box.innerHTML = `<strong>${problems.length} suggestion${problems.length === 1 ? ' was' : 's were'} thrown away because ${problems.length === 1 ? 'it could not' : 'they could not'} be tied.</strong>
      <ul>${problems.slice(0, 4).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
  } else {
    box.hidden = true;
  }
  if (n) choose(0, false);
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ================================================================== detail */

function choose(i, scroll = true) {
  const p = state.patterns[i];
  if (!p) return;
  state.chosen = i;
  $$('[data-pick]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.pick) === i)));
  const d = $('#detail');
  d.hidden = false;
  d.innerHTML = detailHtml(p);
  state.frames = followFrames(p);
  state.frame = 0;
  drawFollow();
  writeHash(p);
  if (scroll) d.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function detailClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) return showTab(tab.dataset.tab);

  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') {
    $('#detail').hidden = true;
    $('#results').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  if (act === 'print') window.print();
  if (act === 'share') copyShare(e.target.closest('[data-act]'));

  const f = e.target.closest('[data-follow]')?.dataset.follow;
  if (f) step(f === 'next' ? 1 : -1);
}

function showTab(id) {
  $$('#detail .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
  $$('#detail .panel').forEach((p) => { p.hidden = p.id !== `p-${id}`; });
  if (id === 'follow') drawFollow();
}

function step(dir) {
  state.frame = Math.max(0, Math.min(state.frames.length - 1, state.frame + dir));
  drawFollow();
}

function drawFollow() {
  const card = $('#follow-card');
  if (!card || !state.frames.length) return;
  const p = state.patterns[state.chosen];
  card.innerHTML = followFrameHtml(state.frames[state.frame], p, state.frame, state.frames.length);
  $('#follow-count').textContent = `${state.frame + 1} of ${state.frames.length}`;
  $('#follow-bar').style.width = `${((state.frame + 1) / state.frames.length) * 100}%`;
}

function keys(e) {
  if ($('#p-follow')?.hidden !== false) return;
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); step(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
}

/* =================================================================== share */

function writeHash(p) {
  const o = readOptions();
  const payload = encodeShare({ design: p.design, options: o.compile, seed: $('#seed').value, prompt: $('#prompt').value });
  history.replaceState(null, '', `#${payload}`);
}

async function copyShare(btn) {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    const was = btn.textContent;
    btn.textContent = 'Link copied';
    setTimeout(() => { btn.textContent = was; }, 1600);
  } catch {
    prompt('Copy this link:', url);
  }
}

function restoreFromHash() {
  const raw = readHash();
  if (!raw) return;
  let data;
  try { data = decodeShare(raw); } catch { return; }
  if (!data?.design) return;
  const built = buildOne(data.design, { options: data.options ?? {}, source: 'shared link' });
  if (!built.ok) return;
  if (data.prompt) $('#prompt').value = data.prompt;
  if (data.seed) $('#seed').value = data.seed;
  if (data.options?.size) $('#size').value = data.options.size;
  if (data.options?.fit) $('#fit').value = data.options.fit;
  state.patterns = [built.pattern];
  $('#results').hidden = false;
  showResults('Opened from a shared link. Change anything above and design a fresh set.');
}

/* ==================================================================== keys */

function saveKey() {
  state.prefs.provider = $('#provider').value;
  state.prefs.key = $('#apikey').value.trim();
  state.prefs.model = $('#model').value;
  save();
  markKey();
  status(state.prefs.key ? 'Saved to this browser.' : 'Key cleared.', state.prefs.key ? 'ok' : '');
  if (state.prefs.key) setTimeout(() => $('#keys').close(), 700);
}

async function testKey() {
  const p = PROVIDER_BY_ID.get($('#provider').value);
  const key = $('#apikey').value.trim();
  if (!key) return status('Paste a key first.', 'bad');
  status('Testing…');
  try {
    const out = await p.complete({
      key, model: $('#model').value,
      system: 'Reply with the single word: ready',
      user: 'ready?',
      temperature: 0,
    });
    status(`Working — the model said “${String(out).trim().slice(0, 40)}”.`, 'ok');
  } catch (err) {
    status(err.message ?? String(err), 'bad');
  }
}

async function refreshModels() {
  const p = PROVIDER_BY_ID.get($('#provider').value);
  const key = $('#apikey').value.trim();
  if (!key) return status('Paste a key first — the list comes from the provider.', 'bad');
  status('Fetching the current model list…');
  try {
    const models = await p.listModels(key);
    if (!models.length) return status('The provider returned no usable models.', 'bad');
    const keep = $('#model').value;
    $('#model').innerHTML = models.map((m) => `<option value="${m.id}">${m.label ?? m.id}${m.note ? ` — ${m.note}` : ''}</option>`).join('');
    if (models.some((m) => m.id === keep)) $('#model').value = keep;
    status(`${models.length} models available right now.`, 'ok');
  } catch (err) {
    status(err.message ?? String(err), 'bad');
  }
}

function status(msg, cls = '') {
  const el = $('#key-status');
  el.textContent = msg;
  el.className = `keystatus ${cls}`;
}

/* =================================================================== image */

function pickImage(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    alert('That image is over 4 MB. Try a smaller one.');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result);
    state.image = { mime: file.type, data: url.split(',')[1] };
    $('#image-preview').hidden = false;
    $('#image-preview').innerHTML = `<img src="${url}" alt="">`;
    $('#clear-image').hidden = false;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  state.image = null;
  $('#image').value = '';
  $('#image-preview').hidden = true;
  $('#image-preview').innerHTML = '';
  $('#clear-image').hidden = true;
}

boot();
