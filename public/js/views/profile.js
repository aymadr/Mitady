import { S, refreshNav } from '../main.js';
import { siteLogo } from '../logos.js';
import { mountPetEditor } from '../pet.js';
import { update, setSaveIndicator } from '../profile-store.js';
import { refreshPerches } from '../decorate.js';
import { placePicker } from '../places.js';
import { html, raw, mount, chipInput } from '../lib.js';

const CONTRACTS = ['Alternance', 'Stage', 'CDI', 'CDD', 'Freelance'];
const REMOTE = [['any', 'Peu importe'], ['hybrid', 'Possible'], ['remote', 'Complet'], ['onsite', 'Sur place']];
const REMOTE_HINT = {
  any: 'Toutes les offres, avec ou sans télétravail.',
  hybrid: 'Garde les annonces qui parlent de télétravail, partiel ou complet.',
  remote: 'Seulement les offres entièrement à distance : le périmètre ne les écarte pas.',
  onsite: 'Écarte les annonces qui proposent du télétravail.',
};
const POSTED = [[0, 'Peu importe'], [1, 'Les dernières 24 heures'], [3, 'Les 3 derniers jours'], [7, 'La dernière semaine'], [14, 'Les 2 dernières semaines'], [30, 'Le dernier mois']];
const MIN_SCORE = [[0, 'Toutes les offres'], [30, '30 % ou plus'], [50, '50 % ou plus'], [70, '70 % ou plus']];
const MAX_OFFERS = [[30, '30 (recherche rapide)'], [60, '60'], [100, '100'], [150, '150 (plus long)']];
const SEARCH_DEFAULTS = { posted: 0, maxOffers: 60, minScore: 0 };

