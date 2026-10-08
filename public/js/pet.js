// The user's companion: a small pixel-art animal they pick and customise (animal, colour,
// accessory, name). It perches on search fields, sits in the header and in empty states.
// Sprites are 16 × 15 grids; each letter is a colour (see KEY), drawn as crisp SVG squares.
import { raw, html } from './lib.js';

// B body (custom colour) · D body shade · L belly (cream) · W white · K dark · E eye · N nose
// A cheek · P inner ear · Y beak and feet · '.' transparent
const SPRITES = {
  koala: {
    label: 'Koala', color: '#a3a9c2', fixed: { N: '#2a2438' },
    grid: [
      '................',
      '..BBBB....BBBB..',
      '.BBLLBB..BBLLBB.',
      '.BBLPBBBBBBPLBB.',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBEBBBBBBEBB..',
      '..BBBBLLLLBBBB..',
      '..BBBLNNNNLBBB..',
      '..BBBLNNNNLBBB..',
      '...BBLLNNLLBB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  chat: {
    label: 'Chat', color: '#f5a524',
    grid: [
      '................',
      '................',
      '..BB........BB..',
      '..BPB......BPB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBEEBBEEBBB..',
      '..BBBEEBBEEBBB..',
      '.KBBBBBNNBBBBBK.',
      '..BABBLLLLBBAB..',
      '...BBLLLLLLBB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  chien: {
    label: 'Chien', color: '#c98a5c',
    grid: [
      '................',
      '................',
      '................',
      '....BBBBBBBB....',
      '.DBBBBBBBBBBBBD.',
      'DDBBBBBBBBBBBBDD',
      'DDBBBBBBBBBBBBDD',
      'DDBBBBBBBBBBBBDD',
      '.DBBBEEBBEEBBBD.',
      '.DBBBEEBBEEBBBD.',
      '..BBBLLNNLLBBB..',
      '..BABLLLLLLBAB..',
      '...BBBBBBBBBB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  renard: {
    label: 'Renard', color: '#ff7a3d',
    grid: [
      '................',
      '..KB........BK..',
      '..KBB......BBK..',
      '..BBBB....BBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBEEBBEEBBB..',
      '..BBBEEBBEEBBB..',
      '..BWWBBNNBBWWB..',
      '..BWWWBBBBWWWB..',
      '...BWWWWWWWWB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  lapin: {
    label: 'Lapin', color: '#e9ddf8',
    grid: [
      '...BB......BB...',
      '...BP......PB...',
      '...BP......PB...',
      '...BP......PB...',
      '...BBB....BBB...',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBEEBBEEBBB..',
      '..BBBEEBBEEBBB..',
      '..BBBBBNNBBBBB..',
      '..BABBBWWBBBAB..',
      '...BBBBBBBBBB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  ours: {
    label: 'Ours', color: '#9a6a42',
    grid: [
      '................',
      '................',
      '..BBB......BBB..',
      '..BPB......BPB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBEEBBEEBBB..',
      '..BBBEEBBEEBBB..',
      '..BBBLLNNLLBBB..',
      '..BABLLLLLLBAB..',
      '...BBBBBBBBBB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  grenouille: {
    label: 'Grenouille', color: '#35c27a',
    grid: [
      '................',
      '................',
      '..BBBB....BBBB..',
      '.BBWEBB..BBEWBB.',
      '.BBBBBBBBBBBBBB.',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBKKKKKKKKBB..',
      '..BABLLLLLLBAB..',
      '...BBLLLLLLBB...',
      '....DDDDDDDD....',
      '...DD......DD...',
    ],
  },
  pingouin: {
    label: 'Pingouin', color: '#2f3a5c',
    grid: [
      '................',
      '................',
      '................',
      '....BBBBBBBB....',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BBBWWBBWWBBB..',
      '..BBWEEWWEEWBB..',
      '..BBWEEWWEEWBB..',
      '..BBBWWYYWWBBB..',
      '..BBBBWWWWBBBB..',
      '...BBBWWWWBBB...',
      '....BBBBBBBB....',
      '...YY......YY...',
    ],
  },
  hibou: {
    label: 'Hibou', color: '#a07a56',
    grid: [
      '................',
      '................',
      '..BB........BB..',
      '..BBB......BBB..',
      '..BBBBBBBBBBBB..',
      '..BBBBBBBBBBBB..',
      '..BWWWWBBWWWWB..',
      '..BWWWWBBWWWWB..',
      '..BWEEWBBWEEWB..',
      '..BWEEWBBWEEWB..',
      '..BBBBBYYBBBBB..',
      '..BBBLLLLLLBBB..',
      '...BBLLLLLLBB...',
      '....DDDDDDDD....',
      '...YY......YY...',
    ],
  },
};

export const ANIMALS = Object.entries(SPRITES).map(([id, s]) => ({ id, label: s.label, color: s.color }));

export const COLORS = ['#f5a524', '#ff7a3d', '#ff6b6b', '#ee5fa7', '#9b5cf6', '#5b5bf0', '#2fa6f0', '#22c08b', '#35c27a', '#c98a5c', '#e9ddf8', '#f3efe8', '#2f3a5c', '#2b2a3a'];

// Overlays, drawn over the sprite. R/Y/C/S/K use the colours listed in ACC.
const ACC = {
  aucun: { label: 'Aucun', grid: [] },
  casquette: {
    label: 'Casquette',
    colors: { C: '#2f6fed', K: '#173a8f' },
    grid: ['', '', '', '....CCCCCCCC....', '...CCCCCCCCCCCC.', '..KKKKKKKKKKKKK.'],
  },
  fete: {
    label: 'Fête',
    colors: { R: '#ee5fa7', Y: '#ffcd00' },
    grid: ['.......YY.......', '......RYYR......', '.....RRYYRR.....', '....RRRYYRRR....', '...RRRRYYRRRR...'],
  },
  couronne: {
    label: 'Couronne',
    colors: { Y: '#ffcd00', R: '#ee5fa7' },
    grid: ['', '', '', '....Y..YY..Y....', '....YYYRRYYY....'],
  },
  lunettes: {
    label: 'Lunettes',
    colors: { K: '#23202e' },
    // White lenses go behind the eyes, the frames in front.
    behind: ['', '', '', '', '', '', '', '....www..www....', '....www..www....', '....www..www....', '....www..www....'],
    behindColors: { w: '#ffffff' },
    grid: ['', '', '', '', '', '', '...KKKKKKKKKK...', '...K...KK...K...', '...K...KK...K...', '...K...KK...K...', '...K...KK...K...', '...KKKKKKKKKK...'],
  },
  noeud: {
    label: 'Nœud',
    colors: { R: '#e5484d', Y: '#ffcd00' },
    grid: ['', '', '', '', '', '', '', '', '', '', '', '', '......RRRR......', '.....RRYYRR.....'],
  },
  echarpe: {
    label: 'Écharpe',
    colors: { S: '#5b5bf0', Y: '#8b8cff' },
    grid: ['', '', '', '', '', '', '', '', '', '', '', '', '...SSYSSYSSS....', '....SSSSSSSS....', '.....SS.........', '.....SS.........'],
  },
  casque: {
    label: 'Casque',
    colors: { K: '#2b2a3a', C: '#5b5bf0' },
    grid: ['', '', '', '', '...KKKKKKKKKK...', '.K............K.', '.K............K.', 'KC............CK', 'KC............CK', 'KC............CK'],
  },
};
export const ACCESSORIES = Object.entries(ACC).map(([id, a]) => ({ id, label: a.label }));

export const defaultPet = (animal = 'koala') => ({ animal, color: SPRITES[animal]?.color || '#f5a524', accessory: 'aucun', name: '' });
export const petOf = (profile) => ({ ...defaultPet(profile?.pet?.animal), ...(profile?.pet || {}) });

function mix(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * k));
  return `rgb(${c.join(',')})`;
}

function rects(grid, colorOf, only) {
  let out = '';
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || !ch) return;
      if (only && !only(ch, x, y, grid)) return;
      const c = colorOf(ch);
      if (c) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
    });
  });
  return out;
}

