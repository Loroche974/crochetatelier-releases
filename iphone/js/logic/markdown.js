// Port of domain/TextFormats.kt and NoteEditing (domain/Notes.kt).

const HEADING = /^(#{1,6})\s+(.*)$/;
const CHECK = /^\s*[-*+]\s+\[([ xX])]\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

/** One block per line: {kind: heading|check|bullet|numbered|paragraph|blank, ...}. */
export function parseMarkdown(source) {
  return String(source ?? '').split(/\r?\n/).map((raw) => {
    const line = raw.trimEnd();
    let m;
    if ((m = HEADING.exec(line))) return { kind: 'heading', level: m[1].length, text: m[2] };
    if ((m = CHECK.exec(line))) return { kind: 'check', done: m[1] !== ' ', text: m[2] };
    if ((m = BULLET.exec(line))) return { kind: 'bullet', text: m[1] };
    if ((m = NUMBERED.exec(line))) return { kind: 'numbered', number: m[1], text: m[2] };
    return line.trim() === '' ? { kind: 'blank' } : { kind: 'paragraph', text: line };
  });
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Inline text to safe HTML: escaped first, then **bold** and *italic*. */
export function inline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Whole document as safe HTML. Checkboxes carry data-line (0-based) so a tap can tick them. */
export function toHtml(source, { checkable = false } = {}) {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const open = (tag) => { if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; } };
  parseMarkdown(source).forEach((b, i) => {
    switch (b.kind) {
      case 'heading': close(); out.push(`<h${Math.min(b.level + 2, 6)}>${inline(b.text)}</h${Math.min(b.level + 2, 6)}>`); break;
      case 'check': open('ul'); out.push(`<li class="check"><label><input type="checkbox" data-line="${i}"${b.done ? ' checked' : ''}${checkable ? '' : ' disabled'}> <span>${inline(b.text)}</span></label></li>`); break;
      case 'bullet': open('ul'); out.push(`<li>${inline(b.text)}</li>`); break;
      case 'numbered': open('ol'); out.push(`<li value="${b.number}">${inline(b.text)}</li>`); break;
      case 'paragraph': close(); out.push(`<p>${inline(b.text)}</p>`); break;
      default: close();
    }
  });
  close();
  return out.join('');
}

/** Target of a Windows ".url" shortcut ([InternetShortcut] / URL=...), or null. */
export function urlFromShortcut(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (/^URL=/i.test(t)) return t.slice(t.indexOf('=') + 1).trim() || null;
  }
  return null;
}

/** UTF-8 when valid (BOM stripped), otherwise Windows-1252: Notepad files often are. */
export function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// --- Note editor toolbar (text + selection) ---

/** Wraps the selection in ** (an empty selection gets **|** with the cursor inside). */
export function bold({ text, start, end }) {
  const s = Math.max(0, Math.min(start, end, text.length));
  const t = Math.min(text.length, Math.max(start, end));
  return { text: `${text.slice(0, s)}**${text.slice(s, t)}**${text.slice(t)}`, start: s + 2, end: t + 2 };
}

const MARKERS = ['- [ ] ', '- [x] ', '- '];

/** Turns the cursor's line into a bullet ("- ") or a checkbox ("- [ ] "); the same action again removes it. */
export function linePrefix({ text, start, end }, prefix) {
  const cursor = Math.max(0, Math.min(start, end, text.length));
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
  const existing = MARKERS.find((m) => text.startsWith(m, lineStart));
  const same = existing === prefix || (prefix === '- [ ] ' && existing === '- [x] ');
  const insert = same ? '' : prefix;
  const removed = existing?.length ?? 0;
  const shift = (i) => (i < lineStart ? i : Math.max(lineStart, i - removed + insert.length));
  return { text: text.slice(0, lineStart) + insert + text.slice(lineStart + removed), start: shift(start), end: shift(end) };
}

/** Ticks or unticks the checkbox on [line] (0-based, as in parseMarkdown). */
export function toggleCheck(source, line) {
  const lines = String(source).split('\n');
  if (line < 0 || line >= lines.length) return source;
  lines[line] = lines[line].replace(/^(\s*[-*+]\s+\[)([ xX])(])/, (_, a, c, b) => a + (c === ' ' ? 'x' : ' ') + b);
  return lines.join('\n');
}
