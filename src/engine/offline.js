/**
 * engine/offline.js -- designing without a model.
 *
 * The app has to work when there is no API key, when the free tier has run
 * out, and when the provider is having a bad day. This is not a placeholder
 * for those moments: it reads the request for colours, words, objects and
 * style hints and builds real designs out of them. It cannot invent, which is
 * the whole reason the model is worth having -- ask it for "the feeling of a
 * thunderstorm over a wheat field" and it will find "storm" and stop. But ask
 * for "purple daisy chain" or "bracelet that says MOM" and you get exactly
 * that, with no key and no network.
 */

import { CSS_COLORS, nearestFloss, PALETTE, PALETTE_BY_CODE, labDistance, hexToLab, hexOf, shortName } from './palette.js';
import { BRAID_KINDS } from './styles/simple.js';
import { searchMotifs, rankMotifs, MOTIF_BY_ID } from './data/motifs.js';
import { hasGlyph } from './data/alphabet.js';
import { makeRng } from './rng.js';
import { STYLE_IDS } from './design.js';
import { GEOMETRY_IDS } from './imagegen.js';

/** Named palettes, for when someone asks for a mood rather than a colour. */
const MOODS = {
  rainbow: ['666', '740', '444', '700', '798', '553'],
  pastel: ['818', '445', '800', '993', '210', 'B5200'],
  sunset: ['444', '742', '740', '608', '349', '498'],
  ocean: ['939', '820', '996', '3845', '993', 'B5200'],
  sea: ['995', '958', '3846', '993'],
  forest: ['890', '909', '700', '3819', '436'],
  earth: ['938', '433', '436', '738', 'ECRU'],
  neutral: ['ECRU', '738', '415', 'B5200', '317'],
  warm: ['666', '740', '742', '444', '435'],
  cool: ['796', '995', '958', '553', '340'],
  neon: ['907', '444', '996', '601', '608'],
  dark: ['310', '3799', '890', '498', '939'],
  night: ['939', '820', '550', '415'],
  monochrome: ['310', '317', '415', 'B5200'],
  candy: ['603', '818', 'B5200', '996'],
  autumn: ['975', '740', '436', '890', '498'],
  spring: ['818', '907', '445', '993', 'B5200'],
  winter: ['800', 'B5200', '415', '796'],
  desert: ['738', '437', '742', '3819', 'ECRU'],
  berry: ['601', '718', '550', '893'],
  vintage: ['ECRU', '738', '958', '498', '317'],
  jewel: ['550', '820', '909', '498', '972'],
};

const STYLE_WORDS = [
  [/\b(alpha|pixel|picture|word|name|letters?|writing|says?|spell)/i, 'alpha'],
  [/\b(daisy|daisies|flower chain|flowers?)\b/i, 'daisy'],
  [/\b(braid|braided|plait|plaited)\b/i, 'braid'],
  [/\b(spiral|twist|twisted|staircase|candy cane|rope)\b/i, 'spiral'],
  [/\b(macram|square knot|shamballa|surfer)/i, 'macrame'],
  [/\b(kumihimo|disk|disc|round braid)\b/i, 'kumihimo'],
  [/\b(chevron|stripe|striped|diagonal|diamond|zigzag|zig-zag|arrow|candy stripe|classic|normal|v pattern)\b/i, 'normal'],
];

const GEOM_WORDS = [
  // Ordered most-specific first: "greek wave" is a meander, not a zigzag.
  [/greek|meander|labyrinth|\bmaze\b/i, 'greek-key'],
  [/lightning|bolt|thunder/i, 'lightning'],
  [/celtic|\bweave\b|woven|interlace/i, 'braid'],
  [/gradient|ombre|\bfade\b/i, 'gradient'],
  [/chevron|\bv-?shape|arrowhead/i, 'chevron'],
  [/diamond|argyle|rhomb/i, 'diamond'],
  [/heart/i, 'hearts'],
  [/\bx+o+\b|hugs and kisses/i, 'xo'],
  [/check|checker|chequer|gingham/i, 'checker'],
  [/triangle|mountain|\bpeak|pyramid/i, 'triangles'],
  [/zig ?-?zag|wave|wavy|ripple/i, 'zigzag'],
  [/diagonal|candy ?stripe|barber|slant/i, 'diagonal'],
  [/dots?\b|polka|speckle|confetti/i, 'dots'],
  [/stripe|\bbands?\b/i, 'stripes'],
];

/**
 * @returns {Array<object>} raw designs in the same shape the model emits, so
 *   they go through exactly the same validation path.
 */
