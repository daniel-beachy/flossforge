/**
 * render.js -- SVG for everything you look at.
 *
 * Two jobs, kept deliberately separate:
 *
 *   chartSvg()   the working diagram you tie from, laid out the way printed
 *                friendship-bracelet patterns are: strands across the top,
 *                staggered knots below, arrows showing which way each knot
 *                goes, row numbers down both margins.
 *
 *   previewSvg() what the finished thing looks like, so you can decide whether
 *                you want it before you spend three hours on it.
 *
 * Everything returns a string, which means the tests can read the output and
 * the UI can drop it straight into the page without a canvas anywhere.
 */

import { hexOf, nameOf, textOn, lightness } from './palette.js';
import { KNOT_SYMBOL } from './knots.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ====================================================================== chart */

export function chartSvg(pattern, opts = {}) {
  switch (pattern.style) {
    case 'normal': return normalChart(pattern, opts);
    case 'alpha': return alphaChart(pattern, opts);
    default: return sequenceChart(pattern, opts);
  }
}

/**
 * The classic diagram. One knot is a rounded tile filled with the colour that
 * knot shows, carrying an arrow for which of the four knots it is:
 *
 *   F  arrow down-right   B  arrow down-left
 *   FB arrow right-then-back   BF arrow left-then-back
 */
function normalChart(pattern, { rows: maxRows = 0, highlight = -1, showRepeatOnly = true } = {}) {
  const { setup, knots, repeat, strands } = pattern.chart;
  const u = 26;
  const shown = showRepeatOnly && repeat ? Math.min(repeat, knots.length) : (maxRows || knots.length);
  const cols = Math.floor(strands / 2);
  const padX = 44;
  const padTop = 58;
  const W = padX * 2 + cols * u;
  const H = padTop + shown * u + 22;

  const out = [head(W, H), defs()];
  out.push(`<rect width="${W}" height="${H}" rx="18" fill="var(--chart-bg,#fbf9f6)"/>`);

  // strands along the top, in the order they get laid out
  setup.forEach((c, i) => {
    const x = padX + (i * u) / 2 + u / 4;
    out.push(`<circle cx="${r2(x)}" cy="26" r="9.5" fill="${hexOf(c)}" stroke="rgba(0,0,0,.28)" stroke-width="1"/>`);
    out.push(`<text x="${r2(x)}" y="${44}" class="tiny" text-anchor="middle">${i + 1}</text>`);
  });

  for (let r = 0; r < shown; r++) {
    const row = knots[r];
    const y = padTop + r * u;
    const odd = row.length && row[0].pos === 1;
    out.push(`<text x="${padX - 10}" y="${y + u / 2 + 4}" class="rownum" text-anchor="end">${r + 1}</text>`);
    out.push(`<text x="${W - padX + 10}" y="${y + u / 2 + 4}" class="rownum" text-anchor="start">${r + 1}</text>`);
    if (r === highlight) {
      out.push(`<rect x="${padX - 6}" y="${y - 2}" width="${cols * u + 12}" height="${u + 4}" rx="9" fill="none" stroke="var(--accent,#c2410c)" stroke-width="2.5"/>`);
    }
    row.forEach((k, j) => {
      const x = padX + j * u + (odd ? u / 2 : 0);
      out.push(knotTile(x, y, u, k.knot, k.shown));
    });
    if (odd) {
      out.push(idleMark(padX + 3, y + u / 2, u));
      out.push(idleMark(padX + cols * u - 3, y + u / 2, u));
    }
  }

  out.push(styleBlock());
  out.push('</svg>');
  return out.join('');
}

