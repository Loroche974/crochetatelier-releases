// Port of domain/model/AppSettings.kt (Season, Palette) and SettingsRepository.setPalette / endExpiredSeason.

export const PALETTES = {
  LAINE_PASTEL: 'Laine pastel', TERRACOTTA: 'Terracotta', SAUGE: 'Sauge', LAVANDE: 'Lavande', COTON: 'Coton', NOEL: 'Noël',
};
export const DEFAULT_PALETTE = 'LAINE_PASTEL';

/** Months are 1-12. A period may span New Year. */
export const SEASONS = [
  { id: 'NOEL', palette: 'NOEL', title: 'Le thème de Noël est là !', from: [12, 1], to: [1, 6] },
];

const md = (date) => (date.getMonth() + 1) * 100 + date.getDate();
const key = ([m, d]) => m * 100 + d;

export function isActive(season, date) {
  const d = md(date), from = key(season.from), to = key(season.to);
  return from <= to ? d >= from && d <= to : d >= from || d <= to;
}

/** Identifies one occurrence (Noël 2026 runs into January 2027), so a dismissed offer comes back the next year. */
export function occurrence(season, date) {
  const spansNewYear = key(season.from) > key(season.to);
  const year = spansNewYear && md(date) <= key(season.to) ? date.getFullYear() - 1 : date.getFullYear();
  return `${season.id}-${year}`;
}

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