// The animal as an SVG, with an open and a closed pair of eyes (the CSS blinks between them).
function art(pet) {
  const sprite = SPRITES[pet.animal] || SPRITES.chat;
  const body = pet.color || sprite.color;
  const fixed = { L: '#fff3df', W: '#ffffff', K: '#2b2438', N: '#e2557a', A: '#ff8fae', P: '#ffb3cc', Y: '#ffb020', ...(sprite.fixed || {}) };
  const colorOf = (ch) => (ch === 'B' ? body : ch === 'D' ? mix(body, -0.22) : ch === 'E' ? null : fixed[ch]);
  const eyes = [];
  sprite.grid.forEach((row, y) => [...row].forEach((ch, x) => ch === 'E' && eyes.push([x, y])));
  const open = eyes.map(([x, y]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="#241a3a"/>`).join('');
  const closed = eyes.map(([x, y]) => `<rect x="${x}" y="${y + 0.62}" width="1.02" height=".4" fill="#241a3a"/>`).join('');
  const shine = `<rect x="4" y="5" width="2" height="1" fill="#fff" opacity=".35"/>`;
  const acc = ACC[pet.accessory] || ACC.aucun;
  const accHtml = rects(acc.grid, (ch) => acc.colors?.[ch]);
  const behind = acc.behind ? rects(acc.behind, (ch) => acc.behindColors?.[ch]) : '';
  return { base: rects(sprite.grid, colorOf) + behind, shine, open, closed, accHtml, eyes };
}

// The pet, ready to drop in a page: petSvg(pet, { size: 64, mood: 'idle' }).
// Moods (CSS): idle, sleep, think, party, wave, tick, hop.
export function petSvg(pet, { size = 64, mood = 'idle', label = '' } = {}) {
  const a = art(pet);
  const name = (pet.name || '').trim();
  return raw(
    `<span class="pet ${mood}" data-rest="${mood}" style="--pet:${size}px;--bd:-${(Math.random() * 4.6).toFixed(2)}s" ${name ? `title="${name.replace(/"/g, '')}"` : ''} aria-hidden="true">` +
      `<svg viewBox="0 0 16 16" width="100%" height="100%" shape-rendering="crispEdges">` +
      `<g class="pet-body">${a.base}${a.shine}<g class="pet-open">${a.open}</g><g class="pet-closed">${a.closed}</g>${a.accHtml}</g></svg>` +
      `<i class="pet-sh"></i><span class="pet-z z1">z</span><span class="pet-z z2">z</span><span class="pet-q">?</span>` +
      `${label ? `<em class="pet-label">${label}</em>` : ''}</span>`,
  );
}

// Just the head, for round badges (header).
export function petHead(pet, size = 38) {
  const a = art(pet);
  return raw(
    `<svg class="pet-head" viewBox="1 1 14 13" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true"><g>${a.base}${a.shine}${a.open}${a.accHtml}</g></svg>`,
  );
}

// ---------- Editor ----------

export function mountPetEditor(el, { pet, onChange, big = true } = {}) {
  let cfg = { ...petOf({ pet }) };
  const emit = () => onChange?.(cfg);

  const preview = () => {
    const box = el.querySelector('.pet-stage');
    box.innerHTML = `<div class="pet-mock"><span class="perch-demo">${petSvg(cfg, { size: big ? 112 : 88, mood: 'idle' })}</span><div class="pet-mock-field">${'Rechercher'}</div></div>`;
    const p = box.querySelector('.pet');
    p.dataset.sleepAfter = '9000';
    scheduleSleep(p);
    const z = el.querySelector('[data-sleep]');
    if (z) z.textContent = 'Dormir';
  };

  const draw = () => {
    el.innerHTML = html`<div class="avb pets ${big ? 'big' : ''}">
      <div class="avb-preview">
        <div class="pet-stage"></div>
        <p class="hint pet-tip">Touche-le : il saute, danse… et s'endort si tu le laisses tranquille.</p>
        <div class="row"><button type="button" class="btn btn-secondary btn-sm" data-sleep>Dormir</button><button type="button" class="btn btn-secondary btn-sm" data-random>Au hasard</button></div>
      </div>
      <div class="avb-opts">
        <div class="avb-row"><span class="avb-label">Animal</span>
          <div class="pet-pick" data-k="animal">${ANIMALS.map((a) => html`<button type="button" class="pet-opt" data-v="${a.id}" aria-pressed="${cfg.animal === a.id}" title="${a.label}">${petHead({ ...cfg, animal: a.id, color: a.color, accessory: 'aucun' }, 40)}<small>${a.label}</small></button>`)}</div></div>
        <div class="avb-row"><span class="avb-label">Couleur</span>
          <div class="swatches" data-k="color">${COLORS.map((c) => html`<button type="button" class="swatch" data-v="${c}" aria-pressed="${cfg.color === c}" aria-label="${c}" style="--c:${c}"></button>`)}<label class="swatch custom" title="Autre couleur" style="--c:${cfg.color}"><input type="color" value="${/^#/.test(cfg.color) ? cfg.color : '#f5a524'}" data-custom></label></div></div>
        <div class="avb-row"><span class="avb-label">Accessoire</span>
          <div class="chips" data-k="accessory">${ACCESSORIES.map((a) => html`<button type="button" class="chip ${cfg.accessory === a.id ? 'on' : 'suggest'}" data-v="${a.id}">${a.label}</button>`)}</div></div>
        <div class="avb-row"><span class="avb-label">Nom de l'animal</span>
          <input class="input input-sm" data-name maxlength="16" placeholder="Facultatif : Mochi, Biscotte…" value="${cfg.name}"></div>
      </div>
    </div>`.toString();
    preview();

    el.querySelectorAll('[data-k]').forEach((group) =>
      group.querySelectorAll('[data-v]').forEach((b) =>
        b.addEventListener('click', () => {
          const k = group.dataset.k;
          // A new animal starts in its own colour, unless a colour was picked by hand.
          cfg = { ...cfg, [k]: b.dataset.v, ...(k === 'animal' && cfg.color === (SPRITES[cfg.animal]?.color) ? { color: SPRITES[b.dataset.v].color } : {}) };
          draw();
          emit();
        }),
      ),
    );
    el.querySelector('[data-custom]').addEventListener('input', (e) => {
      cfg = { ...cfg, color: e.target.value };
      preview();
      emit();
    });
    el.querySelector('[data-name]').addEventListener('input', (e) => {
      cfg = { ...cfg, name: e.target.value };
      emit();
    });
    el.querySelector('[data-sleep]').addEventListener('click', (e) => {
      const p = el.querySelector('.pet-stage .pet');
      const asleep = p.classList.contains('sleep');
      if (asleep) playPet(p, 'wave');
      else sleepPet(p);
      e.currentTarget.textContent = asleep ? 'Dormir' : 'Réveiller';
    });
    el.querySelector('[data-random]').addEventListener('click', () => {
      const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      cfg = { ...cfg, animal: a.id, color: COLORS[Math.floor(Math.random() * COLORS.length)], accessory: ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)].id };
      draw();
      emit();
    });
  };
  draw();
  return { get: () => ({ pet: cfg }) };
}

