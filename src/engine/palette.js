/**
 * palette.js -- a working palette of DMC six-strand embroidery floss.
 *
 * 54 shades chosen to cover the colour wheel evenly and to be the ones craft
 * shops actually stock, so a language model can always find something close to
 * what a person asked for.
 *
 * DMC does not publish official hex values. These are taken from the widely
 * used third-party conversion charts (floss.maxxmint.com, artpatt.com) which
 * cross-reference scanned DMC colour cards. They are screen approximations
 * only -- real floss shifts with dye lot and lighting.
 */

/** @typedef {{code:string,name:string,hex:string,family:string}} Floss */

/** @type {Floss[]} */
export const PALETTE = [
  // ---- neutrals ----
  { code: 'B5200', name: 'Snow White', hex: '#FAFAFF', family: 'neutral' },
  { code: 'BLANC', name: 'White', hex: '#FCFCFC', family: 'neutral' },
  { code: 'ECRU', name: 'Ecru', hex: '#F5F0E1', family: 'neutral' },
  { code: '415', name: 'Pearl Grey', hex: '#C8CACC', family: 'neutral' },
  { code: '318', name: 'Steel Grey Light', hex: '#ABADB0', family: 'neutral' },
  { code: '317', name: 'Pewter Grey', hex: '#888B8D', family: 'neutral' },
  { code: '3799', name: 'Pewter Grey Very Dark', hex: '#4E5355', family: 'neutral' },
  { code: '310', name: 'Black', hex: '#101010', family: 'neutral' },

  // ---- reds ----
  { code: '666', name: 'Bright Red', hex: '#E31D42', family: 'red' },
  { code: '321', name: 'Christmas Red', hex: '#C72B3B', family: 'red' },
  { code: '817', name: 'Coral Red Very Dark', hex: '#BB051F', family: 'red' },
  { code: '498', name: 'Red Dark', hex: '#A7132B', family: 'red' },

  // ---- corals & oranges ----
  { code: '353', name: 'Peach', hex: '#FDCFC4', family: 'orange' },
  { code: '351', name: 'Coral', hex: '#E8604C', family: 'orange' },
  { code: '350', name: 'Coral Medium', hex: '#DA4B35', family: 'orange' },
  { code: '349', name: 'Coral Dark', hex: '#C53B2C', family: 'orange' },
  { code: '608', name: 'Bright Orange', hex: '#F4572B', family: 'orange' },
  { code: '740', name: 'Tangerine', hex: '#FF8400', family: 'orange' },
  { code: '742', name: 'Tangerine Light', hex: '#FFBB32', family: 'orange' },

  // ---- yellows ----
  { code: '972', name: 'Canary Deep', hex: '#FFB515', family: 'yellow' },
  { code: '444', name: 'Lemon Dark', hex: '#FFD600', family: 'yellow' },
  { code: '307', name: 'Lemon', hex: '#FFF176', family: 'yellow' },
  { code: '445', name: 'Lemon Light', hex: '#FFF9A3', family: 'yellow' },

  // ---- greens ----
  { code: '3819', name: 'Moss Green Light', hex: '#BEE07E', family: 'green' },
  { code: '907', name: 'Parrot Green Light', hex: '#B6D91A', family: 'green' },
  { code: '906', name: 'Parrot Green Medium', hex: '#79C51A', family: 'green' },
  { code: '703', name: 'Chartreuse', hex: '#75BA45', family: 'green' },
  { code: '912', name: 'Emerald Green Light', hex: '#34A55E', family: 'green' },
  { code: '700', name: 'Green Bright', hex: '#008E43', family: 'green' },
  { code: '909', name: 'Emerald Green Very Dark', hex: '#1B7043', family: 'green' },
  { code: '890', name: 'Pistachio Ultra Dark', hex: '#173F27', family: 'green' },

  // ---- teals & turquoise ----
  { code: '993', name: 'Aquamarine Light', hex: '#8FD0C2', family: 'teal' },
  { code: '958', name: 'Sea Green Dark', hex: '#27A08A', family: 'teal' },
  { code: '3846', name: 'Bright Turquoise Light', hex: '#05C3DE', family: 'teal' },
  { code: '3845', name: 'Bright Turquoise Medium', hex: '#00AECB', family: 'teal' },
  { code: '995', name: 'Electric Blue Dark', hex: '#009AAD', family: 'teal' },

  // ---- blues ----
  { code: '996', name: 'Electric Blue Medium', hex: '#00B9D4', family: 'blue' },
  { code: '800', name: 'Delft Blue Pale', hex: '#C3D3E4', family: 'blue' },
  { code: '799', name: 'Delft Blue Medium', hex: '#8AA6D6', family: 'blue' },
  { code: '798', name: 'Delft Blue Dark', hex: '#3B68C2', family: 'blue' },
  { code: '796', name: 'Royal Blue Dark', hex: '#145AB8', family: 'blue' },
  { code: '820', name: 'Royal Blue Very Dark', hex: '#0B3D9E', family: 'blue' },
  { code: '939', name: 'Navy Blue Very Dark', hex: '#211B3D', family: 'blue' },

  // ---- purples ----
  { code: '340', name: 'Blue Violet Medium', hex: '#9387C2', family: 'purple' },
  { code: '333', name: 'Blue Violet Very Dark', hex: '#5C5478', family: 'purple' },
  { code: '210', name: 'Lavender Medium', hex: '#BE91CD', family: 'purple' },
  { code: '553', name: 'Violet', hex: '#8B5BAD', family: 'purple' },
  { code: '550', name: 'Violet Very Dark', hex: '#5C2F72', family: 'purple' },

  // ---- pinks ----
  { code: '818', name: 'Baby Pink', hex: '#FFDFD9', family: 'pink' },
  { code: '776', name: 'Pink Medium', hex: '#FFAAB5', family: 'pink' },
  { code: '603', name: 'Cranberry', hex: '#FFA4BE', family: 'pink' },
  { code: '893', name: 'Carnation Light', hex: '#F87898', family: 'pink' },
  { code: '601', name: 'Cranberry Dark', hex: '#D2136F', family: 'pink' },
  { code: '718', name: 'Plum', hex: '#9B1E76', family: 'pink' },

  // ---- browns & tans ----
  { code: '738', name: 'Tan Very Light', hex: '#EFC98E', family: 'brown' },
  { code: '437', name: 'Tan Light', hex: '#D4945F', family: 'brown' },
  { code: '436', name: 'Tan', hex: '#C07B3A', family: 'brown' },
  { code: '975', name: 'Golden Brown Dark', hex: '#A45A13', family: 'brown' },
  { code: '435', name: 'Brown Very Light', hex: '#A65C21', family: 'brown' },
  { code: '433', name: 'Brown Medium', hex: '#7A451F', family: 'brown' },
  { code: '938', name: 'Coffee Brown Ultra Dark', hex: '#3A2415', family: 'brown' },
];

