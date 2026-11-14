// Recherche: name, notes, tags and the text of the PDFs, accents ignored; filters type / difficulty / tag; history.
import * as repo from '../repo.js';
import { link } from '../app.js';
import { h, iconButton, empty } from '../ui.js';
import { terms, normalize, snippet } from '../logic/search.js';
import { TYPE_LABELS, title } from '../logic/files.js';
import { fileItem, fileThumb } from './library.js';
import { indexing, progress } from '../indexer.js';

const MAX_PAGES = 50;
let state = { query: '', type: null, difficulty: 0, tag: null }; // kept while the app is open

export default async function search(root) {
  const [files, tagsBy] = await Promise.all([repo.filesWithMeta(), repo.tagsByPath()]);
  const byPath = new Map(files.map((f) => [f.path, f]));
  let pages = await repo.pdfPages();
  const allTags = [...new Set([...tagsBy.values()].flat())].sort((a, b) => a.localeCompare(b, 'fr'));
  const types = [...new Set(files.map((f) => f.type))];

  const input = h('input', { type: 'search', placeholder: 'Nom, texte du PDF, note, étiquette…', value: state.query, 'aria-label': 'Rechercher', enterkeyhint: 'search', autocomplete: 'off' });
  const filters = h('div');
  const results = h('div');

  const chip = (label, on, onclick) => h('button', { class: `chip${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick }, label);
  const drawFilters = () => filters.replaceChildren(
    h('div', { class: 'chips', style: { margin: '10px 0' } },
      types.map((t) => chip(TYPE_LABELS[t], state.type === t, () => { state.type = state.type === t ? null : t; update(); })),
      [1, 2, 3, 4, 5].map((n) => chip('★'.repeat(n), state.difficulty === n, () => { state.difficulty = state.difficulty === n ? 0 : n; update(); }))),
    allTags.length ? h('div', { class: 'chips', style: { marginBottom: '10px' } },
      allTags.map((t) => chip(`# ${t}`, state.tag === t, () => { state.tag = state.tag === t ? null : t; update(); }))) : '',
  );

  const update = async () => {
    state.query = input.value;
    drawFilters();
    const q = terms(state.query);
    const filtered = !!(state.type || state.difficulty || state.tag);
    if (!q.length && !filtered) {
      const hist = await repo.history();
      results.replaceChildren(hist.length ? h('div', null, h('h2', null, 'Recherches récentes'), h('div', { class: 'list' }, hist.map((x) =>
        h('div', { class: 'item' },
          h('button', { class: 'btn text grow', style: { justifyContent: 'flex-start' }, onclick: () => { input.value = x.query; update(); } }, x.query),
          iconButton('close', `Oublier « ${x.query} »`, async () => { await repo.forgetSearch(x.query); update(); })))))
        : empty(files.length ? 'Tape un mot : le nom du tuto, un mot du PDF, de ta note ou une étiquette.' : 'Ajoute d\'abord des tutos dans la Bibliothèque.'));
      return;
    }
    const passes = (f) => {
      const tags = tagsBy.get(f.path) ?? [];
      return (!state.type || f.type === state.type) && (!state.difficulty || f.meta.difficulty === state.difficulty) && (!state.tag || tags.includes(state.tag));
    };
    const hits = files.filter((f) => passes(f)
      && q.every((w) => normalize(`${f.name} ${f.meta.note} ${(tagsBy.get(f.path) ?? []).join(' ')}`).includes(w)));
    const pageHits = q.length
      ? pages.filter((p) => byPath.has(p.path) && passes(byPath.get(p.path)) && q.every((w) => p.search.includes(w)))
        .sort((a, b) => a.path.localeCompare(b.path, 'fr') || a.page - b.page)
      : [];
    const why = (f) => {
      const inName = q.every((w) => normalize(f.name).includes(w));
      const tags = tagsBy.get(f.path) ?? [];
      return [TYPE_LABELS[f.type], f.meta.difficulty ? '★'.repeat(f.meta.difficulty) : null, tags.length ? tags.map((t) => `#${t}`).join(' ') : null,
        q.length && !inName && normalize(f.meta.note).includes(q[0]) ? 'dans la note' : null].filter(Boolean).join(' · ');
    };
    const pageItem = (p) => {
      const f = byPath.get(p.path);
      const s = snippet(p.text, q);
      return h('a', { class: 'item', href: link('lire', p.path, p.page), onclick: () => repo.remember(state.query) }, fileThumb(f),
        h('div', { class: 'grow' }, h('div', { class: 'title' }, `${title(f.name)} · page ${p.page + 1}`),
          s && h('div', { class: 'sub' }, s.before, h('mark', null, s.match), s.after)));
    };
    const { done, total } = await progress();
    const status = indexing() && done < total ? `Analyse des PDF en cours (${done} / ${total})…` : null;
    const pageCount = pageHits.length > MAX_PAGES ? `${MAX_PAGES}+` : pageHits.length;
    results.replaceChildren(
      hits.length || pageHits.length ? h('div', null,
        h('p', { class: 'muted small', role: 'status' }, `${hits.length} tuto${hits.length > 1 ? 's' : ''} · ${pageCount} page${pageHits.length > 1 ? 's' : ''} de PDF`),
        hits.length ? h('div', { class: 'list' }, hits.map((f) => {
          const item = fileItem(f, why(f));
          item.addEventListener('click', () => repo.remember(state.query));
          return item;
        })) : '',
        pageHits.length ? h('h2', { style: { marginTop: '16px' } }, 'Dans le texte des PDF') : '',
        pageHits.length ? h('div', { class: 'list' }, pageHits.slice(0, MAX_PAGES).map(pageItem)) : '')
        : empty('Aucun résultat.'),
      status ? h('p', { class: 'muted small' }, status) : '');
  };

  // PDFs analysed while the screen is open are searched too.
  const onIndexed = async () => { pages = await repo.pdfPages(); if (terms(input.value).length) update(); };
  addEventListener('pdf-indexed', onIndexed);
  input.addEventListener('input', update);
  input.addEventListener('change', () => repo.remember(input.value));
  root.append(h('div', { class: 'top' }, h('h1', null, 'Recherche')), input, filters, results);
  await update();
  if (!state.query) input.focus();
  return () => removeEventListener('pdf-indexed', onIndexed);
}
