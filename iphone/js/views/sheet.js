// Fiche du tuto: favori, difficulté, étiquettes, marque-pages, note Markdown, projet lié.
import * as repo from '../repo.js';
import { go } from '../app.js';
import { h, icon, iconButton, sheet, promptDialog, section } from '../ui.js';
import { toHtml, bold, linePrefix, toggleCheck } from '../logic/markdown.js';
import { title } from '../logic/files.js';
import { STATUS } from '../logic/workshop.js';

/** [page] = current page (0-based) or null; [goToPage](n) jumps there. Resolves when closed. */
export function tutorialSheet(f, { page = null, goToPage = null } = {}) {
  return sheet(title(f.name), (close) => {
    const body = h('div');
    const draw = async () => {
      const [m, tags, marks, project] = await Promise.all([repo.meta(f.path), repo.tags(f.path), repo.bookmarks(f.path), repo.projectFor(f.path)]);
      body.replaceChildren(
        h('div', { class: 'row' },
          h('button', { class: `btn ${m.favorite ? 'filled' : 'outline'}`, 'aria-pressed': String(m.favorite), onclick: async () => { await repo.toggleFavorite(f.path); draw(); } },
            icon('heart', 20), m.favorite ? 'Favori' : 'Ajouter aux favoris')),

        section('Difficulté', h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Difficulté' }, [1, 2, 3, 4, 5].map((n) =>
          h('button', {
            class: n <= m.difficulty ? 'on' : '', role: 'radio', 'aria-checked': String(n === m.difficulty), 'aria-label': `${n} sur 5`,
            onclick: async () => { await repo.setDifficulty(f.path, n === m.difficulty ? 0 : n); draw(); },
          }, icon('star', 30))))),

        section('Étiquettes', h('div', { class: 'chips' },
          tags.map((t) => h('button', { class: 'chip on', 'aria-label': `Retirer l'étiquette ${t}`, onclick: async () => { await repo.removeTag(f.path, t); draw(); } }, `# ${t}`, icon('close', 16))),
          h('button', { class: 'chip', onclick: async () => { const t = await promptDialog('Nouvelle étiquette', 'Étiquette (ex. amigurumi, bébé)', '', 'Ajouter'); if (t) { await repo.addTag(f.path, t); } draw(); } }, icon('plus', 16), 'Étiquette'))),

        section('Marque-pages',
          marks.length ? h('div', { class: 'list' }, marks.map((b) => h('div', { class: 'item' },
            h('button', { class: 'btn text grow', style: { justifyContent: 'flex-start' }, disabled: !goToPage, onclick: () => { goToPage(b.page); close(); } },
              icon('bookmark', 20), `${b.title}`, h('span', { class: 'muted small' }, ` · p. ${b.page + 1}`)),
            iconButton('trash', `Supprimer le marque-page ${b.title}`, async () => { await repo.removeBookmark(f.path, b.page); draw(); }))))
            : h('p', { class: 'muted' }, 'Aucun marque-page.'),
          page != null && h('button', { class: 'btn tonal', onclick: async () => {
            const t = await promptDialog(`Marque-page, page ${page + 1}`, 'Titre (facultatif)', '', 'Ajouter');
            if (t !== undefined) { await repo.addBookmark(f.path, page, t); } draw();
          } }, icon('plus', 20), `Marquer la page ${page + 1}`)),

        section('Note', noteEditor(m.note, (note) => repo.setNote(f.path, note))),

        section('Projet',
          project
            ? h('button', { class: 'btn tonal', onclick: () => { close(); go('projet', project.id); } }, icon('workshop', 20), `${project.name} · ${STATUS[project.status]}`)
            : h('button', { class: 'btn filled', onclick: async () => { await repo.createProject('', f.path); close('project'); } }, icon('plus', 20), 'Démarrer un projet avec ce tuto'),
          !project && h('p', { class: 'muted small' }, 'Le compteur de rangs et la règle de lecture s\'affichent alors par-dessus le tuto.')),
      );
    };
    draw();
    return body;
  });
}

/** Markdown note: toolbar (gras, liste, case à cocher) + preview where boxes can be ticked. Saves as you type. */
export function noteEditor(initial, save) {
  const area = h('textarea', { 'aria-label': 'Note', placeholder: 'Ta note… « - [ ] » fait une case à cocher.' });
  area.value = initial;
  const preview = h('div', { class: 'md' });
  let timer;
  const changed = () => {
    preview.innerHTML = toHtml(area.value, { checkable: true }); // toHtml escapes the text
    clearTimeout(timer);
    timer = setTimeout(() => save(area.value), 400);
  };
  const apply = (fn) => {
    const r = fn({ text: area.value, start: area.selectionStart, end: area.selectionEnd });
    area.value = r.text;
    area.focus();
    area.setSelectionRange(r.start, r.end);
    changed();
  };
  preview.addEventListener('change', (e) => {
    const line = e.target.dataset?.line;
    if (line == null) return;
    area.value = toggleCheck(area.value, Number(line));
    changed();
  });
  area.addEventListener('input', changed);
  area.addEventListener('blur', () => { clearTimeout(timer); save(area.value); });
  preview.innerHTML = toHtml(initial, { checkable: true });
  return h('div', null,
    h('div', { class: 'row', style: { marginBottom: '6px' } },
      h('button', { class: 'chip', onmousedown: (e) => e.preventDefault(), onclick: () => apply(bold) }, h('strong', null, 'G'), ' Gras'),
      h('button', { class: 'chip', onmousedown: (e) => e.preventDefault(), onclick: () => apply((x) => linePrefix(x, '- ')) }, '• Liste'),
      h('button', { class: 'chip', onmousedown: (e) => e.preventDefault(), onclick: () => apply((x) => linePrefix(x, '- [ ] ')) }, '☐ Case')),
    area,
    h('div', { class: 'muted small', style: { marginTop: '8px' } }, 'Aperçu (touche une case pour la cocher) :'),
    preview);
}
