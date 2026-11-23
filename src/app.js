const menu = document.querySelector('.side-nav');
const menuToggle = document.querySelector('.menu-toggle');
const closeMenu = () => {
  menu.classList.remove('is-expanded');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Expand menu');
};
menuToggle?.addEventListener('click', () => {
  const expanded = menu.classList.toggle('is-expanded');
  menuToggle.setAttribute('aria-expanded', String(expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Collapse menu' : 'Expand menu');
  if (!expanded) menuToggle.blur();
});
document.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); menuToggle.blur(); } });
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', closeMenu));

const reel = document.querySelector('.reel');
if (reel) {
  const panels = [...reel.querySelectorAll('[data-panel]')];
  const dots = [...document.querySelectorAll('.panel-dot')];
  const counter = document.querySelector('[data-current-panel]');
  const status = document.querySelector('[data-panel-status]');
  let active = -1;
  let queued = false;
  const update = () => {
    const middle = reel.getBoundingClientRect().top + reel.clientHeight / 2;
    let closest = 0;
    let distance = Infinity;
    panels.forEach((panel, index) => {
      const bounds = panel.getBoundingClientRect();
      const delta = middle < bounds.top ? bounds.top - middle : middle > bounds.bottom ? middle - bounds.bottom : 0;
      if (delta < distance) { closest = index; distance = delta; }
    });
    if (active !== closest) {
      active = closest;
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === active);
        if (i === active) dot.setAttribute('aria-current', 'step');
        else dot.removeAttribute('aria-current');
      });
      counter.textContent = String(active + 1).padStart(2, '0');
      status.textContent = `${panels[active].dataset.panel}, panel ${active + 1} of ${panels.length}`;
    }
    queued = false;
  };
  reel.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  new ResizeObserver(update).observe(reel);
  const observer = new IntersectionObserver(update, { root: reel, threshold: [0, .25, .5, .75, 1] });
  panels.forEach(panel => observer.observe(panel));
  // Native wheel and touch scrolling retain their normal momentum and CSS snap.
  // Keyboard paging applies only when the user is not interacting with a control.
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a,button,summary,input,textarea,select,[contenteditable="true"]')) return;
    let target;
    if (['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) target = active + 1;
    if (['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey)) target = active - 1;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = panels.length - 1;
    if (target === undefined) return;
    event.preventDefault();
    panels[Math.max(0, Math.min(target, panels.length - 1))].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
  document.querySelectorAll('.skill').forEach(skill => skill.addEventListener('toggle', () => {
    if (skill.open) document.querySelectorAll('.skill').forEach(other => { if (other !== skill) other.open = false; });
  }));
  update();
}

const filters = [...document.querySelectorAll('[data-filter]')];
filters.forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  filters.forEach(other => {
    const selected = button === other;
    other.classList.toggle('is-active', selected);
    other.setAttribute('aria-pressed', String(selected));
  });
  let count = 0;
  document.querySelectorAll('[data-category]').forEach(project => {
    project.hidden = filter !== 'all' && project.dataset.category !== filter;
    if (!project.hidden) count++;
  });
  document.querySelector('[data-filter-status]').textContent = `${count} ${count === 1 ? 'collection' : 'collections'} shown`;
}));
