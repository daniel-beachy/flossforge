/**
 * llm/prompt.js -- what we tell the model, built from the engine's own data so
 * the two can never drift apart.
 *
 * The division of labour is the whole design of this app. The model is asked
 * to do the one thing it is genuinely better at than any algorithm I could
 * write: reading "daisy chain with little watermelons between them" and
 * deciding that means a white-and-yellow daisy chain in DMC B5200 and 444 with
 * a watermelon motif at 2-flower intervals. It is asked to do none of the
 * things it is bad at. It never emits knots, never emits lengths, never emits
 * a strand order -- the engine works all of that out and will happily overrule
 * anything the model says that cannot be tied.
 *
 * So the prompt spends most of its words on constraints, because a design that
 * respects the physics needs less repair, and less repair means the result
 * looks more like what the person asked for.
 */

import { PALETTE, FAMILY_LABEL } from '../engine/palette.js';
import { MOTIFS } from '../engine/data/motifs.js';
import { GEOMETRIES } from '../engine/imagegen.js';
import { NORMAL_TEMPLATES } from '../engine/styles/normal.js';
import { STYLES } from '../engine/design.js';
import { BRAID_KINDS, SPIRAL_KINDS, MACRAME_KINDS } from '../engine/styles/simple.js';
import { SUPPORTED_CHARS } from '../engine/data/alphabet.js';

export function systemPrompt({ allowedStyles = STYLES.map((s) => s.id), count = 5 } = {}) {
  const styles = STYLES.filter((s) => allowedStyles.includes(s.id));
  return `You design friendship bracelets. Someone describes a bracelet in plain English and you return ${count} different designs as JSON.

A separate engine turns your designs into real knots. It will simulate every knot, check the design is physically tie-able, repair it if it is not, and work out the floss lengths. So you do not decide any knots, lengths, strand orders or row counts. You decide the IDEA: which construction suits the request, which colours, which shapes or pictures, how they are laid out and repeated.

Your designs are only as good as their fit to the physics below. Read it.

=== THE STYLES YOU CAN CHOOSE ===
${styles.map(styleBlock).join('\n\n')}

=== COLOURS ===
Use only these DMC codes. Give the code exactly as written.
${paletteBlock()}

=== OUTPUT FORMAT ===
Return ONLY a JSON object, no prose, no markdown fence:

{"designs":[ <design>, <design>, ... ]}

Every design:
{
  "title": "short evocative name, max 6 words",
  "blurb": "one sentence on what it looks like and why it suits the request",
  "style": one of ${styles.map((s) => `"${s.id}"`).join(' | ')},
  "spec": { ...depends on style, see above... }
}

=== HOW TO ANSWER WELL ===
- Give ${count} genuinely DIFFERENT designs, not one design in ${count} colourways. Vary the style, the layout and the mood. If the request suits several styles, use several styles.
- Put the most obvious, most likely-to-please interpretation FIRST. Get more adventurous further down the list.
- Honour every explicit instruction: named colours, named words, named objects, "no pink", "for a boy", "simple", "hard". If they name a word to write, it must appear exactly.
- Pick colours that actually go together. Real floss, not screen colours: check the contrast between a motif and its background or the picture will vanish.
- Names, letters and pictures need "alpha". Diagonal stripes, chevrons, diamonds and zigzags want "normal". Do not try to write a word in a normal pattern; it will not work and the engine will have to butcher it.
- Keep it in proportion: an alpha bracelet 12-18 knots wide, a normal one 8-16 strands. Wider is not better, it is just slower.
- If you draw your own pixels, draw them small and blocky. A recognisable shape at this size is 7-13 wide. Fine detail disappears into the knots.
- Use the plainest style that gets the idea across. A daisy chain really made of daisies beats a pixel picture of a daisy.`;
}

