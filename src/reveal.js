(() => {
  const overlay = document.querySelector('.load-overlay');
  if (!overlay) return;
  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pixelSize = 10; // Same CSS-pixel grid as the fluid renderer.
  const duration = 900;
  let frame = 0, deadline = 0, startTime = null, cells = [], cleared = 0, columns = 0, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    window.removeEventListener('resize', resize);
    reduced.removeEventListener('change', motionChange);
    document.documentElement.classList.remove('js-loading');
    document.body.inert = false;
    document.body.removeAttribute('aria-busy');
    overlay.remove();
  };
  const erase = progress => {
    const count = Math.min(cells.length, Math.floor(cells.length * progress));
    while (cleared < count) {
      const cell = cells[cleared++];
      ctx.clearRect((cell % columns) * pixelSize, Math.floor(cell / columns) * pixelSize, pixelSize, pixelSize);
    }
  };
  function resize() {
    if (done || !ctx) return;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * scale);
    canvas.height = Math.round(innerHeight * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#8d2c25';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    columns = Math.ceil(innerWidth / pixelSize);
    cells = Array.from({ length: columns * Math.ceil(innerHeight / pixelSize) }, (_, i) => i);
    // Smooth random fields keep neighbouring pixels together in organic clumps.
    const rows = Math.ceil(innerHeight / pixelSize);
    const field = scale => {
      const width = Math.ceil(columns / scale) + 2;
      const values = Array.from({ length: width * (Math.ceil(rows / scale) + 2) }, () => Math.random());
      const smooth = value => value * value * (3 - 2 * value);
      return (x, y) => {
        x /= scale; y /= scale;
        const ix = Math.floor(x), iy = Math.floor(y), tx = smooth(x - ix), ty = smooth(y - iy);
        const a = values[iy * width + ix], b = values[iy * width + ix + 1];
        const c = values[(iy + 1) * width + ix], d = values[(iy + 1) * width + ix + 1];
        return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      };
    };
    const broad = field(8), detail = field(4);
    const scores = cells.map(cell => {
      const x = cell % columns, y = Math.floor(cell / columns);
      return broad(x, y) * .8 + detail(x, y) * .2;
    });
    cells.sort((a, b) => scores[a] - scores[b]);
    cleared = 0;
    if (startTime !== null) erase(Math.min(1, (performance.now() - startTime) / duration));
    overlay.style.background = 'transparent';
  }
  function motionChange() { if (reduced.matches && startTime !== null) finish(); }
  const tick = now => {
    if (done) return;
    const progress = Math.min(1, (now - startTime) / duration);
    erase(progress);
    if (progress >= 1) finish();
    else frame = requestAnimationFrame(tick);
  };
  const begin = () => Promise.resolve(document.fonts?.ready).then(() => {
    if (done) return;
    if (!ctx || reduced.matches) { finish(); return; }
    startTime = performance.now();
    deadline = setTimeout(finish, 1000);
    frame = requestAnimationFrame(tick);
  });
  document.body.inert = true;
  document.body.setAttribute('aria-busy', 'true');
  resize();
  window.addEventListener('resize', resize, { passive: true });
  reduced.addEventListener('change', motionChange);
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
})();