export function renderProfile(view) {
  const p = S.profile;
  const domain = S.domains.find((d) => d.id === p.search.domain);

  mount(
    view,
    html`<div class="page-head">
        <div><h1 class="page-title">Profil</h1><p class="page-sub">Ce que tu cherches, et ton compagnon. Ton CV et ta lettre ont leur propre page.</p></div>
        <span class="saved" id="saved"></span>
      </div>

      <section>
        <div class="section-head"><h2 class="section-title">Ton animal</h2><span class="section-note">Il se perche sur tes barres de recherche</span></div>
        <div class="card" id="avatar-editor"></div>
      </section>

      <section class="section" id="recherche">
        <div class="section-head"><h2 class="section-title">Ce que tu cherches</h2></div>
        <div class="card">
          <label class="field"><span class="label">Domaine</span>
            <select class="select" id="domain">
              <option value="">Choisir…</option>
              ${S.domains.map((d) => html`<option value="${d.id}" ${p.search.domain === d.id ? raw('selected') : ''}>${d.label}</option>`)}
              <option value="autre" ${p.search.domain === 'autre' ? raw('selected') : ''}>Autre</option>
            </select></label>
          <div class="field" style="margin-top:16px"><span class="label">Où cherches-tu ?</span><div id="places"></div></div>
          <div class="field" style="margin-top:16px"><span class="label">Télétravail</span>
            <div class="segmented" id="remote" role="group" aria-label="Télétravail">${REMOTE.map(([v, l]) => html`<button type="button" data-v="${v}" aria-pressed="${p.search.remote === v}">${l}</button>`)}</div>
            <p class="hint" id="remote-hint">${REMOTE_HINT[p.search.remote]}</p>
          </div>
          <div class="field" style="margin-top:16px"><span class="label">Contrat</span>
            <div class="chips" id="contracts">${CONTRACTS.map((c) => html`<button class="chip ${p.search.contracts.includes(c) ? 'on' : 'suggest'}" data-v="${c}" aria-pressed="${p.search.contracts.includes(c)}">${c}</button>`)}</div>
            <p class="hint">Coche plusieurs types pour chercher en même temps, par exemple alternance et stage.</p>
          </div>
          <div class="field"><span class="label">Sites de recherche</span>
            <div class="chips" id="sources">${S.sources.map((src) => html`<button class="chip ${activeSources(p).includes(src.id) ? 'on' : 'suggest'}" data-v="${src.id}" aria-pressed="${activeSources(p).includes(src.id)}">${siteLogo(src.label, 20)}${src.label}</button>`)}</div>
            <p class="hint">Plus tu actives de sites, plus la recherche est longue. Une même offre publiée sur plusieurs sites n'apparaît qu'une fois.</p>
          </div>
          <div class="field"><span class="label">Mots-clés de recherche</span><div id="keywords"></div>
            <p class="hint">${domain ? `Vide = mots-clés par défaut : ${domain.keywords.join(', ')}.` : 'Un intitulé ou un métier par mot-clé.'}</p></div>
          <div class="field"><span class="label">Entreprises à ignorer</span><div id="excluded"></div>
            <p class="hint">Les écoles et organismes de formation qui publient de fausses offres sont exclus par défaut.</p></div>
          <details class="adv" ${['posted', 'maxOffers', 'minScore'].some((k) => p.search[k] !== SEARCH_DEFAULTS[k]) ? raw('open') : ''}><summary>Plus de réglages de recherche</summary>
            <div class="adv-body">
              <div class="grid-2">
                <label class="field"><span class="label">Offres publiées depuis</span>
                  <select class="select" id="posted">${POSTED.map(([v, l]) => html`<option value="${v}" ${Number(p.search.posted) === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
                <label class="field"><span class="label">Correspondance minimale</span>
                  <select class="select" id="minScore">${MIN_SCORE.map(([v, l]) => html`<option value="${v}" ${Number(p.search.minScore) === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
              </div>
              <label class="field"><span class="label">Offres lues à chaque recherche</span>
                <select class="select" id="maxOffers">${MAX_OFFERS.map(([v, l]) => html`<option value="${v}" ${Number(p.search.maxOffers) === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
              <p class="hint">La date n'est connue que de certains sites (LinkedIn, Indeed). La correspondance minimale écarte, à la recherche, les offres qui demandent trop de compétences que tu n'as pas. Plus tu lis d'offres, plus la recherche est longue.</p>
            </div>
          </details>
        </div>
      </section>
`,
  );

  setSaveIndicator(view.querySelector('#saved'));
  mountPetEditor(view.querySelector('#avatar-editor'), {
    pet: p.pet,
    big: false,
    onChange: (pet) => {
      update({ pet });
      refreshNav();
      refreshPerches();
    },
  });
  const search = (patch) => update({ search: { ...S.profile.search, ...patch } });
  view.querySelector('#domain').addEventListener('change', (e) => {
    search({ domain: e.target.value });
    renderProfile(view);
  });
  placePicker(view.querySelector('#places'), {
    places: p.search.places || [],
    radius: p.search.radius ?? 30,
    onChange: ({ places, radius }) => search({ places, radius, location: places.map((x) => x.name).join(', ') }),
  });
  view.querySelectorAll('#remote [data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      view.querySelectorAll('#remote [data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      view.querySelector('#remote-hint').textContent = REMOTE_HINT[b.dataset.v];
      search({ remote: b.dataset.v });
    }),
  );
  for (const id of ['posted', 'minScore', 'maxOffers']) view.querySelector('#' + id).addEventListener('change', (e) => search({ [id]: Number(e.target.value) }));
  toggleGroup(view.querySelector('#contracts'), () => search({ contracts: [...view.querySelectorAll('#contracts [aria-pressed="true"]')].map((b) => b.dataset.v) }), 1);
  toggleGroup(view.querySelector('#sources'), () => search({ sources: [...view.querySelectorAll('#sources [aria-pressed="true"]')].map((b) => b.dataset.v) }), 1);
  chipInput(view.querySelector('#keywords'), [...p.search.keywords], (keywords) => search({ keywords }), { placeholder: 'Ajouter un mot-clé' });
  chipInput(view.querySelector('#excluded'), [...p.search.excluded], (excluded) => search({ excluded }), { placeholder: 'Ajouter une entreprise' });

  if (location.hash.endsWith('/recherche')) view.querySelector('#recherche').scrollIntoView({ block: 'start' });
}

const activeSources = (p) => (Array.isArray(p.search.sources) ? p.search.sources : S.sources.filter((x) => x.on).map((x) => x.id));

// Multi-select chips; `min` keeps at least that many selected.
function toggleGroup(group, onChange, min = 0) {
  group.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      if (!on && group.querySelectorAll('[aria-pressed="true"]').length <= min) return;
      b.setAttribute('aria-pressed', on);
      b.classList.toggle('on', on);
      b.classList.toggle('suggest', !on);
      onChange();
    }),
  );
}

function segmented(group, onPick) {
  group.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      onPick(b.dataset.v);
    }),
  );
}