function styleBlock(s) {
  switch (s.id) {
    case 'normal':
      return `"normal" -- ${s.blurb}
  HOW IT WORKS: strands hang side by side and each knot is made by two neighbours. The colour of a knot MUST be one of the two strands that happen to be there, so colour travels along diagonals. This is why it draws stripes, chevrons, diamonds and zigzags beautifully and cannot draw a letter or a face.
  spec: {
    "strands": even number 8-20,
    "colors": ["code", ...] in the order the stripes should read,
    then EITHER "template": one of ${Object.keys(NORMAL_TEMPLATES).map(q).join(' | ')}
    OR "design": {"kind":"geometry","geometry": one of ${GEOMETRIES.map((g) => q(g.id)).join(' | ')}}
    OR "design": {"kind":"pixels","pixels":["..aa..", ...],"legend":{"a":"code","." : "code"}}   (pixel rows are strands/2 wide)
  }
  Prefer "template" when the request is a plain candy stripe or chevron -- it is exact.`;

    case 'alpha':
      return `"alpha" -- ${s.blurb}
  HOW IT WORKS: upright base strands, one per column, and a knotting strand that crosses back and forth tying one knot per column. One knot is one pixel. A column can show its own strand's colour or a colour the knotting strand is carrying, so pictures work, but a column that has to change colour many times down the bracelet does not.
  Letters and pictures run ALONG the bracelet, stacked one above the next; you read them by turning the band.
  spec: {
    "width": knots across, 10-20,
    "background": "code",
    "design": one of
      {"kind":"text","text":"LOVE","color":"code"}                     letters: ${SUPPORTED_CHARS.trim().slice(0, 44)}...
      {"kind":"motif","motif":"id","colors":["code",...],"gapY":2,"columns":1}
      {"kind":"motifs","items":[{"motif":"id","colors":["code"]},...],"gapY":2}   alternates them down the band
      {"kind":"pixels","pixels":["...##...", ...],"legend":{"#":"code",".":"code"}}
      {"kind":"geometry","geometry":"id","colors":["code",...]}
  }
  MOTIF IDS: ${MOTIFS.map((m) => m.id).join(', ')}
  Use "pixels" to draw something that is not in that list. Rows must all be the same length and no wider than "width".`;

    case 'daisy':
      return `"daisy" -- ${s.blurb}
  spec: {"petal":"code","centre":"code","stem":"code","spacing":4-30 knots of stem between flowers,"petalsPerSide":2-4}
  The flowers are real knotted flowers, not a picture of flowers. Choose a petal colour that stands out from the stem.`;

    case 'braid':
      return `"braid" -- ${s.blurb}
  spec: {"kind": one of ${Object.keys(BRAID_KINDS).map(q).join(' | ')}, "colors":["code",...]}
  Good when someone wants something quick, or a gift they can make in an evening.`;

    case 'spiral':
      return `"spiral" -- ${s.blurb}
  spec: {"kind": one of ${Object.keys(SPIRAL_KINDS).map(q).join(' | ')}, "core":["code"], "sequence":[{"color":"code","hitches":12}, ...]}
  Each entry in "sequence" is a block of that colour; the engine stretches them to fill the band. Great for gradients and rainbows.`;

    case 'macrame':
      return `"macrame" -- ${s.blurb}
  spec: {"kind": one of ${Object.keys(MACRAME_KINDS).map(q).join(' | ')}, "working":["code","code"], "core":["code"]}`;

    case 'kumihimo':
      return `"kumihimo" -- ${s.blurb}
  spec: {"colors":["code",...]}  8 slots, filled by repeating your list. Needs a foam disk, so only suggest it if the request sounds like someone who would enjoy that.`;

    default:
      return `"${s.id}" -- ${s.blurb}`;
  }
}

function paletteBlock() {
  const groups = new Map();
  for (const c of PALETTE) {
    if (!groups.has(c.family)) groups.set(c.family, []);
    groups.get(c.family).push(`${c.code} ${c.name}`);
  }
  return [...groups.entries()].map(([f, list]) => `${FAMILY_LABEL[f] ?? f}: ${list.join('; ')}`).join('\n');
}

const q = (s) => `"${s}"`;

/** The turn-by-turn message. */
export function userPrompt({ prompt, count = 5, allowedStyles, size, seed, avoid = [], hasImage = false }) {
  const lines = [];
  lines.push(`Bracelet wanted: ${prompt || 'surprise me with something lovely'}`);
  if (hasImage) lines.push('An image is attached. Read the colours, shapes and mood from it and build the designs around what you see. If it contains a clear simple motif, reproduce that motif.');
  if (size) lines.push(`It is being made as: ${size}.`);
  if (allowedStyles?.length) lines.push(`Only use these styles: ${allowedStyles.join(', ')}.`);
  if (avoid.length) lines.push(`Already suggested, so do something different: ${avoid.slice(0, 10).join('; ')}.`);
  lines.push(`Variation token ${seed} -- use it to pick a different angle than you otherwise would, but never at the cost of what was actually asked for.`);
  lines.push(`Return exactly ${count} designs as {"designs":[...]}.`);
  return lines.join('\n');
}

/** A couple of worked examples, to pin down resolution and tone. */
export const EXAMPLES = `Worked examples of the level of detail expected.

Request: "blue bracelet with the word LOVE written across"
{"title":"Love Letter","blurb":"White letters stacked down a deep navy band, one word per repeat.","style":"alpha","spec":{"width":13,"background":"820","design":{"kind":"text","text":"LOVE","color":"B5200"}}}

Request: "sunset chevron in warm oranges"
{"title":"Long Evening","blurb":"Four warm oranges stepping from gold to burnt red in a classic V.","style":"normal","spec":{"strands":12,"colors":["444","742","740","349"],"template":"chevron"}}

Request: "daisy chain with little watermelons between them"
{"title":"Picnic Chain","blurb":"White daisies on a grass-green stem with a watermelon slice between each pair.","style":"alpha","spec":{"width":15,"background":"700","design":{"kind":"motifs","items":[{"motif":"daisy-small","colors":["B5200","444"]},{"motif":"watermelon","colors":["666","700","310"]}],"gapY":2}}}

Request: "repeating cactus symbols"
{"title":"Little Desert","blurb":"A row of round-armed cacti in two greens on warm sand.","style":"alpha","spec":{"width":13,"background":"738","design":{"kind":"motif","motif":"cactus","colors":["700","906"],"gapY":3}}}

Request: "something for my dad, simple, dark colours"
{"title":"Quiet Rope","blurb":"A four-strand round braid in charcoal, slate and deep green -- an hour's work, no chart to follow.","style":"braid","spec":{"kind":"braid-4-round","colors":["310","3799","890","317"]}}`;