function knotTile(x, y, u, knot, color) {
  const fill = hexOf(color);
  const ink = textOn(fill);
  const p = 2.2;
  const s = u - p * 2;
  const cx = x + u / 2;
  const cy = y + u / 2;
  const a = s * 0.3;
  let arrow;
  if (knot === 'F') arrow = `M${r2(cx - a)},${r2(cy - a)} L${r2(cx + a)},${r2(cy + a)}`;
  else if (knot === 'B') arrow = `M${r2(cx + a)},${r2(cy - a)} L${r2(cx - a)},${r2(cy + a)}`;
  else if (knot === 'FB') arrow = `M${r2(cx - a)},${r2(cy - a)} L${r2(cx + a)},${r2(cy)} L${r2(cx - a)},${r2(cy + a)}`;
  else arrow = `M${r2(cx + a)},${r2(cy - a)} L${r2(cx - a)},${r2(cy)} L${r2(cx + a)},${r2(cy + a)}`;
  const headPt = knot === 'F' ? [cx + a, cy + a] : knot === 'B' ? [cx - a, cy + a] : knot === 'FB' ? [cx - a, cy + a] : [cx + a, cy + a];
  return (
    `<g><rect x="${r2(x + p)}" y="${r2(y + p)}" width="${r2(s)}" height="${r2(s)}" rx="6" fill="${fill}" stroke="rgba(0,0,0,.16)"/>` +
    `<path d="${arrow}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>` +
    `<circle cx="${r2(headPt[0])}" cy="${r2(headPt[1])}" r="2.1" fill="${ink}" opacity=".85"/></g>`
  );
}

/** The little elbow that says "this strand sits this row out". */
function idleMark(x, y, u) {
  return `<path d="M${r2(x)},${r2(y - u * 0.22)} q${u * 0.16},${u * 0.22} 0,${u * 0.44}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.6" stroke-linecap="round"/>`;
}

/** Alpha: a plain grid, because that is exactly what the chart is. */
function alphaChart(pattern, { highlight = -1, rows: maxRows = 0 } = {}) {
  const { image, width, height, rows } = pattern.chart;
  const u = 20;
  const shown = maxRows ? Math.min(maxRows, height) : height;
  const padX = 46;
  const padTop = 26;
  const W = padX * 2 + width * u;
  const H = padTop + shown * u + 20;

  const out = [head(W, H), defs()];
  out.push(`<rect width="${W}" height="${H}" rx="18" fill="var(--chart-bg,#fbf9f6)"/>`);

  for (let r = 0; r < shown; r++) {
    const y = padTop + r * u;
    const dir = rows[r]?.goingRight ? '\u2192' : '\u2190';
    out.push(`<text x="${padX - 10}" y="${y + u / 2 + 4}" class="rownum" text-anchor="end">${r + 1}</text>`);
    out.push(`<text x="${W - padX + 10}" y="${y + u / 2 + 4}" class="rownum" text-anchor="start">${dir}</text>`);
    for (let c = 0; c < width; c++) {
      const fill = hexOf(image[r][c]);
      out.push(`<rect x="${padX + c * u}" y="${y}" width="${u}" height="${u}" fill="${fill}" stroke="rgba(0,0,0,.08)" stroke-width=".6"/>`);
    }
    if (r === highlight) {
      out.push(`<rect x="${padX - 3}" y="${y - 3}" width="${width * u + 6}" height="${u + 6}" rx="6" fill="none" stroke="var(--accent,#c2410c)" stroke-width="2.5"/>`);
    }
  }
  out.push(styleBlock());
  out.push('</svg>');
  return out.join('');
}

/** Braid / spiral / macrame / daisy / kumihimo: a repeat-unit strip. */
function sequenceChart(pattern) {
  const plan = pattern.strandPlan;
  const u = 34;
  const W = 60 + plan.length * u;
  const H = 132;
  const out = [head(W, H), defs()];
  out.push(`<rect width="${W}" height="${H}" rx="18" fill="var(--chart-bg,#fbf9f6)"/>`);
  plan.forEach((s, i) => {
    const x = 30 + i * u + u / 2;
    out.push(`<circle cx="${x}" cy="34" r="13" fill="${hexOf(s.color)}" stroke="rgba(0,0,0,.25)"/>`);
    out.push(`<text x="${x}" y="60" class="tiny" text-anchor="middle">${i + 1}</text>`);
    const wig = `M${x},48 C${x - 9},64 ${x + 9},84 ${x},104`;
    out.push(`<path d="${wig}" fill="none" stroke="${hexOf(s.color)}" stroke-width="7" stroke-linecap="round" opacity=".9"/>`);
  });
  out.push(`<text x="${W / 2}" y="124" class="tiny" text-anchor="middle">${esc(pattern.chart.label ?? '')}</text>`);
  out.push(styleBlock());
  out.push('</svg>');
  return out.join('');
}

