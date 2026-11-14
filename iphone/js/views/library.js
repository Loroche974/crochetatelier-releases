// Bibliothèque: tutorials imported into the phone (IndexedDB), in virtual folders.
import * as repo from '../repo.js';
import { link, go, refresh } from '../app.js';
import { h, icon, iconButton, toast, promptDialog, confirmDialog, pickFiles, blobUrl, segmented, empty } from '../ui.js';
import { breadcrumb, TYPE_LABELS, VIEW_MODES, title } from '../logic/files.js';

const TYPE_ICON = { FOLDER: 'folder', PDF: 'pdf', IMAGE: 'image', VIDEO: 'video', TEXT: 'text', MARKDOWN: 'text', LINK: 'link', OTHER: 'file' };
const ACCEPT = '.pdf,application/pdf,image/*,video/mp4,video/quicktime,.mov,.m4v,.txt,text/plain,.md,.markdown,.url,.webloc';

/** Preview of a file: the picture for images, the cover for analysed PDFs, an icon otherwise. */
export function fileThumb(f) {
  const box = h('div', { class: 'thumb' });
  if (f.type === 'IMAGE' || f.type === 'PDF') {
    (f.type === 'PDF' ? repo.thumb(f.path) : repo.fileBlob(f.path))
      .then((b) => { if (b) box.replaceChildren(h('img', { src: blobUrl(b), alt: '', loading: 'lazy' })); });
  }
  box.append(icon(TYPE_ICON[f.type] ?? 'file'));
  return box;
}

export const openHref = (f) => (f.type === 'FOLDER' ? link('bibliotheque', f.path) : link('lire', f.path));

export function fileTile(f, sub) {
  return h('a', { class: 'tile', href: openHref(f) }, fileThumb(f), h('div', { class: 'title' }, title(f.name)), sub && h('div', { class: 'sub' }, sub));
}

export function fileItem(f, sub, extra) {
  return h('a', { class: 'item', href: openHref(f) }, fileThumb(f),
    h('div', { class: 'grow' }, h('div', { class: 'title' }, f.type === 'FOLDER' ? f.name : title(f.name)), sub && h('div', { class: 'sub' }, sub)),
    extra);
}

export default async function library(root, [folder = '']) {
  const [list, mode] = await Promise.all([repo.children(folder), repo.viewMode(folder)]);
  const crumbs = breadcrumb(folder, 'Mes tutos');

  const add = async () => {
    const files = await pickFiles({ accept: ACCEPT, multiple: true });
    if (!files.length) return;
    toast(`Import de ${files.length} fichier${files.length > 1 ? 's' : ''}…`);
    try {
      const added = await repo.importFiles(folder, files);
      toast(`${added.length} tuto${added.length > 1 ? 's' : ''} ajouté${added.length > 1 ? 's' : ''}.`);
    } catch (e) {
      toast(`L'import a échoué (stockage plein ?) : ${e.message}`);
    }
    refresh();
  };
  const newFolder = async () => {
    const name = await promptDialog('Nouveau dossier', 'Nom du dossier', '', 'Créer');
    if (name) { await repo.createFolder(folder, name); refresh(); }
  };
  const remove = async (f, e) => {
    e.preventDefault();
    const what = f.type === 'FOLDER' ? `le dossier « ${f.name} » et tout ce qu'il contient` : `« ${f.name} »`;
    if (await confirmDialog('Supprimer ?', `Supprimer ${what} de l'appli ? Les notes, marque-pages et projets sont gardés.`, 'Supprimer', true)) {
      await repo.deleteEntry(f.path);
      refresh();
    }
  };

  const sub = (f) => (f.type === 'FOLDER' ? 'Dossier' : `${TYPE_LABELS[f.type]} · ${(f.size / 1048576).toFixed(1).replace('.', ',')} Mo`);
  const body = mode === 'GRID'
    ? h('div', { class: 'files GRID' }, list.map((f) => fileTile(f, sub(f))))
    : h('div', { class: `files ${mode} list` }, list.map((f) => fileItem(f, mode === 'COMPACT' ? null : sub(f),
      iconButton('trash', `Supprimer ${f.name}`, (e) => remove(f, e)))));

  root.append(
    h('div', { class: 'top' },
      folder ? iconButton('back', 'Dossier parent', () => go('bibliotheque', crumbs.at(-2)[0])) : null,
      h('h1', null, crumbs.at(-1)[1])),
    folder ? h('nav', { class: 'crumbs', 'aria-label': 'Chemin' }, crumbs.map(([p, n], i) =>
      [i ? '›' : '', h('a', { href: link('bibliotheque', p), 'aria-current': p === folder ? 'page' : null }, n)])) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn filled', onclick: add }, icon('upload', 20), 'Ajouter des tutos'),
      h('button', { class: 'btn tonal', onclick: newFolder }, icon('folder', 20), 'Dossier')),
    h('div', { style: { margin: '12px 0' } },
      segmented('Affichage', VIEW_MODES, mode, async (m) => { await repo.setViewMode(folder, m); refresh(); })),
    list.length ? body : empty(folder ? 'Ce dossier est vide.' : 'Aucun tuto pour l\'instant. Touche « Ajouter des tutos » pour en importer depuis Fichiers ou iCloud Drive (PDF, images, vidéos, textes).'),
  );
  return showNewCovers();
}

/** Re-renders when a PDF of the screen gets its cover (analysis runs in the background). Returns the cleanup. */
export function showNewCovers() {
  const on = () => refresh();
  addEventListener('pdf-indexed', on);
  return () => removeEventListener('pdf-indexed', on);
}