export function offlineDesigns({ prompt = '', count = 5, allowedStyles = STYLE_IDS, seed = 'offline' } = {}) {
  const rng = makeRng(seed);
  const read = readPrompt(prompt, rng);
  const pool = [];

  for (const make of [alphaText, alphaMotif, normalGeometry, daisyChain, spiralRope, braidRope, macrameBand, alphaPattern, kumihimoRope, normalTemplate]) {
    const list = make(read, rng) ?? [];
    for (const d of list) if (allowedStyles.includes(d.style)) pool.push(d);
  }

  // Rank by how well each answers the request, then take a spread of styles so
  // five candidates never turn out to be five of the same thing.
  //
  // Scores are jittered by the seed. Without that, re-rolling would hand back
  // the identical five bracelets every time, which makes the shuffle button a
  // lie -- but the jitter is small enough that a clearly-best answer stays on
  // top, so a good prompt still gets the design it asked for.
  for (const d of pool) d._score = (d._score ?? 0) + rng.next() * 8 - 4;
  pool.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  const out = [];
  const used = new Map();
  for (const pass of [1, 2, 99]) {
    for (const d of pool) {
      if (out.length >= count) break;
      if (out.includes(d)) continue;
      if ((used.get(d.style) ?? 0) >= pass) continue;
      used.set(d.style, (used.get(d.style) ?? 0) + 1);
      out.push(d);
    }
    if (out.length >= count) break;
  }
  topUp(out, count, rng);
  return out.slice(0, count).map(({ _score, ...d }) => d);
}

/**
 * Narrowing the style filter shrinks the pool -- ask for daisy chains only and
 * there are only so many daisy chains to offer. Rather than hand back one card,
 * re-cut the designs we do have along the one axis every style has: how wide or
 * how dense the band is. These are different bracelets, not relabelled copies.
 */
function topUp(out, count, rng) {
  const titles = new Set(out.map((d) => d.title));
  // Dedupe on the spec, not the title. A variant that lands on the same knobs
  // as a design we already have is the same bracelet wearing a different name,
  // which is exactly the padding this is meant to avoid.
  const sig = (d) => `${d.style}:${JSON.stringify(d.spec)}`;
  const seen = new Set(out.map(sig));
  for (let round = 0; out.length < count && round < 8; round++) {
    for (const d of out.slice()) {
      if (out.length >= count) break;
      const v = vary(d, round);
      if (!v || titles.has(v.title) || seen.has(sig(v))) continue;
      titles.add(v.title);
      seen.add(sig(v));
      v._score = (d._score ?? 0) - 20 - round;
      out.push(v);
    }
  }
}

const WIDTHS = [9, 11, 15, 17, 19, 21];
const STRANDS = [8, 10, 14, 16, 18, 12];
const SPACING = [4, 6, 14, 20, 26, 10];
const HITCHES = [4, 6, 14, 20, 26, 10];

