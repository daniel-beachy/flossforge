/**
 * sizing.js -- bracelet sizes and the floss arithmetic.
 *
 * Everything here is deliberately explicit: every number a user is told to cut
 * comes back with the steps that produced it, because "cut about a yard" is the
 * single most common reason a bracelet has to be started over.
 *
 * The model is per-knot rather than a flat multiplier. A knot is two half
 * hitches wrapped around a 6-ply core, and it eats a roughly constant length of
 * the *knotting* strand. So:
 *
 *     cut = band travel + (knots you tie) x (floss per knot) + setup + tails
 *
 * then a safety margin, then rounded up. The constants are calibrated against
 * the published rules of thumb (see README) and are shown to the user.
 */

/** Floss consumed by one double half-hitch, in inches, for 6-ply floss. */
export const INCHES_PER_KNOT = 0.38;

/**
 * Height of one knot row on the finished band, in inches.
 *
 * normal: about 10 full brickwork row-pairs per inch with 6-ply floss, so one
 *   grid row is half of that.
 * alpha: calibrated so an average adult band lands near the ~93 rows the craft
 *   literature quotes for an adult alpha bracelet.
 */
export const ROW_HEIGHT_IN = {
  normal: 0.05,
  alpha: 0.078,
  daisy: 0.5,
  braid: 0,
  spiral: 0.16,
  macrame: 0.2,
  kumihimo: 0,
};

/** Extra floss for the starting loop / knot, per strand. */
export const SETUP_ALLOWANCE_IN = 4;
/** Extra floss at each end for tying the bracelet on. */
export const TAIL_ALLOWANCE_IN = 5;
/** Fudge factor. Running out is much worse than having leftovers. */
export const SAFETY = 1.15;

/** One DMC six-strand skein: 8.7 yards. */
export const SKEIN_INCHES = 8.7 * 36;

export const SIZES = [
  { id: 'child-s', label: 'Child (2-5 yrs)', wrist: 4.5, group: 'Wrist' },
  { id: 'child-l', label: 'Child (6-10 yrs)', wrist: 5.25, group: 'Wrist' },
  { id: 'teen', label: 'Teen / small adult', wrist: 6.0, group: 'Wrist' },
  { id: 'adult', label: 'Adult (average)', wrist: 6.75, group: 'Wrist' },
  { id: 'adult-l', label: 'Adult large', wrist: 7.5, group: 'Wrist' },
  { id: 'adult-xl', label: 'Adult XL', wrist: 8.25, group: 'Wrist' },
  { id: 'anklet', label: 'Anklet', wrist: 9.5, group: 'Other' },
  { id: 'anklet-l', label: 'Anklet large', wrist: 10.5, group: 'Other' },
  { id: 'bookmark', label: 'Bookmark', wrist: 7.0, group: 'Other', noEase: true },
  { id: 'keychain', label: 'Keychain / zipper pull', wrist: 3.5, group: 'Other', noEase: true },
  { id: 'custom', label: 'Custom length', wrist: 7.0, group: 'Other' },
];

export const FITS = [
  { id: 'snug', label: 'Snug', ease: 0.25 },
  { id: 'standard', label: 'Standard', ease: 0.6 },
  { id: 'loose', label: 'Loose', ease: 1.1 },
];

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES.find((s) => s.id === 'adult');
}
export function fitById(id) {
  return FITS.find((f) => f.id === id) ?? FITS[1];
}

/**
 * Work out the finished length of the knotted band.
 * @param {{size?:string, fit?:string, customInches?:number}} opts
 */
export function bandLength(opts = {}) {
  const size = sizeById(opts.size ?? 'adult');
  const fit = fitById(opts.fit ?? 'standard');
  if (size.id === 'custom' && opts.customInches) {
    return { inches: round2(opts.customInches), size, fit, ease: 0, wrist: opts.customInches, custom: true };
  }
  const ease = size.noEase ? 0 : fit.ease;
  return { inches: round2(size.wrist + ease), size, fit, ease, wrist: size.wrist, custom: false };
}

export function inchesToCm(i) {
  return Math.round(i * 2.54 * 10) / 10;
}

export function formatLen(inches) {
  return `${round2(inches)} in (${inchesToCm(inches)} cm)`;
}

/** Pretty "3 ft 6 in" for long cuts. */
export function formatCut(inches) {
  const i = Math.ceil(inches);
  const ft = Math.floor(i / 12);
  const rem = i % 12;
  const imperial = ft ? (rem ? `${ft} ft ${rem} in` : `${ft} ft`) : `${i} in`;
  return `${i} in (${imperial}, ${Math.round(i * 2.54)} cm)`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * How many rows of knots are needed to fill the band.
 * @param {string} style
 * @param {number} bandInches
 */
export function rowsForBand(style, bandInches) {
  const h = ROW_HEIGHT_IN[style] ?? ROW_HEIGHT_IN.normal;
  if (!h) return 0;
  return Math.max(1, Math.round(bandInches / h));
}

/**
 * Turn a per-strand knot count into a cut length, keeping the arithmetic.
 *
 * @param {{knots:number, bandInches:number, extraTravel?:number, label?:string}} p
 * @returns {{inches:number, steps:string[]}}
 */
export function cutLength({ knots, bandInches, extraTravel = 0, tails = TAIL_ALLOWANCE_IN }) {
  const knotFloss = knots * INCHES_PER_KNOT;
  const travel = bandInches + extraTravel;
  const raw = travel + knotFloss + SETUP_ALLOWANCE_IN + 2 * tails;
  const withSafety = raw * SAFETY;
  const inches = Math.ceil(withSafety);
  const steps = [
    `${round2(travel)} in of band to cover`,
    `${knots} knot${knots === 1 ? '' : 's'} x ${INCHES_PER_KNOT} in per knot = ${round2(knotFloss)} in`,
    `+ ${SETUP_ALLOWANCE_IN} in to start`,
    `+ 2 x ${tails} in for the tie tails = ${2 * tails} in`,
    `subtotal ${round2(raw)} in, x ${SAFETY} safety margin = ${round2(withSafety)} in`,
    `round up to ${inches} in`,
  ];
  return { inches, steps, raw: round2(raw), knotFloss: round2(knotFloss) };
}

/** Skeins needed for a total length of one colour. */
export function skeinsFor(totalInches) {
  return Math.max(1, Math.ceil(totalInches / SKEIN_INCHES));
}
