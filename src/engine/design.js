/**
 * design.js -- the contract between the language model and the engine.
 *
 * A model is good at deciding that "sunset chevron in warm oranges" means a
 * chevron in DMC 740 / 972 / 351 / 350 and terrible at deciding whether the
 * resulting knots can be tied. So the model only ever emits a Design -- a
 * declaration of intent -- and everything downstream is the engine's problem.
 *
 * validateDesign() is deliberately forgiving in one direction and strict in the
 * other: it will happily repair a colour that isn't in the palette, an odd
 * strand count or a motif name that's slightly off, and it will flatly reject
 * anything it cannot make physically real. Every repair is recorded so the
 * finished pattern can say what it changed and why.
 */

import { PALETTE, floss, nearestFloss, contrast, CSS_COLORS, nameOf } from './palette.js';
import { MOTIF_BY_ID, searchMotifs, motifSlotCount } from './data/motifs.js';
import { GEOMETRY_IDS } from './imagegen.js';
import { NORMAL_TEMPLATE_IDS } from './styles/normal.js';
import { BRAID_KINDS, SPIRAL_KINDS, MACRAME_KINDS } from './styles/simple.js';
import { hasGlyph } from './data/alphabet.js';

export const STYLES = [
  {
    id: 'normal',
    label: 'Diagonal knots',
    short: 'Classic',
    blurb: 'Candy stripes, chevrons, arrowheads, diamonds. Every knot is one of four, and the picture emerges from which strand crosses which.',
    difficulty: 2,
  },
  {
    id: 'alpha',
    label: 'Pixel grid',
    short: 'Alpha',
    blurb: 'One knot per pixel. The only way to put a word or a picture on a bracelet.',
    difficulty: 3,
  },
  {
    id: 'daisy',
    label: 'Daisy chain',
    short: 'Daisy',
    blurb: 'Little flowers strung along a twisted stem.',
    difficulty: 3,
  },
  {
    id: 'braid',
    label: 'Braid',
    short: 'Braid',
    blurb: 'No knots at all -- 3, 4, 5 or 7 strands crossing over each other.',
    difficulty: 1,
  },
  {
    id: 'spiral',
    label: 'Spiral',
    short: 'Spiral',
    blurb: 'One strand wrapping a core in the same direction until it corkscrews. The classic Chinese staircase.',
    difficulty: 1,
  },
  {
    id: 'macrame',
    label: 'Macrame',
    short: 'Macrame',
    blurb: 'Square-knot sinnets and lattices, the knots you see on plant hangers.',
    difficulty: 2,
  },
  {
    id: 'kumihimo',
    label: 'Kumihimo',
    short: 'Kumihimo',
    blurb: 'A Japanese round braid worked on a foam disk. Needs the disk, makes a perfect rope.',
    difficulty: 2,
    needsTool: 'a kumihimo foam disk',
  },
];

export const STYLE_IDS = STYLES.map((s) => s.id);
export const STYLE_BY_ID = new Map(STYLES.map((s) => [s.id, s]));

const DESIGN_KINDS = ['geometry', 'motif', 'motifs', 'text', 'pixels'];

/**
 * Models reach for the craft's own vocabulary -- "chevron", "pixel", "candy
 * stripe", "friendship" -- rather than the seven ids this engine happens to
 * use. Snapping those to a real style salvages a design that is otherwise
 * perfectly good; anything genuinely unrecognisable is still rejected.
 */
const STYLE_ALIASES = [
  [/^(normal|diagonal|classic|friendship|chevron|candy ?-? ?stripe|stripe|arrow(head)?|diamond|zig ?-?zag|knotted)/, 'normal'],
  [/^(alpha|alfa|pixel|picture|word|name|text|letter|graph|grid|image)/, 'alpha'],
  [/^(daisy|daisies|flower)/, 'daisy'],
  [/^(braid|plait|plaited|braided)/, 'braid'],
  [/^(spiral|twist|staircase|chinese ?staircase|barber|rope)/, 'spiral'],
  [/^(macram|square ?-? ?knot|shamballa|surfer|hemp)/, 'macrame'],
  [/^(kumihimo|disk|disc|round ?braid|marudai)/, 'kumihimo'],
];

