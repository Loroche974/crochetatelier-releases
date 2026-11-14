// Data operations of the app (port of the Android repositories), on top of db.js.
import * as db from './db.js';
import { indexPending } from './indexer.js';
import { typeOf, child, uniqueName, inside, title as titleOf } from './logic/files.js';
import { elapsed, nextCount, reached, moveRuler, clampRulerHeight } from './logic/workshop.js';
import { readZip, writeZip, photoExt, photoMime, APP, MAX_TAG, MAX_TITLE, BackupError } from './logic/backup.js';

const byName = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });

// ---------- Library ----------

export async function children(parent) {
  const list = await db.byIndex('files', 'parent', parent);
  return list.sort((a, b) => (b.type === 'FOLDER') - (a.type === 'FOLDER') || byName(a.name, b.name));
}
export const file = (path) => db.get('files', path);
export const fileBlob = (path) => db.get('blobs', path);
export const allFiles = async () => (await db.all('files')).filter((f) => f.type !== 'FOLDER');

/** Copies the chosen files into [folder]. Returns the paths added. */
export async function importFiles(folder, files) {
  const taken = new Set((await db.byIndex('files', 'parent', folder)).map((f) => f.name));
  const added = [];
  for (const f of files) {
    const name = uniqueName(f.name, taken);
    taken.add(name);
    const path = child(folder, name);
    // Copied into a plain Blob: a File from the picker may stop being readable later on iOS.
    const blob = new Blob([await f.arrayBuffer()], { type: f.type });
    await db.tx(['files', 'blobs'], 'readwrite', (s) => {
      s.files.put({ path, parent: folder, name, type: typeOf(name), size: f.size, addedAt: Date.now() });
      s.blobs.put(blob, path);
    });
    added.push(path);
  }
  if (added.some((p) => typeOf(p) === 'PDF')) indexPending(); // text for Recherche, cover thumbnail
  return added;
}

export async function createFolder(parent, name) {
  const taken = new Set((await db.byIndex('files', 'parent', parent)).map((f) => f.name));
  const clean = uniqueName(name, taken);
  await db.put('files', { path: child(parent, clean), parent, name: clean, type: 'FOLDER', size: 0, addedAt: Date.now() });
}

/** Deletes a file, or a folder and everything in it, with its text and thumbnail. Notes stay (keyed by path), as on Android. */
export async function deleteEntry(path) {
  const doomed = (await db.all('files')).filter((f) => inside(f.path, path)).map((f) => f.path);
  await db.tx(['files', 'blobs', 'pdfText', 'indexed', 'thumbs'], 'readwrite', (s) => doomed.forEach((p) => {
    s.files.delete(p); s.blobs.delete(p); s.indexed.delete(p); s.thumbs.delete(p);
    s.pdfText.index('path').getAllKeys(p).onsuccess = (e) => e.target.result.forEach((k) => s.pdfText.delete(k));
  }));
}
export const thumb = (path) => db.get('thumbs', path);
/** Every analysed PDF page: { path, page, text, search }. */
export const pdfPages = () => db.all('pdfText');

export const viewMode = async (folder) => (await db.get('folderPrefs', folder))?.viewMode ?? 'LIST';
export const setViewMode = (folder, mode) => db.put('folderPrefs', { path: folder, viewMode: mode });

// ---------- Tutorial data ----------

export const meta = db.meta;
export const markOpened = (path) => db.editMeta(path, () => ({ lastOpenedAt: Date.now() }));
export const forgetOpened = (path) => db.editMeta(path, () => ({ lastOpenedAt: 0 }));
export const setPage = (path, page, count) => db.editMeta(path, () => ({ lastPage: page, pageCount: count }));
export const setPosition = (path, ms) => db.editMeta(path, () => ({ lastPositionMs: Math.max(0, Math.round(ms)) }));
export const toggleFavorite = (path) => db.editMeta(path, (m) => ({ favorite: !m.favorite }));
export const setNote = (path, note) => db.editMeta(path, () => ({ note }));
export const setDifficulty = (path, stars) => db.editMeta(path, () => ({ difficulty: Math.min(Math.max(stars, 0), 5) }));

