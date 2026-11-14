// Port of domain/model/AppSettings.kt (Season, Palette, easterSunday) and SettingsRepository.setPalette / endExpiredSeason.

export const PALETTES = {
  LAINE_PASTEL: 'Laine pastel', TERRACOTTA: 'Terracotta', SAUGE: 'Sauge', LAVANDE: 'Lavande', COTON: 'Coton',
  SAINT_VALENTIN: 'Saint-Valentin', PAQUES: 'Pâques', HALLOWEEN: 'Halloween', NOEL: 'Noël',
};
export const DEFAULT_PALETTE = 'LAINE_PASTEL';

// Dates are compared as yyyymmdd numbers: no time zone or hour can shift a day.
const key = (y, m, d) => y * 10000 + m * 100 + d;
const dayKey = (date) => key(date.getFullYear(), date.getMonth() + 1, date.getDate());
const shift = (y, m, d, days) => { const t = new Date(Date.UTC(y, m - 1, d + days)); return key(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };

/** Gregorian Easter Sunday (Meeus / Jones / Butcher algorithm): { y, m, d }. */
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { y: year, m: Math.floor(n / 31), d: (n % 31) + 1 };
}

/** period(year) = [first, last] day (yyyymmdd, inclusive) of the occurrence starting that year; it may end the next year. */
export const SEASONS = [
  { id: 'SAINT_VALENTIN', palette: 'SAINT_VALENTIN', title: 'Le thème de la Saint-Valentin est là !', emoji: '💕', period: (y) => [key(y, 2, 7), key(y, 2, 15)] },
  { id: 'PAQUES', palette: 'PAQUES', title: 'Le thème de Pâques est là !', emoji: '🐣', period: (y) => { const e = easterSunday(y); return [shift(y, e.m, e.d, -7), shift(y, e.m, e.d, 1)]; } },
  { id: 'HALLOWEEN', palette: 'HALLOWEEN', title: 'Le thème d\'Halloween est là !', emoji: '🎃', period: (y) => [key(y, 10, 20), key(y, 11, 2)] },
  { id: 'NOEL', palette: 'NOEL', title: 'Le thème de Noël est là !', emoji: '🎄', period: (y) => [key(y, 12, 1), key(y + 1, 1, 6)] },
];

/** Year the occurrence covering [date] started in (Noël 2026 runs into January 2027), null when off season. */
function startYear(season, date) {
  const k = dayKey(date), y = date.getFullYear();
  return [y, y - 1].find((yy) => { const [a, b] = season.period(yy); return k >= a && k <= b; }) ?? null;
}

export const isActive = (season, date) => startYear(season, date) != null;

/** Identifies one occurrence, so a dismissed offer comes back the next year. */
export const occurrence = (season, date) => `${season.id}-${startYear(season, date) ?? date.getFullYear()}`;

export const currentSeason = (date) => SEASONS.find((s) => isActive(s, date)) ?? null;
export const seasonOf = (palette) => SEASONS.find((s) => s.palette === palette) ?? null;
export const paletteAvailable = (palette, date) => { const s = seasonOf(palette); return !s || isActive(s, date); };

/** Settings after choosing a palette: a seasonal one remembers the palette in use, to bring it back later. */
export function choosePalette(settings, palette) {
  const next = { ...settings, palette };
  const current = settings.palette ?? DEFAULT_PALETTE;
  if (!seasonOf(palette)) delete next.paletteBeforeSeason;
  else if (!seasonOf(current)) next.paletteBeforeSeason = current;
  return next;
}

/** Season over: back to the palette used before it. Returns the same object when nothing changes. */
export function endExpiredSeason(settings, date) {
  const palette = settings.palette ?? DEFAULT_PALETTE;
  if (paletteAvailable(palette, date)) return settings;
  const next = { ...settings, palette: settings.paletteBeforeSeason ?? DEFAULT_PALETTE };
  delete next.paletteBeforeSeason;
  return next;
}

/** Season on whose theme was neither tried nor declined yet. */
export function seasonOffer(settings, date) {
  const s = currentSeason(date);
  return s && settings.palette !== s.palette && settings.seasonAnswered !== occurrence(s, date) ? s : null;
}