function snapStyle(raw, R) {
  const said = String(raw ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (STYLE_IDS.includes(said)) return said;
  const bare = said.replace(/-/g, ' ');
  // Try the start of the string first (highest confidence), then anywhere, so
  // "3-strand braid" and "flat macrame band" still land somewhere sensible.
  for (const anchored of [true, false]) {
    for (const [re, id] of STYLE_ALIASES) {
      const test = anchored ? re : new RegExp(re.source.replace(/^\^/, '\\b'));
      if (test.test(bare) || test.test(said)) {
        R.fix('style', raw, id, `"${raw}" is not one of my style names; it is closest to ${id}`);
        return id;
      }
    }
  }
  return null;
}

class Repairs {
  constructor() { this.list = []; this.warnings = []; }
  fix(field, from, to, why) { this.list.push({ field, from, to, why }); return to; }
  warn(message) { this.warnings.push(message); }
}

/**
 * @param {any} raw a Design as emitted by a model (or by the offline generator)
 * @param {{allowedStyles?:string[]}} [opts]
 * @returns {{ok:boolean, design?:object, errors:string[], repairs:Array, warnings:string[]}}
 */
export function validateDesign(raw, opts = {}) {
  const errors = [];
  const R = new Repairs();
  if (!raw || typeof raw !== 'object') return fail(['the design was not an object']);

  const style = snapStyle(raw.style, R);
  if (!style) {
    return fail([`"${raw.style}" is not a style I can tie (need one of ${STYLE_IDS.join(', ')})`]);
  }
  if (opts.allowedStyles && !opts.allowedStyles.includes(style)) {
    return fail([`${style} was excluded by the style filter`]);
  }

  const design = {
    style,
    title: clean(raw.title, 70) || 'Untitled bracelet',
    blurb: clean(raw.blurb, 240) || '',
    spec: {},
  };

  const spec = raw.spec && typeof raw.spec === 'object' ? raw.spec : raw;

  switch (style) {
    case 'normal': design.spec = normalSpec(spec, R, errors); break;
    case 'alpha': design.spec = alphaSpec(spec, R, errors); break;
    case 'daisy': design.spec = daisySpec(spec, R); break;
    case 'braid': design.spec = braidSpec(spec, R); break;
    case 'spiral': design.spec = spiralSpec(spec, R); break;
    case 'macrame': design.spec = macrameSpec(spec, R); break;
    case 'kumihimo': design.spec = kumihimoSpec(spec, R); break;
  }

  if (errors.length) return fail(errors, R);
  return { ok: true, design, errors: [], repairs: R.list, warnings: R.warnings };

  function fail(errs, rr = R) {
    return { ok: false, errors: errs, repairs: rr.list, warnings: rr.warnings };
  }
}

/* ------------------------------------------------------------------ colours */

/**
 * Turn whatever the model said into a floss code we actually stock.
 *
 * The subtle trap here: a bare DMC code like "963" is three hex digits, so a
 * naive hex parse silently reads it as #996633 and hands back a brown. Numbers
 * are therefore only ever treated as DMC codes, never as colours.
 */
function colorOf(value, R, field, fallback = '310') {
  if (value == null || value === '') return fallback;
  const raw = String(value).trim();

  const exact = floss(raw);
  if (exact) return exact.code;

  // "DMC 310", "dmc-310"
  const tagged = raw.match(/^dmc[\s-]*([a-z]?\d{2,5})$/i);
  if (tagged) {
    const f = floss(tagged[1]);
    if (f) return f.code;
  }

  const named = CSS_COLORS[raw.toLowerCase().replace(/[\s_-]/g, '')];
  if (named) {
    const near = nearestFloss(named);
    return R.fix(field, raw, near.code, `"${raw}" is not a floss code, so we matched it to the closest shade we stock`);
  }

  // A real colour only if it is written as one: #abc, #aabbcc, rgb(...).
  if (/^#|^rgb/i.test(raw)) {
    const near = nearestFloss(raw);
    if (near) return R.fix(field, raw, near.code, `${raw} matched to the closest floss we stock`);
  }

  // A plausible DMC number we do not stock. We cannot guess its colour -- DMC
  // codes are not ordered by hue -- so we substitute and say so plainly.
  const looksLikeCode = /^[a-z]?\d{2,5}$/i.test(raw);
  const sub = PALETTE[Math.abs(hashCode(raw)) % PALETTE.length].code;
  return R.fix(
    field, raw, looksLikeCode ? sub : fallback,
    looksLikeCode
      ? `DMC ${raw} is not one of the ${PALETTE.length} colours this app stocks, and DMC numbers do not encode their colour, so we could not match it. Swapped in ${nameOf(sub)} -- change it to whatever you have.`
      : `could not understand the colour "${raw}"`,
  );
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function colorList(value, R, field, min, fallbackPool) {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const c = colorOf(arr[i], R, `${field}[${i}]`, null);
    if (c && !out.includes(c)) out.push(c);
  }
  const pool = fallbackPool ?? ['310', 'B5200', '666', '996'];
  let p = 0;
  while (out.length < min) {
    const c = pool[p++ % pool.length];
    if (!out.includes(c)) out.push(c);
    else if (p > pool.length * 2) out.push(PALETTE[(out.length * 7) % PALETTE.length].code);
  }
  if (out.length < (Array.isArray(value) ? value.length : 0)) {
    R.warn('duplicate colours were removed so each strand reads distinctly');
  }
  return out;
}

/* ------------------------------------------------------------------- normal */

function normalSpec(spec, R, errors) {
  let strands = int(spec.strands, 12);
  if (strands % 2 !== 0) strands = R.fix('strands', strands, strands + 1, 'normal patterns need an even number of strands so every row pairs up');
  if (strands < 6) strands = R.fix('strands', strands, 6, 'fewer than 6 strands does not leave room for a pattern');
  if (strands > 24) strands = R.fix('strands', strands, 24, 'more than 24 strands is wider than a wrist');

  const colors = colorList(spec.colors, R, 'colors', 2);
  const out = { strands, colors };

  const template = String(spec.template ?? '').trim();
  if (template && NORMAL_TEMPLATE_IDS.includes(template)) {
    out.template = template;
    if (template.startsWith('chevron') && strands % 2 !== 0) {
      out.strands = R.fix('strands', strands, strands + 1, 'a chevron has to be symmetrical');
    }
    return out;
  }
  if (template) R.warn(`"${template}" is not one of the exact templates, so the pattern was drawn and fitted instead`);

  out.design = designBlock(spec.design ?? spec, R, errors, colors, 'normal');
  return out;
}

/* -------------------------------------------------------------------- alpha */

function alphaSpec(spec, R, errors) {
  let width = int(spec.width, 16);
  if (width < 6) width = R.fix('width', width, 6, 'narrower than 6 knots is not readable');
  if (width > 36) width = R.fix('width', width, 36, 'wider than 36 knots will not sit flat on a wrist');

  const background = colorOf(spec.background ?? spec.backgroundColor, R, 'background', '310');
  const out = { width, background };

  out.design = designBlock(spec.design ?? spec, R, errors, colorList(spec.colors, R, 'colors', 1, [background]), 'alpha');

  if (spec.border && spec.border.color) {
    out.border = { color: colorOf(spec.border.color, R, 'border.color'), width: clampInt(spec.border.width, 1, 1, 3) };
  }
  return out;
}

/* --------------------------------------------------- the shared design block */

function designBlock(d, R, errors, palette, family) {
  const src = d && typeof d === 'object' ? d : {};
  let kind = String(src.kind ?? '').trim().toLowerCase();
  if (!DESIGN_KINDS.includes(kind)) {
    if (src.text) kind = 'text';
    else if (Array.isArray(src.pixels)) kind = 'pixels';
    else if (Array.isArray(src.items)) kind = 'motifs';
    else if (src.motif) kind = 'motif';
    else if (src.geometry) kind = 'geometry';
    else kind = family === 'alpha' ? 'motif' : 'geometry';
    if (src.kind) R.warn(`design kind "${src.kind}" was inferred as "${kind}"`);
  }

  switch (kind) {
    case 'geometry': {
      let geometry = String(src.geometry ?? 'chevron').trim();
      if (!GEOMETRY_IDS.includes(geometry)) {
        geometry = R.fix('design.geometry', geometry, 'chevron', `"${geometry}" is not a shape I know how to draw`);
      }
      // A geometry is allowed to name its own colours -- "a tangerine chevron
      // on lemon" -- and those have to win over the pattern-wide palette. They
      // did not, which whitewashed every pixel-grid geometry: the alpha palette
      // falls back to a single near-white, so the whole band came out blank.
      const own = Array.isArray(src.colors) && src.colors.length
        ? src.colors.slice(0, 6).map((c, i) => colorOf(c, R, `design.colors[${i}]`, palette[i % palette.length]))
        : null;
      return {
        kind: 'geometry',
        geometry,
        colors: own ?? palette,
        thickness: clampInt(src.thickness, 1, 1, 4),
        scale: clampInt(src.scale, 1, 1, 4),
      };
    }
    case 'text': {
      const text = clean(src.text, 24).toUpperCase();
      const usable = [...text].filter((ch) => hasGlyph(ch)).join('');
      if (!usable.trim()) { errors.push('the word for this bracelet had no letters I can knot'); return null; }
      if (usable !== text) R.fix('design.text', text, usable, 'dropped characters with no pixel glyph');
      return { kind: 'text', text: usable, color: colorOf(src.color ?? palette[0], R, 'design.color', palette[0]), gapY: clampInt(src.gapY, 3, 1, 10) };
    }
    case 'motif': {
      const m = resolveMotif(src.motif, R, errors);
      if (!m) return null;
      return {
        kind: 'motif',
        motif: m.id,
        colors: motifColors(src.colors ?? src.motifColors, m, R, palette),
        gapY: clampInt(src.gapY, 2, 0, 12),
        columns: clampInt(src.columns, 1, 1, 4),
        stagger: !!src.stagger,
      };
    }
    case 'motifs': {
      const items = (Array.isArray(src.items) ? src.items : []).slice(0, 4)
        .map((it) => {
          const m = resolveMotif(it.motif, R, errors);
          return m ? { motif: m.id, colors: motifColors(it.colors, m, R, palette) } : null;
        })
        .filter(Boolean);
      if (!items.length) { errors.push('none of the motifs in this design exist'); return null; }
      return { kind: 'motifs', items, gapY: clampInt(src.gapY, 2, 0, 12) };
    }
    case 'pixels': {
      const pixels = (Array.isArray(src.pixels) ? src.pixels : []).map((r) => String(r)).filter(Boolean);
      if (!pixels.length) { errors.push('the pixel grid was empty'); return null; }
      if (pixels.length > 120) { R.fix('design.pixels', `${pixels.length} rows`, '120 rows', 'the drawing was taller than a bracelet'); pixels.length = 120; }
      const w = Math.max(...pixels.map((p) => p.length));
      const padded = pixels.map((p) => p.padEnd(w, p.trimEnd().slice(-1) || '.'));
      const legend = {};
      const rawLegend = src.legend && typeof src.legend === 'object' ? src.legend : {};
      const used = new Set(padded.join('').split(''));
      for (const ch of used) {
        const v = rawLegend[ch];
        if (v == null) {
          if (ch === '.') continue;
          legend[ch] = R.fix(`design.legend["${ch}"]`, 'missing', palette[0], `the drawing used "${ch}" but never said what colour it was`);
        } else legend[ch] = colorOf(v, R, `design.legend["${ch}"]`, palette[0]);
      }
      if (rawLegend['.'] != null) legend['.'] = colorOf(rawLegend['.'], R, 'design.legend["."]');
      return { kind: 'pixels', pixels: padded, legend, gapY: clampInt(src.gapY, 2, 0, 12) };
    }
  }
  errors.push(`unknown design kind "${kind}"`);
  return null;
}

function resolveMotif(id, R, errors) {
  const key = String(id ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  const direct = MOTIF_BY_ID.get(key);
  if (direct) return direct;
  const found = searchMotifs([key])[0];
  if (found) { R.fix('design.motif', key, found.id, `there is no "${key}" motif; used the closest match`); return found; }
  errors.push(`there is no motif called "${id}"`);
  return null;
}

function motifColors(colors, motif, R, palette) {
  const need = motifSlotCount(motif);
  const suggested = motif.suggest?.[0] ?? [];
  const given = Array.isArray(colors) ? colors : [];
  const out = [];
  for (let i = 0; i < need; i++) {
    const raw = given[i] ?? suggested[i] ?? palette[i % palette.length];
    out.push(colorOf(raw, R, `motif.colors[${i}]`, palette[0]));
  }
  return out;
}

/* ------------------------------------------------------------ simple styles */

function daisySpec(spec, R) {
  const petal = colorOf(spec.petal ?? spec.petals, R, 'petal', 'B5200');
  const centre = colorOf(spec.centre ?? spec.center, R, 'centre', '444');
  const stem = colorOf(spec.stem ?? spec.band, R, 'stem', '700');
  if (contrast(petal, stem) < 18) R.warn('the petals and the stem are almost the same colour, so the flowers will be hard to see');
  return {
    petal, centre, stem,
    spacing: clampInt(spec.spacing, 12, 4, 30),
    petalsPerSide: clampInt(spec.petalsPerSide, 3, 2, 4),
  };
}

function braidSpec(spec, R) {
  let kind = String(spec.kind ?? 'braid-3').trim();
  if (!BRAID_KINDS[kind]) kind = R.fix('kind', kind, 'braid-3', `"${kind}" is not a braid I know`);
  return { kind, colors: colorList(spec.colors, R, 'colors', BRAID_KINDS[kind].strands) };
}

function spiralSpec(spec, R) {
  let kind = String(spec.kind ?? 'chinese-staircase').trim();
  if (!SPIRAL_KINDS[kind]) kind = R.fix('kind', kind, 'chinese-staircase', `"${kind}" is not a spiral I know`);
  const seqRaw = Array.isArray(spec.sequence) && spec.sequence.length ? spec.sequence : null;
  const colors = colorList(spec.colors, R, 'colors', 2);
  const sequence = seqRaw
    ? seqRaw.slice(0, 12).map((s, i) => ({
        color: colorOf(s.color ?? s, R, `sequence[${i}].color`, colors[i % colors.length]),
        hitches: clampInt(s.hitches, 12, 3, 80),
      }))
    : colors.map((c) => ({ color: c, hitches: 12 }));
  return { kind, core: colorList(spec.core, R, 'core', 1, [colors[0]]), sequence };
}

function macrameSpec(spec, R) {
  let kind = String(spec.kind ?? 'square-knot').trim();
  if (!MACRAME_KINDS[kind]) kind = R.fix('kind', kind, 'square-knot', `"${kind}" is not a macrame sinnet I know`);
  return {
    kind,
    working: colorList(spec.working, R, 'working', 2),
    core: colorList(spec.core, R, 'core', 2, ['310']),
  };
}

function kumihimoSpec(spec, R) {
  return { colors: colorList(spec.colors, R, 'colors', 4) };
}

/* -------------------------------------------------------------------- utils */

function clean(v, max) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function int(v, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
}
function clampInt(v, fallback, lo, hi) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