export const tags = async (path) => (await db.byIndex('tags', 'path', path)).map((t) => t.name).sort(byName);
/** path → tag names. */
export async function tagsByPath() {
  return (await db.all('tags')).reduce((m, t) => m.set(t.path, [...(m.get(t.path) ?? []), t.name]), new Map());
}
export async function addTag(path, name) {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG);
  if (clean) await db.put('tags', { path, name: clean });
}
export const removeTag = (path, name) => db.del('tags', [path, name]);

/** Annotations of a tutorial: [{ page, inks }]. */
export const inks = (path) => db.byIndex('inks', 'path', path);
export const saveInks = (path, page, list) => (list.length ? db.put('inks', { path, page, inks: list }) : db.del('inks', [path, page]));

export const bookmarks = async (path) => (await db.byIndex('bookmarks', 'path', path)).sort((a, b) => a.page - b.page);
export const addBookmark = (path, page, t) =>
  db.put('bookmarks', { path, page, title: (t.trim() || `Page ${page + 1}`).slice(0, MAX_TITLE), createdAt: Date.now() });
export const removeBookmark = (path, page) => db.del('bookmarks', [path, page]);

/** Files with their meta, for Home and Search. */
export async function filesWithMeta() {
  const [files, metas] = await Promise.all([allFiles(), db.all('meta')]);
  const m = new Map(metas.map((x) => [x.path, x]));
  return files.map((f) => ({ ...f, meta: m.get(f.path) ?? db.emptyMeta(f.path) }));
}

// ---------- Search history ----------

export const history = async () => (await db.all('searchHistory')).sort((a, b) => b.at - a.at).slice(0, 10);
export async function remember(query) {
  const q = query.trim();
  if (!q) return;
  await db.put('searchHistory', { query: q, at: Date.now() });
  const old = (await db.all('searchHistory')).sort((a, b) => b.at - a.at).slice(10);
  await Promise.all(old.map((o) => db.del('searchHistory', o.query)));
}
export const forgetSearch = (q) => db.del('searchHistory', q);

// ---------- Atelier ----------

const byPosition = (a, b) => a.position - b.position || a.id - b.id;

export async function projects() {
  const [list, counters] = await Promise.all([db.all('projects'), db.all('counters')]);
  const rows = new Map();
  counters.sort(byPosition).forEach((c) => { if (!rows.has(c.projectId)) rows.set(c.projectId, c); });
  return list.map((p) => ({ ...p, rowCounter: rows.get(p.id) ?? null }))
    .sort((a, b) => (a.status === 'DONE') - (b.status === 'DONE') || b.updatedAt - a.updatedAt);
}
export const project = (id) => db.get('projects', id);
/** Project of a tutorial: in progress first, then the latest. */
export async function projectFor(path) {
  return (await db.all('projects')).filter((p) => p.tutorialPath === path)
    .sort((a, b) => (b.status === 'IN_PROGRESS') - (a.status === 'IN_PROGRESS') || b.updatedAt - a.updatedAt)[0] ?? null;
}

export async function createProject(name, tutorialPath = null) {
  const now = Date.now();
  const clean = name.trim() || (tutorialPath ? titleOf(tutorialPath.split('/').pop()) : 'Nouveau projet');
  return db.tx(['projects', 'counters'], 'readwrite', (s) => {
    const req = s.projects.add({
      name: clean.slice(0, 80), tutorialPath, tutorialSource: tutorialPath ? 'LOCAL' : null, status: 'IN_PROGRESS',
      hook: '', notes: '', timeMs: 0, timerStartedAt: null, rulerY: 0.1, rulerHeight: 0.04, createdAt: now, updatedAt: now,
    });
    req.onsuccess = () => s.counters.add({ projectId: req.result, name: 'Rangs', value: 0, target: 0, position: 0 });
    return req;
  });
}

