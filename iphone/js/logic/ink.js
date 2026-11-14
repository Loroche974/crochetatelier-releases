// Annotation layer, same format as domain/Notes.kt (Ink) and ui/reader/Annotations.kt, so backups stay compatible.
// An ink: { tool: PEN|HIGHLIGHTER|TEXT, color: ARGB as a signed 32-bit int, width: fraction of the page width,
// points: [x0, y0, x1, y1…] in page fractions (TEXT: its top-left corner), text }.

export const PEN_WIDTH = 0.006;
export const HIGHLIGHTER_WIDTH = 0.035;
export const TEXT_SIZE = 0.04;
export const ERASER_RADIUS = 16; // CSS px, like 16.dp on Android

/** Named for screen readers; same values as Android's inkColors (ARGB, signed like a Kotlin Int). */
export const INK_COLORS = [
  [0xFF212121, 'Noir'], [0xFFD32F2F, 'Rouge'], [0xFF1976D2, 'Bleu'],
  [0xFF388E3C, 'Vert'], [0xFFFFEB3B, 'Jaune'], [0xFFE91E63, 'Rose'],
].map(([argb, name]) => [argb | 0, name]);

/** ARGB int → CSS rgba(); [alpha] overrides the colour's own alpha (highlighter: 0.35). */
export function cssColor(argb, alpha) {
  const a = alpha ?? ((argb >>> 24) & 255) / 255;
  return `rgba(${(argb >>> 16) & 255},${(argb >>> 8) & 255},${argb & 255},${a})`;
}

/** New stroke for the pen or highlighter from the recorded points. Null when too short (a tap). */
export function stroke(tool, color, points) {
  if (points.length < 4) return null;
  return { tool, color, width: tool === 'HIGHLIGHTER' ? HIGHLIGHTER_WIDTH : PEN_WIDTH, points: points.map(round), text: '' };
}

export function textInk(color, x, y, text) {
  const t = text.trim();
  return t ? { tool: 'TEXT', color, width: TEXT_SIZE, points: [round(x), round(y)], text: t } : null;
}

const round = (v) => Math.round(v * 10000) / 10000; // 0.1 ‰ of the page is plenty, and keeps backups small

/** Removes the marks passing within [radius] px of (x, y) on a page drawn at w×h px (port of Inks.erase). */
export function erase(inks, x, y, radius, w, h) {
  return inks.filter((ink) => {
    const reach = radius + (ink.tool === 'TEXT' ? ink.width * w : (ink.width * w) / 2);
    for (let i = 0; i + 1 < ink.points.length; i += 2) {
      if (Math.hypot(ink.points[i] * w - x, ink.points[i + 1] * h - y) <= reach) return false;
    }
    return true;
  });
}

/** Lines of [text] fitting in [maxWidth], with [measure](s) → width. Long words are kept whole. */
export function wrap(text, maxWidth, measure) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Draws [inks] on a 2D context of a page drawn at w×h px. */
export function draw(ctx, inks, w, h) {
  for (const ink of inks) {
    if (ink.points.length < 2) continue;
    if (ink.tool === 'TEXT') {
      const size = ink.width * w;
      ctx.font = `bold ${size}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = cssColor(ink.color);
      ctx.textBaseline = 'top';
      const x = ink.points[0] * w;
      wrap(ink.text, Math.max(1, w - x), (s) => ctx.measureText(s).width)
        .forEach((line, i) => ctx.fillText(line, x, ink.points[1] * h + i * size * 1.2));
      continue;
    }
    const hl = ink.tool === 'HIGHLIGHTER';
    ctx.beginPath();
    ctx.moveTo(ink.points[0] * w, ink.points[1] * h);
    for (let i = 2; i + 1 < ink.points.length; i += 2) ctx.lineTo(ink.points[i] * w, ink.points[i + 1] * h);
    ctx.strokeStyle = cssColor(ink.color, hl ? 0.35 : 1);
    ctx.lineWidth = ink.width * w;
    ctx.lineCap = hl ? 'square' : 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