function vary(d, round) {
  const spec = structuredClone(d.spec);
  const re = (suffix) => (d.title.includes(suffix) ? null : { ...d, title: `${d.title} ${suffix}`, spec });

  switch (d.style) {
    case 'alpha': {
      const w = WIDTHS[round % WIDTHS.length];
      if (w === spec.width) return null;
      spec.width = w;
      return re(`(${w} wide)`);
    }
    case 'normal': {
      const n = STRANDS[round % STRANDS.length];
      if (n === spec.strands) return null;
      spec.strands = n;
      // A template pattern paints one stripe per pair, so the colour list has
      // to follow the strand count or validation quietly pads it.
      if (spec.template && Array.isArray(spec.colors)) {
        spec.colors = Array.from({ length: n / 2 }, (_, i) => spec.colors[i % spec.colors.length]);
      }
      return re(`(${n} strands)`);
    }
    case 'daisy': {
      const s = SPACING[round % SPACING.length];
      if (s === spec.spacing) return null;
      spec.spacing = s;
      return re(`(a flower every ${s})`);
    }
    case 'spiral': {
      const h = HITCHES[round % HITCHES.length];
      if (!Array.isArray(spec.sequence) || !spec.sequence.length) return null;
      if (spec.sequence[0].hitches === h) return null;
      spec.sequence = spec.sequence.map((s) => ({ ...s, hitches: h }));
      return re(`(${h} per twist)`);
    }
    case 'braid': {
      const kinds = ['braid-3', 'braid-4-round', 'fishtail', 'braid-5-flat', 'braid-7-flat'];
      const k = kinds[round % kinds.length];
      if (k === spec.kind) return null;
      spec.kind = k;
      spec.colors = fill(spec.colors, BRAID_KINDS[k].strands);
      return re(`(${BRAID_KINDS[k].label})`);
    }
    case 'macrame': {
      // Only two sinnets exist in the engine, so the other axis is which strand
      // does the knotting and which one sits still in the middle -- that
      // genuinely changes which colour you see on the face of the band.
      const w = spec.working ?? [];
      const c = spec.core ?? [];
      const plans = [
        ['alternating-square', w, c, '(lattice)'],
        ['square-knot', [c[0] ?? w[0], w[1] ?? w[0]], [w[0]], '(core swapped)'],
        ['alternating-square', [c[0] ?? w[0], w[1] ?? w[0]], [w[0]], '(lattice, core swapped)'],
        ['square-knot', [w[1] ?? w[0], w[0]], c, '(hands reversed)'],
        ['alternating-square', [w[1] ?? w[0], w[0]], c, '(lattice, hands reversed)'],
      ];
      const [kind, working, core, label] = plans[round % plans.length];
      if (kind === spec.kind && working.join() === w.join() && core.join() === c.join()) return null;
      spec.kind = kind;
      spec.working = working;
      spec.core = core;
      return re(label);
    }
    case 'kumihimo': {
      // A kumihimo disk only braids one way, so the design *is* how the colours
      // are loaded onto the disk. These four loadings give four visibly
      // different cords from the same eight strands.
      const c = spec.colors ?? [];
      const a = c[0];
      const b = c.find((x) => x !== a) ?? a;
      if (b === a) return null;
      const plans = [
        [[a, b, a, b], '(barber pole)'],
        [[a, a, b, b], '(two-block spiral)'],
        [[a, b, b, a], '(mirrored)'],
        [[a, a, a, b], '(single accent)'],
        [[b, a, b, a], '(barber pole, reversed)'],
      ];
      const [cols, label] = plans[round % plans.length];
      if (cols.join() === c.join()) return null;
      spec.colors = cols;
      return re(label);
    }
    default: return null;
  }
}

/* ------------------------------------------------------------------ reading */

export function readPrompt(prompt, rng = makeRng('r')) {
  const text = String(prompt ?? '');
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9']+/).filter(Boolean);

  const colors = [];
  const push = (code) => { if (code && !colors.includes(code)) colors.push(code); };

  // Explicit DMC codes win over everything.
  for (const m of text.matchAll(/\b(B5200|\d{3,4})\b/g)) if (PALETTE_BY_CODE.has(m[1])) push(m[1]);

  // Colour words, in the order they were said, so "pink and white" lays out pink first.
  const colorWords = [];
  for (const m of lower.matchAll(/\b(light |dark |pale |deep |bright |hot |navy |sky |royal )?([a-z]+)\b/g)) {
    const mod = (m[1] ?? '').trim();
    const base = m[2];
    const joined = `${mod}${base}`;
    if (CSS_COLORS[joined]) { colorWords.push(joined); continue; }
    if (CSS_COLORS[base]) colorWords.push(mod ? `${mod} ${base}` : base);
  }
  for (const cw of colorWords) {
    const [mod, base] = cw.includes(' ') ? cw.split(' ') : ['', cw];
    const hex = CSS_COLORS[cw] ?? CSS_COLORS[base];
    if (!hex) continue;
    push(shade(hex, mod));
  }

  // Moods fill out a thin palette.
  const moods = Object.keys(MOODS).filter((k) => new RegExp(`\\b${k}`, 'i').test(lower));
  for (const m of moods) for (const c of MOODS[m]) push(c);

  // Words to write.
  const phrase = readPhrase(text);

  // A single soft tag brush (score 2) is not a request for that motif; the
  // user has to have actually named the thing, or hit two themes at once.
  const ranked = rankMotifs(words).filter((h) => h.score >= 4);
  const motifs = ranked.slice(0, 4).map((h) => h.motif);
  const motifScore = ranked[0]?.score ?? 0;
  const styleHints = STYLE_WORDS.filter(([re]) => re.test(lower)).map(([, s]) => s);
  const geomHints = GEOM_WORDS.filter(([re]) => re.test(lower)).map(([, g]) => g).filter((g) => GEOMETRY_IDS.includes(g));

  const wantsSimple = /\b(simple|easy|quick|beginner|first|fast|starter)\b/i.test(lower);
  const wantsHard = /\b(complex|hard|advanced|detailed|intricate|challenging|difficult)\b/i.test(lower);
  const wantsThin = /\b(thin|skinny|narrow|delicate|dainty|fine)\b/i.test(lower);
  const wantsWide = /\b(wide|thick|chunky|bold|statement|broad)\b/i.test(lower);

  return {
    text, lower, words, colors, moods, phrase, motifs, motifScore, styleHints, geomHints,
    wantsSimple, wantsHard, wantsThin, wantsWide, rng,
  };
}