export const PALETTE_BY_CODE = new Map(PALETTE.map((c) => [c.code.toUpperCase(), c]));

export const FAMILIES = [
  'neutral', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown',
];

export const FAMILY_LABEL = {
  neutral: 'Neutrals', red: 'Reds', orange: 'Oranges', yellow: 'Yellows', green: 'Greens',
  teal: 'Teals', blue: 'Blues', purple: 'Purples', pink: 'Pinks', brown: 'Browns',
};

export function floss(code) {
  if (code == null) return null;
  return PALETTE_BY_CODE.get(String(code).toUpperCase().trim()) ?? null;
}

export function hexOf(code) {
  return floss(code)?.hex ?? '#B9B9B9';
}

export function nameOf(code) {
  const f = floss(code);
  return f ? `DMC ${f.code} ${f.name}` : `DMC ${code}`;
}

export function shortName(code) {
  const f = floss(code);
  return f ? f.name : String(code);
}

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** CIE Lab, good enough for snapping an arbitrary colour to the palette. */
export function hexToLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const LAB_CACHE = new Map(PALETTE.map((c) => [c.code, hexToLab(c.hex)]));

/** Snap an unknown DMC code, colour name or hex to the closest colour we stock. */
export function nearestFloss(input) {
  if (input == null) return null;
  const direct = floss(input);
  if (direct) return direct;
  const s = String(input).trim();

  const byName = PALETTE.find((c) => c.name.toLowerCase() === s.toLowerCase());
  if (byName) return byName;

  // A bare number is deliberately NOT treated as hex here: "963" is a real DMC
  // code that also happens to parse as #996633, and silently turning a pink
  // into a brown is exactly the bug this guard exists to prevent.
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
  const hex = rgb
    ? `#${[rgb[1], rgb[2], rgb[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('')}`
    : /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s) ? s : CSS_COLORS[s.toLowerCase().replace(/[\s_-]/g, '')];
  if (!hex) return null;
  const target = hexToLab(hex);
  let best = PALETTE[0];
  let bestD = Infinity;
  for (const c of PALETTE) {
    const d = labDistance(target, LAB_CACHE.get(c.code));
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** Common colour words, so "sunset orange" style answers still resolve. */
export const CSS_COLORS = {
  red: '#FF0000', crimson: '#DC143C', maroon: '#800000', pink: '#FFC0CB', hotpink: '#FF69B4',
  magenta: '#FF00FF', fuchsia: '#FF00FF', purple: '#800080', violet: '#EE82EE', lavender: '#E6E6FA',
  indigo: '#4B0082', navy: '#000080', blue: '#0000FF', royalblue: '#4169E1', skyblue: '#87CEEB',
  cyan: '#00FFFF', aqua: '#00FFFF', turquoise: '#40E0D0', teal: '#008080', mint: '#98FF98',
  green: '#008000', lime: '#00FF00', olive: '#808000', forest: '#228B22', sage: '#9CAF88',
  yellow: '#FFFF00', gold: '#FFD700', mustard: '#FFDB58', orange: '#FFA500', coral: '#FF7F50',
  peach: '#FFDAB9', salmon: '#FA8072', rust: '#B7410E', brown: '#A52A2A', tan: '#D2B48C',
  beige: '#F5F5DC', cream: '#FFFDD0', ivory: '#FFFFF0', white: '#FFFFFF', grey: '#808080',
  gray: '#808080', silver: '#C0C0C0', charcoal: '#36454F', black: '#000000',
};

/** Perceived lightness 0..100, for choosing readable label text over a swatch. */
export function lightness(hex) {
  return hexToLab(hex)[0];
}

/** How different two floss colours look; used to warn about invisible designs. */
export function contrast(codeA, codeB) {
  const a = floss(codeA), b = floss(codeB);
  if (!a || !b) return 100;
  return labDistance(hexToLab(a.hex), hexToLab(b.hex));
}

export function textOn(hex) {
  return lightness(hex) > 62 ? '#22201E' : '#FFFFFF';
}
