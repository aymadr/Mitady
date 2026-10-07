// The search screen: little 3D-style creatures, one per job board, play leapfrog while
// the server searches. Each creature wears the site's logo and reacts when its site finds offers.
import { S } from '../main.js';
import { html } from '../lib.js';
import { siteLogo } from '../logos.js';
import { celebrate } from '../fx.js';
import { creatureSvg as creature, BODIES } from '../mascot.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let root = null;
let cast = []; // { el, shadow, x, slot, label }
let order = [];
let running = false;
let slotW = 110;
const state = { seen: 0, dupes: 0, fresh: 0, pct: 0, perSource: {}, total: 0 };
let minimized = false;
let finished = null;

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

export function openSearch({ onMinimize } = {}) {
  if (root) return;
  minimized = false;
  finished = null;
  Object.assign(state, { seen: 0, dupes: 0, fresh: 0, pct: 0, perSource: {}, total: 0 });
  const ids = Array.isArray(S.profile.search.sources) ? S.profile.search.sources : S.sources.filter((s) => s.on).map((s) => s.id);
  const sources = S.sources.filter((s) => ids.includes(s.id));

  root = document.createElement('div');
  root.className = 'srch';
  root.innerHTML = html`
    <div class="srch-bg"><i class="ob-blob b1"></i><i class="ob-blob b2"></i><i class="ob-blob b3"></i></div>
    <button class="srch-min" id="srch-min">Réduire</button>
    <div class="srch-body">
      <div class="ob-kicker"><span></span>Recherche en cours</div>
      <h2 class="srch-title">Mitady <em>cherche</em> pour toi.</h2>
      <p class="srch-action" id="srch-action">Je réveille mes petits assistants…</p>
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

  // The cast: one creature per site.
  const row = root.querySelector('#lf-row');
  const avail = Math.min(innerWidth - 80, 1000);
  const n = Math.max(1, sources.length);
  slotW = Math.min(118, Math.max(70, (avail - 100) / n));
  const size = Math.min(104, slotW * 0.92);
  row.style.width = `${slotW * n}px`;
  row.style.setProperty('--mon', `${size}px`);
  cast = sources.map((src, i) => {
    const el = document.createElement('div');
    el.className = 'mon';
    el.innerHTML = `${creature(i)}<span class="mon-badge">${siteLogo(src.label, Math.round(size * 0.34))}</span><span class="mon-plus"></span>`;
    el.style.setProperty('--n', i);
    const shadow = document.createElement('i');
    shadow.className = 'lf-sh';
    row.append(shadow, el);
    return { el, src, i, shadow, plus: el.querySelector('.mon-plus') };
  });
  order = [...cast];
  layout();
  if (!reduced) {
    running = true;
    hopLoop();
  }
  return root;
}

function layout() {
  order.forEach((c, slot) => {
    c.slot = slot;
    c.el.style.transform = `translate3d(${slot * slotW}px, 0, 0)`;
    c.shadow.style.transform = `translate3d(${slot * slotW}px, 0, 0)`;
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Leapfrog: the creature at the back jumps over the whole line to the front, with anticipation,
// stretch in the air, a backflip, and a squash on landing, while the others shuffle back a step.
async function hopLoop() {
  while (running && root) {
    if (cast.length < 2) {
      await bounce(cast[0]);
      await wait(500);
      continue;
    }
    const leaper = order[0];
    const n = order.length;
    const from = 0;
    const to = (n - 1) * slotW;
    const H = 70 + n * 16;
    const dur = 1050 + n * 90;
    leaper.el.classList.add('air');
    leaper.el.style.zIndex = 20;

    const steps = 22;
    const frames = [];
    const sh = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const arc = Math.sin(Math.PI * t);
      const x = from + (to - from) * t;
      // Anticipation squat, then stretch up, then squash on landing.
      let sx = 1;
      let sy = 1;
      if (t < 0.12) { sx = 1 + 0.2 * (t / 0.12); sy = 1 - 0.22 * (t / 0.12); }
      else if (t < 0.5) { sx = 1.2 - 0.34 * ((t - 0.12) / 0.38); sy = 0.78 + 0.4 * ((t - 0.12) / 0.38); }
      else if (t < 0.9) { sx = 0.86 + 0.14 * ((t - 0.5) / 0.4); sy = 1.18 - 0.18 * ((t - 0.5) / 0.4); }
      else { const q = (t - 0.9) / 0.1; sx = 1 + 0.28 * Math.sin(Math.PI * q); sy = 1 - 0.3 * Math.sin(Math.PI * q); }
      const rot = -360 * Math.min(1, Math.max(0, (t - 0.12) / 0.76));
      frames.push({ transform: `translate3d(${x}px, ${-H * arc}px, 0) rotate(${rot}deg) scale(${sx}, ${sy})`, offset: t });
      sh.push({ transform: `translate3d(${x}px, 0, 0) scale(${1 - 0.55 * arc})`, opacity: 0.55 - 0.3 * arc, offset: t });
    }
    const a = leaper.el.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,.05,.55,.95)' });
    leaper.shadow.animate(sh, { duration: dur, easing: 'cubic-bezier(.45,.05,.55,.95)' });
    // Everyone else hops one step back, a little after each other.
    order.slice(1).forEach((c, k) => {
      const x0 = c.slot * slotW;
      c.el.animate(
        [
          { transform: `translate3d(${x0}px, 0, 0) scale(1,1)` },
          { transform: `translate3d(${x0 - slotW * 0.5}px, -16px, 0) scale(.94,1.1)`, offset: 0.5 },
          { transform: `translate3d(${x0 - slotW}px, 0, 0) scale(1.1,.9)`, offset: 0.9 },
          { transform: `translate3d(${x0 - slotW}px, 0, 0) scale(1,1)` },
        ],
        { duration: 520, delay: dur * 0.5 + k * 55, easing: 'ease-in-out', fill: 'both' },
      );
      c.shadow.animate([{ transform: `translate3d(${x0}px, 0, 0)` }, { transform: `translate3d(${x0 - slotW}px, 0, 0)` }], { duration: 520, delay: dur * 0.5 + k * 55, easing: 'ease-in-out', fill: 'both' });
    });
    await a.finished.catch(() => {});
    if (!running || !root) return;
    dust(leaper, to);
    order = [...order.slice(1), leaper];
    leaper.el.classList.remove('air');
    leaper.el.style.zIndex = '';
    // Commit the final positions, then let the pieces settle before the next jump.
    cast.forEach((c) => { c.el.getAnimations().forEach((an) => an.cancel()); c.shadow.getAnimations().forEach((an) => an.cancel()); });
    layout();
    await wait(380);
  }
}

// A puff of dust where a creature lands.
function dust(c, x) {
  const row = root.querySelector('#lf-row');
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('i');
    d.className = 'dust';
    const a = (i / 6) * Math.PI;
    d.style.cssText = `left:${x + 34}px;--dx:${Math.cos(a) * 60 * (i % 2 ? 1 : 0.7)}px;--dy:${-Math.sin(a) * 34}px;--c:${BODIES[c.i % BODIES.length][0]}`;
    row.append(d);
    setTimeout(() => d.remove(), 800);
  }
}

// Happy little bounce (used when a site reports offers, and for the grand finale).
async function bounce(c, { big = false } = {}) {
  if (!c || reduced) return;
  const x = c.slot * slotW;
  const up = big ? 54 : 30;
  c.el.classList.add('happy');
  await c.el.animate(
    [
      { transform: `translate3d(${x}px, 0, 0) scale(1, 1)` },
      { transform: `translate3d(${x}px, 0, 0) scale(1.18, .8)`, offset: 0.18 },
      { transform: `translate3d(${x}px, ${-up}px, 0) scale(.88, 1.16)`, offset: 0.5 },
      { transform: `translate3d(${x}px, 0, 0) scale(1.14, .86)`, offset: 0.82 },
      { transform: `translate3d(${x}px, 0, 0) scale(1, 1)` },
    ],
    { duration: 620, easing: 'ease-out' },
  ).finished.catch(() => {});
  c.el.classList.remove('happy');
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
    state.total = e.batches;
    set('#srch-action', ACTIONS.start);
    setPct(3);
  } else if (e.stage === 'search') {
    set('#srch-action', `« ${e.keyword} » · ${e.contract}`);
    count(root.querySelector('[data-stat="seen"]'), e.seen);
    setPct(5 + (e.batch / e.batches) * 55);
    // Creatures whose site found something cheer, with a +N bubble.
    for (const c of cast) {
      const now = e.perSource[c.src.label] || 0;
      const before = state.perSource[c.src.label] || 0;
      if (now > before) {
        c.plus.textContent = `+${now - before}`;
        c.plus.classList.remove('show');
        void c.plus.offsetWidth;
        c.plus.classList.add('show');
        if (!c.el.classList.contains('air')) bounce(c);
      }
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
  window.dispatchEvent(new CustomEvent('mitady:search-progress', { detail: { pct: state.pct, action: root.querySelector('#srch-action')?.textContent } }));
}

export const progressInfo = () => ({ pct: state.pct, action: root?.querySelector('#srch-action')?.textContent || '' });

function minimize() {
  minimized = true;
  root.classList.add('min');
  document.body.classList.remove('ob-open');
}

// Called when the search ends. `onSee` runs when the user clicks "Voir les offres".
export async function finishSearch({ added, merged = 0, onSee }) {
  if (!root) return;
  running = false;
  cast.forEach((c) => c.el.getAnimations().forEach((an) => an.cancel()));
  layout();
  root.classList.remove('min');
  document.body.classList.add('ob-open');
  minimized = false;
  setPct(100);
  count(root.querySelector('[data-stat="fresh"]'), added);
  set('#srch-action', added ? 'Terminé ! Voici ce que j\'ai trouvé.' : 'Terminé : rien de nouveau pour le moment.');
  root.querySelector('.srch-title').innerHTML = added ? `<em>${added}</em> nouvelle${added > 1 ? 's' : ''} offre${added > 1 ? 's' : ''} !` : 'Rien de <em>nouveau</em>.';
  root.querySelector('#srch-min').hidden = true;
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
    // The whole cast jumps for joy, one after the other.
    for (const c of cast) {
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
