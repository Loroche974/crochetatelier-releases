// Accueil: reprendre la lecture, favoris, projets en cours, tutos récents, Bienvenue, thème de saison, rappel de sauvegarde.
import * as repo from '../repo.js';
import * as db from '../db.js';
import { link, settings, saveSettings, setPalette, refresh } from '../app.js';
import { h, icon, iconButton, section, toast, shareFile } from '../ui.js';
import { fileTile, showNewCovers } from './library.js';
import { seasonOffer, occurrence, seasonOf } from '../logic/season.js';
import { title } from '../logic/files.js';
import { seasonFall, garland } from '../snow.js';

const DAY = 86400000;
const BACKUP_EVERY = 14 * DAY;

const pageLabel = (m) => (m.pageCount > 0 ? `Page ${m.lastPage + 1} / ${m.pageCount}` : null);

export default async function home(root) {
  const s = settings();
  const today = new Date();
  const [files, projects, newcomer, lastBackup, snoozed] = await Promise.all([
    repo.filesWithMeta(), repo.projects(), repo.newcomer(), db.setting('lastBackupAt', 0), db.setting('backupSnoozedUntil', 0)]);
  const opened = files.filter((f) => f.meta.lastOpenedAt > 0).sort((a, b) => b.meta.lastOpenedAt - a.meta.lastOpenedAt).slice(0, 12);
  const favorites = files.filter((f) => f.meta.favorite).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const recent = [...files].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);
  const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS');
  const offer = seasonOffer(s, today);
  const hasData = projects.length > 0 || files.length > 0;
  const backupDue = hasData && Date.now() - lastBackup > BACKUP_EVERY && Date.now() > snoozed;

  // Season whose theme is in use: decorations on Home.
  const decor = seasonOf(s.palette);
  const stopSnow = decor ? seasonFall(document.body, decor.id) : null;

  const answer = async (accept) => {
    await saveSettings({ ...settings(), seasonAnswered: occurrence(offer, today) });
    if (accept) await setPalette(offer.palette);
    refresh();
  };
  const backupNow = async () => {
    try {
      const { blob, name } = await repo.exportBackup();
      await shareFile(blob, name);
    } catch (e) { toast(`Sauvegarde impossible : ${e.message}`); }
    refresh();
  };

  const resume = opened[0];
  root.append(
    h('div', { class: 'home-head' }, decor?.id === 'NOEL' ? garland() : null, h('h1', null, `Mon Carnet Crochet${decor ? ` ${decor.emoji}` : ''}`)),

    offer && h('div', { class: 'card accent' },
      h('h2', null, offer.title),
      h('p', null, 'Pour un temps limité : l’appli reprend tes couleurs habituelles à la fin de la période.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn filled', onclick: () => answer(true) }, 'Essayer'),
        h('button', { class: 'btn text', onclick: () => answer(false) }, 'Non merci'))),

    backupDue && h('div', { class: 'card' },
      h('h2', null, 'Pense à ta sauvegarde'),
      h('p', null, lastBackup ? `Dernière sauvegarde il y a ${Math.floor((Date.now() - lastBackup) / DAY)} jours. ` : 'Aucune sauvegarde pour l\'instant. ',
        'L\'iPhone peut effacer les données d\'un site : garde une copie de tes projets et notes dans Fichiers ou iCloud Drive.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn filled', onclick: backupNow }, 'Sauvegarder maintenant'),
        h('button', { class: 'btn text', onclick: async () => { await db.setSetting('backupSnoozedUntil', Date.now() + 3 * DAY); refresh(); } }, 'Plus tard'))),

    newcomer && h('div', { class: 'card accent welcome' },
      h('h2', null, 'Bienvenue !'),
      h('ol', null,
        h('li', null, 'Bibliothèque › « Ajouter des tutos » : choisis tes PDF, images ou vidéos dans Fichiers ou iCloud Drive.'),
        h('li', null, 'Touche un tuto pour le lire : il se rouvre à la dernière page lue.'),
        h('li', null, 'Atelier : crée un projet pour compter tes rangs.')),
      h('p', null, 'Tu as déjà l\'appli Android ? Exporte une sauvegarde là-bas, puis Réglages › Importer ici.'),
      h('div', { class: 'row' },
        h('a', { class: 'btn filled', href: link('bibliotheque') }, 'Ajouter des tutos'),
        h('a', { class: 'btn text', href: link('installer') }, 'Installer sur l\'écran d\'accueil'))),

    resume && h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { class: 'muted small' }, 'Reprendre la lecture'), h('h2', { style: { margin: 0 } }, title(resume.name)),
          h('div', { class: 'muted small' }, pageLabel(resume.meta))),
        iconButton('close', 'Retirer de « Reprendre »', async () => { await repo.forgetOpened(resume.path); refresh(); })),
      h('a', { class: 'btn filled', href: link('lire', resume.path), style: { marginTop: '8px' } }, 'Reprendre')),

    opened.length > 1 && section('Lus récemment', h('div', { class: 'shelf' }, opened.slice(1).map((f) => fileTile(f, pageLabel(f.meta))))),
    favorites.length > 0 && section('Favoris', h('div', { class: 'shelf' }, favorites.map((f) => fileTile(f, pageLabel(f.meta))))),
    inProgress.length > 0 && section('Projets en cours', h('div', { class: 'list' }, inProgress.map((p) =>
      h('a', { class: 'item', href: link('projet', p.id) }, h('div', { class: 'thumb' }, icon('workshop')),
        h('div', { class: 'grow' }, h('div', { class: 'title' }, p.name),
          p.rowCounter && h('div', { class: 'sub' }, `${p.rowCounter.name} ${p.rowCounter.value}${p.rowCounter.target ? ` / ${p.rowCounter.target}` : ''}`)))))),
    recent.length > 0 && section('Ajoutés récemment', h('div', { class: 'shelf' }, recent.map((f) => fileTile(f)))),
  );
  const stopCovers = showNewCovers();
  return () => { stopSnow?.(); stopCovers(); };
}
