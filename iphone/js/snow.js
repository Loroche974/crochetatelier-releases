// Christmas theme: garland across the top of Home and light snow (port of ui/home/Snowfall.kt).

/** Light snow over the screen; touches go through. Nothing when the phone asks for less motion. Returns a stop function. */
export function snowfall(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'snow';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const flakes = Array.from({ length: 45 }, () => ({ x: Math.random(), phase: Math.random(), speed: 0.03 + Math.random() * 0.04, r: 2.5 + Math.random() * 3.5 }));
  // Set by theme.js. Silver on light backgrounds: white would vanish.
  const color = document.documentElement.style.colorScheme === 'dark' ? '255,255,255' : '159,179,200';
  const start = performance.now();
  let frame;
  const draw = (now) => {
    const dpr = devicePixelRatio || 1;
    const w = innerWidth, h = innerHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = (now - start) / 1000;
    for (const f of flakes) {
      const y = ((f.phase + t * f.speed) % 1) * h;
      const x = (f.x + 0.02 * Math.sin(t + f.phase * 6.28)) * w;
      const alpha = Math.min(1, (1 - y / h) * 4) * 0.8; // fades out in the last quarter
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(frame); canvas.remove(); };
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
