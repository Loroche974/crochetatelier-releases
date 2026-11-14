// Lecteur: PDF (pdf.js), image, vidéo, texte, Markdown, lien. Reprise, zoom, compteur de rangs, règle de lecture, mains libres.
import * as repo from '../repo.js';
import { back, go } from '../app.js';
import { h, icon, iconButton, toast, blobUrl, announce, segmented, promptDialog } from '../ui.js';
import { toHtml, decodeText, urlFromShortcut } from '../logic/markdown.js';
import { urlFromWebloc, title } from '../logic/files.js';
import { parseVoice } from '../logic/workshop.js';
import { INK_COLORS, ERASER_RADIUS, stroke, textInk, erase, draw as drawInkList } from '../logic/ink.js';
import { openPdf } from '../pdf.js';
import { tutorialSheet } from './sheet.js';

const MAX_ZOOM = 5;
const MAX_CANVAS_PIXELS = 16_000_000; // iOS refuses bigger canvases (blank page)
let showRuler = true; // remembered while the app is open, as on Android

/** #/lire/<path>[/<page>]: the page (0-based) comes from a search result, otherwise the last page read. */
export default async function reader(root, [path, startPage]) {
  const f = await repo.file(path);
  if (!f || f.type === 'FOLDER') { toast('Ce tuto n\'est plus dans la bibliothèque.'); go('bibliotheque'); return; }
  const blob = await repo.fileBlob(path);
  const m = await repo.meta(path);
  await repo.markOpened(path);

  const paged = f.type === 'PDF' || f.type === 'IMAGE';
  let page = startPage != null && Number.isInteger(Number(startPage)) ? Number(startPage) : m.lastPage;
  let pageCount = f.type === 'IMAGE' ? 1 : Math.max(1, m.pageCount);
  let zoom = 1;
  let project = null, rows = null;
  let pdf = null, renderTask = null;
  const cleanups = [];
  // Annotations: page → inks; the tutorial file itself is never modified.
  const inkPages = new Map((await repo.inks(path)).map((p) => [p.page, p.inks]));
  let pen = null; // { tool: PEN|HIGHLIGHTER|TEXT|ERASER, color } while annotating
  let lastPen = { tool: 'PEN', color: INK_COLORS[0][0] };
  let current = null; // points of the stroke being drawn
  const undoInks = []; // { page, inks } before each change

  // ---------- Layout ----------
  const stage = h('div', { class: 'stage' });
  const pageBox = h('div', { class: 'page' });
  const ruler = h('div', { class: 'ruler', style: { inset: '0' } });
  const inkCanvas = h('canvas', { class: 'ink', 'aria-hidden': 'true' });
  const pageLabel = h('span', { class: 'pages', 'aria-live': 'polite' });
  const pill = h('div', { class: 'pill', hidden: true });
  const tools = h('div', { class: 'tools' });
  const bottom = h('div', { class: 'reader-bottom' },
    paged && iconButton('prev', 'Page précédente', () => turn(-1)),
    paged && pageLabel,
    paged && iconButton('next', 'Page suivante', () => turn(1)),
    iconButton('zoomOut', 'Dézoomer', () => setZoom(zoom / 1.25)),
    iconButton('zoomIn', 'Zoomer', () => setZoom(zoom * 1.25)));
  const annotBar = h('div', { class: 'reader-bottom annot-bar', hidden: true });
  const shell = h('div', { class: 'reader' },
    h('div', { class: 'reader-bar' },
      iconButton('back', 'Retour', back),
      h('div', { class: 'title' }, title(f.name)),
      paged && iconButton('edit', 'Annoter', () => annotate(true)),
      iconButton('sheet', 'Fiche du tuto', () => openSheet())),
    stage, bottom, annotBar,
    pill, tools);
  root.append(shell);

  // ---------- Pages ----------
  // Fit the width on a phone; capped so a landscape iPad does not show a giant page.
  const fitWidth = () => Math.max(100, Math.min(stage.clientWidth - 16, 900));
  async function renderPage() {
    pageLabel.textContent = `${page + 1} / ${pageCount}`;
    if (f.type === 'IMAGE') {
      const img = pageBox.querySelector('img');
      const ratio = img.naturalHeight / img.naturalWidth || 1.4;
      sizeBox(fitWidth() * zoom, ratio);
      drawInks();
      return;
    }
    if (!pdf) return;
    const p = await pdf.getPage(page + 1);
    const base = p.getViewport({ scale: 1 });
    const cssW = fitWidth() * zoom;
    sizeBox(cssW, base.height / base.width);
    let scale = (cssW / base.width) * (devicePixelRatio || 1);
    const pixels = base.width * base.height * scale * scale;
    if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
    const viewport = p.getViewport({ scale });
    const canvas = h('canvas', { class: 'pdf', width: Math.floor(viewport.width), height: Math.floor(viewport.height), 'aria-label': `Page ${page + 1}`, role: 'img' });
    renderTask?.cancel();
    renderTask = p.render({ canvasContext: canvas.getContext('2d'), viewport });
    try { await renderTask.promise; } catch (e) { if (e?.name === 'RenderingCancelledException') return; throw e; }
    pageBox.querySelector('canvas.pdf')?.remove(); // swapped only when ready: no white flash
    pageBox.prepend(canvas);
    drawInks();
  }
  function sizeBox(w, ratio) {
    pageBox.style.width = `${w}px`;
    pageBox.style.height = `${w * ratio}px`;
  }
  function turn(delta) { goToPage(page + delta); }
  function goToPage(n) {
    const next = Math.min(Math.max(n, 0), pageCount - 1);
    if (next === page) return;
    page = next;
    repo.setPage(path, page, pageCount);
    stage.scrollTo(0, 0);
    renderPage();
  }
  function setZoom(z) {
    if (f.type === 'TEXT' || f.type === 'MARKDOWN') {
      zoom = Math.min(Math.max(z, 0.6), 3);
      stage.firstChild.style.fontSize = `${zoom}rem`;
      return;
    }
    if (!paged) return;
    const cx = stage.scrollLeft / Math.max(1, stage.scrollWidth), cy = stage.scrollTop / Math.max(1, stage.scrollHeight);
    zoom = Math.min(Math.max(z, 1), MAX_ZOOM);
    renderPage().then(() => stage.scrollTo(cx * stage.scrollWidth, cy * stage.scrollHeight));
  }

  // Pinch to zoom, swipe to turn pages (only when not zoomed).
  if (paged) {
    let pinch = null, swipe = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { pinch = { d: dist(e.touches), z: zoom, r: 1 }; swipe = null; }
      else if (e.touches.length === 1) swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    stage.addEventListener('touchmove', (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      pinch.r = dist(e.touches) / pinch.d;
      pageBox.style.transform = `scale(${Math.min(Math.max(pinch.z * pinch.r, 1), MAX_ZOOM) / pinch.z})`;
    }, { passive: false });
    stage.addEventListener('touchend', (e) => {
      if (pinch && e.touches.length < 2) {
        pageBox.style.transform = '';
        const z = pinch.z * pinch.r;
        pinch = null;
        setZoom(z);
        return;
      }
      if (swipe && zoom === 1 && !pen && e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 50) turn(dx < 0 ? 1 : -1);
      }
      swipe = null;
    });
    pageBox.style.transformOrigin = 'top center';
    const onKey = (e) => { if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1); };
    document.addEventListener('keydown', onKey);
    cleanups.push(() => document.removeEventListener('keydown', onKey));
    let resizeTimer;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderPage, 200); };
    addEventListener('resize', onResize);
    cleanups.push(() => removeEventListener('resize', onResize));
  }

  // ---------- Content ----------
  if (!blob) {
    stage.append(h('div', { class: 'doc' }, h('p', null, 'Le fichier de ce tuto est introuvable : réimporte-le dans la Bibliothèque.')));
  } else if (f.type === 'PDF') {
    stage.append(pageBox);
    pageBox.append(inkCanvas, ruler);
    try {
      pdf = await openPdf(blob);
      pageCount = pdf.numPages;
      page = Math.min(page, pageCount - 1);
      repo.setPage(path, page, pageCount);
      cleanups.push(() => { renderTask?.cancel(); pdf.destroy(); });
      await renderPage();
    } catch (e) {
      console.error(e);
      pageBox.replaceWith(h('div', { class: 'doc' }, h('p', null, `Ce PDF ne peut pas être lu (protégé par un mot de passe ou abîmé). ${e?.message ?? ''}`)));
    }
  } else if (f.type === 'IMAGE') {
    const img = h('img', { src: blobUrl(blob), alt: title(f.name) });
    pageBox.append(img, inkCanvas, ruler);
    stage.append(pageBox);
    page = 0;
    repo.setPage(path, 0, 1);
    await img.decode().catch(() => {});
    renderPage();
  } else if (f.type === 'VIDEO') {
    const video = h('video', { src: blobUrl(blob), controls: true, playsInline: true, preload: 'metadata' });
    video.addEventListener('loadedmetadata', () => {
      const t = m.lastPositionMs / 1000;
      if (t > 0 && t < video.duration - 2) video.currentTime = t;
    }, { once: true });
    let saved = 0;
    const save = () => repo.setPosition(path, video.currentTime * 1000);
    video.addEventListener('timeupdate', () => { if (Date.now() - saved > 5000) { saved = Date.now(); save(); } });
    video.addEventListener('pause', save);
    cleanups.push(save);
    stage.append(video);
  } else if (f.type === 'TEXT' || f.type === 'MARKDOWN') {
    const text = decodeText(new Uint8Array(await blob.arrayBuffer()));
    const doc = h('div', { class: 'doc md' });
    if (f.type === 'MARKDOWN') doc.innerHTML = toHtml(text); else doc.append(h('pre', null, text));
    stage.append(doc);
  } else if (f.type === 'LINK') {
    const text = decodeText(new Uint8Array(await blob.arrayBuffer()));
    const url = urlFromShortcut(text) ?? urlFromWebloc(text);
    const safe = url && /^https?:\/\//i.test(url) ? url : null;
    stage.append(h('div', { class: 'doc' }, safe
      ? [h('p', null, 'Ce tuto est un lien web :'), h('p', { class: 'small', style: { wordBreak: 'break-all' } }, safe),
        h('a', { class: 'btn filled', href: safe, target: '_blank', rel: 'noopener' }, icon('link', 20), 'Ouvrir le lien')]
      : h('p', null, 'Ce raccourci ne contient pas d\'adresse web lisible.')));
  } else {
    stage.append(h('div', { class: 'doc' }, h('p', null, 'Ce type de fichier ne peut pas être affiché.')));
  }

  // ---------- Project: row counter, reading ruler, hands-free ----------
  async function loadProject() {
    project = await repo.projectFor(path);
    rows = project ? (await repo.counters(project.id))[0] ?? null : null;
    drawPill();
    drawRuler();
    drawTools();
  }
  function drawPill() {
    pill.hidden = !rows;
    if (!rows) return;
    pill.replaceChildren(
      iconButton('minus', 'Moins un rang', () => count(-1)),
      h('span', { class: 'label', 'aria-live': 'polite' }, `${rows.name} ${rows.value}${rows.target ? ` / ${rows.target}` : ''}`),
      iconButton('plus', 'Plus un rang', () => count(1), { class: 'icon-btn tonal' }));
  }
  async function count(delta) {
    if (!rows) return;
    const change = await repo.count(rows.id, delta);
    project = await repo.project(project.id);
    rows = await repo.counters(project.id).then((c) => c[0]);
    drawPill();
    drawRuler();
    announce(change);
  }
  function drawRuler(y = project?.rulerY) {
    const on = paged && project && showRuler;
    ruler.hidden = !on;
    if (!on) return;
    const hgt = project.rulerHeight;
    const pct = (v) => `${v * 100}%`;
    const band = h('div', { class: 'band', role: 'slider', 'aria-label': 'Règle de lecture, glisse-la sur le rang en cours', 'aria-valuenow': Math.round(y * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, tabindex: 0, style: { top: pct(y), height: pct(hgt) } });
    ruler.replaceChildren(h('div', { class: 'dim', style: { top: '0', height: pct(y) } }), band, h('div', { class: 'dim', style: { top: pct(y + hgt), bottom: '0' } }));
    let drag = null;
    band.addEventListener('pointerdown', (e) => { band.setPointerCapture(e.pointerId); drag = { start: e.clientY, y0: y }; e.preventDefault(); });
    band.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const ny = Math.min(Math.max(drag.y0 + (e.clientY - drag.start) / pageBox.clientHeight, 0), 1 - hgt);
      band.style.top = pct(ny);
      ruler.firstChild.style.height = pct(ny);
      ruler.lastChild.style.top = pct(ny + hgt);
      drag.y = ny;
    });
    const end = async () => {
      if (drag?.y == null) { drag = null; return; }
      const ny = drag.y;
      drag = null;
      project = await repo.moveProjectRuler(project.id, ny, hgt);
      drawRuler();
    };
    band.addEventListener('pointerup', end);
    band.addEventListener('pointercancel', end);
    band.addEventListener('keydown', async (e) => {
      const d = e.key === 'ArrowDown' ? hgt : e.key === 'ArrowUp' ? -hgt : 0;
      if (!d) return;
      e.preventDefault();
      project = await repo.moveProjectRuler(project.id, y + d, hgt);
      drawRuler();
      ruler.querySelector('.band').focus();
    });
  }
  async function resizeRuler(factor) {
    project = await repo.moveProjectRuler(project.id, project.rulerY, project.rulerHeight * factor);
    drawRuler();
  }
  function drawTools() {
    const rulerOk = paged && project;
    tools.replaceChildren(
      rulerOk && showRuler ? iconButton('plus', 'Règle plus épaisse', () => resizeRuler(1.25)) : '',
      rulerOk && showRuler ? iconButton('minus', 'Règle plus fine', () => resizeRuler(0.8)) : '',
      rulerOk ? iconButton('ruler', showRuler ? 'Masquer la règle de lecture' : 'Afficher la règle de lecture', () => { showRuler = !showRuler; drawRuler(); drawTools(); },
        { class: `icon-btn${showRuler ? ' on' : ''}`, 'aria-pressed': String(showRuler) }) : '',
      (paged || rows) ? iconButton('hand', 'Mode mains libres', handsFree) : '',
    );
  }

  function handsFree() {
    let mode = rows ? 'rows' : 'pages';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null, listening = false;
    const status = h('p', { class: 'small', 'aria-live': 'polite', style: { color: 'var(--danger)' } });
    const flash = h('div', { class: 'flash' });
    const command = (cmd) => {
      flash.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.remove('on')));
      const d = cmd === 'next' ? 1 : -1;
      if (mode === 'rows' && rows) count(d); else turn(d);
    };
    const hint = h('p', { class: 'small' });
    const drawHint = () => { hint.textContent = `Touche l'écran : suivant · appui long : précédent${listening ? ' · dis « suivant » ou « précédent »' : ''}`; };
    const micBtn = SR ? h('button', { class: 'chip', 'aria-pressed': 'false', onclick: (e) => { e.stopPropagation(); toggleVoice(); } }, icon('mic', 18), 'Voix (expérimental)') : null;
    const modeRow = h('div');
    const drawMode = () => modeRow.replaceChildren(rows && paged ? segmented('Avancer', [['rows', 'Rang'], ['pages', 'Page']], mode, (v) => { mode = v; drawMode(); }) : '');
    const panel = h('div', { class: 'panel', onpointerdown: (e) => e.stopPropagation(), onpointerup: (e) => e.stopPropagation() },
      h('div', { class: 'row' }, h('h2', { class: 'grow', style: { margin: 0 } }, 'Mains libres'), micBtn, iconButton('close', 'Quitter le mode mains libres', () => close())),
      hint, modeRow, status);
    const layer = h('div', { class: 'handsfree', role: 'application', 'aria-label': 'Mains libres : touche pour avancer, appui long pour reculer' }, flash, panel);

    let pressTimer = null, longDone = false;
    layer.addEventListener('pointerdown', () => { longDone = false; pressTimer = setTimeout(() => { longDone = true; command('previous'); }, 550); });
    layer.addEventListener('pointerup', () => { clearTimeout(pressTimer); if (!longDone) command('next'); });
    layer.addEventListener('pointercancel', () => clearTimeout(pressTimer));
    layer.addEventListener('contextmenu', (e) => e.preventDefault());

    function toggleVoice() {
      if (listening) { listening = false; rec?.stop(); } else startVoice();
      micBtn.classList.toggle('on', listening);
      micBtn.setAttribute('aria-pressed', String(listening));
      drawHint();
    }
    function startVoice() {
      rec = new SR();
      rec.lang = 'fr-FR';
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) continue;
          const cmd = [...e.results[i]].map((a) => parseVoice(a.transcript)).find(Boolean);
          if (cmd) command(cmd);
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          listening = false;
          status.textContent = 'Micro ou reconnaissance vocale refusés. Sur iPhone, la voix marche mieux dans Safari que depuis l\'écran d\'accueil. Le tap reste disponible.';
          micBtn.classList.remove('on');
          drawHint();
        } else if (e.error === 'network') status.textContent = 'La reconnaissance vocale demande Internet.';
      };
      rec.onend = () => { if (listening) setTimeout(() => { try { rec.start(); } catch { /* already started */ } }, 300); };
      try { rec.start(); listening = true; status.textContent = ''; } catch (err) { status.textContent = `Voix indisponible : ${err.message}`; }
    }
    function close() {
      listening = false;
      try { rec?.abort(); } catch { /* ignore */ }
      layer.remove();
      const i = cleanups.indexOf(close);
      if (i >= 0) cleanups.splice(i, 1);
    }
    cleanups.push(close);
    drawHint();
    drawMode();
    shell.append(layer);
  }

  // ---------- Annotations ----------
  function drawInks() {
    const dpr = devicePixelRatio || 1;
    const w = pageBox.clientWidth, hh = pageBox.clientHeight;
    if (!w || !hh) return;
    // Same pixel budget as the page itself.
    const scale = Math.min(dpr, Math.sqrt(MAX_CANVAS_PIXELS / (w * hh)));
    inkCanvas.width = Math.round(w * scale);
    inkCanvas.height = Math.round(hh * scale);
    const ctx = inkCanvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const list = [...(inkPages.get(page) ?? [])];
    if (current) { const s = stroke(pen.tool, pen.color, current); if (s) list.push(s); }
    drawInkList(ctx, list, w, hh);
  }
  function setInks(list) {
    undoInks.push({ page, inks: inkPages.get(page) ?? [] });
    if (undoInks.length > 50) undoInks.shift();
    inkPages.set(page, list);
    repo.saveInks(path, page, list);
    drawInks();
    drawAnnotBar();
  }
  const at = (e) => { const r = inkCanvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
  let pointers = 0, erasing = null;
  inkCanvas.addEventListener('pointerdown', (e) => {
    if (!pen) return;
    pointers++;
    if (pointers > 1) { current = null; erasing = null; drawInks(); return; } // two fingers: zoom, not a stroke
    inkCanvas.setPointerCapture(e.pointerId);
    const p = at(e);
    if (pen.tool === 'ERASER') { erasing = inkPages.get(page) ?? []; eraseAt(p); }
    else if (pen.tool !== 'TEXT') current = [p.x / p.w, p.y / p.h];
  });
  inkCanvas.addEventListener('pointermove', (e) => {
    if (!pen || pointers !== 1) return;
    const p = at(e);
    if (erasing) eraseAt(p);
    else if (current) { current.push(p.x / p.w, p.y / p.h); drawInks(); }
  });
  const up = async (e) => {
    if (!pen) return;
    pointers = Math.max(0, pointers - 1);
    const p = at(e);
    if (erasing) {
      const before = erasing;
      erasing = null;
      const after = inkPages.get(page) ?? [];
      if (after.length !== before.length) { inkPages.set(page, before); setInks(after); }
    } else if (current) {
      const s = stroke(pen.tool, pen.color, current);
      current = null;
      if (s) setInks([...(inkPages.get(page) ?? []), s]); else drawInks();
    } else if (pen.tool === 'TEXT' && e.type === 'pointerup' && pointers === 0) {
      const text = await promptDialog('Ajouter un texte', 'Texte', '', 'Ajouter');
      const ink = text && textInk(pen.color, p.x / p.w, p.y / p.h, text);
      if (ink) setInks([...(inkPages.get(page) ?? []), ink]);
    }
  };
  inkCanvas.addEventListener('pointerup', up);
  inkCanvas.addEventListener('pointercancel', (e) => { current = null; erasing = null; up(e); drawInks(); });
  function eraseAt(p) {
    // Shown at once; saved (with one undo step) when the finger is lifted.
    inkPages.set(page, erase(inkPages.get(page) ?? [], p.x, p.y, ERASER_RADIUS, p.w, p.h));
    drawInks();
  }

  function annotate(on) {
    pen = on ? lastPen : null;
    shell.classList.toggle('annotating', on);
    inkCanvas.classList.toggle('drawing', on);
    bottom.hidden = on;
    annotBar.hidden = !on;
    pill.hidden = on || !rows;
    tools.hidden = on;
    if (on) drawAnnotBar();
  }
  const TOOLS = [['PEN', 'Stylo', 'edit'], ['HIGHLIGHTER', 'Surligneur', 'ruler'], ['TEXT', 'Texte', 'text'], ['ERASER', 'Gomme', 'trash']];
  function drawAnnotBar() {
    if (!pen) return;
    annotBar.replaceChildren(
      h('div', { class: 'row', style: { width: '100%', flexWrap: 'nowrap' } },
        h('div', { class: 'segmented grow', role: 'radiogroup', 'aria-label': 'Outil' }, TOOLS.map(([t, label, ic]) =>
          h('button', { type: 'button', role: 'radio', 'aria-checked': String(pen.tool === t), class: pen.tool === t ? 'on' : '', 'aria-label': label, title: label,
            onclick: () => { pen = lastPen = { ...pen, tool: t }; drawAnnotBar(); } }, icon(ic, 20), h('span', { class: 'tool-label' }, label)))),
        iconButton('undo', 'Annuler', () => {
          const u = undoInks.pop();
          if (!u) return;
          inkPages.set(u.page, u.inks);
          repo.saveInks(path, u.page, u.inks);
          if (u.page !== page) goToPage(u.page); else drawInks();
          drawAnnotBar();
        }, { disabled: !undoInks.length }),
        h('button', { class: 'btn filled', onclick: () => annotate(false) }, 'Terminé')),
      pen.tool !== 'ERASER' ? h('div', { class: 'colors', role: 'radiogroup', 'aria-label': 'Couleur' }, INK_COLORS.map(([argb, name]) =>
        h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(pen.color === argb), 'aria-label': `Couleur ${name}`, title: name,
          class: `swatch${pen.color === argb ? ' on' : ''}`, style: { background: `#${(argb >>> 0).toString(16).slice(2)}` },
          onclick: () => { pen = lastPen = { ...pen, color: argb }; drawAnnotBar(); },
        }))) : h('p', { class: 'small eraser-hint' }, 'Passe le doigt sur une annotation pour l\'effacer.'),
    );
  }

  async function openSheet() {
    await tutorialSheet(f, { page: paged ? page : null, goToPage: paged ? goToPage : null });
    await loadProject();
  }

  await loadProject();

  // Keep the screen on while reading (when the browser allows it).
  let lock = null;
  const wake = async () => { try { if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed: fine */ } };
  wake();
  document.addEventListener('visibilitychange', wake);
  cleanups.push(() => { document.removeEventListener('visibilitychange', wake); lock?.release().catch(() => {}); });

  return () => cleanups.splice(0).reverse().forEach((fn) => fn());
}
