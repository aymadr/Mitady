import { S, upsertApp, go } from '../main.js';
import { html, mount, api, busy, fail, toast, icons, avatar, miniRing, relDate, norm } from '../lib.js';
import { openModal, closeModal } from './modal.js';

const FILTERS = [
  { id: 'todo', label: 'À traiter', test: (a) => a.status === 'todo' },
  { id: 'active', label: 'En cours', test: (a) => a.status === 'applied' || a.status === 'interview' },
  { id: 'closed', label: 'Terminées', test: (a) => a.status === 'offer' || a.status === 'rejected' },
  { id: 'archived', label: 'Écartées', test: (a) => a.status === 'archived' },
  { id: 'all', label: 'Toutes', test: (a) => a.status !== 'archived' },
];

// View state survives re-renders within the session.
const ui = { filter: 'todo', query: '', sort: 'score' };

function statusSide(a) {
  if (a.followUpDue) return html`<span class="badge orange">À relancer</span>`;
  if (a.status === 'applied') return html`<span class="badge">Envoyée ${relDate(a.appliedAt)}</span>`;
  if (a.status === 'interview') return html`<span class="badge blue">Entretien</span>`;
  if (a.status === 'offer') return html`<span class="badge green">Offre reçue</span>`;
  if (a.status === 'rejected') return html`<span class="badge">Refusée</span>`;
  return '';
}

function rows(list) {
  if (!list.length) {
    const empty = {
      todo: ['Tout est traité', 'Lance une recherche ou ajoute une offre à la main.'],
      active: ['Aucune candidature en cours', 'Les offres auxquelles tu postules apparaîtront ici.'],
      closed: ['Rien pour l\'instant', 'Les offres reçues et les refus apparaîtront ici.'],
      archived: ['Aucune offre écartée', 'Écarte une offre pour la sortir de ta liste sans la supprimer.'],
      all: ['Aucune offre', 'Lance une recherche pour commencer.'],
    }[ui.filter];
    return html`<div class="empty"><strong>${ui.query ? 'Aucun résultat' : empty[0]}</strong>${ui.query ? `Rien ne correspond à « ${ui.query} ».` : empty[1]}</div>`;
  }
  return list.map(
    (a) => html`<a class="item" href="#/offres/${a.id}">
      ${avatar(a.company)}
      <div class="item-main">
        <div class="item-title">${a.title}</div>
        <div class="item-sub">${a.company}${a.location ? ` · ${a.location}` : ''} · ${a.source}${a.contract ? ` · ${a.contract}` : ''} · ${relDate(a.addedAt)}</div>
      </div>
      <div class="item-side">
        ${statusSide(a)}
        ${miniRing(a.score)}
        ${icons.chevron}
      </div>
    </a>`,
  );
}

function visible() {
  const f = FILTERS.find((x) => x.id === ui.filter);
  const q = norm(ui.query);
  const list = S.applications.filter((a) => f.test(a) && (!q || norm(`${a.title} ${a.company} ${a.location}`).includes(q)));
  return list.sort((a, b) =>
    ui.sort === 'score' ? (b.score ?? -1) - (a.score ?? -1) || b.addedAt.localeCompare(a.addedAt) : b.addedAt.localeCompare(a.addedAt),
  );
}

export function renderOffers(view) {
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, S.applications.filter(f.test).length]));
  mount(
    view,
    html`<div class="page-head">
        <div><h1 class="page-title">Offres</h1></div>
        <div class="row">
          <button class="btn btn-secondary btn-sm" id="dedupe" data-busy="Fusion…">Fusionner les doublons</button>
          <a class="btn btn-secondary btn-sm" href="/api/export.xlsx" download>Exporter</a>
          <button class="btn btn-secondary btn-sm" id="add-offer">${icons.plus} Ajouter une offre</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Filtrer">
          ${FILTERS.map((f) => html`<button aria-pressed="${ui.filter === f.id}" data-filter="${f.id}">${f.label}<span class="count">${counts[f.id]}</span></button>`)}
        </div>
        <div class="search-field">${icons.search}<input class="input" id="q" placeholder="Rechercher" value="${ui.query}"></div>
        <div class="segmented" role="group" aria-label="Trier">
          <button aria-pressed="${ui.sort === 'score'}" data-sort="score">Correspondance</button>
          <button aria-pressed="${ui.sort === 'date'}" data-sort="date">Récentes</button>
        </div>
      </div>
      <div class="group" id="list">${rows(visible())}</div>`,
  );

  const list = view.querySelector('#list');
  view.querySelector('#dedupe').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      try {
        const res = await api('/applications/dedupe', { method: 'POST' });
        S.applications = res.applications;
        toast(res.removed ? `${res.removed} doublon${res.removed > 1 ? 's' : ''} fusionné${res.removed > 1 ? 's' : ''}` : 'Aucun doublon');
        renderOffers(view);
      } catch (err) {
        fail(err);
      }
    }),
  );
  view.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.filter = b.dataset.filter;
      renderOffers(view);
    }),
  );
  view.querySelectorAll('[data-sort]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.sort = b.dataset.sort;
      renderOffers(view);
    }),
  );
  view.querySelector('#q').addEventListener('input', (e) => {
    ui.query = e.target.value;
    mount(list, rows(visible()));
  });
  view.querySelector('#add-offer').addEventListener('click', addOfferModal);
}

function addOfferModal() {
  const card = openModal(html`
    <h2 class="modal-title">Ajouter une offre</h2>
    <form id="add-form">
      <label class="field"><span class="label">Intitulé du poste</span><input class="input" name="title" required></label>
      <div class="grid-2" style="margin-top:16px">
        <label class="field"><span class="label">Entreprise</span><input class="input" name="company" required></label>
        <label class="field"><span class="label">Lieu</span><input class="input" name="location"></label>
      </div>
      <label class="field" style="margin-top:16px"><span class="label">Lien de l'annonce</span><input class="input" name="link" type="url" placeholder="https://"></label>
      <label class="field"><span class="label">Description</span><textarea class="textarea" name="description" rows="7" placeholder="Colle le texte de l'annonce : il sert à calculer ta correspondance et à adapter ton CV."></textarea></label>
      <div class="form-foot">
        <button type="button" class="btn btn-secondary" data-close>Annuler</button>
        <button class="btn btn-primary">Ajouter</button>
      </div>
    </form>`);
  card.querySelector('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const created = await api('/applications', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      upsertApp(created);
      closeModal();
      toast('Offre ajoutée');
      go(`#/offres/${created.id}`);
    } catch (err) {
      fail(err);
    }
  });
}

