import { api, fail, toast, hooks } from './lib.js';
import { renderToday } from './views/today.js';
import { renderOffers } from './views/offers.js';
import { renderBoard } from './views/board.js';
import { renderProfile } from './views/profile.js';
import { renderSettings } from './views/settings.js';
import { openOffer, closeOffer } from './views/offer-sheet.js';
import { needsOnboarding, startOnboarding } from './views/onboarding.js';
import { watch } from './decorate.js';
import { openSearch, handleProgress, finishSearch, abortSearch, isSearching, isMinimized, progressInfo, stopSearch } from './views/searching.js';
import { petHead, petOf } from './pet.js';

// Shared client state, loaded once and kept in sync with server responses.
export const S = { profile: null, settings: null, secrets: null, domains: [], applications: [] };

// The companion in the header follows the profile.
export function refreshNav() {
  const el = document.getElementById('nav-avatar');
  if (el && S.profile) el.innerHTML = petHead(petOf(S.profile), 30).toString();
}

export function upsertApp(app) {
  const i = S.applications.findIndex((a) => a.id === app.id);
  if (i === -1) S.applications.unshift(app);
  else S.applications[i] = app;
}

const routes = {
  '': renderToday,
  offres: renderOffers,
  suivi: renderBoard,
  profil: renderProfile,
  reglages: renderSettings,
};

let currentPage = null;
let booted = false;

// Hash routes: #/offres, #/offres/<id>, #/profil, #/reglages
export function route() {
  const [page = '', id, tab] = location.hash.replace(/^#\/?/, '').split('/');
  const view = document.getElementById('view');
  if (page !== currentPage || !id) {
    const changed = page !== currentPage;
    currentPage = page;
    const draw = () => {
      (routes[page] || renderToday)(view);
      document.querySelectorAll('.nav-links a').forEach((a) => {
        const target = a.getAttribute('href').replace(/^#\/?/, '');
        if (target === page) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    };
    // Pages cross-fade (View Transitions) once the app is up; the first paint is immediate.
    if (changed && !id && booted && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(draw);
    else draw();
  }
  if (page === 'offres' && id) openOffer(id, tab);
  else closeOffer();
}

// Re-renders the current page without touching the sheet.
export function refreshPage() {
  const page = location.hash.replace(/^#\/?/, '').split('/')[0];
  (routes[page] || renderToday)(document.getElementById('view'));
}

export function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ---------- Offer search (streams progress from the server) ----------

let source = null;
export function startSearch() {
  if (source) {
    // A search is running: bring its screen back.
    if (isSearching() && isMinimized()) document.querySelector('.srch')?.classList.remove('min'), document.body.classList.add('ob-open');
    return;
  }
  if (!S.profile.search.domain && !S.profile.search.keywords.length) {
    toast('Choisis d\'abord un domaine ou des mots-clés dans ton profil.');
    go('#/profil');
    return;
  }
  const box = document.getElementById('activity');
  const log = document.getElementById('activity-log');
  const title = document.getElementById('activity-title');
  const btn = document.getElementById('search-btn');
  title.textContent = 'Recherche en cours';
  document.getElementById('activity-stop').onclick = stopSearch;
  log.textContent = '';
  btn.disabled = true;

  // The full-screen search scene; minimising it falls back to the small progress card.
  openSearch({
    onMinimize: () => {
      box.hidden = false;
      requestAnimationFrame(() => box.classList.add('open'));
    },
  });
  const hideCard = () => {
    box.classList.remove('open');
    setTimeout(() => (box.hidden = true), 300);
  };
  const finish = () => {
    source.close();
    source = null;
    btn.disabled = false;
    hideCard();
  };

  source = hooks.fakeSearch ? hooks.fakeSearch() : new EventSource('/api/search');
  source.addEventListener('log', (e) => {
    const line = document.createElement('div');
    line.textContent = JSON.parse(e.data).line;
    log.append(line);
    while (log.children.length > 6) log.firstChild.remove();
  });
  source.addEventListener('progress', (e) => {
    handleProgress(JSON.parse(e.data));
    title.textContent = `Recherche en cours · ${progressInfo().pct.toFixed(0)} %`;
  });
  source.addEventListener('done', async (e) => {
    const { added, merged = 0, stopped = false } = JSON.parse(e.data);
    finish();
    S.applications = await api('/applications');
    refreshPage();
    finishSearch({ added, merged, stopped, onSee: () => go('#/offres') });
  });
  source.addEventListener('error', (e) => {
    const msg = e.data ? JSON.parse(e.data).message : 'La recherche a été interrompue.';
    finish();
    abortSearch();
    fail(new Error(msg));
  });
}

document.getElementById('search-btn').addEventListener('click', startSearch);
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.querySelector('.sheet.open') && !document.querySelector('.modal')) go('#/offres');
});

(async () => {
  try {
    Object.assign(S, await api('/state'));
    watch(document.getElementById('view'));
    refreshNav();
    document.getElementById('guide-btn').addEventListener('click', () => startOnboarding({ tour: true }));
    route();
    booted = true;
    if (needsOnboarding()) startOnboarding();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty"><strong>Serveur injoignable</strong>Lance « npm start » puis recharge la page.</div>`;
  }
})();
