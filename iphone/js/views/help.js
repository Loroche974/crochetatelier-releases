// Aide (Réglages › Aide) and « Installer sur l'écran d'accueil ». Text adapted from ui/settings/HelpScreen.kt.
import { back } from '../app.js';
import { h, iconButton } from '../ui.js';

const block = (title, ...lines) => h('section', { class: 'section' }, h('h2', null, title), lines.map((l) => h('p', null, l)));

function install() {
  return [
    block('Sur iPhone ou iPad (Safari)',
      '1. Ouvre l\'adresse de l\'appli dans Safari (pas dans Instagram ni dans un autre navigateur).',
      '2. Touche le bouton Partager (le carré avec une flèche vers le haut), en bas de l\'écran.',
      '3. Fais défiler et choisis « Sur l\'écran d\'accueil », puis « Ajouter ».',
      '4. Ouvre ensuite l\'appli depuis sa nouvelle icône « Carnet Crochet » : elle s\'affiche en plein écran et marche sans Internet.'),
    block('Bon à savoir',
      '• Les tutos et les projets sont rangés dans l\'appli installée. Ceux ajoutés avant, dans Safari, restent dans Safari : fais une sauvegarde (Réglages › Exporter) puis importe-la dans l\'appli installée.',
      '• L\'iPhone peut effacer les données d\'un site très peu utilisé. L\'appli te rappelle de faire une sauvegarde toutes les deux semaines : garde-la dans Fichiers ou iCloud Drive.'),
  ];
}

function help() {
  return [
    block('Bien démarrer',
      '1. Bibliothèque › « Ajouter des tutos » : choisis tes PDF, images, vidéos ou textes dans Fichiers ou iCloud Drive. Ils sont copiés dans l\'appli et se lisent ensuite sans Internet. Tu peux créer des dossiers pour les ranger. Les PDF sont ensuite analysés en arrière-plan (couverture et texte pour la recherche).',
      '2. Touche un tuto pour l\'ouvrir. Il se rouvre à la dernière page lue.',
      '3. Dans l\'Atelier, crée un projet pour compter tes rangs.'),
    block('Les onglets',
      '• Accueil : reprendre la lecture, favoris, projets en cours, tutos récents.',
      '• Bibliothèque : tes tutos. Change de vue (grille, liste, cartes, compacte) en haut de l\'écran ; chaque dossier garde la sienne.',
      '• Recherche : par nom, texte des PDF, note ou étiquette, sans se soucier des accents, avec des filtres. Un résultat dans un PDF ouvre directement la bonne page.',
      '• Atelier : projets et compteurs, stock de laine, lexique FR ↔ US ↔ UK, tailles de crochets, calculatrices.'),
    block('Lire un tuto',
      '• Zoom avec deux doigts ou les loupes en bas ; glisse de côté pour changer de page.',
      '• Annoter (le crayon en haut) : stylo, surligneur, texte et gomme, en 6 couleurs. Le fichier d'origine n'est jamais modifié ; « Annuler » défait le dernier geste.',
      '• Fiche du tuto (bouton en haut à droite) : favori, difficulté, étiquettes, marque-pages et note (avec cases à cocher « - [ ] »).'),
    block('Suivre un ouvrage',
      'Depuis la fiche d\'un tuto, « Démarrer un projet avec ce tuto ». Ensuite, dans le lecteur :',
      '• le compteur de rangs s\'affiche par-dessus le tuto ;',
      '• la règle de lecture descend d\'un cran à chaque rang. Glisse-la avec le doigt, change son épaisseur avec + et − ;',
      '• « Mains libres » (la main) : touche n\'importe où pour avancer, appui long pour reculer.',
      '• La commande à la voix (« suivant » / « précédent ») est expérimentale sur iPhone : elle marche mieux dans Safari que depuis l\'icône de l\'écran d\'accueil, et demande souvent Internet.',
      '• Quand un compteur atteint son objectif, l\'appli sonne et affiche un message (l\'iPhone ne vibre pas pour un site).'),
    block('Sauvegarde',
      'Réglages › Exporter crée un fichier .zip avec tes projets (compteurs, temps, photos), ton stock de laine, tes notes, annotations, marque-pages, étiquettes, favoris et pages lues (pas les tutos eux-mêmes). Enregistre-le dans Fichiers ou iCloud Drive.',
      '• « Importer » le remet sur n\'importe quel appareil, y compris l\'appli Android (même format, dans les deux sens).',
      '• Attention : importer remplace les projets et la laine par ceux de la sauvegarde.',
      '• Les notes sont rattachées au chemin du tuto (dossier/nom) : réimporte les tutos dans les mêmes dossiers, avec les mêmes noms, pour les retrouver.'),
    block('Couleurs',
      'Réglages › Palette : Laine pastel, Terracotta, Sauge, Lavande, Coton. Du 1er décembre au 6 janvier, un thème de Noël est proposé sur l\'Accueil ; l\'appli reprend ensuite toute seule tes couleurs habituelles.'),
    block('Mises à jour',
      'Quand une nouvelle version est publiée, l\'appli la télécharge toute seule (avec Internet) et affiche « Nouvelle version, toucher pour recharger ». Tes données sont gardées.'),
    block('Confidentialité',
      'Tout reste sur ton appareil : aucun compte, aucune publicité, rien n\'est envoyé.'),
  ];
}

export default function helpScreen(root, _args, view) {
  const installing = view === 'installer';
  root.append(
    h('div', { class: 'top' }, iconButton('back', 'Retour', back), h('h1', null, installing ? 'Installer l\'appli' : 'Aide')),
    installing ? install() : help(),
  );
}
