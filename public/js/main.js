import { api, fail, toast } from './lib.js';
import { renderToday } from './views/today.js';
import { renderOffers } from './views/offers.js';
import { renderProfile } from './views/profile.js';
import { renderSettings } from './views/settings.js';
import { openOffer, closeOffer } from './views/offer-sheet.js';
import { needsOnboarding, startOnboarding } from './views/onboarding.js';

// Shared client state, loaded once and kept in sync with server responses.
export const S = { profile: null, settings: null, secrets: null, domains: [], applications: [] };

export function upsertApp(app) {
  const i = S.applications.findIndex((a) => a.id === app.id);
  if (i === -1) S.applications.unshift(app);
  else S.applications[i] = app;
}

const routes = {
  '': renderToday,
  offres: renderOffers,
  profil: renderProfile,
  reglages: renderSettings,
};

let currentPage = null;

// Hash routes: #/offres, #/offres/<id>, #/profil, #/reglages
export function route() {
  const [page = '', id, tab] = location.hash.replace(/^#\/?/, '').split('/');
  const view = document.getElementById('view');
  if (page !== currentPage || !id) {
    currentPage = page;
    (routes[page] || renderToday)(view);
    document.querySelectorAll('.nav-links a').forEach((a) => {
      const target = a.getAttribute('href').replace(/^#\/?/, '');
      if (target === page) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
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
  if (source) return;
  if (!S.profile.search.domain && !S.profile.search.keywords.length) {
    toast('Choisis d\'abord un domaine ou des mots-clés dans ton profil.');
    go('#/profil');
    return;
  }
  const box = document.getElementById('activity');
  const log = document.getElementById('activity-log');
  const title = document.getElementById('activity-title');
  const btn = document.getElementById('search-btn');
  box.hidden = false;
  requestAnimationFrame(() => box.classList.add('open'));
  title.textContent = 'Recherche en cours';
  log.textContent = '';
  btn.disabled = true;

  const finish = () => {
    source.close();
    source = null;
    btn.disabled = false;
    box.classList.remove('open');
    setTimeout(() => (box.hidden = true), 300);
  };

  source = new EventSource('/api/search');
  source.addEventListener('log', (e) => {
    const line = document.createElement('div');
    line.textContent = JSON.parse(e.data).line;
    log.append(line);
    while (log.children.length > 6) log.firstChild.remove();
  });
  source.addEventListener('done', async (e) => {
    const { added, merged = 0 } = JSON.parse(e.data);
    finish();
    S.applications = await api('/applications');
    toast((added ? `${added} nouvelle${added > 1 ? 's' : ''} offre${added > 1 ? 's' : ''}` : 'Aucune nouvelle offre pour le moment') + (merged ? ` · ${merged} doublon${merged > 1 ? 's' : ''} fusionné${merged > 1 ? 's' : ''}` : ''));
    refreshPage();
  });
  source.addEventListener('error', (e) => {
    const msg = e.data ? JSON.parse(e.data).message : 'La recherche a été interrompue.';
    finish();
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
    route();
    if (needsOnboarding()) startOnboarding();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty"><strong>Serveur injoignable</strong>Lance « npm start » puis recharge la page.</div>`;
  }
})();
