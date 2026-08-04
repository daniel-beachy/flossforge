/**
 * compile.js -- turn a validated Design into a Pattern: everything a person
 * needs in their hands to actually make the thing.
 *
 * This is the layer where a design stops being a wish and becomes knots. Each
 * style is simulated with the real knot rules, and whatever the simulation
 * says is what gets drawn, counted and written up -- so the preview cannot
 * disagree with the instructions, and neither can flatter the design.
 */

import { hexOf, nameOf, shortName, floss } from './palette.js';
import {
  bandLength, rowsForBand, cutLength, skeinsFor, formatCut, formatLen,
} from './sizing.js';
import {
  geometric, tileMotif, tileAlternating, textImage, fromPixels, solid, addBorder, imageColors,
} from './imagegen.js';
import {
  NORMAL_TEMPLATES, templateRows, solveSetup, repeatLength, fitBestSetup, fitTarget,
  renderNormalImage, strandPaths, knotsPerStrand,
} from './styles/normal.js';
import { simulate } from './knots.js';
import { planAlpha, simulateAlpha, alphaKnotCounts } from './styles/alpha.js';
import { compileBraid, compileSpiral, compileMacrame, compileDaisy, compileKumihimo } from './styles/simple.js';
import { STYLE_BY_ID } from './design.js';
import { buildSteps } from './instructions.js';

/**
 * @param {object} design a design that has already been through validateDesign
 * @param {{size?:string, fit?:string, customInches?:number, maxRows?:number}} [opts]
 */
export function compilePattern(design, opts = {}) {
  const band = bandLength(opts);
  const style = design.style;
  const notes = [];
  const warnings = [];

  const core =
    style === 'normal' ? compileNormal(design, band, opts, notes, warnings)
    : style === 'alpha' ? compileAlpha(design, band, opts, notes, warnings)
    : compileSimple(design, band, notes, warnings);

  const materials = buildMaterials(core.strandPlan, band);
  const totals = totalUp(materials);
  const meta = STYLE_BY_ID.get(style);

  // A knotting strand that does every knot in the band gets genuinely long.
  // That is real -- alpha patterns eat floss -- but nobody wants to find out
  // halfway through, so say it up front and say what to do about it.
  const longest = materials.reduce((a, m) => (m.cutInches > (a?.cutInches ?? 0) ? m : a), null);
  if (longest && longest.cutInches > 150) {
    notes.push(
      `${shortName(longest.code)} has to be cut ${longest.cutText} — long enough to be awkward. `
      + `Cut it in ${Math.ceil(longest.cutInches / 120)} pieces instead and start a new one when the old runs short: `
      + `leave a 4 in tail, lay the new strand alongside, and knot with both for two or three knots before dropping the old one.`,
    );
  }

  const pattern = {
    style,
    styleLabel: meta?.label ?? style,
    title: design.title,
    blurb: design.blurb || core.blurb || meta?.blurb || '',
    design,
    band: {
      inches: band.inches,
      label: band.size.label,
      fit: band.fit.label,
      text: formatLen(band.inches),
      custom: band.custom,
      wrist: band.wrist,
      ease: band.ease,
    },
    chart: core.chart,
    strandPlan: core.strandPlan,
    materials,
    totals,
    fidelity: core.fidelity ?? 1,
    knots: core.knots ?? 0,
    notes,
    warnings,
    needsTool: meta?.needsTool ?? null,
    difficulty: difficultyOf(style, core),
    timeMinutes: timeEstimate(style, core),
  };

  pattern.steps = buildSteps(pattern);
  return pattern;
}

/* ------------------------------------------------------------- normal style */

