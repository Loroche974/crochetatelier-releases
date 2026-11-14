// Small DOM helpers shared by every screen.

/** h('button', { class: 'x', onclick }, 'Texte', child…). Strings are text (never HTML), null/false skipped. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
}

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  library: 'M4 4h5v16H4zM10 4h4v16h-4zM15.5 5l3.8-1 3 15.5-3.8 1z',
  search: 'M10.5 4a6.5 6.5 0 1 0 4.1 11.5L20 21M10.5 4a6.5 6.5 0 0 1 4.1 11.5',
  workshop: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5 9c4-1 9 0 14 3M4 14c5-2 10-1 15 2M9 4c-2 5-1 11 2 16',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  pdf: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1 1 0 1 0 0 .1',
  video: 'M4 6h12v12H4zM16 10l5-3v10l-5-3',
  text: 'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  ruler: 'M3 9h18v6H3zM7 9v3M11 9v3M15 9v3M19 9v3',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 13.5a1.5 1.5 0 0 1 2.5-1.5L8 14',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  zoomIn: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 20 20M8 10.5h5M10.5 8v5',
  zoomOut: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 20 20M8 10.5h5',
  sheet: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  play: 'M7 5v14l12-7z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v8h14v-8',
  bookmark: 'M7 3h10v18l-5-4-5 4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  more: 'M12 5v.1M12 12v.1M12 19v.1',
};

/** Inline SVG icon (decorative: the button around it carries the label). */
export function icon(name, size = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name] ?? ICONS.file);
  svg.append(p);
  return svg;
}

/** Round icon button with an accessible label. */
export const iconButton = (name, label, onclick, extra = {}) =>
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, ...extra }, icon(name));

export function toast(message, ms = 3500) {
  const host = document.getElementById('toasts');
  const t = h('div', { class: 'toast', role: 'status' }, message);
  host.append(t);
  setTimeout(() => t.remove(), ms);
}

/**
 * Modal sheet. [build](close) returns the content. Resolves with the value given to close().
 * Uses <dialog>, so focus and the Escape key are handled by the browser.
 */
export function sheet(title, build) {
  return new Promise((resolve) => {
    const d = h('dialog', { class: 'sheet', 'aria-label': title });
    let value;
    const close = (v) => { value = v; d.close(); };
    d.append(h('header', { class: 'sheet-head' }, h('h2', null, title), iconButton('close', 'Fermer', () => close())), h('div', { class: 'sheet-body' }, build(close)));
    d.addEventListener('close', () => { d.remove(); resolve(value); });
    d.addEventListener('click', (e) => { if (e.target === d) close(); }); // tap on the backdrop
    document.body.append(d);
    d.showModal();
  });
}

export function confirmDialog(title, message, okLabel = 'OK', danger = false) {
  return sheet(title, (close) => [
    h('p', null, message),
    h('div', { class: 'row end' },
      h('button', { class: 'btn text', onclick: () => close(false) }, 'Annuler'),
      h('button', { class: `btn ${danger ? 'danger' : 'filled'}`, onclick: () => close(true) }, okLabel)),
  ]).then(Boolean);
}

/** Asks for one line of text; resolves with the trimmed text, or undefined when cancelled. */
export function promptDialog(title, label, initial = '', okLabel = 'OK', type = 'text') {
  return sheet(title, (close) => {
    const input = h('input', { type, value: initial, 'aria-label': label, autocomplete: 'off', inputmode: type === 'number' ? 'numeric' : null });
    const form = h('form', { onsubmit: (e) => { e.preventDefault(); close(input.value.trim()); } },
      h('label', { class: 'field' }, h('span', null, label), input),
      h('div', { class: 'row end' },
        h('button', { class: 'btn text', type: 'button', onclick: () => close() }, 'Annuler'),
        h('button', { class: 'btn filled', type: 'submit' }, okLabel)));
    setTimeout(() => input.focus(), 50);
    return form;
  });
}

/** Labelled input. */
export function field(label, input) { return h('label', { class: 'field' }, h('span', null, label), input); }

/** Segmented choice: options = [[value, label]…]. */
export function segmented(label, options, current, onchange) {
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label },
    options.map(([v, l]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(v === current), class: v === current ? 'on' : '',
      onclick: () => onchange(v),
    }, l)));
}

export function section(title, ...children) {
  return h('section', { class: 'section' }, title && h('h2', null, title), children);
}

export function empty(text, ...children) { return h('div', { class: 'empty' }, h('p', null, text), children); }

/** Blob → object URL, released when the screen changes (see app.js). */
const urls = [];
export function blobUrl(blob) { const u = URL.createObjectURL(blob); urls.push(u); return u; }
export function releaseUrls() { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); }

/** Short two-note chime: "objectif atteint" (Safari on iPhone cannot vibrate). */
let audio;
export function chime() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    [880, 1318.5].forEach((freq, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.18;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.4);
    });
  } catch { /* no sound: the message on screen is enough */ }
}

/** Counter change → chime and message when the target is reached. */
export function announce(change) {
  if (change?.reached) { chime(); toast(`Objectif atteint : ${change.name} ${change.after} !`, 5000); }
}

export const dateFr =(ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Hidden file input, opened at once. Resolves with the chosen files (empty when cancelled, where detectable). */
export function pickFiles({ accept = '', multiple = false, capture = null } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, capture, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

/** Saves or shares a file: iOS shows its share sheet (Enregistrer dans Fichiers, AirDrop…). */
export async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return true;
}
