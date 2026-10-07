// Adds the 3D artwork to whatever the views render: page-header artwork,
// an icon before each section title, an illustration in empty states.
// Idempotent, and re-run whenever the page content changes.
import { tile, art } from './brand.js';
import { norm } from './lib.js';

const PAGE_ART = {
  '': ['search', 'doc', 'target'],
  profil: ['user', 'doc', 'sparkles'],
  reglages: ['gear', 'mail', 'key'],
};

const SECTION_ICON = [
  [/^ton cv|fichier word/, 'doc'],
  [/identite|avatar/, 'user'],
  [/resume/, 'sparkles'],
  [/competences/, 'layers'],
  [/parcours/, 'briefcase'],
  [/cherches/, 'target'],
  [/adresse|e-mail/, 'mail'],
  [/relance/, 'bell'],
  [/claude/, 'sparkles'],
  [/correspondances/, 'target'],
  [/entretiens/, 'chat'],
];

export function decorate(view) {
  const page = location.hash.replace(/^#\/?/, '').split('/')[0];

  const head = view.querySelector(':scope > .page-head');
  if (head && !head.dataset.art && PAGE_ART[page]) {
    head.dataset.art = '1';
    head.insertAdjacentHTML('beforeend', art(PAGE_ART[page]).toString());
  }

  view.querySelectorAll('.section-title:not([data-i3d])').forEach((el) => {
    el.dataset.i3d = '1';
    const t = norm(el.textContent.trim());
    const hit = SECTION_ICON.find(([re]) => re.test(t));
    if (hit) el.insertAdjacentHTML('afterbegin', tile(hit[1], { size: 30, cls: 'inline' }).toString());
  });

  view.querySelectorAll('.empty:not([data-i3d])').forEach((el) => {
    el.dataset.i3d = '1';
    el.insertAdjacentHTML('afterbegin', `<div class="empty-art">${tile('inbox', { size: 76, cls: 'float' })}${tile('search', { size: 44, cls: 'float' })}</div>`);
  });

  view.querySelectorAll('.dropzone:not([data-i3d])').forEach((el) => {
    el.dataset.i3d = '1';
    el.insertAdjacentHTML('afterbegin', `<div class="empty-art">${tile('doc', { size: 68, cls: 'float' })}</div>`);
  });
}

export function watch(view) {
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      decorate(view);
    });
  }).observe(view, { childList: true, subtree: true });
  decorate(view);
}
