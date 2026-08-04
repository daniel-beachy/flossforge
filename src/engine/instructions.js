/**
 * instructions.js -- the words a person reads while their hands are busy.
 *
 * Everything here is derived from the simulation, never from the design. If
 * the engine had to repair something, the instructions describe the repaired
 * pattern, because that is the one that can be tied.
 *
 * Two things come out: `steps`, the prose walkthrough, and `rowGuide`, the
 * row-by-row list the phone view steps through one row at a time.
 */

import { KNOT_SYMBOL, KNOT_NAME, KNOT_TIE_TEXT, KNOT_SHORT } from './knots.js';
import { nameOf, shortName } from './palette.js';
import { formatCut } from './sizing.js';

export function buildSteps(pattern) {
  const steps = [];
  let n = 0;
  const add = (title, body, extra = {}) => { steps.push({ n: ++n, title, body, ...extra }); return steps[steps.length - 1]; };

  add(
    'Cut your floss',
    pattern.materials
      .map((m) => `${m.count} x ${m.cutText} of ${m.name}`)
      .join('\n'),
    { kind: 'materials' },
  );

  switch (pattern.style) {
    case 'normal': normalSteps(pattern, add); break;
    case 'alpha': alphaSteps(pattern, add); break;
    case 'daisy': daisySteps(pattern, add); break;
    case 'braid': braidSteps(pattern, add); break;
    case 'spiral': spiralSteps(pattern, add); break;
    case 'macrame': macrameSteps(pattern, add); break;
    case 'kumihimo': kumihimoSteps(pattern, add); break;
  }

  add(
    'Finish it',
    `Knot the loose ends together right up against the last row so nothing works loose, then either plait the tails into two ties, or make a loop at one end and a knot at the other. ` +
    `Trim to about 4 in of tail each side. The band itself should measure about ${pattern.band.text}.`,
    { kind: 'finish' },
  );

  return steps;
}

/* ------------------------------------------------------------------- normal */

function normalSteps(pattern, add) {
  const { setup, rows, repeat, template } = pattern.chart;
  const order = setup.map((c, i) => `${i + 1}. ${nameOf(c)}`).join('\n');

  add(
    'Lay the strands out in this order',
    `Left to right:\n${order}\n\nHold them together, tie one overhand knot about 3 in from the top, and tape that knot down or clip it to a clipboard. ` +
    `Keep the strands flat and in order -- the whole pattern depends on it.`,
    { kind: 'setup', setup: setup.slice() },
  );

  if (setupIsSurprising(setup)) {
    add(
      'Yes, that order looks wrong -- it is right',
      `A printed pattern shows one tile out of the middle of a repeat, so the very first row already contains knots belonging to stripes that began above it. ` +
      `Laying the colours out in plain left-to-right order gives a few rows of mush before it settles. This order starts you already in the rhythm.`,
      { kind: 'aside' },
    );
  }

  const knotSet = [...new Set(rows.flat().map((k) => k.knot))];
  add(
    'The knots you will use',
    knotSet.map((k) => `${KNOT_SYMBOL[k]}  ${KNOT_NAME[k]} (${KNOT_SHORT[k]})\n${KNOT_TIE_TEXT[k]}`).join('\n\n'),
    { kind: 'knots', knots: knotSet },
  );

  const rowGuide = normalRowGuide(pattern);
  const cycle = repeat ?? rows.length;
  const times = Math.max(1, Math.round(rows.length / cycle));

  add(
    'Tie the pattern',
    template
      ? `Every row is the same move, so you only have to learn it once. Work left to right, one row at a time, then start the next row back at the left.\n\n` +
        `The band needs about ${rows.length} rows for ${pattern.band.text}.`
      : `Work one row at a time, always left to right, then start the next row back at the left. ` +
        `Rows 1-${cycle} are the whole pattern; repeat them ${times} time${times === 1 ? '' : 's'} to reach ${pattern.band.text}.`,
    { kind: 'rows', rowGuide, repeat: cycle, totalRows: rows.length },
  );

  if (repeat) {
    add(
      'Check yourself',
      `After row ${repeat} the strands should be back in the same order you laid them out in. If they are, every repeat after this one will come out right.`,
      { kind: 'check' },
    );
  }
}

/** Is the solved setup order different from plain left-to-right colour order? */
function setupIsSurprising(setup) {
  const seen = [];
  for (const c of setup) if (!seen.includes(c)) seen.push(c);
  const plain = [];
  for (let i = 0; i < setup.length; i++) plain.push(seen[i % seen.length]);
  return plain.join('|') !== setup.join('|');
}

/** One line per row: "Row 3 (4 knots): / / / /" plus the colour of each knot. */
export function normalRowGuide(pattern) {
  const { knots } = pattern.chart;
  return knots.map((row, i) => ({
    index: i,
    number: i + 1,
    count: row.length,
    knots: row.map((k) => ({ pos: k.pos, knot: k.knot, symbol: KNOT_SYMBOL[k.knot], color: k.shown })),
    text: row.length
      ? row.map((k) => `${KNOT_SYMBOL[k.knot]}${shortName(k.shown)}`).join('  ')
      : 'no knots in this row',
    hint: row.length && row[0].pos === 1 ? 'the outside strand on each side sits this row out' : '',
  }));
}

