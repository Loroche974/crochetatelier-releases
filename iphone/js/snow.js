// Seasonal decorations of Home (port of ui/home/Snowfall.kt): snow (Noël), hearts (Saint-Valentin),
// eggs (Pâques), pumpkins and skulls (Halloween), and the Christmas garland.

const SHADES = {
  SAINT_VALENTIN: () => ['#E91E63', '#F48FB1', '#D32F2F', '#FF80AB'],
  PAQUES: () => ['#F4B6C2', '#A7D7C5', '#F9D56E', '#B9A7E8'],
  // Bone grey-violet on a light background, where off-white would vanish.
  HALLOWEEN: (dark) => ['#E88A2E', dark ? '#E8E2D6' : '#9E92B0'],
  // Silver on a light background: white would vanish.
  NOEL: (dark) => [dark ? 'rgba(255,255,255,0.8)' : '#9FB3C8'],
};

/** Light fall over the screen for [seasonId]; touches go through. Nothing when the phone asks for less motion. Returns a stop function. */
export function seasonFall(host, seasonId) {
  if (!SHADES[seasonId] || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'snow';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const noel = seasonId === 'NOEL';
  const flakes = Array.from({ length: noel ? 45 : 22 }, () => ({
    x: Math.random(), phase: Math.random(), speed: 0.03 + Math.random() * 0.04, r: 2.5 + Math.random() * 3.5, shade: Math.floor(Math.random() * 4),
  }));
  const root = document.documentElement;
  const dark = root.style.colorScheme === 'dark'; // set by theme.js
  const shades = SHADES[seasonId](dark);
  const hole = getComputedStyle(root).getPropertyValue('--background').trim() || '#000';
  const start = performance.now();
  let frame;
  const draw = (now) => {
    const dpr = devicePixelRatio || 1;
    const w = innerWidth, h = innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = (now - start) / 1000;
    for (const f of flakes) {
      const y = ((f.phase + t * f.speed) % 1) * h;
      const x = (f.x + 0.02 * Math.sin(t + f.phase * 6.28)) * w;
      // Fade out in the last quarter so the fall does not end on a hard line.
      ctx.globalAlpha = Math.min(1, (1 - y / h) * 4) * (noel ? 1 : 0.7);
      const color = shades[f.shade % shades.length];
      const swing = Math.sin(t + f.phase * 6.28);
      ctx.save();
      ctx.translate(x, y);
      if (noel) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fill();
      } else if (seasonId === 'SAINT_VALENTIN') {
        heart(ctx, color, f.r * 1.4);
      } else if (seasonId === 'PAQUES') {
        ctx.rotate((25 * swing * Math.PI) / 180);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, f.r * 1.2, f.r * 1.65, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.rotate((20 * swing * Math.PI) / 180);
        if (f.shade % 2 === 0) pumpkin(ctx, color, f.r * 1.5); else skull(ctx, color, hole, f.r * 1.9);
      }
      ctx.restore();
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(frame); canvas.remove(); };
}

// Shapes centred on (0, 0), same proportions as on Android.
function oval(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
}
function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function heart(ctx, color, s) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.6);
  ctx.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.5, -s * 0.9, 0, -s * 0.3);
  ctx.bezierCurveTo(s * 0.5, -s * 0.9, s * 1.2, -s * 0.1, 0, s * 0.6);
  ctx.fill();
}

function pumpkin(ctx, color, s) {
  const side = '#C8611A';
  oval(ctx, -s * 1.1, -s * 0.75, s * 1.3, s * 1.5, side);
  oval(ctx, -s * 0.2, -s * 0.75, s * 1.3, s * 1.5, side);
  oval(ctx, -s * 0.55, -s * 0.8, s * 1.1, s * 1.6, color);
  ctx.fillStyle = '#4E7A2E';
  ctx.fillRect(-s * 0.12, -s * 1.1, s * 0.24, s * 0.4);
}

function skull(ctx, bone, hole, s) {
  circle(ctx, 0, -s * 0.15, s * 0.8, bone);
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-s * 0.45, s * 0.3, s * 0.9, s * 0.55, s * 0.15) : ctx.rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.55);
  ctx.fill();
  circle(ctx, -s * 0.3, -s * 0.1, s * 0.22, hole);
  circle(ctx, s * 0.3, -s * 0.1, s * 0.22, hole);
  circle(ctx, 0, s * 0.25, s * 0.09, hole);
}

/** Baubles hanging from a sagging string (SVG, scales with the screen). */
export function garland() {
  const loops = 4, W = 400, H = 48, r = H * 0.16, sag = H * 0.45, lw = W / loops;
  const colors = ['#D32F2F', '#F2C14E', '#2E7D32'];
  let path = '', baubles = '', n = 0;
  for (let i = 0; i < loops; i++) {
    const x0 = i * lw;
    path += `M${x0},${r} Q${x0 + lw / 2},${r + sag * 2} ${x0 + lw},${r} `;
    for (let k = 1; k <= 3; k++) {
      const t = k / 4, x = x0 + t * lw, y = r + sag * 2 * 2 * t * (1 - t);
      baubles += `<circle cx="${x}" cy="${y + r}" r="${r}" fill="${colors[n++ % 3]}"/><circle cx="${x - r * 0.35}" cy="${y + r - r * 0.35}" r="${r * 0.3}" fill="#fff8"/>`;
    }
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="garland" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="var(--secondary)" stroke-width="1.5"/>${baubles}</svg>`;
  return wrap.firstChild;
}
