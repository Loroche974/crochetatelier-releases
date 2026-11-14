// Shell: settings, theme, tabs, hash routing, service worker updates.
import * as db from './db.js';
import { applyTheme, onSystemThemeChange } from './theme.js';
import { endExpiredSeason, choosePalette, DEFAULT_PALETTE } from './logic/season.js';
import { h, icon, releaseUrls, toast, sheet } from './ui.js';

export const APP_VERSION = '1.2';

// ---------- Settings ----------
let current = { themeMode: 'SYSTEM', palette: DEFAULT_PALETTE };
export const settings = () => current;
export async function saveSettings(next) {
  current = next;
  await db.setSetting('app', next);
  applyTheme(next);
}
export const setPalette = (palette) => saveSettings(choosePalette(current, palette));

// ---------- Routing ----------
const VIEWS = {
  accueil: () => import('./views/home.js'),
  bibliotheque: () => import('./views/library.js'),
  recherche: () => import('./views/search.js'),
  atelier: () => import('./views/workshop.js'),
  projet: () => import('./views/project.js'),
  laine: () => import('./views/yarn.js'),
  lire: () => import('./views/reader.js'),
  reglages: () => import('./views/settings.js'),
  aide: () => import('./views/help.js'),
  installer: () => import('./views/help.js'),
};
const TABS = [['accueil', 'Accueil', 'home'], ['bibliotheque', 'Bibliothèque', 'library'], ['recherche', 'Recherche', 'search'], ['atelier', 'Atelier', 'workshop'], ['reglages', 'Réglages', 'settings']];
const TAB_OF = { projet: 'atelier', laine: 'atelier', aide: 'reglages', installer: 'reglages' };

/** go('lire', path) → #/lire/<path>. Arguments are encoded, so a path with '/' is one argument. */
export const link = (...parts) => `#/${parts.map((p) => encodeURIComponent(p)).join('/')}`;
export const go = (...parts) => { location.hash = link(...parts); };
export const back = () => (history.length > 1 ? history.back() : go('accueil'));

let cleanup = null;
let renderId = 0;
export async function render() {
  const [name = 'accueil', ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const view = VIEWS[name] ? name : 'accueil';
  const id = ++renderId;
  try { cleanup?.(); } catch { /* a screen failing to clean up must not block navigation */ }
  cleanup = null;
  releaseUrls();
  const tab = TAB_OF[view] ?? view;
  document.querySelectorAll('#tabs a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === tab));
  document.body.classList.toggle('fullscreen', view === 'lire');
  const root = document.getElementById('view');
  try {
    const mod = await VIEWS[view]();
    if (id !== renderId) return;
    const fresh = h('main', { id: 'view', tabindex: '-1' });
    // Screens write root.append(cond && x, …): skip null/false/undefined like h() does.
    fresh.append = (...c) => Element.prototype.append.apply(fresh, c.flat(Infinity).filter((x) => x != null && x !== false));
    root.replaceWith(fresh);
    cleanup = (await mod.default(fresh, args, view)) ?? null;
    if (id !== renderId) { cleanup?.(); cleanup = null; }
  } catch (e) {
    console.error(e);
    toast(`Erreur : ${e?.message ?? e}`);
  }
}
/** Re-renders the current screen (after a change), keeping the scroll position. */
export async function refresh() {
  const y = window.scrollY;
  await render();
  window.scrollTo(0, y);
}

// ---------- Service worker: "Nouvelle version" banner ----------
function watchUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (worker) => {
      const banner = document.getElementById('update');
      banner.hidden = false;
      banner.onclick = () => worker.postMessage('skipWaiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    // An installed app may stay open for days: look for a new version when it comes back to the front.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('Service worker', e));
}

export async function checkForUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return 'Mises à jour indisponibles ici (ouvre l\'appli depuis son adresse https).';
  await reg.update();
  return reg.waiting || reg.installing ? 'Nouvelle version trouvée : touche le bandeau en haut pour l\'installer.' : 'Tu as la dernière version.';
}

// ---------- « Quoi de neuf » after an update ----------
async function showNews() {
  const [{ NEWS, shouldShowNews }, { newcomer }] = await Promise.all([import('./logic/news.js'), import('./repo.js')]);
  const seen = await db.setting('newsSeen', null);
  const show = shouldShowNews(seen, APP_VERSION, await newcomer());
  await db.setSetting('newsSeen', APP_VERSION); // once only, as on Android
  if (show) {
    sheet(`Quoi de neuf dans la ${APP_VERSION} ?`, (close) => [
      h('p', { style: { whiteSpace: 'pre-line', lineHeight: '1.5' } }, NEWS),
      h('div', { class: 'row end' }, h('button', { class: 'btn filled', onclick: () => close() }, 'Super !')),
    ]);
  }
}

// ---------- Start ----------
async function start() {
  const saved = await db.setting('app', current);
  const merged = { ...current, ...saved };
  current = endExpiredSeason(merged, new Date());
  if (current !== merged) await db.setSetting('app', current);
  applyTheme(current);
  onSystemThemeChange(() => applyTheme(current));

  document.getElementById('tabs').append(...TABS.map(([tab, label, ic]) =>
    h('a', { href: link(tab), 'data-tab': tab }, icon(ic), h('span', null, label))));
  addEventListener('hashchange', render);
  await render();
  db.persist();
  watchUpdates();
  showNews();
  // PDFs imported before this version, or whose analysis was interrupted.
  setTimeout(() => import('./indexer.js').then((m) => m.indexPending()), 2000);
}
start();
