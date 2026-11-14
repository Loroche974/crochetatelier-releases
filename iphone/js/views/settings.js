// Réglages: apparence, sauvegarde, aide, mises à jour, À propos.
import * as repo from '../repo.js';
import * as db from '../db.js';
import { link, settings, saveSettings, setPalette, refresh, checkForUpdate, APP_VERSION } from '../app.js';
import { h, icon, section, segmented, toast, confirmDialog, pickFiles, shareFile, dateFr } from '../ui.js';
import { PALETTES, paletteAvailable, seasonOf } from '../logic/season.js';
import { describeSummary } from '../logic/backup.js';

// Same links as the constants at the top of SettingsScreen.kt (Android).
const INSTAGRAM = 'https://www.instagram.com/co_con_de_mailles/';

export default async function settingsScreen(root) {
  const s = settings();
  const [lastBackup, persisted, estimate] = await Promise.all([
    db.setting('lastBackupAt', 0),
    navigator.storage?.persisted?.().catch(() => false) ?? false,
    navigator.storage?.estimate?.().catch(() => null) ?? null,
  ]);
  const today = new Date();
  const status = h('p', { class: 'muted small', role: 'status' });

  const exportNow = async () => {
    status.textContent = 'Préparation de la sauvegarde…';
    try {
      const { blob, name, summary } = await repo.exportBackup();
      await shareFile(blob, name);
      status.textContent = `Sauvegarde créée : ${describeSummary(summary)}.`;
    } catch (e) {
      status.textContent = `La sauvegarde a échoué : ${e.message}`;
    }
  };
  const importNow = async () => {
    const [file] = await pickFiles({ accept: '.zip,application/zip' });
    if (!file) return;
    if (!await confirmDialog('Importer cette sauvegarde ?', 'Les projets et la laine de cet iPhone seront remplacés par ceux de la sauvegarde. Les notes des tutos qu\'elle contient seront remises. Les fichiers des tutos ne sont pas dans la sauvegarde : réimporte-les dans les mêmes dossiers.', 'Importer', true)) return;
    status.textContent = 'Import en cours…';
    try {
      const summary = await repo.importBackup(file);
      toast(`Sauvegarde importée : ${describeSummary(summary)}.`, 6000);
      refresh();
    } catch (e) {
      status.textContent = e.message;
    }
  };
  const shareApp = async () => {
    const url = new URL('./', location.href).href;
    try {
      if (navigator.share) await navigator.share({ title: 'Mon Carnet Crochet', text: 'Mon Carnet Crochet : tutos, compteurs et stock de laine, même sans Internet.', url });
      else { await navigator.clipboard.writeText(url); toast('Lien copié.'); }
    } catch { /* cancelled */ }
  };
  const mb = (n) => `${(n / 1048576).toFixed(0)} Mo`;

  root.append(
    h('div', { class: 'top' }, h('h1', null, 'Réglages')),

    section('Mode', segmented('Mode', [['SYSTEM', 'Auto'], ['LIGHT', 'Clair'], ['DARK', 'Sombre']], s.themeMode, async (m) => { await saveSettings({ ...settings(), themeMode: m }); refresh(); })),
    section('Palette', h('div', { class: 'chips' }, Object.entries(PALETTES).filter(([id]) => paletteAvailable(id, today)).map(([id, label]) =>
      h('button', { class: `chip${s.palette === id ? ' on' : ''}`, 'aria-pressed': String(s.palette === id), onclick: async () => { await setPalette(id); refresh(); } }, label))),
    seasonOf(s.palette) ? h('p', { class: 'muted small' }, `Thème ${PALETTES[s.palette] === 'Halloween' ? 'd\'Halloween' : `de ${PALETTES[s.palette]}`} : tes couleurs d'avant reviennent toutes seules à la fin de la période.`) : null),

    section('Sauvegarde',
      h('p', { class: 'small' }, 'Un fichier .zip avec tes projets (compteurs, temps, photos), ta laine, tes notes, marque-pages, étiquettes, favoris et pages lues. Pas les tutos eux-mêmes. Il se lit aussi dans l\'appli Android.'),
      h('p', { class: 'muted small' }, lastBackup ? `Dernière sauvegarde : ${dateFr(lastBackup)}.` : 'Aucune sauvegarde pour l\'instant.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn filled', onclick: exportNow }, icon('share', 20), 'Exporter'),
        h('button', { class: 'btn tonal', onclick: importNow }, icon('upload', 20), 'Importer')),
      status),

    section('Stockage',
      h('p', { class: 'small' }, persisted ? 'Stockage protégé : l\'iPhone ne doit pas effacer tes données.' : 'Stockage non protégé : pense aux sauvegardes. L\'installer sur l\'écran d\'accueil aide à garder les données.'),
      estimate ? h('p', { class: 'muted small' }, `Utilisé : ${mb(estimate.usage ?? 0)}${estimate.quota ? ` sur ${mb(estimate.quota)} disponibles` : ''}.`) : null),

    section('Aide',
      h('div', { class: 'row' },
        h('a', { class: 'btn tonal', href: link('aide') }, icon('info', 20), 'Aide'),
        h('a', { class: 'btn text', href: link('installer') }, 'Installer sur l\'écran d\'accueil'))),

    section('Mises à jour',
      h('p', { class: 'small' }, `Version ${APP_VERSION}. Les nouvelles versions arrivent toutes seules quand l'iPhone a Internet : un bandeau « Nouvelle version » s'affiche en haut.`),
      h('button', { class: 'btn text', onclick: async () => toast(await checkForUpdate()) }, 'Vérifier les mises à jour')),

    section('À propos',
      h('div', { class: 'list' },
        h('button', { class: 'item', style: { width: '100%', background: 'none', border: 0, textAlign: 'left' }, onclick: shareApp }, icon('share'), h('span', { class: 'grow' }, 'Partager l\'appli')),
        h('a', { class: 'item', href: INSTAGRAM, target: '_blank', rel: 'noopener' }, icon('heart'), h('span', { class: 'grow' }, 'Co\'Condemailles sur Instagram'))),
      h('p', { class: 'muted small', style: { textAlign: 'center', marginTop: '16px', whiteSpace: 'pre-line' } },
        `Mon Carnet Crochet ${APP_VERSION}\n© 2026 Loroche974 · Tous droits réservés.\nAppli créée pour Co'Condemailles 🧶`)),
  );
}