/* ==================================================================== preview */

/** What it will look like on a wrist. */
export function previewSvg(pattern, opts = {}) {
  switch (pattern.style) {
    case 'normal': return normalPreview(pattern, opts);
    case 'alpha': return alphaPreview(pattern, opts);
    case 'daisy': return daisyPreview(pattern, opts);
    case 'braid': return braidPreview(pattern, opts);
    case 'spiral': return spiralPreview(pattern, opts);
    case 'macrame': return macramePreview(pattern, opts);
    default: return braidPreview(pattern, { ...opts, round: true });
  }
}

const BAND_ROWS = 46;

function normalPreview(pattern, { width = 220, rows: maxRows = BAND_ROWS } = {}) {
  const { image, strands } = pattern.chart;
  const cols = Math.floor(strands / 2);
  const u = width / (cols + 0.5);
  const rows = Math.min(maxRows || image.length, image.length);
  const H = rows * u * 0.86;
  const _i = uid();
  const out = [head(width, H, true), bandDefs(_i)];
  out.push(`<g clip-path="url(#${_i}-band)">`);
  out.push(`<rect width="${width}" height="${H}" fill="#efeae2"/>`);
  for (let r = 0; r < rows; r++) {
    const y = r * u * 0.86;
    const odd = image[r].length && pattern.chart.knots[r][0].pos === 1;
    for (let j = 0; j < image[r].length; j++) {
      const c = image[r][j];
      if (!c) continue;
      const x = j * u + (odd ? u / 2 : 0);
      out.push(stitch(x, y, u, u * 0.86, hexOf(c), pattern.chart.knots[r][j]?.knot));
    }
  }
  out.push('</g>');
  out.push(`<rect width="${width}" height="${H}" rx="${u * 0.7}" fill="url(#${_i}-sheen)" opacity=".5"/>`);
  out.push(`<clipPath id="${_i}-band"><rect width="${width}" height="${H}" rx="${u * 0.7}"/></clipPath>`);
  out.push('</svg>');
  return out.join('');
}

/** One knot, drawn as the little slanted bar it actually looks like. */
function stitch(x, y, w, h, fill, knot) {
  const lean = knot === 'B' || knot === 'BF' ? -1 : 1;
  const inset = w * 0.06;
  const x1 = x + inset + (lean > 0 ? 0 : w * 0.16);
  const x2 = x + w - inset - (lean > 0 ? w * 0.16 : 0);
  return (
    `<path d="M${r2(x1)},${r2(y + h * 0.08)} L${r2(x2)},${r2(y + h * 0.92)}" stroke="${fill}" stroke-width="${r2(w * 0.82)}" stroke-linecap="round"/>`
  );
}

function alphaPreview(pattern, { width = 220, rows: maxRows = BAND_ROWS } = {}) {
  const { image, width: cols } = pattern.chart;
  const u = width / cols;
  const rows = Math.min(maxRows ? maxRows + 14 : image.length, image.length);
  const H = rows * u;
  const _i = uid();
  const out = [head(width, H, true), bandDefs(_i)];
  out.push(`<g clip-path="url(#${_i}-band)"><rect width="${width}" height="${H}" fill="#efeae2"/>`);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * u;
      const y = r * u;
      out.push(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(u * 1.02)}" height="${r2(u * 1.02)}" rx="${r2(u * 0.3)}" fill="${hexOf(image[r][c])}"/>`);
    }
  }
  out.push('</g>');
  out.push(`<rect width="${width}" height="${H}" rx="${u}" fill="url(#${_i}-sheen)" opacity=".45"/>`);
  out.push(`<clipPath id="${_i}-band"><rect width="${width}" height="${H}" rx="${u}"/></clipPath>`);
  out.push('</svg>');
  return out.join('');
}

