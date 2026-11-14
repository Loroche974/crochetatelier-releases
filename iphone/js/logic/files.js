// Port of domain/Files.kt. Paths are relative, '/'-separated, root = "".

const BY_EXTENSION = {
  pdf: 'PDF',
  jpg: 'IMAGE', jpeg: 'IMAGE', png: 'IMAGE', webp: 'IMAGE', heic: 'IMAGE', gif: 'IMAGE',
  mp4: 'VIDEO', mov: 'VIDEO', m4v: 'VIDEO', // .mov: videos filmed on iPhone
  txt: 'TEXT',
  md: 'MARKDOWN', markdown: 'MARKDOWN',
  url: 'LINK', webloc: 'LINK',
};
export const TYPE_LABELS = { FOLDER: 'Dossier', PDF: 'PDF', IMAGE: 'Image', VIDEO: 'Vidéo', TEXT: 'Texte', MARKDOWN: 'Markdown', LINK: 'Lien web', OTHER: 'Fichier' };
export const VIEW_MODES = [['GRID', 'Grille'], ['LIST', 'Liste'], ['CARDS', 'Cartes'], ['COMPACT', 'Compact']];

export const typeOf = (name) => BY_EXTENSION[name.includes('.') ? name.split('.').pop().toLowerCase() : ''] ?? 'OTHER';
export const parentOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
export const child = (parent, name) => (parent ? `${parent}/${name}` : name);
export const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);
/** "Lapin.pdf" → "Lapin" */
export const title = (name) => (name.lastIndexOf('.') > 0 ? name.slice(0, name.lastIndexOf('.')) : name);
/** True when [path] is [folder] itself or inside it. */
export const inside = (path, folder) => path === folder || path.startsWith(`${folder}/`);

/** "a/b" -> [["", rootLabel], ["a", "a"], ["a/b", "b"]] */
export function breadcrumb(path, rootLabel) {
  const crumbs = [['', rootLabel]];
  let acc = '';
  if (path) for (const part of path.split('/')) { acc = child(acc, part); crumbs.push([acc, part]); }
  return crumbs;
}

/** A name not in [taken]: "Lapin.pdf", then "Lapin (2).pdf"… Slashes are replaced (they separate folders). */
export function uniqueName(name, taken) {
  const clean = name.replace(/[/\\]/g, '-').trim() || 'Sans nom';
  if (!taken.has(clean)) return clean;
  const dot = clean.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [clean.slice(0, dot), clean.slice(dot)] : [clean, ''];
  for (let i = 2; ; i++) if (!taken.has(`${stem} (${i})${ext}`)) return `${stem} (${i})${ext}`;
}

/** Target of a macOS .webloc file (XML plist with <string>URL</string>), or null. */
export function urlFromWebloc(text) {
  return /<key>URL<\/key>\s*<string>([^<]+)<\/string>/.exec(text)?.[1].trim() ?? null;
}
