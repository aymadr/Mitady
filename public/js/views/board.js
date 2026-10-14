// "Suivi": a board with one column per stage. Drag an application from a column to another to
// change its status. Cards follow the pointer with a tilt, and the others slide into place.
import { S, upsertApp, go } from '../main.js';
import { html, mount, api, fail, toast, avatar, miniRing, relDate, norm, icons } from '../lib.js';
import { siteLogo } from '../logos.js';
import { cheerStatus } from '../mascot.js';
import { scene } from '../scenery.js';

const COLUMNS = [
  { id: 'todo', title: 'À traiter', color: '#8b8aa3', empty: 'Rien à traiter pour le moment.', deco: ['bush', 52] },
  { id: 'applied', title: 'Envoyées', color: '#2f7d5b', empty: 'Glisse ici une offre quand tu as postulé.', deco: ['flower', 62] },
  { id: 'interview', title: 'Entretiens', color: '#e0a800', empty: 'Pas encore d’entretien. Ça va venir.', deco: ['mushroom', 56] },
  { id: 'offer', title: 'Offres reçues', color: '#14b87d', empty: 'Ta première offre arrive bientôt.', deco: ['tree', 86] },
  { id: 'rejected', title: 'Refusées', color: '#c9604a', empty: 'Rien ici, tant mieux.', deco: ['cloud', 44] },
];
const SENT = ['applied', 'interview', 'offer', 'rejected'];
const ui = { query: '' };
let view = null;
// A finger that is dragging a card must not also scroll the page. iOS only honours this from a non-passive listener.
let touchDragging = false;
addEventListener('touchmove', (e) => { if (touchDragging && e.cancelable) e.preventDefault(); }, { passive: false });

function card(a) {
  return html`<article class="kcard" data-id="${a.id}" tabindex="0" aria-label="${a.title}, ${a.company}">
    <div class="kcard-top">${avatar(a.company)}<div class="grow"><b>${a.title}</b><small>${a.company}${a.location ? ` · ${a.location}` : ''}</small></div>${miniRing(a.score)}</div>
    <div class="kcard-foot">${siteLogo(a.source, 18)}<span class="kcard-kind">${a.contract || a.source}</span>${a.followUpDue ? html`<span class="badge orange">À relancer</span>` : ''}${a.status === 'applied' && a.appliedAt ? html`<span class="tiny">${relDate(a.appliedAt)}</span>` : ''}${a.link ? html`<a class="klink" href="${a.link}" target="_blank" rel="noopener" title="Voir l'annonce" aria-label="Voir l'annonce">${icons.external}</a>` : ''}</div>
  </article>`;
}

function visible(status) {
  const q = norm(ui.query);
  return S.applications
    .filter((a) => a.status === status && (!q || norm(`${a.title} ${a.company}`).includes(q)))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.addedAt.localeCompare(a.addedAt));
}

function board() {
  return html`<div class="board" id="board">${COLUMNS.map((c, ci) => {
    const list = visible(c.id);
    return html`<section class="kcol" data-status="${c.id}" style="--c:${c.color};--ci:${ci}">
      <header><i></i><h3>${c.title}</h3><span class="kcount">${list.length}</span></header>
      <div class="kcol-body">${list.length ? list.map(card) : html`<div class="kempty">${scene(c.deco[0], { size: c.deco[1] })}<p>${c.empty}</p></div>`}</div>
    </section>`;
  })}</div>`;
}

export function renderBoard(el) {
  view = el;
  const total = S.applications.filter((a) => a.status !== 'archived').length;
  mount(
    el,
    html`<div class="page-head"><div><h1 class="page-title">Suivi</h1><p class="page-sub">${total ? 'Glisse chaque offre d’une colonne à l’autre au fil de ta recherche.' : 'Tes candidatures apparaîtront ici, colonne par colonne.'}</p></div></div>
      <div class="toolbar"><div class="search-field"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="7" r="5"/><path d="m11 11 3.5 3.5"/></svg><input class="input" id="bq" placeholder="Filtrer par poste ou entreprise" value="${ui.query}"></div></div>
      ${board()}`,
  );
  el.querySelector('#bq').addEventListener('input', (e) => {
    ui.query = e.target.value;
    redraw();
  });
  bind();
}

function redraw() {
  const boardEl = view.querySelector('#board');
  const before = rects();
  boardEl.outerHTML = board().toString();
  bind();
  flip(before);
}

// Positions of every card, to animate them from where they were (FLIP).
function rects() {
  const out = new Map();
  view.querySelectorAll('.kcard').forEach((c) => out.set(c.dataset.id, c.getBoundingClientRect()));
  return out;
}
function flip(before, skip) {
  view.querySelectorAll('.kcard').forEach((c) => {
    const from = before.get(c.dataset.id);
    if (!from || c.dataset.id === skip) return;
    const to = c.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (!dx && !dy) return;
    c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.32,.72,0,1)' });
  });
}

function bind() {
  const boardEl = view.querySelector('#board');
  boardEl.querySelectorAll('.kcard').forEach((c) => {
    c.addEventListener('pointerdown', (e) => startPress(e, c));
    if (matchMedia('(pointer: coarse)').matches) c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('keydown', (e) => e.key === 'Enter' && go(`#/offres/${c.dataset.id}`));
  });
}

