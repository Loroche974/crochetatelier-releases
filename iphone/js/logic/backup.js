// Same .zip as the Android app (data/backup/Backup.kt, version 2): one JSON file + "photos/".
import { zipSync, unzipSync, strToU8, strFromU8 } from '../../lib/fflate.js';

export const ENTRY = 'crochet-atelier.json';
export const APP = 'Crochet Atelier'; // format id, not the display name: kept so older backups still import
const PHOTOS = 'photos/';
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
/** Plain file names only: "photos/../../x" must never be accepted. */
export const PHOTO_NAME = /^[A-Za-z0-9._-]{1,120}$/;
const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];
const INK_TOOLS = ['PEN', 'HIGHLIGHTER', 'TEXT'];
export const MAX_TAG = 40;
export const MAX_TITLE = 80;

export class BackupError extends Error {}

const str = (v, d = '') => (typeof v === 'string' ? v : d);
const int = (v, d = 0) => (Number.isFinite(v) ? Math.trunc(v) : d);
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const arr = (v) => (Array.isArray(v) ? v : []);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function ink(i) {
  if (!i || !INK_TOOLS.includes(i.tool)) return null;
  return { tool: i.tool, color: int(i.color), width: num(i.width), points: arr(i.points).filter(Number.isFinite), text: str(i.text) };
}

/** Text of crochet-atelier.json → cleaned backup, with the same defaults and limits as the Android import. */
export function parseBackup(text) {
  let b;
  try { b = JSON.parse(text); } catch { throw new BackupError('La sauvegarde est abîmée : elle ne peut pas être lue.'); }
  if (!b || typeof b !== 'object' || (b.app ?? APP) !== APP) throw new BackupError("Ce fichier n'est pas une sauvegarde Mon Carnet Crochet.");
  if (!Number.isFinite(b.exportedAt) || !Array.isArray(b.items)) throw new BackupError('La sauvegarde est abîmée : elle ne peut pas être lue.');
  const items = b.items.filter((it) => it && str(it.path).trim()).map((it) => ({
    path: it.path,
    favorite: it.favorite === true,
    lastPage: Math.max(0, int(it.lastPage)),
    pageCount: Math.max(0, int(it.pageCount)),
    lastPositionMs: Math.max(0, int(it.lastPositionMs)),
    lastOpenedAt: int(it.lastOpenedAt),
    note: str(it.note),
    difficulty: clamp(int(it.difficulty), 0, 5),
    tags: [...new Set(arr(it.tags).map((t) => str(t).trim().slice(0, MAX_TAG)).filter(Boolean))],
    bookmarks: arr(it.bookmarks).filter((m) => m && int(m.page, -1) >= 0).map((m) => ({ page: int(m.page), title: str(m.title).slice(0, MAX_TITLE) })),
    annotations: arr(it.annotations).filter((p) => p && int(p.page, -1) >= 0)
      .map((p) => ({ page: int(p.page), inks: arr(p.inks).map(ink).filter(Boolean) })).filter((p) => p.inks.length),
  }));
  const w = b.workshop;
  const workshop = w && typeof w === 'object' ? {
    projects: arr(w.projects).filter(Boolean).map((p) => ({
      name: str(p.name).trim() || 'Projet',
      tutorialPath: typeof p.tutorialPath === 'string' ? p.tutorialPath : null,
      tutorialSource: typeof p.tutorialSource === 'string' ? p.tutorialSource : null,
      status: STATUSES.includes(p.status) ? p.status : 'IN_PROGRESS',
      hook: str(p.hook), notes: str(p.notes),
      timeMs: Math.max(0, int(p.timeMs)),
      rulerHeight: clamp(num(p.rulerHeight, 0.04), 0.015, 0.2),
      rulerY: clamp(num(p.rulerY, 0.1), 0, 1),
      createdAt: int(p.createdAt), updatedAt: int(p.updatedAt),
      counters: arr(p.counters).filter(Boolean).map((c) => ({ name: str(c.name), value: int(c.value), target: Math.max(0, int(c.target)), position: int(c.position) })),
      photos: arr(p.photos).filter((ph) => ph && PHOTO_NAME.test(str(ph.file))).map((ph) => ({ file: ph.file, takenAt: int(ph.takenAt) })),
      yarns: arr(p.yarns).filter(Number.isInteger),
    })),
    yarns: arr(w.yarns).filter(Boolean).map((y) => ({
      brand: str(y.brand).trim() || 'Laine', color: str(y.color), material: str(y.material), weight: str(y.weight),
      metersPerBall: Math.max(0, int(y.metersPerBall)), quantity: Math.max(0, num(y.quantity)),
      photo: typeof y.photo === 'string' && PHOTO_NAME.test(y.photo) ? y.photo : null, notes: str(y.notes),
    })),
  } : null;
  return { app: APP, version: int(b.version, 1), exportedAt: b.exportedAt, items, workshop };
}

/** .zip bytes → { backup, photos: Map(name → Uint8Array) }. Throws BackupError with a French message. */
export function readZip(bytes) {
  let files;
  try {
    files = unzipSync(bytes, {
      filter: (f) => (f.name === ENTRY && f.originalSize <= MAX_BYTES)
        || (f.name.startsWith(PHOTOS) && PHOTO_NAME.test(f.name.slice(PHOTOS.length)) && f.originalSize <= MAX_PHOTO_BYTES),
    });
  } catch {
    throw new BackupError("Ce fichier n'est pas un .zip lisible.");
  }
  const json = files[ENTRY];
  if (!json) throw new BackupError("Ce fichier .zip n'est pas une sauvegarde Mon Carnet Crochet (ou elle est trop volumineuse).");
  const photos = new Map();
  for (const [name, data] of Object.entries(files)) {
    if (name !== ENTRY && data.length <= MAX_PHOTO_BYTES) photos.set(name.slice(PHOTOS.length), data);
  }
  return { backup: parseBackup(strFromU8(json)), photos };
}

/** backup object + photos (name → Uint8Array) → .zip bytes. Photos are already compressed: stored as is. */
export function writeZip(backup, photos = new Map()) {
  const entries = { [ENTRY]: strToU8(JSON.stringify(backup)) };
  for (const [name, data] of photos) entries[PHOTOS + name] = [data, { level: 0 }];
  return zipSync(entries, { level: 6 });
}

export function photoExt(mime) {
  return ({ 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif' })[mime] ?? 'jpg';
}
export function photoMime(name) {
  return ({ png: 'image/png', webp: 'image/webp', heic: 'image/heic', gif: 'image/gif' })[name.split('.').pop().toLowerCase()] ?? 'image/jpeg';
}

/** "3 tutos, 2 projets, 1 laine" */
export function describeSummary({ tutorials, projects, yarns }) {
  const n = (c, w) => `${c} ${w}${c > 1 ? 's' : ''}`;
  const shop = projects == null || yarns == null ? ' (ancienne sauvegarde : projets et laine inchangés)' : `, ${n(projects, 'projet')}, ${n(yarns, 'laine')}`;
  return n(tutorials, 'tuto') + shop;
}