/** Nudge a hex lighter/darker before snapping, so "dark green" is not "green". */
function shade(hex, mod) {
  const f = { light: 1.42, pale: 1.55, sky: 1.3, dark: 0.55, deep: 0.6, navy: 0.45, bright: 1.12, hot: 1.05, royal: 0.85 }[mod] ?? 1;
  if (f === 1) return nearestFloss(hex).code;
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? 255 - (255 - v) / f : v * f))));
  return nearestFloss(`#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`).code;
}

/** A palette of at least n, extending what was asked for in a way that suits it. */
function palette(read, n, { needContrast = null } = {}) {
  const out = [...read.colors];
  if (!out.length) out.push(...(MOODS[read.rng.pick(['rainbow', 'sunset', 'ocean', 'berry', 'forest'])]));
  const from = out.length;
  while (out.length < n) {
    const seedCode = out[(out.length - from) % Math.max(1, from)] ?? out[0];
    const next = companion(seedCode, out, read.rng, needContrast);
    if (!next) break;
    out.push(next);
  }
  return out.slice(0, Math.max(n, 2));
}

/** Pick a floss that reads clearly against what is already there. */
function companion(code, taken, rng, needContrast) {
  const base = hexToLab(hexOf(code));
  const pool = PALETTE
    .filter((c) => !taken.includes(c.code))
    .map((c) => ({ c, d: labDistance(base, hexToLab(c.hex)) }))
    .filter(({ d }) => d > (needContrast ?? 25) && d < 110)
    .sort((a, b) => a.d - b.d);
  if (!pool.length) return PALETTE.find((c) => !taken.includes(c.code))?.code ?? null;
  return pool[rng.int(0, Math.max(0, Math.ceil(pool.length / 2) - 1))].c.code;
}

