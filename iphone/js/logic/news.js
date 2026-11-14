// « Quoi de neuf » (port of UpdateViewModel.whatsNew on Android): the news of this version, once, after an update.

/** News of the current version (APP_VERSION in app.js). Rewrite it at every publication; empty = no window. */
export const NEWS = `• Après chaque mise à jour, cette fenêtre te montre les nouveautés de la version.
• Pour rappel, la 1.1 a ajouté les thèmes Saint-Valentin, Pâques et Halloween, proposés sur l'Accueil à leurs dates.`;

/** -1, 0 or 1: "1.10" comes after "1.9". */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * Whether to show the news. [seen] = last version whose news were shown (null if never),
 * [newcomer] = nothing read, added or started yet: a fresh install shows nothing, like on Android.
 */
export function shouldShowNews(seen, current, newcomer, news = NEWS) {
  if (!news.trim() || newcomer) return false;
  return seen == null || compareVersions(current, seen) > 0;
}