function compileNormal(design, band, opts, notes, warnings) {
  const { strands, colors } = design.spec;
  const rowCount = Math.min(opts.maxRows ?? 600, rowsForBand('normal', band.inches));

  let setup;
  let tile;
  let fidelity = 1;
  const templateId = design.spec.template ?? geometryTemplate(design.spec.design);

  if (templateId) {
    const t = NORMAL_TEMPLATES[templateId];
    // A template's tile is however long it takes the strands to come home.
    const probe = templateRows(templateId, strands, Math.min(rowCount, 2 * strands + 4));
    setup = solveSetup(probe, strands, colors, { mirrored: !!t.mirrored }).setup;
    const period = evenUp(repeatLength(probe, setup) ?? Math.min(rowCount, 2 * strands));
    tile = templateRows(templateId, strands, period);
    notes.push(t.note ?? `${t.label}: every row is the same move, so once you have the rhythm you can stop reading.`);
  } else {
    // Fit ONE repeat, not the whole band. Real patterns are a tile you repeat,
    // and fitting 20 rows instead of 150 is what keeps this instant.
    //
    // The tile must have an EVEN number of rows: rows alternate between the
    // two brickwork offsets, so an odd tile would put every other copy on the
    // wrong offset and the whole thing would fall apart.
    // Try one repeat first across all candidate strand orders, then give the
    // winning order a longer run: a picture whose strands do not come home
    // after one tile often does after two, and a short honest repeat is worth
    // far more to whoever is tying it than a marginally closer fit.
    const picture = normalTarget(design.spec.design, strands, rowCount, colors);
    const period = clamp(evenUp(detectRepeat(picture) ?? 16), 4, 48);

    let fit = fitBestSetup(repeatTo(picture, period), strands, colors, { beam: 40, close: true });
    setup = fit.setup;
    if (!fit.closed || fit.score < 0.97) {
      for (const mult of [2, 3]) {
        const h = period * mult;
        if (h > 96) break;
        const res = fitTarget(setup, repeatTo(picture, h), strands, { beam: 40, closeTo: setup });
        const score = res.matched / Math.max(1, res.total);
        const closed = res.final.join('|') === setup.join('|');
        if (score + (closed ? 0.05 : 0) > fit.score + (fit.closed ? 0.05 : 0)) {
          fit = { ...res, setup, score, closed };
        }
        if (fit.closed && fit.score > 0.97) break;
      }
    }

    tile = fit.rows;
    fidelity = fit.matched / Math.max(1, fit.total);
    if (!fit.closed) {
      notes.push('The strands do not land back in their starting order at the end of the repeat, so the pattern drifts very slightly as it goes. Follow the rows as written and it will still look right.');
    }
    if (fidelity < 0.999) {
      notes.push(
        `Diagonal knots cannot draw every picture exactly -- the colour at a knot has to come from one of the two strands already sitting there. ` +
        `The engine searched the tie-able patterns, matched ${fit.matched} of ${fit.total} knots (${pct(fidelity)}), and used the closest legal knot everywhere else.`
      );
    }
    if (fidelity < 0.8) {
      warnings.push(`Only ${pct(fidelity)} of this picture survives being knotted diagonally. A pixel-grid version would be much closer to the idea.`);
    }
  }

  const repeat = tile.length;
  const rows = tileRows(tile, rowCount);
  const { sim, image } = renderNormalImage(setup, rows);
  const counts = knotsPerStrand(setup, rows);

  const strandPlan = setup.map((color, i) => ({
    role: `Strand ${i + 1}`,
    slot: i,
    color,
    plies: 6,
    knots: counts[i],
    travel: band.inches,
  }));

  return {
    chart: {
      kind: 'normal',
      strands,
      setup,
      rows,
      tile,
      knots: sim.knots,
      image,
      paths: strandPaths(setup, rows),
      repeat,
      template: templateId,
      rowCount,
    },
    strandPlan,
    fidelity,
    knots: rows.reduce((a, r) => a + r.length, 0),
    repeat,
    blurb: templateId ? NORMAL_TEMPLATES[templateId].blurb : '',
  };
}

/**
 * Four of the shapes have an exact construction rather than a fitted
 * approximation. If a design asks for one of them, use the real thing: it is
 * both perfect and instant, and it is what a person would actually be told to
 * tie.
 */
