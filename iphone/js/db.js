// IndexedDB: everything stays on the phone (tutorial files included).

const NAME = 'mon-carnet-crochet';
const VERSION = 2; // 2: PDF text, analysed PDFs, thumbnails (stores are only ever added)

/** store → [keyPath, autoIncrement, indexes] (keyPath null = keys given outside the value). */
const STORES = {
  files: ['path', false, ['parent']], // { path, parent, name, type, size, addedAt }; type 'FOLDER' for folders
  blobs: [null, false, []], // path → Blob (the tutorial itself)
  meta: ['path', false, []], // { path, favorite, lastPage, pageCount, lastPositionMs, lastOpenedAt, note, difficulty }
  tags: [['path', 'name'], false, ['path']],
  bookmarks: [['path', 'page'], false, ['path']],
  inks: [['path', 'page'], false, ['path']], // { path, page, inks: [...] } annotations (kept from Android backups)
  projects: ['id', true, []],
  counters: ['id', true, ['projectId']],
  photos: ['id', true, ['projectId']], // { projectId, blob, takenAt }
  yarns: ['id', true, []], // { brand, color, material, weight, metersPerBall, quantity, photo: Blob|null, notes }
  projectYarns: [['projectId', 'yarnId'], false, ['projectId', 'yarnId']],
  folderPrefs: ['path', false, []],
  searchHistory: ['query', false, []],
  settings: [null, false, []],
  // Derived from the tutorial files (rebuilt if lost, not in backups):
  pdfText: [['path', 'page'], false, ['path']], // { path, page, text, search: normalised text }
  indexed: ['path', false, []], // { path, pages } PDFs already analysed (pages 0 = unreadable)
  thumbs: [null, false, []], // path → JPEG Blob of the first page
};

let dbPromise;
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, [keyPath, autoIncrement, indexes]] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const s = db.createObjectStore(name, keyPath ? { keyPath, autoIncrement } : undefined);
        indexes.forEach((i) => s.createIndex(i, i));
      }
    };
    req.onsuccess = () => {
      // A newer version opened in another tab: let it upgrade instead of blocking it.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const done = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

/**
 * Runs [fn](stores) in one transaction: everything is written, or nothing (import, deletions).
 * Inside fn, only use the stores' request methods (no await on other things: the transaction would close).
 */
export async function tx(names, mode, fn) {
  const db = await open();
  const t = db.transaction(names, mode);
  const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
  const result = fn(stores);
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error ?? new Error('Transaction annulée')); });
  return result instanceof IDBRequest ? result.result : result;
}

async function store(name, mode = 'readonly') { return (await open()).transaction(name, mode).objectStore(name); }

export const get = async (name, key) => done((await store(name)).get(key));
export const all = async (name) => done((await store(name)).getAll());
export const byIndex = async (name, index, value) => done((await store(name)).index(index).getAll(value));
export const put = async (name, value, key) => done((await store(name, 'readwrite')).put(value, key));
export const del = async (name, key) => done((await store(name, 'readwrite')).delete(key));

/** Reads, changes and writes one record in a single transaction. [change] gets undefined when missing. */
export async function update(name, key, change) {
  const s = await store(name, 'readwrite');
  const next = change(await done(s.get(key)));
  if (next !== undefined) await done(key !== undefined && !s.keyPath ? s.put(next, key) : s.put(next));
  return next;
}

// --- settings (key/value) ---
export const setting = async (key, fallback) => (await get('settings', key)) ?? fallback;
export const setSetting = (key, value) => put('settings', value, key);

// --- tutorial metadata, created on first use (same defaults as Android's item_meta) ---
export const emptyMeta = (path) => ({ path, favorite: false, lastPage: 0, pageCount: 0, lastPositionMs: 0, lastOpenedAt: 0, note: '', difficulty: 0 });
export const meta = async (path) => (await get('meta', path)) ?? emptyMeta(path);
export const editMeta = (path, change) => update('meta', path, (m) => ({ ...(m ?? emptyMeta(path)), ...change(m ?? emptyMeta(path)) }));

/** Keeps the data on the phone even when storage runs low (iOS may still clear it: hence the backup reminder). */
export async function persist() {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { return false; }
}
