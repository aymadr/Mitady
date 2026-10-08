// Light / dark theme. The choice is remembered; without one, the system decides.
// Switching expands from the clicked button as a circle (View Transitions API).
const KEY = 'mitady.theme';
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const stored = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const system = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const current = () => root.dataset.theme || stored() || system();

function paint(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a1410' : '#f4f1e8');
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', theme === 'dark');
    b.setAttribute('aria-label', theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
  });
}

export function setTheme(theme, origin) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  if (!document.startViewTransition || reduced) return paint(theme);
  const x = origin?.x ?? innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('vt-theme');
  const t = document.startViewTransition(() => paint(theme));
  t.ready.then(() =>
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 800, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' },
    ),
  ).catch(() => {});
  t.finished.finally(() => root.classList.remove('vt-theme'));
}

export function initTheme() {
  paint(current());
  // Follow the system until the user picks one.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => !stored() && paint(system()));
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-toggle]');
    if (!b) return;
    const r = b.getBoundingClientRect();
    setTheme(current() === 'dark' ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  });
}

export const toggleHtml = `<button class="theme-toggle" data-theme-toggle type="button" aria-label="Changer de thème">
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <mask id="moon-mask"><rect x="0" y="0" width="24" height="24" fill="#fff"/><circle class="moon-cut" cx="24" cy="0" r="8" fill="#000"/></mask>
    <circle class="sun-core" cx="12" cy="12" r="4.6" fill="currentColor" stroke="none" mask="url(#moon-mask)"/>
    <g class="sun-rays"><path d="M12 2.5v2.2M12 19.300v2.200M2.500 12h2.200M19.300 12h2.200M5.300 5.300l1.500 1.500M17.200 17.200l1.500 1.500M18.700 5.300l-1.500 1.500M6.800 17.200l-1.500 1.500"/></g>
  </svg>
</button>`;