function braidPreview(pattern, { width = 220, round = false } = {}) {
  const colors = (pattern.chart.preview?.colors ?? pattern.strandPlan.map((s) => s.color)).map(hexOf);
  const n = Math.max(2, colors.length);
  const H = 300;
  const w = width * (round ? 0.46 : 0.66);
  const cx = width / 2;
  const period = round ? 54 : 62;
  const amp = w / 2 - w / (n * 2.1);
  const sw = (w / n) * 1.55;

  // Each strand is sampled into short segments carrying a depth, then the whole
  // lot is drawn back-to-front. That ordering is what makes it read as woven
  // rather than as a stack of wavy lines.
  const segs = [];
  for (let i = 0; i < n; i++) {
    const off = (i / n) * Math.PI * 2;
    for (let y = -8; y < H + 8; y += 4) {
      const p0 = (y / period) * Math.PI * 2 + off;
      const p1 = ((y + 4) / period) * Math.PI * 2 + off;
      segs.push({
        d: Math.cos((p0 + p1) / 2),
        x0: cx + Math.sin(p0) * amp, y0: y,
        x1: cx + Math.sin(p1) * amp, y1: y + 4,
        c: colors[i],
      });
    }
  }
  segs.sort((a, b) => a.d - b.d);

  const _i = uid();
  const out = [head(width, H, true), bandDefs(_i)];
  out.push(`<g stroke-linecap="round">`);
  for (const s of segs) {
    const line = `x1="${r2(s.x0)}" y1="${r2(s.y0)}" x2="${r2(s.x1)}" y2="${r2(s.y1)}"`;
    out.push(`<line ${line} stroke="rgba(0,0,0,.28)" stroke-width="${r2(sw + 3)}"/>`);
    out.push(`<line ${line} stroke="${s.c}" stroke-width="${r2(sw)}"/>`);
    // a highlight along the front of the twist
    if (s.d > 0.35) out.push(`<line ${line} stroke="rgba(255,255,255,${r2(0.05 + s.d * 0.16)})" stroke-width="${r2(sw * 0.45)}"/>`);
  }
  out.push('</g>');
  out.push(`<rect x="${r2(cx - w / 2 - sw / 2)}" width="${r2(w + sw)}" height="${H}" rx="${r2((w + sw) / 2)}" fill="url(#${_i}-sheen)" opacity=".35"/>`);
  out.push('</svg>');
  return out.join('');
}

function spiralPreview(pattern, { width = 220 } = {}) {
  const blocks = pattern.chart.blocks?.length
    ? pattern.chart.blocks
    : [{ color: pattern.strandPlan[0].color, hitches: 40 }];
  const H = 300;
  const w = width * 0.42;
  const x0 = (width - w) / 2;
  const total = blocks.reduce((a, b) => a + b.hitches, 0) || 1;
  const core = hexOf(pattern.strandPlan.find((s) => /core/i.test(s.role))?.color ?? blocks[0].color);

  // A Chinese staircase is one strand hitched round a core over and over, which
  // makes the cord roll into a barber-pole. So: a rounded column with slanted
  // wraps across it, shaded to suggest the roll.
  const _i = uid();
  const out = [head(width, H, true), bandDefs(_i)];
  out.push(`<clipPath id="${_i}-rope"><rect x="${r2(x0)}" width="${r2(w)}" height="${H}" rx="${r2(w / 2)}"/></clipPath>`);
  out.push(`<g clip-path="url(#${_i}-rope)">`);
  out.push(`<rect x="${r2(x0)}" width="${r2(w)}" height="${H}" fill="${core}"/>`);
  const slant = w * 0.62;
  const pitch = 9;
  let y = 0;
  for (const b of blocks) {
    const h = (b.hitches / total) * H;
    const hex = hexOf(b.color);
    for (let yy = y - slant; yy < y + h; yy += pitch) {
      out.push(`<path d="M${r2(x0 - 2)},${r2(yy + slant)} L${r2(x0 + w + 2)},${r2(yy)}" stroke="${hex}" stroke-width="${pitch + 1.5}" fill="none"/>`);
      // Without a groove between wraps a block of one colour is just a flat
      // bar; the shadow line is what makes the cord read as twisted.
      out.push(`<path d="M${r2(x0 - 2)},${r2(yy + slant + pitch / 2)} L${r2(x0 + w + 2)},${r2(yy + pitch / 2)}" stroke="rgba(0,0,0,.20)" stroke-width="1.6" fill="none"/>`);
      out.push(`<path d="M${r2(x0 - 2)},${r2(yy + slant - pitch / 4)} L${r2(x0 + w + 2)},${r2(yy - pitch / 4)}" stroke="rgba(255,255,255,.16)" stroke-width="2.2" fill="none"/>`);
    }
    y += h;
  }
  out.push('</g>');
  // barrel shading: dark at the edges, bright a third of the way in
  out.push(`<g clip-path="url(#${_i}-rope)" pointer-events="none">
    <rect x="${r2(x0)}" width="${r2(w)}" height="${H}" fill="url(#${_i}-barrel)"/>
  </g>`);
  out.push(`<rect x="${r2(x0)}" width="${r2(w)}" height="${H}" rx="${r2(w / 2)}" fill="none" stroke="rgba(0,0,0,.18)"/>`);
  out.push('</svg>');
  return out.join('');
}

