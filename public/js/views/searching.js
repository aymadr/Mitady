// The search screen: pixel animals, one per job board, play leapfrog while the server searches.
// Each animal carries its site's logo above its head and tosses it in the air when the site finds offers.
// Your own companion is always one of them.
import { S } from '../main.js';
import { html, api, fail } from '../lib.js';
import { siteLogo, logoRatio } from '../logos.js';
import { celebrate } from '../fx.js';
import { petSvg, petOf, defaultPet, ANIMALS } from '../pet.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUST = ['#f5a524', '#ee5fa7', '#5b5bf0', '#22c08b', '#2fa6f0', '#9b5cf6'];

let root = null;
let cast = []; // { el, shadow, logo, plus, pet, src, i, slot }
let order = [];
let running = false;
let slotW = 110;
const state = { pct: 0, perSource: {} };
let minimized = false;

const count = (el, to) => {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 700);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export const isSearching = () => Boolean(root);
export const isMinimized = () => minimized;

// The user's companion first, then the other animals.
function animalsFor(n) {
  const mine = petOf(S.profile);
  const others = ANIMALS.map((a) => a.id).filter((id) => id !== mine.animal);
  return Array.from({ length: n }, (_, i) => (i === 0 ? mine : defaultPet(others[(i - 1) % others.length])));
}

export function openSearch({ onMinimize } = {}) {
  if (root) return;
  minimized = false;
  Object.assign(state, { pct: 0, perSource: {} });
  const ids = Array.isArray(S.profile.search.sources) ? S.profile.search.sources : S.sources.filter((s) => s.on).map((s) => s.id);
  const sources = S.sources.filter((s) => ids.includes(s.id));

  root = document.createElement('div');
  root.className = 'srch';
  root.innerHTML = html`
    <div class="srch-bg"><i class="ob-blob b1"></i><i class="ob-blob b2"></i><i class="ob-blob b3"></i></div>
    <div class="srch-top"><button class="srch-stop" id="srch-stop">Arrêter la recherche</button><button class="srch-min" id="srch-min">Réduire</button></div>
    <div class="srch-body">
      <div class="ob-kicker"><span></span>Recherche en cours</div>
      <h2 class="srch-title">Mitady <em>cherche</em> pour toi.</h2>
      <p class="srch-action" id="srch-action">Mes petits assistants se réveillent…</p>
      <div class="lf" id="lf">
        <div class="lf-sky"><span class="lf-star s1"></span><span class="lf-star s2"></span><span class="lf-star s3"></span><span class="lf-star s4"></span></div>
        <div class="lf-floor"></div>
        <div class="lf-row" id="lf-row"></div>
      </div>
      <div class="srch-stats">
        <div><b data-stat="seen" data-v="0">0</b><span>offres vues</span></div>
        <div><b data-stat="dupes" data-v="0">0</b><span>doublons écartés</span></div>
        <div class="hero"><b data-stat="fresh" data-v="0">0</b><span>nouvelles offres</span></div>
      </div>
      <div class="srch-bar"><i id="srch-fill"></i></div>
      <div class="srch-foot" id="srch-foot"><span class="hint">Tu peux réduire cette fenêtre et continuer à naviguer pendant ce temps.</span></div>
    </div>`.toString();
  document.body.append(root);
  document.body.classList.add('ob-open');
  root.querySelector('#srch-min').addEventListener('click', () => {
    minimize();
    onMinimize?.();
  });
  root.querySelector('#srch-stop').addEventListener('click', stopSearch);

  // The cast: one animal per site, each carrying its logo.
  const row = root.querySelector('#lf-row');
  const n = Math.max(1, sources.length);
  const avail = Math.min(innerWidth - 80, 1000);
  slotW = Math.min(122, Math.max(72, (avail - 100) / n));
  const size = Math.min(104, slotW * 0.9);
  row.style.width = `${slotW * n}px`;
  row.style.setProperty('--mon', `${size}px`);
  const pets = animalsFor(n);
  cast = sources.map((src, i) => {
    const el = document.createElement('div');
    el.className = 'lf-pet';
    el.innerHTML = `${petSvg(pets[i], { size, mood: 'idle' })}<span class="lf-logo">${siteLogo(src.label, Math.round(Math.min(size * 0.46, (slotW * 0.96) / logoRatio(src.label))))}</span><span class="lf-plus"></span>`;
    const shadow = document.createElement('i');
    shadow.className = 'lf-sh';
    row.append(shadow, el);
    return { el, src, i, shadow, logo: el.querySelector('.lf-logo'), plus: el.querySelector('.lf-plus'), pet: el.querySelector('.pet') };
  });
  order = [...cast];
  layout();
  if (!reduced) {
    running = true;
    hopLoop();
  }
}

