/**
 * styles/simple.js -- the bracelet families that aren't knot grids.
 *
 * Braids, spirals, macrame sinnets, daisy chains and round braids are all built
 * from a short move repeated a known number of times, so instead of a knot grid
 * each one reports: how many strands, how much floss each of them eats, how many
 * repeats fill the band, and the move itself.
 *
 * Honesty note: the daisy chain is the one construction the craft literature
 * does not agree on. Sources describe the petals variously as knots, loops or
 * buttonhole stitches. The sequence here is the one that appears most often in
 * tutorials, written out unambiguously -- see README.
 */

const range = (n) => Array.from({ length: n }, (_, i) => i);

export const BRAID_KINDS = {
  'braid-3': {
    label: '3-strand braid',
    strands: 3,
    takeUp: 1.35,
    perInch: 6,
    blurb: 'The plait everyone already knows, in floss. Fast, flat and forgiving.',
    move: [
      'Bring the LEFT bundle over the middle bundle. It is now the middle.',
      'Bring the RIGHT bundle over the new middle bundle. It is now the middle.',
      'Keep alternating left-over-middle, right-over-middle, pulling snug each time.',
    ],
  },
  'braid-4-round': {
    label: '4-strand round braid',
    strands: 4,
    takeUp: 1.5,
    perInch: 7,
    blurb: 'Four strands worked into a square cord that rolls between your fingers.',
    move: [
      'Split into two pairs: strands 1-2 on the left, strands 3-4 on the right.',
      'Take the BACK-left strand, pass it over the front-left strand, under both right strands, then back over the back-right strand.',
      'Mirror the move from the right side.',
      'Repeat, keeping even tension so the cord stays square.',
    ],
  },
  'braid-5-flat': {
    label: '5-strand flat braid',
    strands: 5,
    takeUp: 1.45,
    perInch: 7,
    blurb: 'A wider flat braid with a herringbone surface.',
    move: [
      'Take the far LEFT strand. Pass it over the strand beside it, then under the next.',
      'Take the far RIGHT strand. Pass it over one, then under the next.',
      'Alternate sides, always over-then-under, and keep the strands spread flat.',
    ],
  },
  'braid-7-flat': {
    label: '7-strand flat braid',
    strands: 7,
    takeUp: 1.5,
    perInch: 8,
    blurb: 'Seven strands, over-under-over. Wide and ribbon-like.',
    move: [
      'Take the far LEFT strand and weave it over, under, over across three strands.',
      'Take the far RIGHT strand and weave it over, under, over the other way.',
      'Alternate sides. Keep the fan of strands flat on the table.',
    ],
  },
  fishtail: {
    label: 'Fishtail braid',
    strands: 4,
    takeUp: 1.4,
    perInch: 9,
    blurb: 'Two bundles trading their outer edges. Reads as a fine chevron.',
    move: [
      'Split into two equal bundles, left and right.',
      'Take a few threads from the OUTER edge of the left bundle and cross them over to join the right bundle.',
      'Take a few threads from the OUTER edge of the right bundle and cross them over to join the left.',
      'Repeat, pulling firmly after each crossing.',
    ],
  },
};

export const SPIRAL_KINDS = {
  'chinese-staircase': {
    label: 'Chinese staircase',
    blurb: 'One strand wrapping a bundle in single half hitches, all in the same direction, so it corkscrews.',
    hitchesPerTwist: 10,
    perInch: 26,
  },
  'half-knot-spiral': {
    label: 'Half-knot spiral (macrame)',
    blurb: 'Two working strands around a core, tying only the left half of a square knot over and over.',
    hitchesPerTwist: 4,
    perInch: 12,
  },
};

export const MACRAME_KINDS = {
  'square-knot': {
    label: 'Square knot sinnet',
    blurb: 'Alternating half knots, which cancel out into a flat, symmetrical chain.',
    perInch: 6,
  },
  'alternating-square': {
    label: 'Alternating square knot net',
    blurb: 'Rows of square knots offset from each other, opening into a lattice.',
    perInch: 5,
  },
};

/** @param {{kind:string, colors:string[], bandInches:number, plies?:number}} p */
export function compileBraid({ kind, colors, bandInches, plies = 6 }) {
  const def = BRAID_KINDS[kind] ?? BRAID_KINDS['braid-3'];
  const bundles = range(def.strands).map((i) => ({
    role: `Bundle ${i + 1}`,
    color: colors[i % colors.length],
    plies,
    travel: bandInches * def.takeUp,
    knots: 0,
  }));
  const crossings = Math.round(bandInches * def.perInch);
  return {
    family: 'braid',
    kind,
    label: def.label,
    blurb: def.blurb,
    strandPlan: bundles,
    repeats: crossings,
    unitLabel: 'crossing',
    move: def.move,
    preview: { kind: 'braid', strands: def.strands, colors: bundles.map((b) => b.color) },
  };
}

/**
 * @param {{kind:string, core:string[], sequence:Array<{color:string,hitches:number}>,
 *          bandInches:number}} p
 */