/* -------------------------------------------------------------------- alpha */

function alphaSteps(pattern, add) {
  const { base, wefts, width, rows, stringCount } = pattern.chart;
  const baseOrder = base.map((c, i) => `${i + 1}. ${nameOf(c)}`).join('\n');

  add(
    'Set up the base strands',
    `You need ${stringCount} strings in all: ${width} upright base strings, one per column, plus ${wefts.length} knotting string${wefts.length === 1 ? '' : 's'}.\n\n` +
    `Lay the base strings out left to right:\n${baseOrder}\n\n` +
    `Tie them all together at the top and tape or clip that knot down. Add the knotting string${wefts.length === 1 ? '' : 's'} (${wefts.map(nameOf).join(', ')}) at the far LEFT, outside all the base strings.`,
    { kind: 'setup', setup: base.slice() },
  );

  add(
    'How an alpha knot works',
    `Every square of the chart is one knot, and there are only two of them.\n\n` +
    `BACKGROUND SQUARE -- knot with the knotting string, over the base string. The knotting string's colour shows and it moves along one column.\n` +
    `${KNOT_TIE_TEXT.F}\n\n` +
    `DESIGN SQUARE -- swap roles: knot with the BASE string over the knotting string ("a downward knot"). The base string's colour shows, and the knotting string still ends up one column along.\n` +
    `${KNOT_TIE_TEXT.B}\n\n` +
    `Odd rows run left to right; even rows run right to left, and the two knots trade places (going left, a background square is a backward knot).`,
    { kind: 'knots', knots: ['F', 'B'] },
  );

  if (wefts.length > 1) {
    add(
      'Carrying the extra colour',
      `When the chart wants ${nameOf(wefts[1])} where the base string underneath is a different colour, put the ${nameOf(wefts[0])} string down BEHIND the work, pick up ${nameOf(wefts[1])} and keep knotting with it. ` +
      `Swap back the same way. Always drop the resting string behind the bracelet, never in front, or you will see it on the good side. ` +
      `The one that is resting simply floats across the back until it is needed again.`,
      { kind: 'aside' },
    );
  }

  add(
    'Clean edges',
    `At the end of every row, knot the last base string TWICE with the knotting string -- once to finish the row and once to start the next -- using a knot that does not swap the strings ` +
    `(${KNOT_NAME.FB} at the right edge, ${KNOT_NAME.BF} at the left). That locks the turn and stops the sides going wavy.`,
    { kind: 'aside' },
  );

  const rowGuide = alphaRowGuide(pattern);
  add(
    'Work the chart',
    `${rows.length} rows, ${width} knots each, ${pattern.knots} knots in total. Read one row at a time and tick it off -- it is very easy to lose your place. ` +
    `Row 1 goes left to right.`,
    { kind: 'rows', rowGuide, totalRows: rows.length, repeat: pattern.chart.repeat },
  );
}

/** "Row 4 <- : 5 black, 2 white, 5 black" */
export function alphaRowGuide(pattern) {
  const { rows } = pattern.chart;
  return rows.map((row) => ({
    index: row.index,
    number: row.index + 1,
    direction: row.goingRight ? 'right' : 'left',
    arrow: row.goingRight ? '\u2192' : '\u2190',
    count: row.knots.length,
    runs: row.runs.map((r) => ({ count: r.count, color: r.shown, knot: r.knot, symbol: KNOT_SYMBOL[r.knot] })),
    text: row.runs.map((r) => `${r.count} ${shortName(r.shown)}`).join(', '),
    knots: row.knots.map((k) => ({ pos: k.col, knot: k.knot, symbol: KNOT_SYMBOL[k.knot], color: k.shown })),
  }));
}

/* -------------------------------------------------------------------- daisy */

function daisySteps(pattern, add) {
  const c = pattern.chart;
  add(
    'Set up',
    `Four strands: ${nameOf(c.strandPlan[0].color)} for the stem, two of ${nameOf(c.strandPlan[1].color)} for the petals, and ${nameOf(c.strandPlan[3].color)} for the flower centres. ` +
    `Tie them together at the top with the two petal strands on the OUTSIDE and the stem and centre strands in the middle. Tape it down.`,
    { kind: 'setup' },
  );
  add(
    'Tie the stem',
    `Using the left petal strand as the holder, make ${c.stemHitches} forward knots with the stem strand down the left side, then ${c.stemHitches} backward knots down the right. ` +
    `That twists into a neat little cord about ${(c.stemHitches * 0.038).toFixed(2)} in long. (Any spiral you like works here -- this is the version that keeps the petal strands where you need them.)`,
    { kind: 'unit' },
  );
  add(
    'Make one daisy',
    `Bring the two petal strands to the middle. With the LEFT petal strand, make ${c.perSide} forward knots on the right petal strand; with the RIGHT petal strand, make ${c.perSide} backward knots on the left. ` +
    `Pull them up snug and they curl into a ring of petals.\n\n` +
    `Now bring the centre strand up through the middle of that ring and tie one knot on each petal strand to lock the flower and hold the centre in place.`,
    { kind: 'unit' },
  );
  add(
    'Repeat',
    `Stem, flower, stem, flower. You need about ${c.daisies} daisies to fill ${pattern.band.text}.`,
    { kind: 'repeat', repeats: c.daisies },
  );
}

