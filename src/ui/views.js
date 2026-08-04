/**
 * ui/views.js -- pure functions from a pattern to HTML.
 *
 * Kept separate from app.js so every one of these can be rendered and eyeballed
 * without a browser event ever firing.
 */

import { previewSvg, chartSvg, swatchSvg } from '../engine/render.js';
import { hexOf, nameOf, shortName, textOn } from '../engine/palette.js';
import { STYLE_BY_ID } from '../engine/design.js';

// Prose from the engine and from the model both use "--" for an em dash, and
// straight quotes. Fixing it once here beats fixing it in a hundred strings.
const typo = (s) => String(s ?? '')
  .replace(/(\s)--(\s)/g, '$1\u2014$2')
  .replace(/(\w)--(\w)/g, '$1\u2014$2');

const esc = (s) => typo(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = (s) => esc(s).split('\n').filter((l) => l.trim()).map((l) => `<p>${l}</p>`).join('');

/* ------------------------------------------------------------------- cards */

export function cardHtml(pattern, i) {
  const diff = ['', 'Very easy', 'Easy', 'Steady', 'Fiddly', 'A project'][pattern.difficulty] ?? '';
  const flags = [];
  if (pattern.repairs?.length) flags.push(`<span class="tag warn" title="${esc(pattern.repairs.map((r) => r.why).join(' — '))}">adjusted</span>`);
  if (pattern.fidelity != null && pattern.fidelity < 0.995) flags.push(`<span class="tag warn">${Math.round(pattern.fidelity * 100)}% match</span>`);
  if (pattern.needsTool) flags.push(`<span class="tag">needs a ${esc(pattern.needsTool)}</span>`);

  return `<button type="button" class="pcard" data-pick="${i}" aria-current="false">
    <span class="pcard-art">${previewSvg(pattern, { width: 96, rows: 40 })}</span>
    <span class="pcard-body">
      <h3>${esc(pattern.title)}</h3>
      <p>${esc(pattern.blurb)}</p>
      <span class="pcard-meta">
        <span class="tag style">${esc(pattern.styleLabel)}</span>
        ${diff ? `<span class="tag">${diff}</span>` : ''}
        <span class="tag">${hours(pattern.timeMinutes)}</span>
        ${flags.join('')}
      </span>
    </span>
  </button>`;
}

function hours(mins) {
  if (!mins) return '';
  if (mins < 90) return `${Math.round(mins / 5) * 5} min`;
  return `${(mins / 60).toFixed(mins < 300 ? 1 : 0).replace('.0', '')} hr`;
}

/* ------------------------------------------------------------------ detail */

export function detailHtml(pattern) {
  return `<div class="detail-in">
    <div class="dhead">
      <div>
        <h2>${esc(pattern.title)}</h2>
        <p>${esc(pattern.blurb)}</p>
      </div>
      <div class="dactions">
        <button type="button" class="ghost" data-act="share">Copy link</button>
        <button type="button" class="ghost" data-act="print">Print</button>
        <button type="button" class="ghost" data-act="close">Back to ideas</button>
      </div>
    </div>

    <div class="tabs" role="tablist">
      ${tab('overview', 'Overview', true)}
      ${hasChart(pattern) ? tab('chart', 'Chart') : ''}
      ${tab('steps', 'Instructions')}
      ${tab('follow', 'Follow along')}
    </div>

    <div class="panel" id="p-overview" role="tabpanel">${overviewHtml(pattern)}</div>
    ${hasChart(pattern) ? `<div class="panel" id="p-chart" role="tabpanel" hidden>${chartHtml(pattern)}</div>` : ''}
    <div class="panel" id="p-steps" role="tabpanel" hidden>${stepsHtml(pattern)}</div>
    <div class="panel" id="p-follow" role="tabpanel" hidden>${followShell()}</div>
  </div>`;
}

/** Braids, spirals and macrame have no knot grid -- an empty Chart tab is worse
 *  than no Chart tab, so those styles just don't get one. Only the two knotted
 *  families produce a real chart; everything else sets chart.kind to its own
 *  construction family (braid, spiral, macrame, daisy, kumihimo). */
const hasChart = (p) => p.chart?.kind === 'normal' || p.chart?.kind === 'alpha';

const tab = (id, label, on = false) =>
  `<button type="button" class="tab" role="tab" data-tab="${id}" aria-selected="${on}" aria-controls="p-${id}">${label}</button>`;

/* ---------------------------------------------------------------- overview */

function overviewHtml(p) {
  return `<div class="split">
    <div>
      <div class="bandbox">
        ${previewSvg(p, { width: 200 })}
        <p class="bandcap">${esc(p.band.text)} of band · ${esc(p.band.label)}, ${esc(p.band.fit).toLowerCase()} fit</p>
      </div>
    </div>
    <div>
      ${noticeHtml(p)}

      <section class="block">
        <h3>What you need</h3>
        <p class="sub">${p.totals.colors} colours · ${p.totals.strands} strands · about ${p.totals.skeins} skein${p.totals.skeins === 1 ? '' : 's'} of floss in total${p.needsTool ? ` · plus a ${esc(p.needsTool)}` : ''}</p>
        <table>
          <thead><tr><th>Colour</th><th>Used for</th><th class="num">Strands</th><th class="num nowrap">Cut each</th></tr></thead>
          <tbody>
            ${p.materials.map(matRow).join('')}
          </tbody>
        </table>
        <p class="maths" style="margin-top:.9rem">Total floss ${esc(p.totals.text)}.</p>
      </section>

      <section class="block">
        <h3>Where those lengths come from</h3>
        <p class="sub">Nothing here is a rule of thumb — it is counted off the actual knots, so you can check it.</p>
        ${p.materials.map(mathsRow).join('')}
      </section>

      ${p.notes?.length ? `<section class="block">
        <h3>Worth knowing</h3>
        <ul class="steps" style="padding-left:1.1rem">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </section>` : ''}
    </div>
  </div>`;
}

function matRow(m) {
  return `<tr>
    <td><span class="dot" style="background:${hexOf(m.code)}"></span>${esc(shortName(m.code))} <span class="muted small">${esc(m.code)}</span></td>
    <td class="muted">${esc(m.roles.join(', '))}</td>
    <td class="num">${m.count}</td>
    <td class="num nowrap">${esc(m.cutText)}</td>
  </tr>`;
}

function mathsRow(m) {
  return `<div style="margin-bottom:1rem">
    <strong><span class="dot" style="background:${hexOf(m.code)}"></span>${esc(shortName(m.code))}</strong>
    <span class="muted small"> — ${m.count} strand${m.count === 1 ? '' : 's'} at ${esc(m.cutText)}</span>
    <p class="maths">${m.steps.map((s) => `<span>${esc(s)}</span>`).join('')}</p>
  </div>`;
}

function noticeHtml(p) {
  const bits = [];
  if (p.repairs?.length) {
    bits.push(`<strong>The design was adjusted so it can actually be tied.</strong><ul>${
      p.repairs.map((r) => `<li>${esc(r.why)}</li>`).join('')}</ul>`);
  }
  if (p.warnings?.length) {
    bits.push(`<ul>${p.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`);
  }
  if (p.fidelity != null && p.fidelity < 0.995) {
    bits.push(`<strong>This is a ${Math.round(p.fidelity * 100)}% match to the picture asked for.</strong>
      Diagonal-knot bracelets can only put colour where two strands meet, so some shapes can be approached but not hit exactly. What is drawn below is what you will actually get.`);
  }
  return bits.length ? `<div class="notice">${bits.join('')}</div>` : '';
}

/* ------------------------------------------------------------------- chart */

function chartHtml(p) {
  const known = { F: 'forward', B: 'backward', FB: 'forward-backward', BF: 'backward-forward' };
  const used = new Set();
  for (const row of p.chart.knots ?? []) for (const k of row ?? []) if (k?.knot) used.add(k.knot);
  const legend = [...used].map((k) => `<span><b>${symbolOf(k)}</b> ${known[k] ?? k}</span>`).join('');

  return `<div class="chartbox">${chartSvg(p, { rows: 0 })}</div>
    ${legend ? `<div class="legend">${legend}</div>` : ''}
    <p class="muted small" style="margin-top:1rem">
      ${p.chart.repeat ? `The chart shows one repeat of ${p.chart.repeat} rows. Work it ${Math.max(1, Math.round((p.chart.rowCount ?? p.chart.repeat) / p.chart.repeat))} times for the full ${esc(p.band.text)}.` : ''}
      Each square is one knot; the arrow is the direction to pull it, and the colour is the string that ends up showing.
    </p>`;
}

const symbolOf = (k) => ({ F: '/', B: '\\', FB: '>', BF: '<' }[k] ?? k);

/* -------------------------------------------------------------------- steps */

export function stepsHtml(p) {
  return `<div class="steps">${p.steps.map((s) => stepHtml(s, p)).join('')}</div>`;
}

function stepHtml(s, p) {
  return `<article class="step">
    <div class="step-n">${s.n}</div>
    <div>
      <h4>${esc(s.title)}</h4>
      ${para(s.body)}
      ${s.setup ? setupStrip(s.setup) : ''}
      ${s.knots ? '' : ''}
      ${s.rowGuide ? rowPreviewStrip(s, p) : ''}
      ${s.repeats ? `<p class="why">${esc(s.repeats)}</p>` : ''}
    </div>
  </article>`;
}

function setupStrip(setup) {
  return `<div class="rowguide">${setup.map((c, i) =>
    `<span class="kchip" style="background:${hexOf(c)};color:${textOn(c)}" title="${esc(nameOf(c))}">${i + 1}</span>`).join('')}</div>`;
}

/** The first couple of rows, so the written step has something to point at. */
function rowPreviewStrip(s, p) {
  const rows = s.rowGuide.slice(0, Math.min(s.repeat || 4, 4));
  return rows.map((r) => `
    <div style="margin:.5rem 0">
      <span class="muted small">Row ${r.number}${r.arrow ? ` ${r.arrow}` : ''}</span>
      ${knotChips(r)}
    </div>`).join('') + (s.rowGuide.length > rows.length
    ? `<p class="why">…and so on. Use the Follow along tab to step through all ${s.totalRows} rows one at a time.</p>` : '');
}

export function knotChips(r) {
  if (r.runs) {
    return `<div class="rowguide">${r.runs.map((run) =>
      `<span class="kchip" style="background:${hexOf(run.color)};color:${textOn(run.color)}" title="${esc(nameOf(run.color))}">${run.count}×${run.symbol}</span>`).join('')}</div>`;
  }
  return `<div class="rowguide">${(r.knots ?? []).map((k) =>
    `<span class="kchip" style="background:${hexOf(k.color)};color:${textOn(k.color)}" title="${esc(nameOf(k.color))}">${k.symbol}</span>`).join('')}</div>`;
}

/* ---------------------------------------------------------------- follow */

function followShell() {
  return `<div class="follow">
    <div class="progress"><i id="follow-bar" style="width:0%"></i></div>
    <div class="followcard" id="follow-card"></div>
    <div class="followbar">
      <button type="button" class="ghost" data-follow="prev">← Back</button>
      <span class="count" id="follow-count"></span>
      <button type="button" class="primary" data-follow="next">Next →</button>
    </div>
  </div>`;
}

/**
 * One card at a time. Preparation steps are shown whole; the long knotting step
 * is exploded into one card per row, because "row 63 of 147" is the thing you
 * actually need when you pick the bracelet back up.
 */
export function followFrames(p) {
  const frames = [];
  for (const s of p.steps) {
    if (s.rowGuide && s.rowGuide.length > 1) {
      frames.push({ kind: 'lead', step: s });
      s.rowGuide.forEach((r, i) => frames.push({ kind: 'row', step: s, row: r, i }));
    } else {
      frames.push({ kind: 'step', step: s });
    }
  }
  return frames;
}

export function followFrameHtml(f, p, idx, total) {
  if (f.kind === 'row') {
    const r = f.row;
    const rep = f.step.repeat ? ` · row ${((r.index) % f.step.repeat) + 1} of the ${f.step.repeat}-row repeat` : '';
    return `<div class="step">
      <div class="step-n">${r.number}</div>
      <div>
        <h4>Row ${r.number} of ${f.step.totalRows}${r.arrow ? ` &nbsp;${r.arrow}` : ''}</h4>
        <p class="why" style="margin-top:-.2rem">${r.count} knot${r.count === 1 ? '' : 's'}${esc(rep)}</p>
        ${knotChips(r)}
        <p>${esc(r.text)}</p>
        ${r.hint ? `<p class="why">${esc(r.hint)}</p>` : ''}
      </div>
    </div>`;
  }
  const s = f.step;
  return `<div class="step">
    <div class="step-n">${s.n}</div>
    <div>
      <h4>${esc(s.title)}</h4>
      ${para(s.body)}
      ${s.setup ? setupStrip(s.setup) : ''}
      ${f.kind === 'lead' ? `<p class="why">The next ${s.totalRows} cards walk you through it one row at a time.</p>` : ''}
    </div>
  </div>`;
}

/* ------------------------------------------------------------- key dialog */

export function providerHelpHtml(p) {
  return `<p><strong>${esc(p.label)}</strong> — ${esc(p.free)}</p>
    <ol>${(p.steps ?? []).map((s) => `<li>${s}</li>`).join('')}</ol>
    <div class="limits">
      <span><b>Vision:</b> ${p.vision ? 'yes, you can attach a picture' : 'no, text only'}</span>
      ${p.keyUrl ? `<span><a href="${esc(p.keyUrl)}" target="_blank" rel="noopener">Get a key →</a></span>` : ''}
    </div>`;
}

export const KNOT_HELP = [
  ['/', 'Forward knot', 'left string over the right, twice. The left string ends up on the right.'],
  ['\\', 'Backward knot', 'right string over the left, twice. The right string ends up on the left.'],
  ['>', 'Forward-backward', 'one of each. The strings stay where they were.'],
  ['<', 'Backward-forward', 'one of each, the other way round. The strings stay where they were.'],
];
