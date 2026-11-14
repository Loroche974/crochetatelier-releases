// Une laine du stock: marque, couleur, matière, épaisseur, mètres/pelote, pelotes, photo, notes, « utilisée dans ».
import * as repo from '../repo.js';
import { link, go, back } from '../app.js';
import { h, icon, iconButton, field, section, confirmDialog, pickFiles, blobUrl, toast } from '../ui.js';
import { parseNumber, STATUS } from '../logic/workshop.js';

export default async function yarnScreen(root, [idText]) {
  const isNew = idText === 'nouvelle';
  const y = isNew ? { brand: '', color: '', material: '', weight: '', metersPerBall: 0, quantity: 0, photo: null, notes: '' } : await repo.yarn(Number(idText));
  if (!y) { go('atelier', 'laine'); return; }
  const usedIn = isNew ? [] : await repo.projectsUsing(y.id);
  let photo = y.photo;

  const input = (value, extra = {}) => h('input', { type: 'text', value: value ?? '', ...extra });
  const brand = input(y.brand, { required: true, autocapitalize: 'words' });
  const color = input(y.color);
  const material = input(y.material, { placeholder: 'coton, acrylique, laine…' });
  const weight = input(y.weight, { placeholder: 'DK, fingering, 4 mm…' });
  const meters = input(y.metersPerBall || '', { inputmode: 'numeric' });
  const quantity = input(y.quantity ? String(y.quantity).replace('.', ',') : '', { inputmode: 'decimal' });
  const notes = h('textarea', null);
  notes.value = y.notes;
  const photoBox = h('div');
  const drawPhoto = () => photoBox.replaceChildren(
    photo ? h('div', { class: 'photos' }, h('figure', null, h('img', { src: blobUrl(photo), alt: 'Photo de la laine' }),
      iconButton('trash', 'Retirer la photo', () => { photo = null; drawPhoto(); }))) : '',
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { type: 'button', class: 'btn tonal', onclick: () => choose(true) }, icon('camera', 20), 'Appareil photo'),
      h('button', { type: 'button', class: 'btn text', onclick: () => choose(false) }, icon('image', 20), 'Galerie')));
  const choose = async (capture) => {
    const [f] = await pickFiles({ accept: 'image/*', capture: capture ? 'environment' : null });
    if (f) { photo = new Blob([await f.arrayBuffer()], { type: f.type || 'image/jpeg' }); drawPhoto(); }
  };
  drawPhoto();

  const save = async (e) => {
    e.preventDefault();
    const q = parseNumber(quantity.value), mpb = parseNumber(meters.value);
    const next = {
      ...y, brand: brand.value.trim() || 'Laine', color: color.value.trim(), material: material.value.trim(), weight: weight.value.trim(),
      metersPerBall: Number.isFinite(mpb) ? Math.max(0, Math.round(mpb)) : 0, quantity: Number.isFinite(q) ? Math.max(0, q) : 0, photo, notes: notes.value,
    };
    if (isNew) delete next.id;
    await repo.saveYarn(next);
    toast('Laine enregistrée.');
    go('atelier', 'laine');
  };

  root.append(
    h('div', { class: 'top' }, iconButton('back', 'Retour', back), h('h1', null, isNew ? 'Nouvelle laine' : [y.brand, y.color].filter(Boolean).join(' · '))),
    h('form', { onsubmit: save },
      h('div', { class: 'grid2' }, field('Marque', brand), field('Couleur', color), field('Matière', material), field('Épaisseur', weight),
        field('Mètres par pelote', meters), field('Nombre de pelotes', quantity)),
      field('Notes', notes),
      section('Photo', photoBox),
      usedIn.length ? section('Utilisée dans', h('div', { class: 'list' }, usedIn.map((p) =>
        h('a', { class: 'item', href: link('projet', p.id) }, h('div', { class: 'grow' }, h('div', { class: 'title' }, p.name), h('div', { class: 'sub' }, STATUS[p.status])))))) : null,
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('button', { type: 'submit', class: 'btn filled' }, 'Enregistrer'),
        !isNew && h('button', { type: 'button', class: 'btn text', style: { color: 'var(--danger)' }, onclick: async () => {
          if (await confirmDialog('Supprimer ?', 'Retirer cette laine du stock ? Elle sera aussi retirée des projets.', 'Supprimer', true)) { await repo.deleteYarn(y.id); go('atelier', 'laine'); }
        } }, 'Supprimer'))),
  );
}
