/**
 * motifs.js -- a library of low-resolution pixel sprites.
 *
 * Every one of these is drawn on the same grid an alpha bracelet is knotted on,
 * one character per knot, so what you see here is exactly what gets tied. Colour
 * slots are 'a'..'d'; '.' means "leave the background colour showing".
 *
 * The library does two jobs: it gives the offline generator real subject matter,
 * and it is shown to the language model as worked examples so its own sprites
 * come back at a sensible resolution instead of 64x64 mush.
 */

/** @typedef {{id:string,label:string,tags:string[],grid:string[],slots:string[],suggest?:string[][]}} Motif */

/** @type {Motif[]} */
export const MOTIFS = [
  {
    id: 'heart',
    label: 'Heart',
    tags: ['love', 'valentine', 'cute', 'romance'],
    slots: ['heart'],
    suggest: [['666'], ['603'], ['310']],
    grid: ['.aa.aa.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  },
  {
    id: 'star',
    label: 'Star',
    tags: ['night', 'sky', 'sparkle', 'space'],
    slots: ['star'],
    suggest: [['444'], ['B5200'], ['972']],
    grid: ['...a...', '..aaa..', 'aaaaaaa', '.aaaaa.', '..aaa..', '.a...a.'],
  },
  {
    id: 'flower',
    label: 'Flower',
    tags: ['daisy', 'garden', 'spring', 'bloom', 'floral'],
    slots: ['petals', 'centre'],
    suggest: [['B5200', '444'], ['603', '742'], ['553', '307']],
    grid: ['.aa.aa.', 'aaaaaaa', 'aabbbaa', '.abbba.', 'aabbbaa', 'aaaaaaa', '.aa.aa.'],
  },
  {
    id: 'daisy-small',
    label: 'Small daisy',
    tags: ['daisy', 'flower', 'tiny', 'spacer'],
    slots: ['petals', 'centre'],
    suggest: [['B5200', '444']],
    grid: ['.aaa.', 'aabaa', 'abbba', 'aabaa', '.aaa.'],
  },
  {
    id: 'watermelon',
    label: 'Watermelon slice',
    tags: ['fruit', 'summer', 'food', 'picnic'],
    slots: ['rind', 'flesh', 'seeds'],
    suggest: [['700', '603', '310'], ['906', '666', '310']],
    grid: ['aaaaaaaaa', 'abbbbbbba', '.bbcbcbb.', '.bbbbbbb.', '..bcbcb..', '...bbb...', '....b....'],
  },
  {
    id: 'cactus',
    label: 'Cactus',
    tags: ['desert', 'plant', 'southwest', 'succulent'],
    slots: ['cactus', 'pot'],
    suggest: [['909', '608'], ['906', '433']],
    grid: ['...a...', '.a.a...', '.a.a.a.', '.aaaaa.', '...a...', '...a...', '...a...', '..bbb..', '.bbbbb.'],
  },
  {
    id: 'cherry',
    label: 'Cherries',
    tags: ['fruit', 'food', 'summer', 'sweet'],
    slots: ['fruit', 'stem'],
    suggest: [['666', '700']],
    grid: ['...b...', '..b.b..', '.b...b.', 'aa...aa', 'aaa.aaa', 'aaa.aaa', '.a...a.'],
  },
  {
    id: 'strawberry',
    label: 'Strawberry',
    tags: ['fruit', 'food', 'summer', 'sweet', 'berry'],
    slots: ['berry', 'leaves', 'seeds'],
    suggest: [['666', '700', '444']],
    grid: ['..bbb..', '.bbbbb.', 'aaacaaa', 'aacaaca', 'aaaaaaa', '.acaca.', '..aaa..', '...a...'],
  },
  {
    id: 'mushroom',
    label: 'Mushroom',
    tags: ['forest', 'cottagecore', 'toadstool', 'plant'],
    slots: ['cap', 'spots', 'stem'],
    suggest: [['666', 'B5200', '738']],
    grid: ['.aaaaa.', 'aabaaba', 'aaaaaaa', 'abaaaba', '.ccccc.', '..ccc..', '..ccc..'],
  },
  {
    id: 'sun',
    label: 'Sun',
    tags: ['sky', 'summer', 'warm', 'beach', 'sunshine'],
    slots: ['sun'],
    suggest: [['972'], ['444'], ['608']],
    grid: ['...a...', 'a.aaa.a', '.aaaaa.', 'aaaaaaa', '.aaaaa.', 'a.aaa.a', '...a...'],
  },
  {
    id: 'moon',
    label: 'Crescent moon',
    tags: ['night', 'sky', 'space', 'sleep'],
    slots: ['moon'],
    suggest: [['445'], ['B5200'], ['415']],
    grid: ['...aa..', '..aa...', '.aa....', '.aa....', '.aa....', '..aa...', '...aa..'],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    tags: ['sky', 'weather', 'soft', 'pastel'],
    slots: ['cloud'],
    suggest: [['B5200'], ['800']],
    grid: ['..aaa....', '.aaaaaaa.', 'aaaaaaaaa', 'aaaaaaaaa', '.aaaaaaa.'],
  },
  {
    id: 'lightning',
    label: 'Lightning bolt',
    tags: ['storm', 'weather', 'energy', 'power'],
    slots: ['bolt'],
    suggest: [['444'], ['972']],
    grid: ['...aa', '..aa.', '.aa..', 'aaaa.', '..aa.', '.aa..', 'aa...'],
  },
  {
    id: 'butterfly',
    label: 'Butterfly',
    tags: ['insect', 'garden', 'spring', 'wings'],
    slots: ['wings', 'body'],
    suggest: [['996', '310'], ['553', '444']],
    grid: ['aa..b..aa', 'aaa.b.aaa', 'aaaabaaaa', '.aaabaaa.', 'aaaabaaaa', 'aaa.b.aaa', 'aa.....aa'],
  },
  {
    id: 'bee',
    label: 'Bee',
    tags: ['insect', 'honey', 'garden', 'yellow'],
    slots: ['body', 'stripes', 'wings'],
    suggest: [['444', '310', 'B5200']],
    grid: ['.c...c.', '..c.c..', '.bbbbb.', '.aaaaa.', '.bbbbb.', '.aaaaa.', '..bbb..'],
  },
  {
    id: 'paw',
    label: 'Paw print',
    tags: ['dog', 'cat', 'pet', 'animal'],
    slots: ['paw'],
    suggest: [['310'], ['433']],
    grid: ['.aa.aa.', '.aa.aa.', 'a.....a', 'aa...aa', '.aaaaa.', 'aaaaaaa', '.aaaaa.'],
  },
  {
    id: 'cat',
    label: 'Cat face',
    tags: ['animal', 'pet', 'kitty', 'cute'],
    slots: ['fur', 'features'],
    suggest: [['310', '444'], ['437', '310']],
    grid: ['a.....a', 'aa...aa', 'aaaaaaa', 'abaaaba', 'aaabaaa', 'a.aaa.a', '.aaaaa.'],
  },
  {
    id: 'fish',
    label: 'Fish',
    tags: ['ocean', 'sea', 'water', 'animal'],
    slots: ['body', 'eye'],
    suggest: [['996', '310'], ['608', '310']],
    grid: ['.aaaaa.a.', 'aaaaaaaaa', 'abaaaaaaa', 'aaaaaaaaa', '.aaaaa.a.'],
  },
  {
    id: 'turtle',
    label: 'Turtle',
    tags: ['ocean', 'animal', 'sea', 'slow'],
    slots: ['shell', 'body'],
    suggest: [['909', '907']],
    grid: ['....b....', '..aaaaa..', '.aaaaaaa.', 'baaaaaaab', '.aaaaaaa.', '..aaaaa..', '.b.....b.'],
  },
  {
    id: 'palm',
    label: 'Palm tree',
    tags: ['beach', 'tropical', 'summer', 'island'],
    slots: ['leaves', 'trunk'],
    suggest: [['906', '433']],
    grid: ['.aa.a.aa.', 'aaaaaaaaa', '.aa.b.aa.', '....b....', '....b....', '...b.....', '...b.....', '..bbb....'],
  },
  {
    id: 'pine',
    label: 'Pine tree',
    tags: ['forest', 'winter', 'christmas', 'mountain', 'tree'],
    slots: ['tree', 'trunk'],
    suggest: [['909', '433']],
    grid: ['...a...', '..aaa..', '.aaaaa.', '..aaa..', '.aaaaa.', 'aaaaaaa', '.aaaaa.', '...b...', '...b...'],
  },
  {
    id: 'clover',
    label: 'Four-leaf clover',
    tags: ['luck', 'irish', 'green', 'plant'],
    slots: ['leaves', 'stem'],
    suggest: [['906', '909']],
    grid: ['.aa.aa.', 'aaaaaaa', '.aaaaa.', '..aba..', '.aaaaa.', 'aaaaaaa', '.aa.aa.'],
  },
  {
    id: 'smiley',
    label: 'Smiley face',
    tags: ['happy', 'face', 'retro', 'y2k'],
    slots: ['face', 'features'],
    suggest: [['444', '310']],
    grid: ['.aaaaa.', 'aaaaaaa', 'abaaaba', 'aaaaaaa', 'abaaaba', '.abbba.', '.aaaaa.'],
  },
  {
    id: 'peace',
    label: 'Peace sign',
    tags: ['hippie', 'retro', 'seventies', 'symbol'],
    slots: ['sign'],
    suggest: [['B5200'], ['996']],
    grid: ['.aaaaa.', 'aa.a.aa', 'aa.a.aa', 'aaaaaaa', 'aa.a.aa', 'aa.a.aa', '.aaaaa.'],
  },
  {
    id: 'snowflake',
    label: 'Snowflake',
    tags: ['winter', 'cold', 'christmas', 'ice'],
    slots: ['flake'],
    suggest: [['B5200'], ['996']],
    grid: ['a..a..a', '.a.a.a.', '..aaa..', 'aaaaaaa', '..aaa..', '.a.a.a.', 'a..a..a'],
  },
  {
    id: 'ice-cream',
    label: 'Ice cream cone',
    tags: ['food', 'summer', 'sweet', 'dessert'],
    slots: ['scoop', 'cone'],
    suggest: [['776', '738'], ['3846', '437']],
    grid: ['..aaa..', '.aaaaa.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '.bbbbb.', '..bbb..', '..bbb..', '...b...'],
  },
  {
    id: 'skull',
    label: 'Skull',
    tags: ['halloween', 'punk', 'goth', 'spooky'],
    slots: ['bone', 'features'],
    suggest: [['B5200', '310']],
    grid: ['.aaaaa.', 'aaaaaaa', 'abbabba', 'aaaaaaa', '.aaaaa.', '.ababa.', '.aaaaa.'],
  },
  {
    id: 'ghost',
    label: 'Ghost',
    tags: ['halloween', 'spooky', 'cute', 'autumn'],
    slots: ['body', 'eyes'],
    suggest: [['B5200', '310']],
    grid: ['..aaa..', '.aaaaa.', 'aaaaaaa', 'abaaaba', 'aaaaaaa', 'aaaaaaa', 'aaaaaaa', 'a.a.a.a'],
  },
  {
    id: 'pumpkin',
    label: 'Jack-o-lantern',
    tags: ['halloween', 'autumn', 'fall', 'october'],
    slots: ['pumpkin', 'face', 'stem'],
    suggest: [['608', '310', '909']],
    grid: ['...c...', '.aaaaa.', 'aaaaaaa', 'abaaaba', 'aaaaaaa', 'abbbbba', '.aaaaa.'],
  },
  {
    id: 'alien',
    label: 'Alien',
    tags: ['space', 'ufo', 'sci-fi', 'y2k'],
    slots: ['head', 'eyes'],
    suggest: [['907', '310']],
    grid: ['.aaaaa.', 'aaaaaaa', 'abbabba', 'abbabba', 'aaaaaaa', '.aaaaa.', '..a.a..'],
  },
  {
    id: 'gem',
    label: 'Gem',
    tags: ['diamond', 'jewel', 'sparkle', 'treasure'],
    slots: ['gem'],
    suggest: [['3846'], ['553']],
    grid: ['.aaaaa.', 'aaaaaaa', '.aaaaa.', '.aaaaa.', '..aaa..', '..aaa..', '...a...'],
  },
  {
    id: 'anchor',
    label: 'Anchor',
    tags: ['nautical', 'sea', 'sailor', 'boat'],
    slots: ['anchor'],
    suggest: [['820'], ['B5200']],
    grid: ['...a...', '..a.a..', '...a...', '.aaaaa.', '...a...', '...a...', 'a..a..a', '.aaaaa.', '..aaa..'],
  },
  {
    id: 'mountain',
    label: 'Mountain',
    tags: ['outdoors', 'hiking', 'nature', 'peak'],
    slots: ['rock', 'snow'],
    suggest: [['3799', 'B5200'], ['433', 'ECRU']],
    grid: ['....b....', '...bbb...', '..aabaa..', '.aaaaaaa.', 'aaaaaaaaa', 'aaaaaaaaa'],
  },
  {
    id: 'music',
    label: 'Music notes',
    tags: ['song', 'band', 'sound', 'melody'],
    slots: ['notes'],
    suggest: [['310'], ['553']],
    grid: ['..aaaaa', '..a...a', '..a...a', '..a...a', '.aa..aa', 'aaa.aaa', '.a...a.'],
  },
  {
    id: 'arrow',
    label: 'Arrow',
    tags: ['direction', 'geometric', 'simple'],
    slots: ['arrow'],
    suggest: [['310'], ['B5200']],
    grid: ['..a..', '.aaa.', 'aaaaa', '..a..', '..a..', '..a..', '..a..'],
  },
];

export const MOTIF_BY_ID = new Map(MOTIFS.map((m) => [m.id, m]));

export function motifSize(m) {
  return { w: Math.max(...m.grid.map((r) => r.length)), h: m.grid.length };
}

/** How many distinct colour slots a motif needs. */
export function motifSlotCount(m) {
  const used = new Set();
  for (const row of m.grid) for (const ch of row) if (ch !== '.') used.add(ch);
  return used.size;
}

/**
 * Paint a motif into concrete floss codes.
 * @param {Motif} m
 * @param {string[]} colors  codes for slots a, b, c...
 * @returns {(string|null)[][]} null means transparent
 */
export function paintMotif(m, colors) {
  const { w } = motifSize(m);
  return m.grid.map((row) => {
    const padded = row.padEnd(w, '.');
    return Array.from(padded, (ch) => {
      if (ch === '.') return null;
      const idx = ch.charCodeAt(0) - 97;
      return colors[idx] ?? colors[colors.length - 1] ?? null;
    });
  });
}

/** Find motifs whose id/label/tags match any of the given words. */
export function rankMotifs(words) {
  const stop = new Set(['and', 'the', 'with', 'for', 'that', 'this', 'some', 'something', 'little', 'small', 'big', 'bracelet', 'pattern', 'design', 'colour', 'color', 'colours', 'colors', 'between', 'them', 'made', 'want', 'like', 'please', 'make', 'simple', 'easy', 'nice', 'pretty', 'cute', 'cool', 'thin', 'wide', 'dark', 'light', 'bright', 'pale', 'deep',
    // Mood and colour adjectives. "warm oranges" is a palette instruction, not
    // a request for the sun motif just because "warm" is one of its tags.
    'warm', 'hot', 'cold', 'soft', 'muted', 'neon', 'pastel', 'rich', 'bold', 'subtle',
    'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'violet', 'pink', 'brown', 'black', 'white', 'grey', 'gray', 'gold', 'silver', 'cream', 'teal', 'navy', 'lilac', 'lavender', 'peach', 'mint', 'coral', 'rust', 'plum', 'sand']);
  const w = [];
  for (const raw of words) {
    const word = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length < 3 || stop.has(word)) continue;
    w.push(word);
    // "cactuses", "daisies", "hearts" should find "cactus", "daisy", "heart".
    if (word.length > 4 && word.endsWith('ies')) w.push(`${word.slice(0, -3)}y`);
    else if (word.length > 3 && word.endsWith('es')) w.push(word.slice(0, -2));
    else if (word.length > 3 && word.endsWith('s')) w.push(word.slice(0, -1));
  }
  const hits = [];
  for (const m of MOTIFS) {
    // Naming the thing outright is much stronger evidence than brushing one of
    // its themes, so identity and tags are scored on different scales.
    const names = [m.id.replace(/-/g, ''), m.label.toLowerCase().replace(/[^a-z]/g, '')];
    const tags = m.tags.map((t) => t.replace(/[^a-z]/g, ''));
    let score = 0;
    for (const word of w) {
      for (const h of names) {
        // Only ever match a *prefix the user typed* against a longer name.
        // The reverse ("sunset" starting with "sun") produces nonsense hits.
        if (h === word) score += 5;
        else if (word.length >= 4 && h.startsWith(word)) score += 4;
        else if (word.length >= 5 && h.includes(word)) score += 2;
      }
      for (const h of tags) {
        if (h === word) score += 2;
        else if (word.length >= 4 && h.startsWith(word)) score += 1;
      }
    }
    if (score > 0) hits.push({ motif: m, score });
  }
  hits.sort((a, b) => b.score - a.score || a.motif.id.localeCompare(b.motif.id));
  return hits;
}

export function searchMotifs(words) {
  return rankMotifs(words).map((h) => h.motif);
}

