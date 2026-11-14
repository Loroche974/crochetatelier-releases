// Analyses imported PDFs once: text of every page (Recherche) and a cover thumbnail (Bibliothèque, Accueil).
import * as db from './db.js';
import { openPdf } from './pdf.js';
import { normalize } from './logic/search.js';

const THUMB_WIDTH = 300;
let running = null;

/** PDFs still to analyse, then analyses them one by one. Single run at a time; fires 'pdf-indexed' on window. */
export function indexPending() {
  running ??= run().finally(() => { running = null; });
  return running;
}
export const indexing = () => running != null;

export async function progress() {
  const [files, done] = await Promise.all([db.all('files'), db.all('indexed')]);
  return { done: done.length, total: files.filter((f) => f.type === 'PDF').length };
}

async function run() {
  const [files, done] = await Promise.all([db.all('files'), db.all('indexed')]);
  const seen = new Set(done.map((d) => d.path));
  for (const f of files.filter((x) => x.type === 'PDF' && !seen.has(x.path))) {
    const blob = await db.get('blobs', f.path);
    if (!blob) continue;
    let pages = [], thumb = null;
    try {
      const pdf = await openPdf(blob);
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim());
          if (i === 1) thumb = await cover(page);
          page.cleanup();
        }
      } finally { pdf.destroy(); }
    } catch (e) {
      console.warn('PDF illisible', f.path, e);
      pages = []; // marked as analysed anyway: no endless retries on a broken file
    }
    // The file may have been deleted meanwhile: then nothing is written.
    if (!(await db.get('files', f.path))) continue;
    await db.tx(['pdfText', 'indexed', 'thumbs'], 'readwrite', (s) => {
      pages.forEach((text, page) => { if (text) s.pdfText.put({ path: f.path, page, text, search: normalize(text) }); });
      s.indexed.put({ path: f.path, pages: pages.filter(Boolean).length });
      if (thumb) s.thumbs.put(thumb, f.path);
    });
    dispatchEvent(new CustomEvent('pdf-indexed', { detail: f.path }));
  }
}

async function cover(page) {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}