function macramePreview(pattern, { width = 220 } = {}) {
  const working = (pattern.chart.preview?.working ?? pattern.strandPlan.filter((s) => /work/i.test(s.role)).map((s) => s.color)).map(hexOf);
  const core = (pattern.chart.preview?.core ?? pattern.strandPlan.filter((s) => /core/i.test(s.role)).map((s) => s.color)).map(hexOf);
  const H = 300;
  const w = width * 0.5;
  const x0 = (width - w) / 2;
  const _i = uid();
  const out = [head(width, H, true), bandDefs(_i)];
  out.push(`<clipPath id="${_i}-mac"><rect x="${r2(x0)}" width="${r2(w)}" height="${H}" rx="8"/></clipPath>`);
  out.push(`<g clip-path="url(#${_i}-mac)">`);
  out.push(`<rect x="${r2(x0)}" width="${r2(w)}" height="${H}" fill="${core[0] ?? '#cfc7bb'}"/>`);
  // A square knot reads as two nested chevrons with a pinched waist.
  const step = 30;
  for (let i = 0, y = -step; y < H + step; i++, y += step) {
    const c = working[i % Math.max(1, working.length)] ?? '#8a8078';
    const t = w * 0.16;
    out.push(`<path d="M${r2(x0 - 3)},${r2(y)} Q${r2(x0 + w / 2)},${r2(y + step * 0.62)} ${r2(x0 + w + 3)},${r2(y)}"
      fill="none" stroke="rgba(0,0,0,.22)" stroke-width="${r2(t + 3)}"/>`);
    out.push(`<path d="M${r2(x0 - 3)},${r2(y)} Q${r2(x0 + w / 2)},${r2(y + step * 0.62)} ${r2(x0 + w + 3)},${r2(y)}"
      fill="none" stroke="${c}" stroke-width="${r2(t)}"/>`);
    out.push(`<path d="M${r2(x0 - 3)},${r2(y + step * 0.5)} Q${r2(x0 + w / 2)},${r2(y + step * 1.12)} ${r2(x0 + w + 3)},${r2(y + step * 0.5)}"
      fill="none" stroke="${c}" stroke-width="${r2(t)}" opacity=".92"/>`);
    out.push(`<ellipse cx="${r2(x0 + w / 2)}" cy="${r2(y + step * 0.56)}" rx="${r2(w * 0.13)}" ry="${r2(step * 0.16)}" fill="rgba(255,255,255,.14)"/>`);
  }
  out.push('</g>');
  out.push(`<g clip-path="url(#${_i}-mac)"><rect x="${r2(x0)}" width="${r2(w)}" height="${H}" fill="url(#${_i}-barrel)" opacity=".7"/></g>`);
  out.push('</svg>');
  return out.join('');
}

