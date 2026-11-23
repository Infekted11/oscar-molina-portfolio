const menu = document.querySelector('.side-nav');
const menuToggle = document.querySelector('.nav-reveal');
let keyboardNavigation = false;
const usesTapNavigation = () => matchMedia('(max-width:700px), (hover:none), (pointer:coarse)').matches;
const setMenuVisible = visible => {
  menu.classList.toggle('is-visible', visible);
  menuToggle.setAttribute('aria-expanded', String(visible));
  menuToggle.setAttribute('aria-label', visible ? 'Hide navigation' : 'Show navigation');
};
const hasKeyboardFocus = () => keyboardNavigation && menu.contains(document.activeElement);
menuToggle.addEventListener('click', () => setMenuVisible(!menu.classList.contains('is-visible')));
document.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' || usesTapNavigation()) return;
  if (event.clientX <= 80) setMenuVisible(true);
  else if (event.clientX > menu.getBoundingClientRect().right + 32 && !hasKeyboardFocus()) setMenuVisible(false);
}, { passive: true });
document.addEventListener('pointerdown', event => {
  keyboardNavigation = false;
  if (!menu.contains(event.target) && !menuToggle.contains(event.target)) setMenuVisible(false);
});
document.addEventListener('focusin', event => {
  if (menu.contains(event.target)) setMenuVisible(true);
  else if (!menuToggle.contains(event.target)) setMenuVisible(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') keyboardNavigation = true;
  if (event.key === 'Escape') {
    if (menu.contains(document.activeElement)) document.activeElement.blur();
    setMenuVisible(false);
  }
});
document.documentElement.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'touch' && !usesTapNavigation() && !hasKeyboardFocus()) setMenuVisible(false);
});
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => setMenuVisible(false)));

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
      document.querySelectorAll('.nav-link').forEach(link => {
        const selected = panels[active].id === 'contact' ? link.getAttribute('href') === '#contact' : link.getAttribute('aria-current') === 'page';
        link.classList.toggle('is-selected', selected);
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
    if (skill.open) skill.closest('.skill-list').querySelectorAll('.skill').forEach(other => { if (other !== skill) other.open = false; });
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
