// Atelier: projets, stock de laine, lexique FR ↔ US ↔ UK, tailles de crochets, calculatrices.
import * as repo from '../repo.js';
import { link, go } from '../app.js';
import { h, icon, field, empty, blobUrl, promptDialog } from '../ui.js';
import { STATUS, searchLexicon, HOOKS, closestHook, yarnFor, gauge, spread, describeSpread, yarn, foundation, parseNumber } from '../logic/workshop.js';

const TABS = [['projets', 'Projets'], ['laine', 'Laine'], ['lexique', 'Lexique'], ['crochets', 'Crochets'], ['calculs', 'Calculs']];

export default async function workshop(root, [tab = 'projets']) {
  root.append(
    h('div', { class: 'top' }, h('h1', null, 'Atelier')),
    h('nav', { class: 'chips', 'aria-label': 'Rubriques de l\'Atelier', style: { marginBottom: '12px' } },
      TABS.map(([t, label]) => h('a', { class: `chip${t === tab ? ' on' : ''}`, href: link('atelier', t), 'aria-current': t === tab ? 'page' : null, style: { textDecoration: 'none', color: 'inherit' } }, label))),
  );
  const body = h('div');
  root.append(body);
  await ({ projets: projects, laine: yarns, lexique: lexicon, crochets: hooks, calculs: calculators }[tab] ?? projects)(body);
}

async function projects(root) {
  const list = await repo.projects();
  const create = async () => {
    const name = await promptDialog('Nouveau projet', 'Nom du projet', '', 'Créer');
    if (name !== undefined) go('projet', await repo.createProject(name));
  };
  root.append(
    h('button', { class: 'btn filled', onclick: create }, icon('plus', 20), 'Nouveau projet'),
    list.length
      ? h('div', { class: 'list', style: { marginTop: '12px' } }, list.map((p) =>
        h('a', { class: 'item', href: link('projet', p.id) }, h('div', { class: 'thumb' }, icon('workshop')),
          h('div', { class: 'grow' }, h('div', { class: 'title' }, p.name),
            h('div', { class: 'sub' }, [STATUS[p.status], p.rowCounter && `${p.rowCounter.name} ${p.rowCounter.value}${p.rowCounter.target ? ` / ${p.rowCounter.target}` : ''}`, p.hook && `crochet ${p.hook}`].filter(Boolean).join(' · '))))))
      : empty('Aucun projet. Un projet garde tes compteurs, ton temps, tes photos et la laine utilisée. Depuis un tuto, la fiche propose aussi « Démarrer un projet avec ce tuto ».'),
  );
}

async function yarns(root) {
  const list = await repo.yarns();
  root.append(
    h('a', { class: 'btn filled', href: link('laine', 'nouvelle') }, icon('plus', 20), 'Ajouter une laine'),
    list.length
      ? h('div', { class: 'list', style: { marginTop: '12px' } }, list.map((y) =>
        h('a', { class: 'item', href: link('laine', y.id) },
          h('div', { class: 'thumb' }, y.photo ? h('img', { src: blobUrl(y.photo), alt: '' }) : icon('workshop')),
          h('div', { class: 'grow' }, h('div', { class: 'title' }, [y.brand, y.color].filter(Boolean).join(' · ')),
            h('div', { class: 'sub' }, [y.material, y.weight, y.quantity ? `${String(y.quantity).replace('.', ',')} pelote${y.quantity > 1 ? 's' : ''}` : null, y.metersPerBall ? `${y.metersPerBall} m/pelote` : null].filter(Boolean).join(' · '))))))
      : empty('Ton stock de laine est vide.'),
  );
}

function lexicon(root) {
  const input = h('input', { type: 'search', placeholder: 'ms, sc, treble, bride…', 'aria-label': 'Chercher une abréviation' });
  const out = h('div');
  const draw = () => {
    const list = searchLexicon(input.value);
    out.replaceChildren(list.length ? h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'FR'), h('th', null, 'US'), h('th', null, 'UK'))),
      h('tbody', null, list.map((a) => [
        h('tr', null, h('td', null, h('strong', null, a.fr), h('div', { class: 'small muted' }, a.frName)), h('td', null, a.us), h('td', null, a.uk)),
        a.note && h('tr', null, h('td', { colspan: 3, class: 'small', style: { color: 'var(--danger)' } }, `⚠ ${a.note}`)),
      ]))) : empty('Aucune abréviation trouvée.'));
  };
  input.addEventListener('input', draw);
  root.append(h('p', { class: 'muted small' }, 'Attention : US et UK utilisent les mêmes mots pour des points différents (« dc » US = bride, « dc » UK = maille serrée).'), input, out);
  draw();
}

