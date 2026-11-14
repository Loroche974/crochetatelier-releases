// Offline: the whole app is cached at install. Change VERSION on every publication,
// otherwise phones keep the old files.
const VERSION = 'v1';
const CACHE = `carnet-crochet-${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/db.js', 'js/repo.js', 'js/theme.js', 'js/ui.js', 'js/snow.js', 'js/pdf.js', 'js/indexer.js',
  'js/logic/backup.js', 'js/logic/ink.js', 'js/logic/files.js', 'js/logic/markdown.js', 'js/logic/search.js', 'js/logic/season.js', 'js/logic/workshop.js',
  'js/views/home.js', 'js/views/library.js', 'js/views/search.js', 'js/views/reader.js', 'js/views/sheet.js',
  'js/views/workshop.js', 'js/views/project.js', 'js/views/yarn.js', 'js/views/settings.js', 'js/views/help.js',
  'lib/pdf.min.mjs', 'lib/pdf.worker.min.mjs', 'lib/fflate.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache, so a new version never mixes with old files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// The page asks for it when the user taps "Nouvelle version".
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit
      ?? fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