function startPress(e, cardEl) {
  if (e.button !== 0 || e.target.closest('a')) return;
  const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  const startX = e.clientX;
  const startY = e.clientY;
  let pointer = { x: startX, y: startY };
  let timer = null;
  let raf = 0;
  let dragging = false;
  let ghost = null;
  let lastX = e.clientX;
  let tilt = 0;
  let over = null;
  const rect = cardEl.getBoundingClientRect();
  const offX = e.clientX - rect.left;
  const offY = e.clientY - rect.top;

  const begin = () => {
    dragging = true;
    ghost = cardEl.cloneNode(true);
    ghost.classList.add('kghost');
    ghost.style.width = `${rect.width}px`;
    document.body.append(ghost);
    cardEl.classList.add('ph');
    document.body.classList.add('dragging');
    view.querySelector('#board').classList.add('drag');
    if (touch) {
      touchDragging = true;
      navigator.vibrate?.(12);
      place(startX, startY);
      lastFrame = 0;
      scrollLoop();
    }
  };
  const place = (x, y) => {
    ghost.style.transform = `translate3d(${x - offX}px, ${y - offY}px, 0) rotate(${Math.max(-14, Math.min(14, tilt))}deg) scale(1.04)`;
  };
  // The column under the finger, or the nearest one when it is in a gap or at the screen edge.
  const columnAt = (x, y) => {
    let best = null;
    let bd = 60;
    view.querySelectorAll('.kcol').forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = (x < r.left ? r.left - x : x > r.right ? x - r.right : 0) + (y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  };
  const hover = (x, y) => {
    const col = columnAt(x, y);
    if (col !== over) {
      over?.classList.remove('over');
      col?.classList.add('over');
      over = col;
    }
  };
  // Near the screen edge the board scrolls by itself, so a card can reach the columns that are off-screen.
  let lastFrame = 0;
  const scrollLoop = (now = performance.now()) => {
    if (!dragging) return;
    const f = lastFrame ? Math.min(3, (now - lastFrame) / (1000 / 60)) : 1; // same speed on a 60 and a 240 Hz screen
    lastFrame = now;
    const boardEl = view.querySelector('#board');
    const edge = 64;
    const step = pointer.x < edge ? -Math.ceil((edge - pointer.x) / 3) : pointer.x > innerWidth - edge ? Math.ceil((pointer.x - (innerWidth - edge)) / 3) : 0;
    const dx = Math.round(step * f);
    if (dx && boardEl) {
      boardEl.scrollLeft += dx;
      hover(pointer.x, pointer.y);
    }
    raf = requestAnimationFrame(scrollLoop);
  };
  const move = (ev) => {
    pointer = { x: ev.clientX, y: ev.clientY };
    const far = Math.hypot(ev.clientX - startX, ev.clientY - startY) > (touch ? 9 : 6);
    if (!dragging && touch && far) {
      // the finger moved before the long press: it is a swipe, let the page or the board scroll
      clearTimeout(timer);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      return;
    }
    if (!dragging && far) begin();
    if (!dragging) return;
    ev.preventDefault();
    tilt += ((ev.clientX - lastX) * 0.9 - tilt) * 0.3;
    lastX = ev.clientX;
    place(ev.clientX, ev.clientY);
    hover(ev.clientX, ev.clientY);
  };
  const up = async (ev) => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    touchDragging = false;
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    if (!dragging) return go(`#/offres/${cardEl.dataset.id}`);
    document.body.classList.remove('dragging');
    view.querySelector('#board')?.classList.remove('drag');
    over?.classList.remove('over');
    const id = cardEl.dataset.id;
    const app = S.applications.find((a) => a.id === id);
    const target = over?.dataset.status;
    if (!target || target === app.status) {
      // Back where it came from.
      const r = cardEl.getBoundingClientRect();
      await ghost.animate([{ transform: ghost.style.transform }, { transform: `translate3d(${r.left}px, ${r.top}px, 0) rotate(0deg) scale(1)` }], { duration: 320, easing: 'cubic-bezier(.32,.72,0,1)' }).finished.catch(() => {});
      ghost.remove();
      cardEl.classList.remove('ph');
      return;
    }
    const from = rects();
    const gr = ghost.getBoundingClientRect();
    const wasSent = SENT.includes(app.status);
    try {
      const res = await api(`/applications/${id}`, { method: 'PUT', body: { status: target } });
      upsertApp(res);
    } catch (err) {
      ghost.remove();
      cardEl.classList.remove('ph');
      return fail(err);
    }
    redraw();
    const dropped = view.querySelector(`.kcard[data-id="${id}"]`);
    ghost.remove();
    if (dropped) {
      dropped.style.opacity = 0;
      const to = dropped.getBoundingClientRect();
      await dropped.animate([{ transform: `translate(${gr.left - to.left}px, ${gr.top - to.top}px) rotate(${tilt}deg) scale(1.04)`, opacity: 1 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' }).finished.catch(() => {});
      dropped.style.opacity = '';
      cheer(target, wasSent, to);
    }
  };
  addEventListener('pointermove', move, { passive: false });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  if (touch) timer = setTimeout(begin, 320); // long press: the card is picked up
}

// A moment of joy when something good happens.
function cheer(target, wasSent, r) {
  const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const sent = S.applications.filter((a) => SENT.includes(a.status)).length;
  if (target === 'rejected') return toast('Pas grave : la bonne arrive.');
  cheerStatus(target, { wasSent, sent, at });
}