export function compileSpiral({ kind, core, sequence, bandInches }) {
  const def = SPIRAL_KINDS[kind] ?? SPIRAL_KINDS['chinese-staircase'];
  const totalHitches = Math.round(bandInches * def.perInch);

  // stretch or trim the requested colour blocks to exactly fill the band
  const asked = sequence.reduce((a, s) => a + Math.max(1, s.hitches), 0) || 1;
  const scale = totalHitches / asked;
  const blocks = [];
  let placed = 0;
  sequence.forEach((s, i) => {
    const n = i === sequence.length - 1
      ? totalHitches - placed
      : Math.max(1, Math.round(Math.max(1, s.hitches) * scale));
    if (n > 0) blocks.push({ color: s.color, hitches: n, from: placed });
    placed += n;
  });

  const perColor = new Map();
  for (const b of blocks) perColor.set(b.color, (perColor.get(b.color) ?? 0) + b.hitches);

  const workers = [...perColor.entries()].map(([color, hitches]) => ({
    role: 'Wrapping strand',
    color,
    plies: 6,
    knots: hitches,
    travel: bandInches,
  }));
  const cores = core.map((color) => ({
    role: 'Core strand',
    color,
    plies: 6,
    knots: 0,
    travel: bandInches * 1.05,
  }));

  return {
    family: 'spiral',
    kind,
    label: def.label,
    blurb: def.blurb,
    strandPlan: [...workers, ...cores],
    blocks,
    totalHitches,
    hitchesPerTwist: def.hitchesPerTwist,
    twists: Math.round(totalHitches / def.hitchesPerTwist),
    unitLabel: kind === 'chinese-staircase' ? 'half hitch' : 'half knot',
    preview: { kind: 'spiral', blocks, coreColors: core, hitchesPerTwist: def.hitchesPerTwist },
  };
}

/** @param {{kind:string, working:string[], core:string[], bandInches:number}} p */
export function compileMacrame({ kind, working, core, bandInches }) {
  const def = MACRAME_KINDS[kind] ?? MACRAME_KINDS['square-knot'];
  const knots = Math.round(bandInches * def.perInch);
  return {
    family: 'macrame',
    kind,
    label: def.label,
    blurb: def.blurb,
    strandPlan: [
      ...working.map((color) => ({ role: 'Working strand', color, plies: 6, knots, travel: bandInches })),
      ...core.map((color) => ({ role: 'Core strand', color, plies: 6, knots: 0, travel: bandInches * 1.05 })),
    ],
    knots,
    unitLabel: 'square knot',
    preview: { kind: 'macrame', working, core, knots, alternating: kind === 'alternating-square' },
  };
}

export const DAISY_DEFAULTS = { petalsPerSide: 3, stemHitches: 12 };

/**
 * @param {{petal:string, centre:string, stem:string, spacing?:number,
 *          petalsPerSide?:number, bandInches:number}} p
 */
export function compileDaisy({ petal, centre, stem, spacing, petalsPerSide, bandInches }) {
  const perSide = clamp(petalsPerSide ?? DAISY_DEFAULTS.petalsPerSide, 2, 4);
  const stemHitches = clamp(spacing ?? DAISY_DEFAULTS.stemHitches, 4, 30);
  // one daisy plus its stem takes roughly this much band
  const stemInches = stemHitches * 0.038;
  const flowerInches = 0.34;
  const unit = stemInches + flowerInches;
  const daisies = Math.max(1, Math.round(bandInches / unit));

  const stemKnots = daisies * stemHitches + daisies; // hitches plus one locking knot each
  const petalKnots = daisies * perSide;

  return {
    family: 'daisy',
    label: 'Daisy chain',
    blurb: `${daisies} daisies with a ${stemHitches}-hitch stem between each.`,
    daisies,
    perSide,
    stemHitches,
    strandPlan: [
      { role: 'Stem strand', color: stem, plies: 6, knots: stemKnots, travel: bandInches },
      { role: 'Left petal strand', color: petal, plies: 6, knots: petalKnots, travel: bandInches * 1.1 },
      { role: 'Right petal strand', color: petal, plies: 6, knots: petalKnots, travel: bandInches * 1.1 },
      { role: 'Flower centre', color: centre, plies: 6, knots: daisies, travel: bandInches * 1.05 },
      { role: 'Core strand', color: stem, plies: 6, knots: 0, travel: bandInches * 1.05 },
    ],
    unitLabel: 'daisy',
    preview: { kind: 'daisy', petal, centre, stem, daisies, perSide, stemHitches },
  };
}

export const KUMIHIMO_KINDS = {
  'kumihimo-8': {
    label: 'Kumihimo round braid (8 strand)',
    strands: 8,
    takeUp: 1.6,
    perInch: 16,
    blurb: 'A dense round cord braided on a foam disk. Needs the disk; the payoff is a perfectly round rope.',
  },
};

/** @param {{colors:string[], bandInches:number}} p */
export function compileKumihimo({ colors, bandInches }) {
  const def = KUMIHIMO_KINDS['kumihimo-8'];
  return {
    family: 'kumihimo',
    kind: 'kumihimo-8',
    label: def.label,
    blurb: def.blurb,
    strandPlan: range(def.strands).map((i) => ({
      role: `Slot ${['N', 'N', 'E', 'E', 'S', 'S', 'W', 'W'][i]}${(i % 2) + 1}`,
      color: colors[i % colors.length],
      plies: 6,
      knots: 0,
      travel: bandInches * def.takeUp,
    })),
    repeats: Math.round(bandInches * def.perInch),
    unitLabel: 'half turn',
    preview: { kind: 'kumihimo', colors: range(def.strands).map((i) => colors[i % colors.length]) },
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