const GEOMETRY_TEMPLATE = {
  diagonal: 'candy-stripe',
  'diagonal-left': 'candy-stripe-left',
  chevron: 'chevron',
  'chevron-up': 'chevron-up',
};
function geometryTemplate(d) {
  if (!d || d.kind !== 'geometry') return null;
  if (d.thickness > 1 || d.scale > 1) return null;
  return GEOMETRY_TEMPLATE[d.geometry] ?? null;
}

/** Stack copies of a picture until it is `h` rows tall. */
function repeatTo(picture, h) {
  const out = [];
  for (let r = 0; r < h; r++) out.push(picture[r % picture.length]);
  return out;
}

/** Repeat the tile down the band, cutting off at the row count. */
function tileRows(tile, rowCount) {
  const rows = [];
  while (rows.length < rowCount) rows.push(...tile.map((r) => r.map((k) => ({ ...k }))));
  return rows.slice(0, rowCount);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const evenUp = (n) => (n % 2 === 0 ? n : n * 2);

/**
 * The picture a normal pattern should aim for, in KNOT SPACE.
 *
 * A row of a normal pattern holds n/2 knots, not n-1, and the odd rows sit
 * half a knot over. So the target is drawn n/2 wide -- which is also exactly
 * how these charts appear on paper.
 */
function normalTarget(d, strands, rowCount, colors) {
  const W = Math.floor(strands / 2);
  const bg = colors[colors.length - 1];
  return sized(pictureFor(d, W, rowCount, colors, bg), W, rowCount, bg);
}

/* -------------------------------------------------------------- alpha style */

function compileAlpha(design, band, opts, notes, warnings) {
  const { width, background } = design.spec;
  const rowCount = Math.min(opts.maxRows ?? 400, rowsForBand('alpha', band.inches));
  const palette = [background, ...(design.spec.design?.colors ?? [design.spec.design?.color]).filter(Boolean)];

  // A geometry paints by cycling through its colour list, so on a pixel grid the
  // background has to be in that list or the shape has nothing to sit against.
  const block = design.spec.design?.kind === 'geometry'
    ? { ...design.spec.design, colors: [background, ...(design.spec.design.colors ?? []).filter((c) => c !== background)] }
    : design.spec.design;

  let image = sized(pictureFor(block, width, rowCount, palette, background), width, rowCount, background);
  if (design.spec.border) image = addBorder(image, design.spec.border.color, design.spec.border.width);

  const plan = planAlpha(image, background);
  const sim = simulateAlpha(plan);
  const counts = alphaKnotCounts(sim);

  if (plan.repairs.length) {
    notes.push(
      `A pixel column can only show its own strand's colour or a colour the weft is carrying. ` +
      `${plan.repairs.length} knot${plan.repairs.length === 1 ? '' : 's'} of ${plan.width * plan.height} asked for something else, ` +
      `so the engine moved ${plan.repairs.length === 1 ? 'it' : 'them'} to the nearest colour that can actually be tied there.`
    );
  }
  if (plan.wefts.length > 1) {
    notes.push(
      `This one carries ${plan.wefts.length} knotting strands (${plan.wefts.map((c) => nameOf(c)).join(', ')}). ` +
      `When a colour is not in use, drop it behind the work and pick it up again when you need it -- do not cut it.`
    );
  }
  if (plan.carries > plan.height * 2.5) {
    warnings.push('This design swaps knotting strands a lot, so the back will have long floats and the band will be thick. It is tie-able, just fiddly.');
  }
  if (!sim.ok) warnings.push(`Internal check: ${sim.misses.length} knots did not simulate to the planned colour.`);

  const strandPlan = [
    ...plan.wefts.map((color, i) => ({
      role: i === 0 ? 'Knotting strand (background)' : 'Knotting strand (extra colour)',
      color,
      plies: 6,
      knots: (counts.weft[color] ?? 0) + (i === 0 ? counts.edges : 0),
      travel: band.inches,
      weft: true,
      // the weft crosses the full width on every row it works, so it eats far
      // more floss than a base strand does
      extraTravel: (counts.weft[color] ?? 0) * 0,
    })),
    ...plan.base.map((color, c) => ({
      role: `Base strand ${c + 1}`,
      slot: c,
      color,
      plies: 6,
      knots: counts.base[c],
      travel: band.inches,
    })),
  ];

  return {
    chart: {
      kind: 'alpha',
      width: plan.width,
      height: plan.height,
      image: plan.image,
      base: plan.base,
      wefts: plan.wefts,
      background,
      rows: sim.rows,
      repeat: design.spec.design?.repeatEvery ?? detectRepeat(plan.image),
      stringCount: plan.width + plan.wefts.length,
    },
    strandPlan,
    fidelity: plan.fidelity,
    knots: counts.total,
    blurb: '',
  };
}

/* ------------------------------------------------------- the simple families */

function compileSimple(design, band, notes) {
  const s = design.spec;
  const bandInches = band.inches;
  let c;
  switch (design.style) {
    case 'daisy': c = compileDaisy({ ...s, bandInches }); break;
    case 'braid': c = compileBraid({ ...s, bandInches }); break;
    case 'spiral': c = compileSpiral({ ...s, bandInches }); break;
    case 'macrame': c = compileMacrame({ ...s, bandInches }); break;
    case 'kumihimo': c = compileKumihimo({ ...s, bandInches }); break;
    default: throw new Error(`no compiler for ${design.style}`);
  }
  if (c.note) notes.push(c.note);
  return {
    chart: { kind: c.family, ...c, image: null },
    strandPlan: c.strandPlan,
    fidelity: 1,
    knots: c.strandPlan.reduce((a, s2) => a + (s2.knots ?? 0), 0),
    blurb: c.blurb,
  };
}

/* ------------------------------------------------------------- the pictures */

/** Turn a validated design block into a colour grid. */
function pictureFor(d, W, H, palette, background) {
  if (!d) return solid(W, H, palette[0] ?? background);
  switch (d.kind) {
    case 'geometry':
      return geometric(d.geometry, W, H, d.colors?.length ? d.colors : (palette.length ? palette : [background]), { thickness: d.thickness, scale: d.scale });
    case 'text':
      return textImage({ text: d.text, color: d.color, background, W, H, gapY: d.gapY }).image;
    case 'motif':
      return tileMotif({ motif: d.motif, colors: d.colors, background, W, H, gapY: d.gapY, columns: d.columns, stagger: d.stagger });
    case 'motifs':
      return tileAlternating({ motifs: d.items, background, W, H, gapY: d.gapY });
    case 'pixels':
      return tileGrid(fromPixels(d.pixels, d.legend, background), W, H, background, d.gapY);
    default:
      return solid(W, H, background);
  }
}

/** Repeat a fixed drawing down the band and centre it across. */
function tileGrid(tile, W, H, background, gapY = 2) {
  const th = tile.length;
  const tw = tile[0].length;
  const out = solid(W, H, background);
  const step = th + gapY;
  const x0 = Math.round((W - tw) / 2);
  for (let base = 0; base < H + th; base += step) {
    for (let y = 0; y < th; y++) {
      const ry = base + y;
      if (ry < 0 || ry >= H) continue;
      for (let x = 0; x < tw; x++) {
        const rx = x0 + x;
        if (rx < 0 || rx >= W) continue;
        if (tile[y][x] != null) out[ry][rx] = tile[y][x];
      }
    }
  }
  return out;
}

/** Force any picture to exactly W x H so the rest of the engine can trust it. */
function sized(img, W, H, fill) {
  const out = [];
  for (let r = 0; r < H; r++) {
    const src = img[r % Math.max(1, img.length)] ?? [];
    const row = [];
    for (let c = 0; c < W; c++) row.push(src[c] ?? fill);
    out.push(row);
  }
  return out;
}

/** Shortest number of rows after which the picture starts over. */
function detectRepeat(image) {
  const H = image.length;
  for (let p = 1; p <= Math.floor(H / 2); p++) {
    let ok = true;
    for (let r = 0; r + p < H && ok; r++) {
      if (image[r].join('|') !== image[r + p].join('|')) ok = false;
    }
    if (ok) return p;
  }
  return null;
}

/* ------------------------------------------------------------- the shopping */

/**
 * Group the strand plan by colour and work out cut lengths. Every strand of a
 * colour is cut to the same length -- the longest that colour needs -- because
 * nobody wants to keep track of six subtly different lengths.
 */
export function buildMaterials(strandPlan, band) {
  const byColor = new Map();
  for (const s of strandPlan) {
    if (!byColor.has(s.color)) byColor.set(s.color, []);
    byColor.get(s.color).push(s);
  }

  const materials = [];
  for (const [color, group] of byColor) {
    const worst = group.reduce((a, b) => ((b.knots ?? 0) > (a.knots ?? 0) ? b : a));
    const cut = cutLength({
      knots: worst.knots ?? 0,
      bandInches: worst.travel ?? band.inches,
      extraTravel: worst.extraTravel ?? 0,
    });
    const count = group.length;
    const totalInches = cut.inches * count;
    const f = floss(color);
    materials.push({
      code: color,
      name: nameOf(color),
      hex: hexOf(color),
      family: f?.family ?? null,
      count,
      roles: tidyRoles(group.map((g) => g.role)),
      knots: worst.knots ?? 0,
      cutInches: cut.inches,
      cutText: formatCut(cut.inches),
      steps: cut.steps,
      totalInches,
      totalText: formatCut(totalInches),
      skeins: skeinsFor(totalInches),
    });
  }
  materials.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return materials;
}

/**
 * "Base strand 1 … Base strand 13" is technically true and completely useless
 * to read. Collapse numbered runs of the same role back into a range.
 */
function tidyRoles(roles) {
  const groups = new Map();
  const plain = [];
  for (const role of roles) {
    const m = role.match(/^(.*?)\s+(\d+)$/);
    if (!m) { if (!plain.includes(role)) plain.push(role); continue; }
    if (!groups.has(m[1])) groups.set(m[1], []);
    groups.get(m[1]).push(Number(m[2]));
  }
  const out = [...plain];
  for (const [stem, nums] of groups) {
    nums.sort((a, b) => a - b);
    if (nums.length === 1) out.push(`${stem} ${nums[0]}`);
    else if (nums.length === nums[nums.length - 1] - nums[0] + 1) out.push(`${stem}s ${nums[0]}\u2013${nums[nums.length - 1]}`);
    else out.push(`${stem}s ${nums.join(', ')}`);
  }
  return out;
}

function totalUp(materials) {
  const inches = materials.reduce((a, m) => a + m.totalInches, 0);
  return {
    inches: Math.ceil(inches),
    text: formatCut(inches),
    skeins: materials.reduce((a, m) => a + m.skeins, 0),
    strands: materials.reduce((a, m) => a + m.count, 0),
    colors: materials.length,
  };
}

/* ------------------------------------------------------------------ scoring */

function difficultyOf(style, core) {
  const base = STYLE_BY_ID.get(style)?.difficulty ?? 2;
  let d = base;
  if (style === 'alpha' && core.chart.wefts?.length > 1) d += 1;
  if (style === 'normal' && !core.chart.template) d += 1;
  if (style === 'normal' && core.chart.strands >= 18) d += 1;
  return Math.max(1, Math.min(5, d));
}

const LEVELS = ['', 'Very easy', 'Easy', 'Doable', 'Involved', 'Ambitious'];
export const difficultyLabel = (n) => LEVELS[Math.max(1, Math.min(5, n))];

function timeEstimate(style, core) {
  const knots = core.knots ?? 0;
  if (style === 'braid' || style === 'kumihimo') return Math.round(15 + (core.chart.repeats ?? 0) / 12);
  const perKnot = style === 'alpha' ? 0.075 : 0.06; // minutes
  return Math.max(20, Math.round(knots * perKnot + 15));
}

const pct = (x) => `${Math.round(x * 100)}%`;