/** Changes a project and its "updated" date. */
export const editProject = (id, change) => db.update('projects', id, (p) => p && { ...p, ...change(p), updatedAt: Date.now() });

const stopped = (p) => (p.timerStartedAt == null ? {} : { timeMs: elapsed(p.timeMs, p.timerStartedAt, Date.now()), timerStartedAt: null });
/** Finishing a project also stops its timer. */
export const setStatus = (id, status) => editProject(id, (p) => ({ ...(status === 'DONE' ? stopped(p) : {}), status }));
export const toggleTimer = (id) => editProject(id, (p) => (p.timerStartedAt == null ? { timerStartedAt: Date.now() } : stopped(p)));
export const moveProjectRuler = (id, y, height) => editProject(id, () => {
  const h = clampRulerHeight(height);
  return { rulerY: Math.min(Math.max(y, 0), 1 - h), rulerHeight: h };
});

export async function deleteProject(id) {
  const [counters, photos, links] = await Promise.all([db.byIndex('counters', 'projectId', id), db.byIndex('photos', 'projectId', id), db.byIndex('projectYarns', 'projectId', id)]);
  await db.tx(['projects', 'counters', 'photos', 'projectYarns'], 'readwrite', (s) => {
    s.projects.delete(id);
    counters.forEach((c) => s.counters.delete(c.id));
    photos.forEach((p) => s.photos.delete(p.id));
    links.forEach((l) => s.projectYarns.delete([l.projectId, l.yarnId]));
  });
}

export const counters = async (projectId) => (await db.byIndex('counters', 'projectId', projectId)).sort(byPosition);
export async function addCounter(projectId, name, target) {
  const position = Math.max(-1, ...(await counters(projectId)).map((c) => c.position)) + 1;
  await db.put('counters', { projectId, name: name.trim().slice(0, 40) || 'Compteur', value: 0, target: Math.max(0, target || 0), position });
}
export const saveCounter = (c) => db.put('counters', { ...c, name: c.name.trim().slice(0, 40) || 'Compteur', target: Math.max(0, c.target || 0) });
export const deleteCounter = (id) => db.del('counters', id);

/** +1 / −1 (or an undo). The row counter (first one) also moves the reading ruler by one band. */
export async function count(counterId, delta) {
  const c = await db.get('counters', counterId);
  if (!c) return null;
  const after = nextCount(c.value, delta);
  if (after === c.value) return { before: c.value, after, reached: false };
  await db.put('counters', { ...c, value: after });
  const isRow = (await counters(c.projectId))[0]?.id === c.id;
  await editProject(c.projectId, (p) => (isRow ? { rulerY: moveRuler(p.rulerY, p.rulerHeight, after - c.value) } : {}));
  return { before: c.value, after, reached: reached(c.value, after, c.target), name: c.name };
}

export const photos = async (projectId) => (await db.byIndex('photos', 'projectId', projectId)).sort((a, b) => b.takenAt - a.takenAt);
export async function addPhotos(projectId, files) {
  for (const f of files) await db.put('photos', { projectId, blob: new Blob([await f.arrayBuffer()], { type: f.type || 'image/jpeg' }), takenAt: Date.now() });
  await editProject(projectId, () => ({}));
}
export const deletePhoto = (id) => db.del('photos', id);