function daisyPreview(pattern, { width = 220 } = {}) {
  const c = pattern.chart;
  const petal = hexOf(c.preview?.petal ?? c.strandPlan[1].color);
  const centre = hexOf(c.preview?.centre ?? c.strandPlan[3]?.color ?? c.strandPlan[0].color);
  const stem = hexOf(c.preview?.stem ?? c.strandPlan[0].color);
  const H = 300;
  const cx = width / 2;
  const n = Math.max(4, (c.perSide ?? 3) * 2);
  const gap = 46 + n * 3;
  const _i = uid();
  const out = [head(width, H, true), bandDefs(_i)];

  // the plain knotted stem between flowers
  out.push(`<rect x="${r2(cx - 8)}" width="16" height="${H}" rx="8" fill="${stem}"/>`);
  for (let y = 4; y < H; y += 7) {
    out.push(`<path d="M${r2(cx - 8)},${r2(y + 3)} Q${cx},${r2(y - 3)} ${r2(cx + 8)},${r2(y + 3)}" fill="none" stroke="rgba(0,0,0,.13)" stroke-width="2.4"/>`);
  }
  for (let y = gap / 2; y < H; y += gap) {
    const rr = 12.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      out.push(`<ellipse cx="${r2(px)}" cy="${r2(py)}" rx="10" ry="7.5" transform="rotate(${r2((a * 180) / Math.PI)} ${r2(px)} ${r2(py)})" fill="${petal}" stroke="rgba(0,0,0,.16)" stroke-width="1"/>`);
    }
    out.push(`<circle cx="${cx}" cy="${r2(y)}" r="8" fill="${centre}" stroke="rgba(0,0,0,.18)"/>`);
    out.push(`<circle cx="${r2(cx - 2)}" cy="${r2(y - 2)}" r="2.6" fill="rgba(255,255,255,.35)"/>`);
  }
  out.push('</svg>');
  return out.join('');
}

/* ================================================================== fragments */

function head(w, h, fluid = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(w)} ${r2(h)}"${fluid ? ' preserveAspectRatio="xMidYMin meet"' : ` width="${r2(w)}" height="${r2(h)}"`} role="img">`;
}

function defs() {
  return '';
}

// Several of these SVGs live in one HTML document at once (five candidate cards
// plus the detail view), and url(#id) resolves against the whole document. So
// every gradient and clip path gets a unique id or the second bracelet on the
// page silently borrows the first one's clip rectangle.
let idSeq = 0;
const uid = () => `ff${(++idSeq).toString(36)}`;

function bandDefs(id) {
  return (
    `<defs><linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0">` +
    '<stop offset="0" stop-color="#000" stop-opacity=".22"/>' +
    '<stop offset=".28" stop-color="#fff" stop-opacity=".26"/>' +
    '<stop offset=".62" stop-color="#fff" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#000" stop-opacity=".24"/>' +
    `</linearGradient><linearGradient id="${id}-barrel" x1="0" y1="0" x2="1" y2="0">` +
    '<stop offset="0" stop-color="#000" stop-opacity=".38"/>' +
    '<stop offset=".3" stop-color="#fff" stop-opacity=".22"/>' +
    '<stop offset=".55" stop-color="#fff" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#000" stop-opacity=".4"/>' +
    '</linearGradient></defs>'
  );
}

function styleBlock() {
  return (
    '<style>' +
    '.rownum{font:600 10px ui-sans-serif,system-ui,sans-serif;fill:rgba(0,0,0,.42)}' +
    '.tiny{font:600 9px ui-sans-serif,system-ui,sans-serif;fill:rgba(0,0,0,.5)}' +
    '</style>'
  );
}

const r2 = (n) => Math.round(n * 100) / 100;

/* ============================================================ small helpers */

/** A row of colour chips for the materials list. */
export function swatchSvg(codes, size = 18) {
  const w = codes.length * (size + 4);
  const cells = codes
    .map((c, i) => `<rect x="${i * (size + 4)}" width="${size}" height="${size}" rx="5" fill="${hexOf(c)}" stroke="rgba(0,0,0,.18)"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${size}" viewBox="0 0 ${w} ${size}">${cells}</svg>`;
}

/** Tiny thumbnail for a candidate card, drawn straight from the picture. */
export function thumbSvg(pattern, w = 96, h = 128) {
  const img = pattern.chart.image;
  if (!img || !img.length) return previewSvg(pattern, { width: w });
  const cols = img[0].length;
  const rows = Math.min(img.length, Math.round((h / w) * cols * 1.1));
  const cw = w / cols;
  const ch = h / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = img[r % img.length][c];
      if (!v) continue;
      const odd = pattern.style === 'normal' && pattern.chart.knots[r % img.length]?.[0]?.pos === 1;
      cells.push(`<rect x="${r2(c * cw + (odd ? cw / 2 : 0))}" y="${r2(r * ch)}" width="${r2(cw + 0.5)}" height="${r2(ch + 0.5)}" fill="${hexOf(v)}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${cells.join('')}</svg>`;
}

export { nameOf, hexOf, lightness };