function hooks(root) {
  const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'ex. 3,5', 'aria-label': 'Taille en mm' });
  const out = h('div');
  const draw = () => {
    const hit = closestHook(input.value);
    out.replaceChildren(
      hit ? h('div', { class: 'result', role: 'status' }, `${String(hit.mm).replace('.', ',')} mm · US ${hit.us} · UK ${hit.uk}`, h('div', { class: 'small' }, `Laine : ${yarnFor(hit.mm)}`)) : '',
      h('table', null, h('thead', null, h('tr', null, h('th', null, 'mm'), h('th', null, 'US'), h('th', null, 'UK'))),
        h('tbody', null, HOOKS.map((k) => h('tr', { class: k === hit ? 'hit' : '' }, h('td', null, String(k.mm).replace('.', ',')), h('td', null, k.us), h('td', null, k.uk))))),
      h('p', { class: 'muted small' }, 'UK : anciens numéros impériaux.'));
  };
  input.addEventListener('input', draw);
  root.append(field('Ma taille (mm)', input), out);
  draw();
}

/** A small form: inputs [[key, label, default]], compute(values) → text or null. */
function calc(titleText, help, inputs, compute) {
  // inputmode 'text' where a minus sign is needed: the iPhone decimal pad has none.
  const els = Object.fromEntries(inputs.map(([k, , d, mode = 'decimal']) => [k, h('input', { type: 'text', inputmode: mode, value: d ?? '' })]));
  const out = h('div', { class: 'result', role: 'status' });
  const draw = () => {
    const v = Object.fromEntries(Object.entries(els).map(([k, e]) => [k, parseNumber(e.value)]));
    const r = compute(v);
    out.textContent = r ?? 'Remplis toutes les cases avec des nombres positifs.';
  };
  Object.values(els).forEach((e) => e.addEventListener('input', draw));
  draw();
  return h('div', { class: 'card' }, h('h2', null, titleText), h('p', { class: 'muted small' }, help),
    h('div', { class: 'grid2' }, inputs.map(([k, label]) => field(label, els[k]))), out);
}

function calculators(root) {
  root.append(
    calc('Échantillon', 'Combien de mailles et de rangs pour la taille voulue ?',
      [['s', 'Mailles de l\'échantillon', 20], ['sw', 'Largeur (cm)', 10], ['r', 'Rangs de l\'échantillon', 22], ['rh', 'Hauteur (cm)', 10], ['w', 'Largeur voulue (cm)'], ['hh', 'Hauteur voulue (cm)']],
      (v) => { const g = gauge(v.s, v.sw, v.r, v.rh, v.w, v.hh); return g && `${g.stitches} mailles × ${g.rows} rangs`; }),
    calc('Augmentations et diminutions', 'Répartir régulièrement sur un tour. Nombre négatif = diminutions.',
      [['n', 'Mailles du tour', 24], ['c', 'Augmentations (+) ou diminutions (−)', 6, 'text']],
      (v) => { const s = spread(v.n, v.c); return s && describeSpread(s); }),
    calc('Quantité de laine', 'D\'après un échantillon, avec 10 % de marge.',
      [['sw', 'Largeur échantillon (cm)', 10], ['sh', 'Hauteur échantillon (cm)', 10], ['m', 'Laine de l\'échantillon (m)'], ['w', 'Largeur voulue (cm)'], ['hh', 'Hauteur voulue (cm)'], ['b', 'Mètres par pelote']],
      (v) => { const y = yarn(v.sw, v.sh, v.m, v.w, v.hh, v.b); return y && `${y.meters} m, soit ${y.balls} pelote${y.balls > 1 ? 's' : ''}`; }),
    calc('Chaînette de base', 'Multiple du motif + mailles en plus, et la chaînette pour tourner (ms 1, dB 2, br 3).',
      [['w', 'Largeur voulue (cm)'], ['g', 'Mailles pour 10 cm', 18], ['mult', 'Multiple du motif', 1], ['extra', '+ mailles', 0], ['t', 'Chaînette pour tourner', 1]],
      (v) => {
        const c = foundation(v.w, v.g, Math.round(v.mult), Math.round(v.extra || 0), Math.round(v.t || 0));
        return c && `${c.stitches} ml + ${c.turning} pour tourner = ${c.total} ml`;
      }),
  );
}