const byBrand = (a, b) => byName(a.brand, b.brand) || byName(a.color, b.color);
export const yarns = async () => (await db.all('yarns')).sort(byBrand);
export const yarn = (id) => db.get('yarns', id);
export const saveYarn = (y) => db.put('yarns', y);
export async function deleteYarn(id) {
  const links = await db.byIndex('projectYarns', 'yarnId', id);
  await db.tx(['yarns', 'projectYarns'], 'readwrite', (s) => { s.yarns.delete(id); links.forEach((l) => s.projectYarns.delete([l.projectId, l.yarnId])); });
}
export async function yarnsOf(projectId) {
  const ids = (await db.byIndex('projectYarns', 'projectId', projectId)).map((l) => l.yarnId);
  return (await Promise.all(ids.map(yarn))).filter(Boolean).sort(byBrand);
}
export async function projectsUsing(yarnId) {
  const ids = (await db.byIndex('projectYarns', 'yarnId', yarnId)).map((l) => l.projectId);
  return (await Promise.all(ids.map(project))).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const link = (projectId, yarnId) => db.put('projectYarns', { projectId, yarnId });
export const unlink = (projectId, yarnId) => db.del('projectYarns', [projectId, yarnId]);

/** Nothing read, added or started: shows the "Bienvenue" card. */
export async function newcomer() {
  const [metas, files, projs] = await Promise.all([db.all('meta'), db.all('files'), db.all('projects')]);
  return !metas.some((m) => m.lastOpenedAt > 0) && files.length === 0 && projs.length === 0;
}

// ---------- Backup (.zip, same format as the Android app) ----------

/** { blob, name, summary } of a full backup. */
export async function exportBackup() {
  const [metas, tagList, marks, inks, projs, counterList, photoList, yarnList, links] = await Promise.all(
    ['meta', 'tags', 'bookmarks', 'inks', 'projects', 'counters', 'photos', 'yarns', 'projectYarns'].map(db.all));
  const group = (list) => list.reduce((m, x) => m.set(x.path, [...(m.get(x.path) ?? []), x]), new Map());
  const metaBy = new Map(metas.map((m) => [m.path, m]));
  const tagsBy = group(tagList), marksBy = group(marks), inksBy = group(inks);
  const paths = [...new Set([...metaBy.keys(), ...tagsBy.keys(), ...marksBy.keys(), ...inksBy.keys()])].sort();
  const items = paths.map((path) => {
    const m = metaBy.get(path) ?? db.emptyMeta(path);
    return {
      path, favorite: m.favorite, lastPage: m.lastPage, pageCount: m.pageCount, lastPositionMs: m.lastPositionMs,
      lastOpenedAt: m.lastOpenedAt, note: m.note, difficulty: m.difficulty,
      tags: (tagsBy.get(path) ?? []).map((t) => t.name).sort(),
      bookmarks: (marksBy.get(path) ?? []).sort((a, b) => a.page - b.page).map((b) => ({ page: b.page, title: b.title })),
      annotations: (inksBy.get(path) ?? []).sort((a, b) => a.page - b.page).map((p) => ({ page: p.page, inks: p.inks })),
    };
  });
  const files = new Map();
  const keep = async (blob) => {
    if (!blob) return null;
    const name = `photo-${files.size + 1}.${photoExt(blob.type)}`;
    files.set(name, new Uint8Array(await blob.arrayBuffer()));
    return name;
  };
  const now = Date.now();
  const sortedYarns = yarnList.sort(byBrand);
  const yarnIndex = new Map(sortedYarns.map((y, i) => [y.id, i]));
  const yarnsOut = [];
  for (const y of sortedYarns) {
    yarnsOut.push({ brand: y.brand, color: y.color, material: y.material, weight: y.weight, metersPerBall: y.metersPerBall, quantity: y.quantity, photo: await keep(y.photo), notes: y.notes });
  }
  const projectsOut = [];
  for (const p of projs) {
    const ph = [];
    for (const x of photoList.filter((x) => x.projectId === p.id).sort((a, b) => a.takenAt - b.takenAt)) ph.push({ file: await keep(x.blob), takenAt: x.takenAt });
    projectsOut.push({
      name: p.name, tutorialPath: p.tutorialPath, tutorialSource: p.tutorialSource, status: p.status, hook: p.hook, notes: p.notes,
      timeMs: Math.round(elapsed(p.timeMs, p.timerStartedAt, now)), rulerY: p.rulerY, rulerHeight: p.rulerHeight,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
      counters: counterList.filter((c) => c.projectId === p.id).sort(byPosition).map((c) => ({ name: c.name, value: c.value, target: c.target, position: c.position })),
      photos: ph,
      yarns: links.filter((l) => l.projectId === p.id).map((l) => yarnIndex.get(l.yarnId)).filter((i) => i != null),
    });
  }
  const backup = { app: APP, version: 2, exportedAt: now, items, workshop: { projects: projectsOut, yarns: yarnsOut } };
  const zip = writeZip(backup, files);
  const day = new Date(now).toISOString().slice(0, 10);
  await db.setSetting('lastBackupAt', now);
  return { blob: new Blob([zip], { type: 'application/zip' }), name: `mon-carnet-crochet-${day}.zip`, summary: { tutorials: items.length, projects: projectsOut.length, yarns: yarnsOut.length } };
}

/**
 * Restores a backup: the tutorials it contains get their data back, the others are untouched.
 * A version 2 backup also replaces all projects and yarns. All in one transaction: nothing changes on failure.
 */
export async function importBackup(fileObj) {
  const { backup, photos: pics } = readZip(new Uint8Array(await fileObj.arrayBuffer()));
  const photo = (name) => (name && pics.has(name) ? new Blob([pics.get(name)], { type: photoMime(name) }) : null);
  const items = backup.items;
  const shop = backup.workshop;
  const itemPaths = new Set(items.map((i) => i.path));
  const [oldTags, oldMarks, oldInks] = await Promise.all(['tags', 'bookmarks', 'inks'].map(db.all));
  const stores = ['meta', 'tags', 'bookmarks', 'inks', ...(shop ? ['projects', 'counters', 'photos', 'yarns', 'projectYarns'] : [])];
  try {
    await db.tx(stores, 'readwrite', (s) => {
      oldTags.filter((t) => itemPaths.has(t.path)).forEach((t) => s.tags.delete([t.path, t.name]));
      oldMarks.filter((b) => itemPaths.has(b.path)).forEach((b) => s.bookmarks.delete([b.path, b.page]));
      oldInks.filter((p) => itemPaths.has(p.path)).forEach((p) => s.inks.delete([p.path, p.page]));
      for (const it of items) {
        s.meta.put({ path: it.path, favorite: it.favorite, lastPage: it.lastPage, pageCount: it.pageCount, lastPositionMs: it.lastPositionMs, lastOpenedAt: it.lastOpenedAt, note: it.note, difficulty: it.difficulty });
        it.tags.forEach((name) => s.tags.put({ path: it.path, name }));
        it.bookmarks.forEach((b) => s.bookmarks.put({ path: it.path, page: b.page, title: b.title, createdAt: backup.exportedAt }));
        it.annotations.forEach((p) => s.inks.put({ path: it.path, page: p.page, inks: p.inks }));
      }
      if (!shop) return;
      ['projects', 'counters', 'photos', 'yarns', 'projectYarns'].forEach((n) => s[n].clear());
      // Ids come back asynchronously: chain the inserts through the request callbacks.
      const yarnIds = [];
      const addProjects = () => shop.projects.forEach((p) => {
        const { counters: cs, photos: ps, yarns: ys, ...fields } = p;
        const req = s.projects.add({ ...fields, timerStartedAt: null });
        req.onsuccess = () => {
          const id = req.result;
          cs.forEach((c) => s.counters.add({ ...c, projectId: id }));
          ps.forEach((ph) => { const blob = photo(ph.file); if (blob) s.photos.add({ projectId: id, blob, takenAt: ph.takenAt }); });
          [...new Set(ys.map((i) => yarnIds[i]).filter((y) => y != null))].forEach((yarnId) => s.projectYarns.put({ projectId: id, yarnId }));
        };
      });
      if (!shop.yarns.length) return addProjects();
      shop.yarns.forEach((y, i) => {
        const req = s.yarns.add({ ...y, photo: photo(y.photo) });
        req.onsuccess = () => { yarnIds[i] = req.result; if (i === shop.yarns.length - 1) addProjects(); };
      });
    });
  } catch (e) {
    throw new BackupError(`La restauration a échoué : rien n'a été modifié. (${e?.message ?? e})`);
  }
  return { tutorials: items.length, projects: shop ? shop.projects.length : null, yarns: shop ? shop.yarns.length : null };
}