// Stops the search on the server; what was found so far is kept.
export async function stopSearch() {
  const btn = root?.querySelector('#srch-stop');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'J’arrête…';
  }
  set('#srch-action', 'J’arrête la recherche et je garde ce que j’ai trouvé…');
  try {
    await api('/search/stop', { method: 'POST' });
  } catch (e) {
    fail(e);
  }
}

function layout() {
  order.forEach((c, slot) => {
    c.slot = slot;
    c.el.style.transform = `translate3d(${slot * slotW}px, 0, 0)`;
    c.shadow.style.transform = `translate3d(${slot * slotW}px, 0, 0)`;
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Leapfrog: the animal at the back jumps over the whole line to the front, with a squat before the
// jump, a stretch in the air, a flip, and a squash on landing, while the others hop back one step.
async function hopLoop() {
  while (running && root) {
    if (cast.length < 2) {
      await bounce(cast[0]);
      await wait(500);
      continue;
    }
    const leaper = order[0];
    const n = order.length;
    const to = (n - 1) * slotW;
    const H = 70 + n * 16;
    const dur = 1000 + n * 90;
    leaper.el.style.zIndex = 20;
    leaper.pet.classList.add('air');

    const steps = 22;
    const frames = [];
    const sh = [];
    const logoFrames = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const arc = Math.sin(Math.PI * t);
      const x = to * t;
      let sx = 1;
      let sy = 1;
      if (t < 0.12) { sx = 1 + 0.16 * (t / 0.12); sy = 1 - 0.18 * (t / 0.12); }
      else if (t < 0.5) { sx = 1.16 - 0.3 * ((t - 0.12) / 0.38); sy = 0.82 + 0.34 * ((t - 0.12) / 0.38); }
      else if (t < 0.9) { sx = 0.86 + 0.14 * ((t - 0.5) / 0.4); sy = 1.16 - 0.16 * ((t - 0.5) / 0.4); }
      else { const q = (t - 0.9) / 0.1; sx = 1 + 0.24 * Math.sin(Math.PI * q); sy = 1 - 0.26 * Math.sin(Math.PI * q); }
      const rot = -360 * Math.min(1, Math.max(0, (t - 0.14) / 0.72));
      frames.push({ transform: `translate3d(${x}px, ${-H * arc}px, 0) rotate(${rot}deg) scale(${sx}, ${sy})`, offset: t });
      sh.push({ transform: `translate3d(${x}px, 0, 0) scale(${1 - 0.55 * arc})`, opacity: 0.55 - 0.3 * arc, offset: t });
      // The logo stays upright while its animal flips.
      logoFrames.push({ transform: `rotate(${-rot}deg)`, offset: t });
    }
    const ease = 'cubic-bezier(.45,.05,.55,.95)';
    const a = leaper.el.animate(frames, { duration: dur, easing: ease });
    leaper.shadow.animate(sh, { duration: dur, easing: ease });
    leaper.logo.animate(logoFrames, { duration: dur, easing: ease });
    // Everyone else hops one step back, a little after each other.
    order.slice(1).forEach((c, k) => {
      const x0 = c.slot * slotW;
      const timing = { duration: 520, delay: dur * 0.5 + k * 55, easing: 'steps(8, jump-none)', fill: 'both' };
      c.el.animate(
        [
          { transform: `translate3d(${x0}px, 0, 0)` },
          { transform: `translate3d(${x0 - slotW * 0.5}px, -18px, 0)`, offset: 0.5 },
          { transform: `translate3d(${x0 - slotW}px, 0, 0)` },
        ],
        timing,
      );
      c.shadow.animate([{ transform: `translate3d(${x0}px, 0, 0)` }, { transform: `translate3d(${x0 - slotW}px, 0, 0)` }], timing);
    });
    await a.finished.catch(() => {});
    if (!running || !root) return;
    dust(leaper, to);
    order = [...order.slice(1), leaper];
    leaper.pet.classList.remove('air');
    leaper.el.style.zIndex = '';
    cast.forEach((c) => {
      c.el.getAnimations().forEach((an) => an.cancel());
      c.shadow.getAnimations().forEach((an) => an.cancel());
    });
    layout();
    await wait(380);
  }
}

// Square pixels of dust where an animal lands.
function dust(c, x) {
  const row = root.querySelector('#lf-row');
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('i');
    d.className = 'dust';
    const a = (i / 7) * Math.PI;
    d.style.cssText = `left:${x + 40}px;--dx:${Math.cos(a) * 64 * (i % 2 ? 1 : 0.7)}px;--dy:${-Math.sin(a) * 36}px;--c:${DUST[(c.i + i) % DUST.length]}`;
    row.append(d);
    setTimeout(() => d.remove(), 800);
  }
}

// A happy hop (used for the grand finale).
async function bounce(c, { big = false } = {}) {
  if (!c || reduced) return;
  const x = c.slot * slotW;
  const up = big ? 56 : 30;
  await c.el.animate(
    [
      { transform: `translate3d(${x}px, 0, 0) scale(1, 1)` },
      { transform: `translate3d(${x}px, 0, 0) scale(1.14, .84)`, offset: 0.18 },
      { transform: `translate3d(${x}px, ${-up}px, 0) scale(.9, 1.14)`, offset: 0.5 },
      { transform: `translate3d(${x}px, 0, 0) scale(1.12, .88)`, offset: 0.82 },
      { transform: `translate3d(${x}px, 0, 0) scale(1, 1)` },
    ],
    { duration: 620, easing: 'steps(10, jump-none)' },
  ).finished.catch(() => {});
}

// When a site reports offers, its animal tosses the logo up, spins it, and catches it again.
function toss(c, gained) {
  if (gained) {
    c.plus.textContent = `+${gained}`;
    c.plus.classList.remove('show');
    void c.plus.offsetWidth;
    c.plus.classList.add('show');
  }
  if (reduced) return;
  c.logo.animate(
    [
      { transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)' },
      { transform: 'translate3d(0, -86px, 0) rotate(180deg) scale(1.25)', offset: 0.5 },
      { transform: 'translate3d(0, 0, 0) rotate(360deg) scale(1)' },
    ],
    { duration: 900, easing: 'cubic-bezier(.3,.7,.4,1)' },
  );
  c.pet.classList.remove('hop');
  void c.pet.offsetWidth;
  c.pet.classList.add('hop');
}

// ---------- Progress from the server ----------

const ACTIONS = {
  start: 'Je pars explorer les sites…',
  filter: 'Je trie les offres hors sujet et les faux postes des écoles…',
  dedupe: 'Je fusionne les doublons entre les sites…',
  read: 'Je lis les annonces une par une…',
};

function set(sel, text) {
  const el = root?.querySelector(sel);
  if (el) el.textContent = text;
}

function setPct(p) {
  state.pct = Math.max(state.pct, Math.min(100, p));
  const fill = root?.querySelector('#srch-fill');
  if (fill) fill.style.width = `${state.pct}%`;
}

export function handleProgress(e) {
  if (!root) return;
  if (e.stage === 'start') {
    set('#srch-action', ACTIONS.start);
    setPct(3);
  } else if (e.stage === 'search') {
    set('#srch-action', `« ${e.keyword} » · ${e.contract}`);
    count(root.querySelector('[data-stat="seen"]'), e.seen);
    setPct(5 + (e.batch / e.batches) * 55);
    for (const c of cast) {
      const now = e.perSource[c.src.label] || 0;
      const before = state.perSource[c.src.label] || 0;
      if (now > before && !c.pet.classList.contains('air')) toss(c, now - before);
    }
    state.perSource = e.perSource;
  } else if (e.stage === 'filter') {
    set('#srch-action', ACTIONS.filter);
    setPct(64);
  } else if (e.stage === 'dedupe') {
    set('#srch-action', ACTIONS.dedupe);
    count(root.querySelector('[data-stat="dupes"]'), e.dupes);
    count(root.querySelector('[data-stat="fresh"]'), e.fresh);
    setPct(70);
  } else if (e.stage === 'read') {
    set('#srch-action', e.total ? `${ACTIONS.read.replace('…', '')} ${Math.min(e.done, e.total)} / ${e.total}` : ACTIONS.read);
    setPct(70 + (e.total ? (e.done / e.total) * 28 : 0));
  }
}

export const progressInfo = () => ({ pct: state.pct, action: root?.querySelector('#srch-action')?.textContent || '' });

function minimize() {
  minimized = true;
  root.classList.add('min');
  document.body.classList.remove('ob-open');
}

// Called when the search ends. `onSee` runs when the user clicks "Voir les offres".
export async function finishSearch({ added, merged = 0, stopped = false, onSee }) {
  if (!root) return;
  running = false;
  cast.forEach((c) => {
    c.el.getAnimations().forEach((an) => an.cancel());
    c.shadow.getAnimations().forEach((an) => an.cancel());
    c.pet.classList.remove('air');
  });
  layout();
  root.classList.remove('min');
  document.body.classList.add('ob-open');
  minimized = false;
  setPct(100);
  count(root.querySelector('[data-stat="fresh"]'), added);
  set('#srch-action', stopped ? 'Recherche arrêtée : je garde ce que j’ai déjà trouvé.' : added ? 'Terminé ! Voici ce que j\'ai trouvé.' : 'Terminé : rien de nouveau pour le moment.');
  root.querySelector('.srch-title').innerHTML = added ? `<em>${added}</em> nouvelle${added > 1 ? 's' : ''} offre${added > 1 ? 's' : ''} !` : stopped ? 'Recherche <em>arrêtée</em>.' : 'Rien de <em>nouveau</em>.';
  root.querySelector('.srch-top').hidden = true;
  const foot = root.querySelector('#srch-foot');
  foot.innerHTML = `<button class="ob-cta" id="srch-see">${added ? 'Voir les offres' : 'Fermer'}</button>${merged ? `<span class="hint">${merged} doublon${merged > 1 ? 's' : ''} déjà en liste fusionné${merged > 1 ? 's' : ''}.</span>` : ''}`;
  const close = () => {
    root.classList.add('out');
    document.body.classList.remove('ob-open');
    const el = root;
    root = null;
    cast = [];
    setTimeout(() => el.remove(), 500);
    onSee?.();
  };
  foot.querySelector('#srch-see').addEventListener('click', close);
  if (added) {
    const r = root.querySelector('.srch-stats .hero').getBoundingClientRect();
    celebrate({ x: r.left + r.width / 2, y: r.top + 20, count: 140, power: 1.2 });
    // The whole cast cheers, one after the other, logos in the air.
    for (const c of cast) {
      c.pet.classList.add('party');
      toss(c, 0);
      bounce(c, { big: true });
      await wait(90);
    }
  }
}

export function abortSearch() {
  running = false;
  if (!root) return;
  const el = root;
  root = null;
  cast = [];
  document.body.classList.remove('ob-open');
  el.classList.add('out');
  setTimeout(() => el.remove(), 500);
}