// ---------- Life: tricks and sleep ----------

const TRICKS = ['hop', 'spin', 'wave', 'party'];
const LONG = { wave: 1800, party: 1800, spin: 700, hop: 600 };

export function sleepPet(el) {
  clearTimeout(el._trick);
  TRICKS.forEach((t) => el.classList.remove(t));
  el.classList.remove('think');
  el.classList.add('sleep');
}

// A pet with data-sleep-after (ms) falls asleep when left alone; one that rests asleep
// (the perched ones) goes back to sleep a few seconds after being played with.
function scheduleSleep(el) {
  clearTimeout(el._nap);
  const after = Number(el.dataset.sleepAfter) || (el.dataset.rest === 'sleep' ? 5000 : 0);
  if (!after) return;
  el._nap = setTimeout(() => {
    if (!el.isConnected) return;
    if (el.closest('.search-field')?.querySelector('input:focus')) return scheduleSleep(el);
    sleepPet(el);
    const b = document.querySelector('[data-sleep]');
    if (b && el.closest('.pet-stage')) b.textContent = 'Réveiller';
  }, after);
}

export function playPet(el, trick) {
  if (el.classList.contains('sleep')) {
    el.classList.remove('sleep');
    trick = 'wave';
  }
  trick ||= TRICKS[Math.floor(Math.random() * TRICKS.length)];
  clearTimeout(el._trick);
  TRICKS.forEach((t) => el.classList.remove(t));
  void el.offsetWidth;
  el.classList.add(trick);
  el._trick = setTimeout(() => el.classList.remove(trick), LONG[trick]);
  scheduleSleep(el);
}

// Any pet can be touched, anywhere in the app.
export function initPetPlay() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('.pet');
    if (!el || el.closest('button, a, [data-nopet]')) return;
    playPet(el);
  });
}