/** A background that the given colours will all show up against. */
function backdrop(colors, rng) {
  const labs = colors.map((c) => hexToLab(hexOf(c)));
  const best = PALETTE
    .filter((c) => !colors.includes(c.code))
    .map((c) => ({ code: c.code, worst: Math.min(...labs.map((l) => labDistance(l, hexToLab(c.hex)))) }))
    .sort((a, b) => b.worst - a.worst);
  return best[rng.int(0, Math.max(0, Math.min(4, best.length) - 1))]?.code ?? '310';
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Words that can follow the thing being spelled but are clearly not part of it,
 * so "the word LOVE written across" yields LOVE and not "LOVE WRITTEN A". */
const PHRASE_STOP = new Set([
  'written', 'write', 'writing', 'across', 'on', 'in', 'down', 'along', 'around', 'over', 'through',
  'with', 'and', 'the', 'a', 'an', 'it', 'is', 'of', 'for', 'to', 'spelled', 'spelt', 'out',
  'bracelet', 'band', 'letters', 'lettering', 'text', 'word', 'words', 'name', 'says', 'reading',
  'repeated', 'repeating', 'colors', 'colours', 'style', 'please', 'thanks',
]);

/**
 * Pull the word(s) somebody wants knotted into the band. Quotes win, then an
 * explicit "the word X", then a SHOUTED word.
 */
function readPhrase(text) {
  const clean = (s) => (s ?? '').trim().toUpperCase().replace(/[^A-Z0-9 !?&.\-+*<>#']/g, '').replace(/\s+/g, ' ').trim();
  const ok = (s) => s && s.length <= 14 && /[A-Z0-9]/.test(s) && [...s].every(hasGlyph);

  const quoted = text.match(/["'\u201c\u2018]([^"'\u201d\u2019]{1,14})["'\u201d\u2019]/);
  if (ok(clean(quoted?.[1]))) return clean(quoted[1]);

  const said = text.match(/\b(?:says?|saying|reads?|reading|spells?|spelling|word|name)\s+((?:[A-Za-z0-9!?&'.\-]+\s*){1,4})/i);
  if (said) {
    const kept = [];
    for (const tok of said[1].trim().split(/\s+/)) {
      if (PHRASE_STOP.has(tok.toLowerCase())) break;
      kept.push(tok);
      if (kept.join(' ').length >= 14) break;
    }
    const c = clean(kept.join(' '));
    if (ok(c)) return c;
  }

  // A shouted word only counts if the rest of the sentence isn't shouting too.
  const shout = text.match(/\b([A-Z][A-Z0-9]{1,11})\b/);
  if (shout && text !== text.toUpperCase() && ok(clean(shout[1]))) return clean(shout[1]);
  return null;
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'with', 'to', 'or']);
/** Title Case That Keeps Small Words Small (except the first one). */
const title = (s) => String(s)
  .split(/\s+/)
  .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : cap(w.toLowerCase())))
  .join(' ');

/** "cactus" -> "cacti"-ish. Enough English to stop "cactuss" reaching a user. */
function plural(word) {
  const w = String(word).toLowerCase();
  if (/(?:s|x|z|ch|sh)$/.test(w)) return `${w}es`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  if (/(?:f)$/.test(w)) return `${w.slice(0, -1)}ves`;
  if (/fe$/.test(w)) return `${w.slice(0, -2)}ves`;
  return `${w}s`;
}

/** Pluralise only the head noun: "watermelon slice" -> "watermelon slices". */
const pluralLabel = (label) => {
  const parts = String(label).toLowerCase().split(' ');
  parts[parts.length - 1] = plural(parts[parts.length - 1]);
  return parts.join(' ');
};

/* -------------------------------------------------------------- the makers */

function alphaText(read, rng) {
  if (!read.phrase) return [];
  // "blue bracelet with the word LOVE" names the BAND, not the letters. So one
  // named colour is the background and the lettering becomes whichever of white
  // or black reads against it; two or more, and the second is the ink.
  const bg = read.colors[0] ?? backdrop(['B5200'], rng);
  const ink = read.colors[1] ?? readableOn(bg);
  const width = read.wantsThin ? 11 : read.wantsWide ? 17 : 13;
  const nice = cap(read.phrase.toLowerCase());
  return [
    {
      _score: 100,
      title: `${nice} in Knots`,
      blurb: `The word ${read.phrase} stacked down the band, one letter above the next, so it reads when you turn your wrist.`,
      style: 'alpha',
      spec: { width, background: bg, design: { kind: 'text', text: read.phrase, color: ink } },
    },
    {
      _score: 88,
      title: `${nice}, Reversed`,
      blurb: `The same word with the colours swapped -- ${shortName(ink).toLowerCase()} band, ${shortName(bg).toLowerCase()} letters.`,
      style: 'alpha',
      spec: { width, background: ink, design: { kind: 'text', text: read.phrase, color: bg } },
    },
    {
      _score: 80,
      title: `${nice}, Narrow`,
      blurb: `${read.phrase} on a slimmer band -- fewer strands, less floss, and it still reads clearly.`,
      style: 'alpha',
      spec: { width: 9, background: bg, design: { kind: 'text', text: read.phrase, color: ink } },
    },
    {
      _score: 74,
      title: `${nice}, Wide`,
      blurb: `A broad cuff version, with room around the letters so the word sits in the middle of the band.`,
      style: 'alpha',
      spec: { width: 19, background: bg, design: { kind: 'text', text: read.phrase, color: ink } },
    },
  ];
}

/** Whichever of the palette's near-white or near-black stands out most. */
function readableOn(code) {
  const bg = hexToLab(hexOf(code));
  return ['B5200', '310', '444', '666']
    .map((c) => ({ c, d: labDistance(bg, hexToLab(hexOf(c))) }))
    .sort((a, b) => b.d - a.d)[0].c;
}

function alphaMotif(read, rng) {
  if (!read.motifs.length) return [];
  const out = [];
  const [first, second] = read.motifs;
  const suggested = first.suggest?.[0] ?? [];
  const colors = read.colors.length ? read.colors.slice(0, Math.max(1, first.slots.length)) : suggested;
  const bg = read.colors[colors.length] ?? backdrop(colors, rng);

  out.push({
    _score: 55 + Math.min(35, read.motifScore * 6),
    title: `${title(first.label)} Repeat`,
    blurb: `A row of ${pluralLabel(first.label)} marching down the band with a little breathing room between each.`,
    style: 'alpha',
    spec: {
      width: read.wantsWide ? 17 : 13,
      background: bg,
      design: { kind: 'motif', motif: first.id, colors: colors.length ? colors : suggested, gapY: read.wantsSimple ? 3 : 2 },
    },
  });

  if (second) {
    out.push({
      _score: 50 + Math.min(35, read.motifScore * 6),
      title: `${title(first.label)} and ${title(second.label)}`,
      blurb: `${title(first.label)} and ${pluralLabel(second.label)} taking turns down the bracelet.`,
      style: 'alpha',
      spec: {
        width: 15,
        background: bg,
        design: {
          kind: 'motifs',
          gapY: 2,
          items: [
            { motif: first.id, colors: colors.length ? colors : suggested },
            { motif: second.id, colors: second.suggest?.[0] ?? colors },
          ],
        },
      },
    });
  }

  // Same motif, different band. The gap and the width change the rhythm enough
  // that these read as separate bracelets, not as the same one twice.
  out.push({
    _score: 44 + Math.min(30, read.motifScore * 6),
    title: `${title(first.label)}, Close-Packed`,
    blurb: `The same ${first.label.toLowerCase()} with the gap closed up, so the motifs almost touch and the band fills edge to edge.`,
    style: 'alpha',
    spec: {
      width: 13,
      background: bg,
      design: { kind: 'motif', motif: first.id, colors: colors.length ? colors : suggested, gapY: 1 },
    },
  });
  out.push({
    _score: 40 + Math.min(30, read.motifScore * 6),
    title: `${title(first.label)}, Wide Band`,
    blurb: `A broader cuff with the ${first.label.toLowerCase()} centred and plenty of background either side.`,
    style: 'alpha',
    spec: {
      width: 19,
      background: bg,
      design: { kind: 'motif', motif: first.id, colors: colors.length ? colors : suggested, gapY: 3 },
    },
  });
  return out;
}

function normalGeometry(read, rng) {
  const geoms = read.geomHints.length ? read.geomHints : ['chevron', 'diagonal', 'diamond'];
  const strands = read.wantsThin ? 8 : read.wantsWide ? 16 : 12;
  const asked = read.geomHints.length;
  // Two or three colours. A shaped motif in five hues stops reading as a shape
  // and starts reading as confetti.
  const paint = (g) => palette(read, g === 'gradient' ? 5 : 3, { needContrast: 34 });
  const one = (g, n, score, suffix, note) => ({
    _score: score,
    title: `${title(g.replace(/-/g, ' '))} ${suffix}`,
    blurb: note,
    style: 'normal',
    spec: { strands: n, colors: paint(g), design: { kind: 'geometry', geometry: g } },
  });

  const out = geoms.slice(0, 3).map((g, i) => one(
    g, strands, (asked ? 94 : 40) - i * 6, 'Band',
    `A repeating ${g.replace(/-/g, ' ')} worked in forward and backward knots -- the classic friendship bracelet look.`,
  ));

  // Width is not a cosmetic setting here: a diagonal pattern is drawn by the
  // strands themselves, so eight strands and sixteen give genuinely different
  // bracelets from the same idea.
  const lead = geoms[0];
  if (strands !== 8) {
    out.push(one(lead, 8, (asked ? 94 : 40) - 14, 'Narrow',
      `The same ${lead.replace(/-/g, ' ')} on eight strands -- a slim band that works up in a fraction of the time.`));
  }
  if (strands !== 16) {
    out.push(one(lead, 16, (asked ? 94 : 40) - 18, 'Wide',
      `A sixteen-strand cuff, which gives the ${lead.replace(/-/g, ' ')} room to show its full shape.`));
  }
  return out;
}

function normalTemplate(read, rng) {
  const wanted = /chevron|candy ?stripe|classic|simple|easy/i.test(read.lower) ? 78 : 35;
  const strands = read.wantsThin ? 8 : read.wantsWide ? 16 : 12;
  const both = [
    ['chevron', 'Plain Chevron', 'Two mirrored halves meeting in a V down the middle -- the pattern everyone learns first.'],
    ['candy-stripe', 'Candy Stripe', 'Colours walking diagonally across the band, one stripe per strand. As simple as it gets.'],
  ];
  // Whichever the request leans towards goes first; the other still gets
  // offered, because they are the two patterns everybody actually makes.
  const leansCandy = /candy ?stripe|diagonal|barber/i.test(read.lower) || read.geomHints.includes('diagonal');
  const order = leansCandy ? [both[1], both[0]] : both;
  return order.map(([t, name, blurb], i) => ({
    _score: wanted - i * 8,
    title: name,
    blurb,
    style: 'normal',
    spec: { strands, colors: palette(read, strands / 2, { needContrast: 28 }), template: t },
  }));
}

function alphaPattern(read, rng) {
  if (read.phrase || read.motifs.length) return [];
  const colors = palette(read, 3, { needContrast: 32 });
  // Hinted geometries first, then fill from the standard grid patterns, so a
  // one-word request still produces a choice rather than a single card.
  const geoms = [...read.geomHints];
  for (const g of rng.sample(['checker', 'zigzag', 'bands', 'diamond', 'wave', 'vertical'], 6)) {
    if (geoms.length >= 3) break;
    if (!geoms.includes(g)) geoms.push(g);
  }
  return geoms.slice(0, 3).map((g, i) => ({
    _score: 30 - i * 4,
    title: `${title(g.replace(/-/g, ' '))} Grid`,
    blurb: `A ${g.replace(/-/g, ' ')} worked as a pixel grid, one knot per square.`,
    style: 'alpha',
    spec: { width: 13, background: colors[0], design: { kind: 'geometry', geometry: g, colors: colors.slice(1) } },
  }));
}

/**
 * A one-word flavour drawn from the request, used to stop five candidates for
 * "sunset chevron" all arriving with the same neutral factory names.
 */
function flavour(read) {
  if (read.moods.length) return title(read.moods[0]);
  const fam = read.colors.length ? PALETTE_BY_CODE.get(read.colors[0])?.family : null;
  return fam ? title(fam) : null;
}

const flavoured = (read, name) => {
  const f = flavour(read);
  return f && !name.toLowerCase().includes(f.toLowerCase()) ? `${f} ${name}` : name;
};

/* Each of these used to return exactly one design, which was fine while every
 * style was on -- the ranker had ten candidates to choose five from. But as
 * soon as someone unticks styles the pool collapses, and asking for "only
 * daisy chain" handed back a single card. So every family now offers the
 * variants the engine actually supports, scored below its canonical form. */

function daisyChain(read, rng) {
  const wants = read.styleHints.includes('daisy') || /flower|daisy|petal|bloom/i.test(read.lower);
  const base = wants ? 95 : 20;
  const petal = read.colors.find((c) => ['B5200', 'BLANC', '445', '818', '307', 'ECRU'].includes(c)) ?? (wants ? read.colors[0] ?? 'B5200' : 'B5200');
  const stem = read.colors.find((c) => c !== petal) ?? '700';
  const centre = read.colors[2] ?? '444';
  const named = (n) => (wants ? n : flavoured(read, n));
  return [
    {
      _score: base,
      title: named('Daisy Chain'),
      blurb: 'Real knotted flowers -- five petals round a bright centre -- strung along a plain stem.',
      style: 'daisy',
      spec: { petal, centre, stem, spacing: read.wantsSimple ? 12 : 8, petalsPerSide: 3 },
    },
    {
      _score: base - 7,
      title: named('Crowded Daisy Chain'),
      blurb: 'The same flower packed nose to tail, so the whole band reads as one unbroken row of petals.',
      style: 'daisy',
      spec: { petal, centre, stem, spacing: 4, petalsPerSide: 3 },
    },
    {
      _score: base - 11,
      title: named('Wide-Petal Daisy Chain'),
      blurb: 'Four knots a side instead of three, which opens the flower out into a rounder, fatter bloom.',
      style: 'daisy',
      spec: { petal, centre, stem, spacing: 9, petalsPerSide: 4 },
    },
    {
      _score: base - 15,
      title: named('Scattered Daisy Chain'),
      blurb: 'Long runs of twisted stem with a single flower every so often. Quick, and the flowers count for more.',
      style: 'daisy',
      spec: { petal, centre, stem, spacing: 20, petalsPerSide: 3 },
    },
  ];
}

function spiralRope(read, rng) {
  const wants = read.styleHints.includes('spiral');
  const base = wants ? 92 : 25;
  const colors = palette(read, 3);
  return [
    {
      _score: base,
      title: wants ? 'Chinese Staircase' : flavoured(read, 'Staircase Spiral'),
      blurb: 'One strand hitched round a core again and again until it twists into a barber-pole spiral. No chart to follow.',
      style: 'spiral',
      spec: {
        kind: 'chinese-staircase',
        core: [colors[0]],
        sequence: colors.slice(1).concat(colors.slice(1)).map((c) => ({ color: c, hitches: 10 })),
      },
    },
    {
      _score: base - 8,
      title: wants ? 'Half-Knot Spiral' : flavoured(read, 'Half-Knot Twist'),
      blurb: 'Two strands tying only the left half of a square knot over a still core, so the band corkscrews on its own.',
      style: 'spiral',
      spec: {
        kind: 'half-knot-spiral',
        core: [colors[0]],
        sequence: [{ color: colors[1] ?? colors[0], hitches: 4 }],
      },
    },
    {
      _score: base - 13,
      title: wants ? 'Short-Run Staircase' : flavoured(read, 'Candy Twist'),
      blurb: 'The same staircase but changing colour every few hitches, which stripes the spiral instead of blocking it.',
      style: 'spiral',
      spec: {
        kind: 'chinese-staircase',
        core: [colors[0]],
        sequence: colors.slice(1).concat(colors.slice(1)).map((c) => ({ color: c, hitches: 4 })),
      },
    },
  ];
}

function braidRope(read, rng) {
  const wants = read.styleHints.includes('braid') || read.wantsSimple;
  const base = wants ? 88 : 22;
  const colors = palette(read, 7);
  const named = (n) => (wants ? n : flavoured(read, n));
  const out = [
    {
      kind: 'braid-3', drop: 0, name: 'Three-Strand Plait', need: 3,
      blurb: 'The plait everyone already knows, worked in floss. Fast, flat and forgiving.',
    },
    {
      kind: 'braid-4-round', drop: 2, name: 'Round Four-Strand Braid', need: 4,
      blurb: 'No knots at all, just a braid -- an evening\'s work and it wears like rope.',
    },
    {
      kind: 'fishtail', drop: 6, name: 'Fishtail Braid', need: 4,
      blurb: 'Two bundles trading their outer edges. Reads as a fine chevron without a single knot.',
    },
    {
      kind: 'braid-5-flat', drop: 9, name: 'Five-Strand Flat Braid', need: 5,
      blurb: 'A wider flat braid with a herringbone surface. Still no knots, just more strands to keep track of.',
    },
    {
      kind: 'braid-7-flat', drop: 13, name: 'Seven-Strand Ribbon Braid', need: 7,
      blurb: 'Seven strands woven over-under-over into a wide, ribbon-like band.',
    },
  ];
  // A braid needs one strand per position, so a design that asks for more
  // colours than we can source would just repeat itself. Offer it anyway --
  // repeated colours braid fine -- but prefer the ones the palette fills.
  return out.map((o) => ({
    _score: base - o.drop - (colors.length < o.need ? 4 : 0),
    title: named(o.name),
    blurb: o.blurb,
    style: 'braid',
    spec: { kind: o.kind, colors: fill(colors, o.need) },
  }));
}

/** Repeat what we have until there are n strands, so a two-colour request can
 *  still be braided seven wide. */
function fill(colors, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(colors[i % colors.length]);
  return out;
}

function macrameBand(read, rng) {
  const wants = read.styleHints.includes('macrame');
  const base = wants ? 90 : 12;
  const colors = palette(read, 3);
  const working = [colors[0], colors[1] ?? colors[0]];
  const core = [colors[2] ?? colors[0]];
  const named = (n) => (wants ? n : flavoured(read, n));
  return [
    {
      _score: base,
      title: named('Square Knot Band'),
      blurb: 'Flat macramé square knots over a still core -- the surfer-bracelet build, sturdy and quick.',
      style: 'macrame',
      spec: { kind: 'square-knot', working, core },
    },
    {
      _score: base - 6,
      title: named('Square Knot Lattice'),
      blurb: 'Rows of square knots offset from each other so the band opens into an airy net.',
      style: 'macrame',
      spec: { kind: 'alternating-square', working, core },
    },
    {
      _score: base - 10,
      title: named('Two-Tone Square Knot Band'),
      blurb: 'The same sinnet with the two working strands in different colours, which makes the knots read as a chain of alternating bumps.',
      style: 'macrame',
      spec: { kind: 'square-knot', working: [colors[0], colors[2] ?? colors[1] ?? colors[0]], core: [colors[1] ?? colors[0]] },
    },
  ];
}

function kumihimoRope(read, rng) {
  // Kumihimo needs a foam disk, so it should not turn up unasked at the top of
  // a list -- but it must still be reachable, or ticking only Kumihimo would
  // return nothing at all.
  const wants = read.styleHints.includes('kumihimo');
  const base = wants ? 86 : 6;
  const colors = palette(read, 4);
  const named = (n) => (wants ? n : flavoured(read, n));
  return [
    {
      _score: base,
      title: named('Kumihimo Round'),
      blurb: 'Eight strands worked on a foam disk into a smooth spiralling cord.',
      style: 'kumihimo',
      spec: { colors: fill(colors, 4) },
    },
    {
      _score: base - 6,
      title: named('Kumihimo Barber Pole'),
      blurb: 'The same eight-strand round braid loaded with two colours opposite each other, which spirals them round the rope.',
      style: 'kumihimo',
      spec: { colors: fill([colors[0], colors[1] ?? colors[0]], 4) },
    },
  ];
}
