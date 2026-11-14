// Port of domain/Workshop.kt: same data and formulas.
import { normalize, terms } from './search.js';

export const STATUS = { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminé' };

/** Time spent: saved total plus the running session, if the timer is on. */
export function elapsed(savedMs, startedAt, now) {
  return savedMs + (startedAt != null ? Math.max(0, now - startedAt) : 0);
}

/** "2 h 05", "12 min", "0 min". */
export function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

/** Counters never go below 0. */
export const nextCount = (value, delta) => Math.max(0, value + delta);
/** The target (0 = none) is reached exactly when the value gets to it. */
export const reached = (before, after, target) => target > 0 && before < target && after >= target;

/** Reading ruler after the row counter moved by [moved] rows: one band per row. */
export function moveRuler(y, height, moved) {
  return Math.min(Math.max(y + moved * height, 0), 1 - height);
}
export const clampRulerHeight = (h) => Math.min(Math.max(h, 0.015), 0.2);

const NEXT = new Set(['suivant', 'suivante', 'next', 'plus', 'avance', 'avancer']);
const PREVIOUS = new Set(['precedent', 'precedente', 'retour', 'arriere', 'moins', 'recule', 'reculer']);

/** Last command word heard: 'next', 'previous' or null. */
export function parseVoice(heard) {
  for (const w of normalize(heard).split(' ').reverse()) {
    if (NEXT.has(w)) return 'next';
    if (PREVIOUS.has(w)) return 'previous';
  }
  return null;
}

const positive = (...xs) => xs.every((x) => Number.isFinite(x) && x > 0);
// Kotlin roundToInt rounds half up (toward +∞), like Math.round.
const round = Math.round;

/** Swatch → stitches and rows for the wanted size. */
export function gauge(swatchStitches, swatchWidthCm, swatchRows, swatchHeightCm, widthCm, heightCm) {
  if (!positive(swatchStitches, swatchWidthCm, swatchRows, swatchHeightCm, widthCm, heightCm)) return null;
  return { stitches: round(swatchStitches / swatchWidthCm * widthCm), rows: round(swatchRows / swatchHeightCm * heightCm) };
}

/** Spreads [change] increases (> 0) or decreases (< 0) evenly over a round of [stitches]. */
export function spread(stitches, change) {
  if (!Number.isInteger(stitches) || !Number.isInteger(change) || stitches <= 0 || change === 0) return null;
  const k = Math.abs(change);
  const used = change > 0 ? k : 2 * k;
  if (used > stitches) return null;
  const plain = stitches - used;
  const base = Math.floor(plain / k);
  const extra = plain % k;
  const groups = [{ plain: base + 1, repeats: extra }, { plain: base, repeats: k - extra }].filter((g) => g.repeats > 0);
  return { groups, total: stitches + change, increase: change > 0 };
}

/** "(3 ms, 1 aug) × 4, puis (2 ms, 1 aug) × 2 → 26 mailles" */
export function describeSpread(s) {
  const action = s.increase ? '1 aug' : '1 dim';
  return s.groups.map((g) => `(${g.plain > 0 ? `${g.plain} ms, ${action}` : action}) × ${g.repeats}`).join(', puis ')
    + ` → ${s.total} mailles`;
}

/** Yarn for a size from a swatch, plus 10 % margin. */
export function yarn(swatchWidthCm, swatchHeightCm, swatchMeters, widthCm, heightCm, metersPerBall) {
  if (!positive(swatchWidthCm, swatchHeightCm, swatchMeters, widthCm, heightCm, metersPerBall)) return null;
  // Rounded to the cm first: 200 × 1.1 is 220.00000000000003 in floating point, not 221 m.
  const meters = Math.ceil(round(swatchMeters * (widthCm * heightCm) / (swatchWidthCm * swatchHeightCm) * 1.1 * 100) / 100);
  return { meters, balls: Math.ceil(meters / metersPerBall) };
}

/** Foundation chain rounded to "multiple of [multiple] + [extra]", plus the turning chain. */
export function foundation(widthCm, stitchesPer10cm, multiple = 1, extra = 0, turning = 1) {
  if (!positive(widthCm, stitchesPer10cm) || !(multiple >= 1) || !(extra >= 0) || !(turning >= 0)) return null;
  const raw = widthCm * stitchesPer10cm / 10;
  const n = Math.max(1, round((raw - extra) / multiple));
  const stitches = n * multiple + extra;
  return { stitches, turning, total: stitches + turning };
}

/** Reads "3,5", "4 mm" or "−6" as a number, or NaN. */
export function parseNumber(input) {
  const t = String(input ?? '').trim();
  const s = t.replace(',', '.').replace(/[^0-9.]/g, '');
  if (s === '') return NaN;
  return /^[-−]/.test(t) ? -Number(s) : Number(s);
}

export const HOOKS = [
  [2.0, '—', '14'], [2.25, 'B-1', '13'], [2.5, '—', '12'], [2.75, 'C-2', '—'],
  [3.0, '—', '11'], [3.25, 'D-3', '10'], [3.5, 'E-4', '9'], [3.75, 'F-5', '—'],
  [4.0, 'G-6', '8'], [4.5, '7', '7'], [5.0, 'H-8', '6'], [5.5, 'I-9', '5'],
  [6.0, 'J-10', '4'], [6.5, 'K-10½', '3'], [7.0, '—', '2'], [8.0, 'L-11', '0'],
  [9.0, 'M/N-13', '00'], [10.0, 'N/P-15', '000'], [12.0, 'O-16', '—'], [15.0, 'P/Q', '—'],
].map(([mm, us, uk]) => ({ mm, us, uk }));

/** Yarn weight usually worked with this hook (Craft Yarn Council ranges). */
export function yarnFor(mm) {
  if (mm < 2.25) return 'Dentelle (lace, 0)';
  if (mm < 3.5) return 'Très fine : chaussettes, fingering (1)';
  if (mm < 4.5) return 'Fine : sport, bébé (2)';
  if (mm < 5.5) return 'Légère : DK (3)';
  if (mm < 6.5) return 'Moyenne : worsted, aran (4)';
  if (mm < 9.0) return 'Épaisse : chunky, bulky (5)';
  if (mm < 15.0) return 'Très épaisse : super bulky (6)';
  return 'Jumbo (7)';
}

/** Closest hook to a size typed by the user ("3,5", "4 mm"). */
export function closestHook(input) {
  const mm = parseNumber(input);
  if (!Number.isFinite(mm)) return null;
  return HOOKS.reduce((best, h) => (Math.abs(h.mm - mm) < Math.abs(best.mm - mm) ? h : best));
}

const ab = (fr, frName, us, uk, note = '') => ({ fr, frName, us, uk, note });
/** FR ↔ US ↔ UK. Beware: US and UK use the same words for different stitches (US sc = UK dc). */
export const LEXICON = [
  ab('ml', "maille en l'air", 'ch (chain)', 'ch (chain)'),
  ab('mc', 'maille coulée', 'sl st (slip stitch)', 'ss / sl st (slip stitch)'),
  ab('ms', 'maille serrée', 'sc (single crochet)', 'dc (double crochet)', 'Le piège : « dc » veut dire maille serrée en UK, mais bride en US.'),
  ab('dB', 'demi-bride', 'hdc (half double crochet)', 'htr (half treble)'),
  ab('br', 'bride', 'dc (double crochet)', 'tr (treble)'),
  ab('dbr', 'double bride', 'tr (treble)', 'dtr (double treble)'),
  ab('tbr', 'triple bride', 'dtr (double treble)', 'trtr (triple treble)'),
  ab('aug', 'augmentation (2 m dans la même m)', 'inc (increase)', 'inc (increase)'),
  ab('dim', 'diminution (2 m ensemble)', 'dec / sc2tog', 'dec / dc2tog', '« sc2tog » US = « dc2tog » UK.'),
  ab('dim inv', 'diminution invisible', 'invdec (invisible decrease)', 'invdec'),
  ab('cm', 'cercle magique', 'MR (magic ring)', 'MR (magic ring / loop)'),
  ab('m', 'maille', 'st (stitch)', 'st (stitch)'),
  ab('rg', 'rang / tour', 'row / rnd (round)', 'row / rnd (round)'),
  ab('BAV', 'brin avant uniquement', 'FLO (front loop only)', 'FLO (front loop only)'),
  ab('BAR', 'brin arrière uniquement', 'BLO (back loop only)', 'BLO (back loop only)'),
  ab('br rel av', 'bride en relief avant', 'FPdc (front post dc)', 'FPtr (front post treble)'),
  ab('br rel arr', 'bride en relief arrière', 'BPdc (back post dc)', 'BPtr (back post treble)'),
  ab('ens', 'ensemble', 'tog (together)', 'tog (together)'),
  ab('sauter', 'sauter une maille', 'sk (skip)', 'miss'),
  ab('ms écrevisse', 'maille écrevisse', 'rev sc (reverse sc)', 'crab stitch / rev dc'),
  ab('pop', 'maille popcorn', 'pc (popcorn)', 'pc (popcorn)'),
  ab('bouclette', 'maille bouclée', 'loop st', 'loop st'),
  ab('rép', 'répéter', 'rep (repeat)', 'rep (repeat)'),
  ab('tourner', "tourner l'ouvrage", 'turn', 'turn'),
  ab('échant.', 'échantillon', 'gauge', 'tension'),
  ab('fil', 'fil / laine', 'yarn', 'yarn / wool'),
  ab('jeté', 'jeté (fil sur le crochet)', 'yo (yarn over)', 'yoh (yarn over hook)'),
  ab('m.', 'marqueur de maille', 'st m / PM (place marker)', 'st m / PM'),
];

export function searchLexicon(query) {
  const t = terms(query);
  if (!t.length) return LEXICON;
  return LEXICON.filter((a) => {
    const text = normalize(`${a.fr} ${a.frName} ${a.us} ${a.uk}`);
    return t.every((w) => text.includes(w));
  });
}
