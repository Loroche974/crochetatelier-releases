// Same rules as domain/Search.kt: case, accents and punctuation ignored.

/** "Doudous_Bébé - Lapin.pdf" -> "doudous bebe lapin pdf" */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '')
    .replace(/[œŒ]/g, 'oe').replace(/[æÆ]/g, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Words of a query, normalised, without duplicates. */
export function terms(query) {
  return [...new Set(normalize(query).split(' ').filter(Boolean))];
}

/**
 * Extract of [text] around the first term found, accents and case ignored: { before, match, after } in the
 * original spelling, or null. [radius] = characters kept on each side.
 */
export function snippet(text, queryTerms, radius = 40) {
  // Fold each character on its own, remembering where each folded character comes from.
  let folded = '';
  const origin = [];
  for (let i = 0; i < text.length; i++) {
    const f = text[i].normalize('NFD').replace(/\p{Mn}+/gu, '').replace(/[œŒ]/g, 'oe').replace(/[æÆ]/g, 'ae').toLowerCase();
    for (const c of f) { folded += /[a-z0-9]/.test(c) ? c : ' '; origin.push(i); }
  }
  for (const term of queryTerms) {
    const at = folded.indexOf(term);
    if (at < 0) continue;
    const start = origin[at], end = origin[at + term.length - 1] + 1;
    let from = Math.max(0, start - radius), to = Math.min(text.length, end + radius);
    // Whole words only: drop a word cut at either edge.
    if (from > 0 && /\S/.test(text[from - 1])) { const sp = text.slice(from, start).search(/\s/); if (sp >= 0) from += sp + 1; }
    if (to < text.length && /\S/.test(text[to])) { const sp = text.slice(end, to).search(/\s\S*$/); if (sp >= 0) to = end + sp; }
    const clean = (s) => s.replace(/\s+/g, ' ');
    return {
      before: (from > 0 ? '…' : '') + clean(text.slice(from, start)).trimStart(),
      match: text.slice(start, end),
      after: clean(text.slice(end, to)).trimEnd() + (to < text.length ? '…' : ''),
    };
  }
  return null;
}

/** True when every term appears in [text] (substring, so "lap" finds "lapin"). */
export function matches(text, queryTerms) {
  const t = normalize(text);
  return queryTerms.every((w) => t.includes(w));
}
