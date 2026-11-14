// Un projet: statut, tuto lié, crochet, minuteur, compteurs, notes, photos, laines.
import * as repo from '../repo.js';
import { link, go, back, refresh } from '../app.js';
import { h, icon, iconButton, field, section, segmented, sheet, promptDialog, confirmDialog, pickFiles, blobUrl, announce, toast } from '../ui.js';
import { STATUS, elapsed, formatTime } from '../logic/workshop.js';
import { title } from '../logic/files.js';
import { terms, matches } from '../logic/search.js';

const undo = []; // { counterId, value }, newest last; survives re-renders

export default async function project(root, [idText]) {
  const id = Number(idText);
  const p = await repo.project(id);
  if (!p) { go('atelier'); return; }
  const [counters, photos, linked, stash, tuto] = await Promise.all([
    repo.counters(id), repo.photos(id), repo.yarnsOf(id), repo.yarns(), p.tutorialPath ? repo.file(p.tutorialPath) : null]);
  const timers = [];

  // ---------- Counters ----------
  const counterRow = (c, i) => {
    const value = h('span', { class: 'value', 'aria-live': 'polite' }, String(c.value));
    const doCount = async (d) => {
      const before = c.value;
      const change = await repo.count(c.id, d);
      if (!change || change.after === before) return;
      undo.push({ counterId: c.id, value: before });
      if (undo.length > 50) undo.shift();
      announce(change);
      refresh();
    };
    return h('div', { class: `counter${i === 0 ? ' first' : ''}` },
      h('div', { class: 'grow' },
        h('div', { class: 'title' }, c.name, i === 0 ? h('span', { class: 'muted small' }, ' · suit la règle') : ''),
        c.target ? h('div', { class: 'small muted' }, `Objectif ${c.target}`) : null),
      iconButton('minus', `Moins un, ${c.name}`, () => doCount(-1), { class: 'icon-btn big tonal' }),
      value,
      iconButton('plus', `Plus un, ${c.name}`, () => doCount(1), { class: 'icon-btn big on' }),
      iconButton('edit', `Modifier ${c.name}`, () => editCounter(c)));
  };
  const editCounter = (c) => sheet(c ? `Modifier « ${c.name} »` : 'Nouveau compteur', (close) => {
    const name = h('input', { type: 'text', value: c?.name ?? '' });
    const target = h('input', { type: 'text', inputmode: 'numeric', value: c?.target ? String(c.target) : '' });
    const val = c ? h('input', { type: 'text', inputmode: 'numeric', value: String(c.value) }) : null;
    return h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const t = parseInt(target.value, 10) || 0;
        if (c) await repo.saveCounter({ ...c, name: name.value, target: t, value: Math.max(0, parseInt(val.value, 10) || 0) });
        else await repo.addCounter(id, name.value, t);
        close(); refresh();
      },
    },
    field('Nom', name), field('Objectif (vide = aucun)', target), val && field('Valeur', val),
    h('div', { class: 'row end' },
      c && counters.length > 1 ? h('button', { type: 'button', class: 'btn text', style: { color: 'var(--danger)' }, onclick: async () => {
        if (await confirmDialog('Supprimer ?', `Supprimer le compteur « ${c.name} » ?`, 'Supprimer', true)) { await repo.deleteCounter(c.id); close(); refresh(); }
      } }, 'Supprimer') : null,
      h('button', { type: 'submit', class: 'btn filled' }, 'Enregistrer')));
  });

  // ---------- Timer ----------
  const timeEl = h('strong', { 'aria-live': 'off' });
  const drawTime = () => { timeEl.textContent = formatTime(elapsed(p.timeMs, p.timerStartedAt, Date.now())); };
  drawTime();
  if (p.timerStartedAt != null) timers.push(setInterval(drawTime, 30000));

  // ---------- Notes ----------
  const notes = h('textarea', { 'aria-label': 'Notes du projet', placeholder: 'Modifications, taille, idées…' });
  notes.value = p.notes;
  let noteTimer;
  notes.addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(() => repo.editProject(id, () => ({ notes: notes.value })), 400); });
  const saveNotes = () => { clearTimeout(noteTimer); if (notes.value !== p.notes) repo.editProject(id, () => ({ notes: notes.value })); };
  notes.addEventListener('blur', saveNotes);

  const hook = h('input', { type: 'text', inputmode: 'decimal', value: p.hook, placeholder: 'ex. 3,5 mm' });
  hook.addEventListener('change', () => repo.editProject(id, () => ({ hook: hook.value.trim().slice(0, 40) })));

  const addPhotos = async (capture) => {
    const files = await pickFiles({ accept: 'image/*', multiple: !capture, capture: capture ? 'environment' : null });
    if (files.length) { await repo.addPhotos(id, files); refresh(); }
  };

  const chooseTutorial = async () => {
    const files = await repo.allFiles();
    const picked = await sheet('Choisir le tuto', (close) => {
      const q = h('input', { type: 'search', placeholder: 'Chercher un tuto', 'aria-label': 'Chercher un tuto' });
      const list = h('div', { class: 'list' });
      const draw = () => {
        const t = terms(q.value);
        list.replaceChildren(...files.filter((f) => matches(f.path, t)).slice(0, 100).map((f) =>
          h('button', { class: 'item', style: { width: '100%', background: 'none', border: 0, textAlign: 'left' }, onclick: () => close(f.path) },
            h('div', { class: 'grow' }, h('div', { class: 'title' }, title(f.name)), h('div', { class: 'sub' }, f.parent || 'Mes tutos')))));
      };
      q.addEventListener('input', draw);
      draw();
      return files.length ? [q, list] : h('p', null, 'Ajoute d\'abord des tutos dans la Bibliothèque.');
    });
    if (picked) { await repo.editProject(id, () => ({ tutorialPath: picked, tutorialSource: 'LOCAL' })); refresh(); }
  };

  const linkYarn = async () => {
    const free = stash.filter((y) => !linked.some((l) => l.id === y.id));
    const picked = await sheet('Ajouter une laine', (close) => (free.length
      ? h('div', { class: 'list' }, free.map((y) => h('button', { class: 'item', style: { width: '100%', background: 'none', border: 0, textAlign: 'left' }, onclick: () => close(y.id) },
        h('div', { class: 'title' }, [y.brand, y.color].filter(Boolean).join(' · ')))))
      : [h('p', null, 'Toutes tes laines sont déjà liées, ou ton stock est vide.'), h('a', { class: 'btn tonal', href: link('laine', 'nouvelle'), onclick: () => close() }, 'Ajouter une laine au stock')]));
    if (picked) { await repo.link(id, picked); refresh(); }
  };

  const last = undo.at(-1);
  root.append(
    h('div', { class: 'top' },
      iconButton('back', 'Retour', back),
      h('h1', null, p.name),
      iconButton('edit', 'Renommer', async () => { const n = await promptDialog('Renommer', 'Nom du projet', p.name, 'Renommer'); if (n) { await repo.editProject(id, () => ({ name: n.slice(0, 80) })); refresh(); } })),

    segmented('Statut', Object.entries(STATUS), p.status, async (s) => { await repo.setStatus(id, s); refresh(); }),

    section('Tuto',
      tuto
        ? h('div', { class: 'row' }, h('a', { class: 'btn filled', href: link('lire', tuto.path) }, icon('pdf', 20), `Ouvrir « ${title(tuto.name)} »`),
          h('button', { class: 'btn text', onclick: chooseTutorial }, 'Changer'),
          h('button', { class: 'btn text', onclick: async () => { await repo.editProject(id, () => ({ tutorialPath: null, tutorialSource: null })); refresh(); } }, 'Délier'))
        : h('div', null,
          p.tutorialPath ? h('p', { class: 'muted small' }, `Tuto « ${p.tutorialPath} » absent de la bibliothèque : importe-le dans le même dossier pour le retrouver.`) : null,
          h('button', { class: 'btn tonal', onclick: chooseTutorial }, icon('link', 20), 'Lier un tuto'))),

    section('Compteurs',
      counters.map(counterRow),
      h('div', { class: 'row' },
        h('button', { class: 'btn tonal', onclick: () => editCounter(null) }, icon('plus', 20), 'Compteur'),
        h('button', { class: 'btn text', disabled: !last, onclick: async () => {
          const u = undo.pop();
          if (!u) return;
          const c = await repo.counters(id).then((cs) => cs.find((x) => x.id === u.counterId));
          if (c) await repo.count(c.id, u.value - c.value);
          refresh();
        } }, icon('undo', 20), 'Annuler'))),

    section('Temps passé', h('div', { class: 'row' }, h('span', { class: 'grow' }, timeEl),
      h('button', { class: `btn ${p.timerStartedAt != null ? 'filled' : 'tonal'}`, onclick: async () => { await repo.toggleTimer(id); refresh(); } },
        icon(p.timerStartedAt != null ? 'pause' : 'play', 20), p.timerStartedAt != null ? 'Pause' : 'Démarrer'))),

    section('Crochet', field('Taille du crochet', hook), h('a', { href: link('atelier', 'crochets'), class: 'small' }, 'Convertir mm ↔ US ↔ UK')),

    section('Notes', notes),

    section('Photos d\'avancement',
      photos.length ? h('div', { class: 'photos' }, photos.map((ph) => h('figure', null,
        h('img', { src: blobUrl(ph.blob), alt: `Photo du ${new Date(ph.takenAt).toLocaleDateString('fr-FR')}` }),
        iconButton('trash', 'Supprimer la photo', async () => { if (await confirmDialog('Supprimer ?', 'Supprimer cette photo ?', 'Supprimer', true)) { await repo.deletePhoto(ph.id); refresh(); } })))) : null,
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn tonal', onclick: () => addPhotos(true) }, icon('camera', 20), 'Appareil photo'),
        h('button', { class: 'btn text', onclick: () => addPhotos(false) }, icon('image', 20), 'Galerie'))),

    section('Laines',
      h('div', { class: 'chips' },
        linked.map((y) => h('span', { class: 'chip on' },
          h('a', { href: link('laine', y.id), style: { color: 'inherit', textDecoration: 'none' } }, [y.brand, y.color].filter(Boolean).join(' · ')),
          h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': `Retirer ${y.brand}`, onclick: async () => { await repo.unlink(id, y.id); refresh(); } }, icon('close', 16)))),
        h('button', { class: 'chip', onclick: linkYarn }, icon('plus', 16), 'Laine'))),

    h('div', { class: 'section' }, h('button', { class: 'btn danger', onclick: async () => {
      if (await confirmDialog('Supprimer le projet ?', `« ${p.name} », ses compteurs et ses photos seront supprimés.`, 'Supprimer', true)) {
        await repo.deleteProject(id); toast('Projet supprimé.'); go('atelier');
      }
    } }, icon('trash', 20), 'Supprimer le projet')),
  );
  return () => { timers.forEach(clearInterval); saveNotes(); };
}