/* -------------------------------------------------------------------- braid */

function braidSteps(pattern, add) {
  const c = pattern.chart;
  add(
    'Set up',
    `${c.strandPlan.length} bundles: ${c.strandPlan.map((s) => nameOf(s.color)).join(', ')}. ` +
    `Keep each colour as its own bundle of 6 plies -- that is what makes the stripes read clearly. Knot the top and tape it down.`,
    { kind: 'setup' },
  );
  add('The move', c.move, { kind: 'unit' });
  add(
    'Keep going',
    `Repeat until the braid measures ${pattern.band.text}, about ${c.repeats} crossings. Keep the tension even and stop every inch to smooth it straight.`,
    { kind: 'repeat', repeats: c.repeats },
  );
}

/* ------------------------------------------------------------------- spiral */

function spiralSteps(pattern, add) {
  const c = pattern.chart;
  add(
    'Set up',
    `Hold ${c.strandPlan.filter((s) => s.role.includes('Core')).length} core strand(s) together -- they stay still and never knot. ` +
    `The wrapping strands do all the work. Knot everything together at the top and tape it down.`,
    { kind: 'setup' },
  );
  add(
    'The move',
    `${KNOT_TIE_TEXT.F}\n\nMake that same knot over and over with the wrapping strand around the core, always in the same direction. After about eight of them the band starts to corkscrew on its own -- that is the whole trick. Let it twist.`,
    { kind: 'unit' },
  );
  add(
    'Colour blocks',
    c.blocks.map((b, i) => `${i + 1}. ${b.hitches} knots in ${nameOf(b.color)}`).join('\n') +
    `\n\nTo change colour, drop the strand you were using down into the core and pick up the next one. Nothing gets cut.`,
    { kind: 'repeat', repeats: c.blocks.length },
  );
}

/* ------------------------------------------------------------------ macrame */

function macrameSteps(pattern, add) {
  const c = pattern.chart;
  add(
    'Set up',
    `Core strands (${c.strandPlan.filter((s) => s.role.includes('Core')).map((s) => nameOf(s.color)).join(', ')}) run down the middle and never knot. ` +
    `The working strands (${c.strandPlan.filter((s) => s.role.includes('Working')).map((s) => nameOf(s.color)).join(', ')}) sit either side and do everything.`,
    { kind: 'setup' },
  );
  add(
    'The square knot',
    `Take the LEFT working strand across the front of the core to the right, over the right working strand. Bring the RIGHT working strand behind the core and up through the loop on the left. Pull both snug -- that is half a square knot.\n\n` +
    `Now do the mirror image: RIGHT strand across the front to the left, LEFT strand behind and up through the loop on the right. Pull snug. That is one full square knot, and it lies flat.\n\n` +
    `If you only ever do the first half, the band spirals instead -- which is the half-knot spiral, and also lovely.`,
    { kind: 'unit' },
  );
  add(
    'Keep going',
    `About ${c.knots} square knots fills ${pattern.band.text}.` +
    (c.preview.alternating ? ` For the lattice, work four knots, split the strands into new groups by shifting two across, and carry on -- that is what opens up the diamonds.` : ''),
    { kind: 'repeat', repeats: c.knots },
  );
}

/* ----------------------------------------------------------------- kumihimo */

function kumihimoSteps(pattern, add) {
  const c = pattern.chart;
  add(
    'Set up the disk',
    `You need a kumihimo foam disk. Knot all 8 strands together, drop the knot through the middle hole, and hang a small weight on it. ` +
    `Put the strands in these slots:\n` +
    c.strandPlan.map((s) => `${s.role}: ${nameOf(s.color)}`).join('\n'),
    { kind: 'setup' },
  );
  add(
    'The move',
    `Turn the disk so the two "north" strands are at the top.\n1. Bring the RIGHT north strand down to sit right of the south pair.\n2. Bring the LEFT south strand up to sit left of the north pair.\n3. Turn the disk a quarter turn anticlockwise.\n\nThat is it. Those three moves, forever.`,
    { kind: 'unit' },
  );
  add(
    'Keep going',
    `About ${c.repeats} moves gives ${pattern.band.text}. The braid grows down through the hole -- check the length by pulling it gently, not by measuring the strands.`,
    { kind: 'repeat', repeats: c.repeats },
  );
}
