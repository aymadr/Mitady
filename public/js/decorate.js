// Adds the 3D artwork to whatever the views render: page-header artwork,
// an icon before each section title, an illustration in empty states.
// Idempotent, and re-run whenever the page content changes.
import { tile, art } from './brand.js';
import { petSvg, petOf } from './pet.js';
import { scene } from './scenery.js';
import { S } from './main.js';
import { norm } from './lib.js';

const PAGE_ART = {
  '': ['search', 'doc', 'target'],
  suivi: ['target', 'send', 'chat'],
  cv: ['doc', 'sparkles', 'user'],
  recherche: ['search', 'target', 'sparkles'],
  reglages: ['gear', 'mail', 'key'],
};

const SECTION_ICON = [
  [/^ton cv|fichier word/, 'doc'],
  [/identite|compagnon/, 'user'],
  [/resume/, 'sparkles'],
  [/competences/, 'layers'],
  [/parcours/, 'briefcase'],
  [/cherches/, 'target'],
  [/telephone/, 'send'],
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

  // Empty states get a creature whose mood matches the message.
  view.querySelectorAll('.empty:not([data-i3d])').forEach((el) => {
    el.dataset.i3d = '1';
    const t = norm(el.querySelector('strong')?.textContent || '');
    const mood = /tout est traite/.test(t) ? 'party' : /aucun resultat|injoignable/.test(t) ? 'think' : /aucune|rien/.test(t) ? 'sleep' : 'wave';
    const i = [...t].reduce((a, c) => (a + c.charCodeAt(0)) % 6, 0);
    const [name, size] = mood === 'party' ? ['flower', 92] : [['tree', 'bush', 'mushroom', 'gum', 'flower', 'cloud'][i], [110, 70, 64, 120, 90, 52][i]];
    el.insertAdjacentHTML('afterbegin', `<div class="empty-art">${scene(name, { size })}</div>`);
  });

  view.querySelectorAll('.dropzone:not([data-i3d])').forEach((el) => {
    el.dataset.i3d = '1';
    el.insertAdjacentHTML('afterbegin', `<div class="empty-art">${tile('doc', { size: 68, cls: 'float' })}${scene('bush', { size: 60 })}</div>`);
  });

  // The user's companion, perched on the edge of each search field: asleep until you click it.
  view.querySelectorAll('.search-field:not([data-perch])').forEach((el) => {
    el.dataset.perch = '1';
    el.insertAdjacentHTML('beforeend', `<span class="perch">${petSvg(petOf(S.profile), { size: 46, mood: 'sleep' })}</span>`);
  });
}

// After the companion is edited: redraw the perched ones.
export function refreshPerches() {
  document.querySelectorAll('.perch').forEach((p) => p.remove());
  document.querySelectorAll('.search-field[data-perch]').forEach((el) => delete el.dataset.perch);
  decorate(document.getElementById('view'));
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
